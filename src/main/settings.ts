import { app } from 'electron'
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

// DEFAULT values for every setting. Saved changes are stored in
// %APPDATA%\<app name>\data\settings.json and override these.
export const DEFAULT_SETTINGS: AppSettings = {
  // capture
  countdownSeconds: 3,
  previewAfterShotMs: 1500,
  cameraDeviceId: '',
  cameraWidth: 1920,
  cameraHeight: 1080,
  mirrorPreview: true,
  mirrorPhotos: true,
  // behind-the-scenes clip (animated GIF)
  gifEnabled: true, // admin-only switch: guests never see a button for this
  gifFps: 8, // smoothness
  gifWidth: 360, // width of the whole animated strip in pixels
  gifHoldSeconds: 2, // pause on the finished strip at the end of each loop
    // online sharing (QR code + the guest download page)
  cloudEnabled: false,
  cloudBaseUrl: '', // the website address from Vercel
  cloudBoothKey: '', // the BOOTH_API_KEY (never shown on screen)
  cloudRetentionDays: 5, // how long guest links stay online (1-30)
  // branding (the look of the booth)
  brandName: 'Click',
  brandInstructions: 'Choose a layout, strike a pose, and take your photos home.',
  brandButton: 'Take pictures',
  theme: 'calm', // calm | sky | rose
  homeStrips: 'samples', // 'samples' = designed examples, 'recent' = guests' latest strips
  // printing
  printEnabled: true,
  printerName: '', // '' = use whichever printer is the Windows default
  printPaper: '4r', // 4R = 4x6 inch photo paper
  printCopies: 1, // sheets printed each time the Print button is pressed
  printFillSheet: true, // a 2x6 strip prints twice side by side on 4x6 paper
  printMarginMm: 0, // 0 = edge to edge; raise it if the printer cuts off the edges
  printMaxPerSession: 2, // times a guest may press Print (0 = unlimited)
  printUseDriverPaper: false, // true = ignore our paper size, use the printer's own default
  // export
  exportFormat: 'jpeg',
  exportQuality: 95,
  exportScale: 1,
  // kiosk
  fullscreen: false, // F11 toggles; the choice is remembered
  displayId: 0,
  idleTimeoutSeconds: 90,
  idleWarningSeconds: 10,
  adminPin: '1234', // CHANGE THIS in the admin screen (Part 2)
  // home
  showRecentOnHome: true,
  homeGalleryCount: 8,
  // storage
  keepOriginalPhotos: false,
  autoPrune: true,
  retentionDays: 0,
  maxSessions: 1000,
  minFreeSpaceMB: 500
}

let current: AppSettings = { ...DEFAULT_SETTINGS }

const settingsFile = () => join(app.getPath('userData'), 'data', 'settings.json')

// Keeps only known settings whose value has the right type; everything else
// falls back to the default. Protects against a corrupted file.
function sanitize(input: Record<string, unknown>): AppSettings {
  const defaults = DEFAULT_SETTINGS as unknown as Record<string, unknown>
  const out: Record<string, unknown> = { ...defaults }
  for (const key of Object.keys(defaults)) {
    const value = input[key]
    if (typeof value === typeof defaults[key]) out[key] = value
  }
  return out as unknown as AppSettings
}

export function loadSettings(): AppSettings {
  try {
    current = sanitize(JSON.parse(readFileSync(settingsFile(), 'utf8')))
  } catch {
    current = { ...DEFAULT_SETTINGS } // first run, or unreadable file
  }
  return current
}

export const getSettings = (): AppSettings => current

export function updateSettings(patch: Partial<AppSettings>): AppSettings {
  current = sanitize({ ...current, ...patch })
  // Write to a temp file first, then rename: a crash can't leave a half-written file.
  mkdirSync(dirname(settingsFile()), { recursive: true })
  const temp = settingsFile() + '.tmp'
  writeFileSync(temp, JSON.stringify(current, null, 2))
  renameSync(temp, settingsFile())
  return current
}