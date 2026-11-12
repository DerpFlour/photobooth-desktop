import { randomBytes } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { getSettings } from './settings'
import { cloudQueue, getSession, resolveSessionFile, setCloud } from './storage'

type Cfg = { base: string; key: string; retentionDays: number }
type Ticket = { path: string; token: string }
type Registered = {
  supabaseUrl: string
  publishableKey: string
  bucket: string
  expiresAt: string
  uploads: { strip: Ticket; clip?: Ticket }
}

// A new secret link token: 128 random bits as 22 URL-safe characters.
// The booth makes it itself, so the QR code works even with no internet.
export const newToken = (): string => randomBytes(16).toString('base64url')

// Accepts "photobooth-gallery-lac.vercel.app", a full link, or even a guest
// link, and keeps just the website address.
export function normalizeBase(input: string): string {
  const text = input.trim()
  if (!text) return ''
  try {
    return new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`).origin
  } catch {
    return text
  }
}

// The booth key travels with every request, so insist on https
// (plain http is only allowed for testing on this computer).
function secureEnough(base: string): boolean {
  try {
    const u = new URL(base)
    return u.protocol === 'https:' || u.hostname === 'localhost' || u.hostname === '127.0.0.1'
  } catch {
    return false
  }
}

function config(requireEnabled = true): Cfg | null {
  const s = getSettings()
  if (requireEnabled && !s.cloudEnabled) return null
  const base = normalizeBase(s.cloudBaseUrl)
  if (!base || !s.cloudBoothKey || !secureEnough(base)) return null
  return { base, key: s.cloudBoothKey, retentionDays: s.cloudRetentionDays }
}

function explain(status: number): string {
  if (status === 401) return 'The booth key was rejected. Check it in the admin settings.'
  if (status === 404) return 'The website address looks wrong (page not found).'
  if (status >= 500) return 'The website had a problem. It will retry automatically.'
  return `The website answered with an error (${status}).`
}

async function call<T>(cfg: Cfg, method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${cfg.base}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${cfg.key}`,
        ...(body ? { 'content-type': 'application/json' } : {})
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(30_000)
    })
  } catch {
    throw new Error('No internet connection (or the website address is wrong).')
  }
  if (!res.ok) throw new Error(explain(res.status))
  return (await res.json()) as T
}

async function put(
  client: SupabaseClient,
  bucket: string,
  ticket: Ticket,
  bytes: Buffer,
  contentType: string
): Promise<void> {
  const { error } = await client.storage.from(bucket).uploadToSignedUrl(ticket.path, ticket.token, bytes, { contentType })
  if (error) throw new Error(`The upload was refused: ${error.message}`)
}

// ---------------------------------------------------------------------------
// Sharing a session
// ---------------------------------------------------------------------------

// Called when a guest reaches the result screen. Returns the link for the QR
// code immediately (no internet needed) and queues the upload.
export function shareSession(id: string): CloudInfo | null {
  const cfg = config()
  const record = getSession(id)
  if (!cfg || !record) return null

  let cloud = record.cloud
  if (!cloud || cloud.base !== cfg.base) {
    const token = cloud?.token ?? newToken()
    cloud = { token, base: cfg.base, url: `${cfg.base}/s/${token}`, status: 'pending', rev: (cloud?.rev ?? 0) + 1, attempts: 0 }
    setCloud(id, cloud)
  }
  kickQueue()
  return cloud
}

// ---------------------------------------------------------------------------
// The upload queue
// ---------------------------------------------------------------------------

// Newest first, so the guest standing at the booth is served before old retries.
function nextEligible(cfg: Cfg): SessionRecord | undefined {
  const now = Date.now()
  const tooLate = cfg.retentionDays * 86_400_000
  return cloudQueue()
    .filter((r) => r.cloud && r.cloud.base === cfg.base)
    .filter((r) => now - r.createdAt < tooLate) // the link would already have expired
    .filter((r) => !r.cloud?.nextTry || r.cloud.nextTry <= now)
    .sort((a, b) => b.createdAt - a.createdAt)[0]
}

async function uploadOne(id: string, cfg: Cfg): Promise<void> {
  const record = getSession(id)
  const start = record?.cloud
  if (!record || !start) return
  setCloud(id, { ...start, status: 'uploading', attempts: start.attempts + 1, error: undefined, nextTry: undefined })

  try {
    const stripFile = resolveSessionFile(record.stripPath)
    if (!stripFile || !existsSync(stripFile)) throw new Error('The saved photo strip file is missing.')
    const clipFile = record.gifPath ? resolveSessionFile(record.gifPath) : null
    const hasClip = !!clipFile && existsSync(clipFile)
    const ext = record.stripPath.toLowerCase().endsWith('.png') ? 'png' : 'jpg'

    // 1. Tell the website about this session; it returns one-time upload tickets.
    const reg = await call<Registered>(cfg, 'POST', '/api/sessions', {
      token: start.token,
      boothSessionId: id,
      stripExt: ext,
      hasClip,
      retentionDays: cfg.retentionDays
    })

    // 2. Upload the files straight to storage using those tickets.
    const client = createClient(reg.supabaseUrl, reg.publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: (input, init) => fetch(input, { ...init, signal: init?.signal ?? AbortSignal.timeout(120_000) }) }
    })
    await put(client, reg.bucket, reg.uploads.strip, readFileSync(stripFile), ext === 'png' ? 'image/png' : 'image/jpeg')
    if (hasClip && clipFile && reg.uploads.clip) {
      await put(client, reg.bucket, reg.uploads.clip, readFileSync(clipFile), 'image/gif')
    }

    // 3. The website checks the files arrived and marks the link ready.
    await call(cfg, 'POST', '/api/sessions/complete', { token: start.token })

    // If the session was saved again while we were uploading, these pictures
    // are already out of date: leave it pending and the queue sends the new ones.
    const latest = getSession(id)?.cloud
    if (!latest || latest.rev !== start.rev) return
    setCloud(id, { ...latest, status: 'ready', error: undefined, nextTry: undefined, expiresAt: reg.expiresAt })
  } catch (e) {
    const latest = getSession(id)?.cloud
    if (!latest || latest.rev !== start.rev) return
    setCloud(id, {
      ...latest,
      status: 'failed',
      error: e instanceof Error ? e.message : String(e),
      // wait a little longer after each failure, up to 5 minutes
      nextTry: Date.now() + Math.min(5 * 60_000, latest.attempts * 30_000)
    })
  }
}

let running = false

export async function processQueue(): Promise<void> {
  if (running) return
  const cfg = config()
  if (!cfg) return
  running = true
  try {
    for (let guard = 0; guard < 200; guard++) {
      const next = nextEligible(cfg)
      if (!next) break
      await uploadOne(next.id, cfg)
    }
  } finally {
    running = false
  }
}

export const kickQueue = (): void => {
  void processQueue()
}

// Called once at startup: anything left "uploading" was interrupted by the
// app closing, so put it back in line. Then check the queue every minute.
export function startCloudQueue(): void {
  for (const r of cloudQueue()) {
    if (r.cloud?.status === 'uploading') setCloud(r.id, { ...r.cloud, status: 'pending' })
  }
  kickQueue()
  setInterval(kickQueue, 60_000)
}

export function queueSummary(): CloudQueue {
  const list = cloudQueue()
  return {
    waiting: list.filter((r) => r.cloud?.status === 'pending' || r.cloud?.status === 'uploading').length,
    failed: list.filter((r) => r.cloud?.status === 'failed').length
  }
}

// "Retry now": forget the waiting time of failed uploads and go again.
export function retryNow(): void {
  for (const r of cloudQueue()) {
    if (r.cloud?.status === 'failed') setCloud(r.id, { ...r.cloud, nextTry: undefined })
  }
  kickQueue()
}

// ---------------------------------------------------------------------------
// Admin helpers
// ---------------------------------------------------------------------------
export async function testConnection(): Promise<CloudTestResult> {
  const s = getSettings()
  const base = normalizeBase(s.cloudBaseUrl)
  if (!base) return { ok: false, message: 'Type the website address first.' }
  if (!secureEnough(base)) return { ok: false, message: 'The address must start with https://' }
  if (!s.cloudBoothKey) return { ok: false, message: 'Type the booth key first.' }
  const cfg = config(false)
  if (!cfg) return { ok: false, message: 'The online settings are incomplete.' }
  try {
    await call(cfg, 'GET', '/api/health')
    return { ok: true, message: 'Connected ✓ The website and its database are working.' }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) }
  }
}

// Deletes a guest's online copy right away. Returns false if it couldn't
// (for example offline); the copy then simply expires on its own.
export async function deleteRemote(token: string): Promise<boolean> {
  const cfg = config(false)
  if (!cfg) return false
  try {
    await call(cfg, 'POST', '/api/sessions/delete', { token })
    return true
  } catch {
    return false
  }
}

export async function deleteRemotes(tokens: string[]): Promise<void> {
  for (const token of tokens) await deleteRemote(token)
}