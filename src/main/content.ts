import { app, BrowserWindow, dialog, shell } from 'electron'
import { randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { framesDir } from './storage'

// Layouts that ship with the app (custom templates may point at these).
const BUILT_IN_LAYOUT_IDS = ['strip-4', 'grid-8']

const userRoot = (): string => app.getPath('userData')
const contentPath = (): string => join(userRoot(), 'data', 'content.json')
const empty = (): ContentFile => ({ customLayouts: [], customTemplates: [], layoutEnabled: {}, templateEnabled: {} })

let current: ContentFile = empty()

const num = (v: unknown, lo: number, hi: number, fallback: number): number => {
  const n = Number(v)
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.round(n))) : fallback
}
const text = (v: unknown, max: number, fallback: string): string =>
  typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : fallback
const colour = (v: unknown, fallback: string): string =>
  typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v) ? v : fallback

function flags(v: unknown): Record<string, boolean> {
  const out: Record<string, boolean> = {}
  if (v && typeof v === 'object') {
    for (const [key, value] of Object.entries(v)) {
      if (typeof value === 'boolean' && key.length <= 64) out[key] = value
    }
  }
  return out
}

// Keeps only well-formed entries with sensible numbers. Protects against a
// damaged file and against anything unexpected coming from the screens.
function sanitize(raw: unknown): ContentFile {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>

  const customLayouts: CustomLayout[] = []
  for (const item of (Array.isArray(r.customLayouts) ? r.customLayouts : []).slice(0, 30)) {
    const l = item as Record<string, unknown>
    const id = typeof l.id === 'string' && /^custom-[a-z0-9]{4,16}$/.test(l.id) ? l.id : null
    if (!id || customLayouts.some((x) => x.id === id)) continue
    customLayouts.push({
      id,
      name: text(l.name, 40, 'New layout'),
      canvasW: num(l.canvasW, 300, 3000, 1200),
      canvasH: num(l.canvasH, 300, 3000, 1800),
      columns: num(l.columns, 1, 4, 1),
      rows: num(l.rows, 1, 6, 3),
      margin: num(l.margin, 0, 120, 40),
      gap: num(l.gap, 0, 80, 30),
      footer: num(l.footer, 0, 300, 110)
    })
  }

  const known = new Set([...BUILT_IN_LAYOUT_IDS, ...customLayouts.map((l) => l.id)])
  const customTemplates: CustomTemplate[] = []
  for (const item of (Array.isArray(r.customTemplates) ? r.customTemplates : []).slice(0, 100)) {
    const t = item as Record<string, unknown>
    const id = typeof t.id === 'string' && /^frame-[a-z0-9]{4,20}$/.test(t.id) ? t.id : null
    const file = typeof t.file === 'string' && /^frame-[a-f0-9]{12}\.png$/.test(t.file) ? t.file : null
    const layoutId = typeof t.layoutId === 'string' && known.has(t.layoutId) ? t.layoutId : null
    if (!id || !file || !layoutId || customTemplates.some((x) => x.id === id)) continue
    if (!existsSync(join(framesDir(), file))) continue // the picture file is gone
    customTemplates.push({
      id,
      name: text(t.name, 40, 'My frame'),
      category: text(t.category, 24, 'My frames'),
      layoutId,
      file,
      backgroundColor: colour(t.backgroundColor, '#FFFFFF'),
      slotColor: colour(t.slotColor, '#E8EFF9'),
      textColor: colour(t.textColor, '#0F2A5C')
    })
  }

  return {
    customLayouts,
    customTemplates,
    layoutEnabled: flags(r.layoutEnabled),
    templateEnabled: flags(r.templateEnabled)
  }
}

function persist(): void {
  mkdirSync(dirname(contentPath()), { recursive: true })
  const temp = contentPath() + '.tmp'
  writeFileSync(temp, JSON.stringify(current, null, 2))
  renameSync(temp, contentPath()) // a crash can't leave a half-written file
}

// Deletes frame pictures that no frame uses any more.
function cleanFrames(): void {
  const dir = framesDir()
  if (!existsSync(dir)) return
  const keep = new Set(current.customTemplates.map((t) => t.file))
  for (const name of readdirSync(dir)) {
    if (!keep.has(name)) rmSync(join(dir, name), { force: true })
  }
}

export function loadContent(): ContentFile {
  try {
    current = sanitize(JSON.parse(readFileSync(contentPath(), 'utf8')))
  } catch {
    current = empty() // first run, or an unreadable file
  }
  cleanFrames()
  return current
}

export const getContent = (): ContentFile => current

export function setContent(next: ContentFile): ContentFile {
  current = sanitize(next)
  persist()
  cleanFrames()
  return current
}

// The "Choose a frame..." file window. Returns the picture, or null if cancelled.
export async function pickPng(win: BrowserWindow | null): Promise<{ name: string; bytes: Buffer } | null> {
  const options: Electron.OpenDialogOptions = {
    title: 'Choose a frame (a PNG with transparent photo windows)',
    properties: ['openFile'],
    filters: [{ name: 'PNG image', extensions: ['png'] }]
  }
  const result = win ? await dialog.showOpenDialog(win, options) : await dialog.showOpenDialog(options)
  if (result.canceled || !result.filePaths[0]) return null
  const file = result.filePaths[0]
  const bytes = readFileSync(file)
  if (bytes.length > 15 * 1024 * 1024) throw new Error('That file is too big (over 15 MB).')
  return { name: basename(file), bytes }
}

// Stores an imported frame picture and returns its stored file name.
export function storeFrame(bytes: ArrayBuffer): string {
  const data = Buffer.from(bytes)
  const isPng = data.length > 8 && data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  if (!isPng) throw new Error('That file is not a PNG picture.')
  if (data.length > 15 * 1024 * 1024) throw new Error('That file is too big (over 15 MB).')
  mkdirSync(framesDir(), { recursive: true })
  const name = `frame-${randomBytes(6).toString('hex')}.png`
  writeFileSync(join(framesDir(), name), data)
  return name
}

// Saves a "guide" picture (the photo windows, marked) to Documents and shows it.
export function saveGuide(name: string, bytes: ArrayBuffer): string {
  const safe = name.replace(/[^a-z0-9_-]+/gi, '-').slice(0, 60) || 'layout'
  const dir = join(app.getPath('documents'), 'Click frame guides')
  mkdirSync(dir, { recursive: true })
  const target = join(dir, `guide-${safe}.png`)
  writeFileSync(target, Buffer.from(bytes))
  shell.showItemInFolder(target)
  return target
}