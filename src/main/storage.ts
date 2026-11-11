import { app } from 'electron'
import {
  existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync
} from 'node:fs'
import { statfs } from 'node:fs/promises'
import { dirname, join, normalize, sep } from 'node:path'
import { getSettings } from './settings'

const MB = 1024 * 1024
const userRoot = (): string => app.getPath('userData')
export const sessionsDir = (): string => join(userRoot(), 'sessions')
const indexFile = (): string => join(userRoot(), 'data', 'sessions.json')

// The list of saved sessions, newest first. Kept in memory, saved to disk.
let records: SessionRecord[] = []

function persist(): void {
  mkdirSync(dirname(indexFile()), { recursive: true })
  const temp = indexFile() + '.tmp'
  writeFileSync(temp, JSON.stringify(records))
  renameSync(temp, indexFile()) // a crash can't leave a half-written list
}

export function loadSessions(): void {
  try {
    const raw = JSON.parse(readFileSync(indexFile(), 'utf8'))
    records = Array.isArray(raw)
      ? raw.filter((r) => r && typeof r.id === 'string' && typeof r.stripPath === 'string')
      : []
  } catch {
    records = [] // first run, or unreadable file
  }
  records.sort((a, b) => b.createdAt - a.createdAt)
}

// Ids become folder names, so only allow safe characters.
const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/

// Turns a stored relative path into a real file path, but ONLY inside the
// sessions folder. Anything else returns null (blocks "../" tricks).
export function resolveSessionFile(relativePath: string): string | null {
  const full = normalize(join(userRoot(), relativePath))
  return full.startsWith(sessionsDir() + sep) ? full : null
}

export function saveSession(input: SessionSaveInput): SessionRecord {
  if (!input || !ID_PATTERN.test(input.id)) throw new Error('Invalid session id')
  const dir = join(sessionsDir(), input.id)
  rmSync(dir, { recursive: true, force: true }) // saving again replaces the old save
  mkdirSync(dir, { recursive: true })

  const stripName = `strip.${input.ext === 'png' ? 'png' : 'jpg'}`
  writeFileSync(join(dir, stripName), Buffer.from(input.strip))
  writeFileSync(join(dir, 'thumb.jpg'), Buffer.from(input.thumb))
  let total = input.strip.byteLength + input.thumb.byteLength

  const hasGif = !!input.gif && input.gif.byteLength > 0
  if (hasGif && input.gif) {
    writeFileSync(join(dir, 'clip.gif'), Buffer.from(input.gif))
    total += input.gif.byteLength
  }
  input.originals.forEach((photo, i) => {
    writeFileSync(join(dir, `photo-${i + 1}.jpg`), Buffer.from(photo))
    total += photo.byteLength
  })

  // Make sure everything we are about to promise really is on disk.
  for (const name of [stripName, 'thumb.jpg', ...(hasGif ? ['clip.gif'] : [])]) {
    if (!existsSync(join(dir, name))) throw new Error(`Saving failed: ${name} was not written to disk.`)
  }

  const record: SessionRecord = {
    id: input.id,
    createdAt: Date.now(),
    layoutId: input.layoutId,
    templateId: input.templateId,
    stripPath: `sessions/${input.id}/${stripName}`,
    thumbPath: `sessions/${input.id}/thumb.jpg`,
    gifPath: hasGif ? `sessions/${input.id}/clip.gif` : undefined,
    width: input.width,
    height: input.height,
    bytes: total,
    photoCount: input.photoCount,
    originalsKept: input.originals.length > 0
  }
  records = [record, ...records.filter((r) => r.id !== input.id)]
  persist()

  // Cleanup runs in the background and never deletes the session just saved.
  pruneStorage(input.id).catch((e) => console.warn('[storage] cleanup failed', e))
  return record
}

export const listSessions = (limit: number): SessionRecord[] => records.slice(0, Math.max(0, limit))

// Deletes just the behind-the-scenes clip from a saved session.
export function removeClip(id: string): SessionRecord | null {
  const record = records.find((r) => r.id === id)
  if (!record || !record.gifPath) return record ?? null
  let size = 0
  const full = resolveSessionFile(record.gifPath)
  try {
    if (full) {
      size = statSync(full).size
      rmSync(full, { force: true })
    }
  } catch (e) {
    console.warn('[storage] could not remove clip', e)
  }
  record.gifPath = undefined
  record.bytes = Math.max(0, record.bytes - size)
  persist()
  return record
}

export function deleteSession(id: string): void {
  if (!ID_PATTERN.test(id)) return
  rmSync(join(sessionsDir(), id), { recursive: true, force: true })
  records = records.filter((r) => r.id !== id)
  persist()
}

export function deleteAllSessions(): void {
  rmSync(sessionsDir(), { recursive: true, force: true })
  records = []
  persist()
}

async function disk(): Promise<{ free: number; total: number }> {
  const s = await statfs(userRoot())
  return { free: s.bavail * s.bsize, total: s.blocks * s.bsize }
}

export async function storageSummary(): Promise<StorageSummary> {
  const { free, total } = await disk()
  return {
    sessionCount: records.length,
    usedBytes: records.reduce((sum, r) => sum + r.bytes, 0),
    freeBytes: free,
    diskBytes: total
  }
}

// Deletes the OLDEST sessions according to the settings. Does nothing when
// "automatic cleanup" is off. Returns how many were deleted.
export async function pruneStorage(protectId?: string): Promise<number> {
  const s = getSettings()
  if (!s.autoPrune) return 0
  let deleted = 0
  const remove = (r: SessionRecord): void => {
    if (r.id === protectId) return
    deleteSession(r.id)
    deleted++
  }

  // 1. Too old
  if (s.retentionDays > 0) {
    const cutoff = Date.now() - s.retentionDays * 24 * 60 * 60 * 1000
    records.filter((r) => r.createdAt < cutoff).forEach(remove)
  }
  // 2. Too many
  if (records.length > s.maxSessions) {
    const extra = records.length - s.maxSessions
    ;[...records].reverse().slice(0, extra).forEach(remove)
  }
  // 3. Disk too full: delete the oldest one at a time until there's room
  for (let guard = 0; guard < 500; guard++) {
    const { free } = await disk()
    if (free / MB >= s.minFreeSpaceMB) break
    const oldest = [...records].reverse().find((r) => r.id !== protectId)
    if (!oldest) break
    remove(oldest)
  }
  return deleted
}

// Called before each guest session starts.
export async function ensureStorage(): Promise<{ ok: boolean; freeMB: number }> {
  const s = getSettings()
  let { free } = await disk()
  if (free / MB >= s.minFreeSpaceMB) return { ok: true, freeMB: free / MB }
  if (s.autoPrune) await pruneStorage()
  free = (await disk()).free
  return { ok: free / MB >= s.minFreeSpaceMB, freeMB: free / MB }
}

// Startup repair:
// - a session whose strip picture is gone is dropped from the list
// - a missing thumbnail is replaced by the strip itself
// - a missing clip is forgotten
// - folders that aren't in the list (e.g. the app closed mid-save) are deleted
export function reconcileStorage(): void {
  const root = userRoot()
  const has = (relative?: string): boolean => typeof relative === 'string' && existsSync(join(root, relative))

  records = records.filter((r) => {
    const keep = has(r.stripPath)
    if (!keep) console.warn('[storage] removing session with a missing strip:', r.id)
    return keep
  })
  for (const r of records) {
    if (!has(r.thumbPath)) {
      console.warn('[storage] thumbnail missing, using the strip instead:', r.id)
      r.thumbPath = r.stripPath
    }
    if (r.gifPath && !has(r.gifPath)) {
      console.warn('[storage] clip file missing, forgetting it:', r.id)
      r.gifPath = undefined
    }
  }
  persist()

  const dir = sessionsDir()
  if (!existsSync(dir)) return
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory() && !records.some((r) => r.id === entry.name)) {
      rmSync(join(dir, entry.name), { recursive: true, force: true })
    }
  }
}