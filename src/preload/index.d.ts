export {}

declare global {
  // Every booth setting. The main process owns the values (see settings.ts);
  // screens receive the full object, so they never need the defaults.
  interface AppSettings {
    // capture
    countdownSeconds: number
    previewAfterShotMs: number
    cameraDeviceId: string // '' = the default camera
    cameraWidth: number
    cameraHeight: number
    mirrorPreview: boolean // live preview looks like a mirror (selfie style)
    mirrorPhotos: boolean // saved photos match the preview
    // behind-the-scenes clip
    gifEnabled: boolean
    gifFps: number
    gifWidth: number
    gifHoldSeconds: number
    // online sharing
    cloudEnabled: boolean
    cloudBaseUrl: string
    cloudBoothKey: string // the screens only ever see '********' or ''
    cloudRetentionDays: number
    // printing
    printEnabled: boolean
    printerName: string // '' = the Windows default printer
    printPaper: string // '4r' | '5x7' | 'a6' | 'a4' | 'letter'
    printCopies: number // sheets per press of the Print button
    printFillSheet: boolean // fill the sheet with copies of the strip
    printMarginMm: number // white border (0 = edge to edge)
    printMaxPerSession: number // 0 = unlimited
    printUseDriverPaper: boolean // let the printer choose the paper size
    // export
    exportFormat: 'jpeg' | 'png'
    exportQuality: number
    exportScale: number
    // kiosk
    fullscreen: boolean
    displayId: number // 0 = not chosen yet
    idleTimeoutSeconds: number // 0 = never
    idleWarningSeconds: number
    adminPin: string
    // home screen
    showRecentOnHome: boolean
    homeGalleryCount: number
    // storage
    keepOriginalPhotos: boolean
    autoPrune: boolean
    retentionDays: number
    maxSessions: number
    minFreeSpaceMB: number
  }

  // The online-sharing state of one session.
  interface CloudInfo {
    token: string // the guest's secret link token
    base: string // the website this session is sent to
    url: string // the link inside the QR code
    status: 'pending' | 'uploading' | 'ready' | 'failed'
    rev: number // goes up each time the session is saved again
    attempts: number
    error?: string
    nextTry?: number // when to retry after a failure
    expiresAt?: string
  }

  interface CloudQueue {
    waiting: number
    failed: number
  }

  interface CloudTestResult {
    ok: boolean
    message: string
  }
  interface PrinterEntry {
    name: string // the system name Windows uses
    displayName: string
    description: string
    isDefault: boolean
  }

  interface PrintRequest {
    image: ArrayBuffer // the finished print sheet (JPEG)
    widthMm: number
    heightMm: number
    copies: number
  }

  interface PrintResult {
    ok: boolean
    message: string
    printer?: string
  }
  // One saved guest session. Paths are relative to the app's data folder.
  interface SessionRecord {
    id: string
    createdAt: number // milliseconds since 1970
    layoutId: string
    templateId: string
    stripPath: string
    thumbPath: string
    gifPath?: string // the behind-the-scenes clip, if there is one
    cloud?: CloudInfo // online sharing, if it is switched on
    width: number
    height: number
    bytes: number // total size of all this session's files
    photoCount: number
    originalsKept: boolean
  }

  // What the screen sends to be saved.
  interface SessionSaveInput {
    id: string
    layoutId: string
    templateId: string
    width: number
    height: number
    photoCount: number
    ext: 'jpg' | 'png'
    strip: ArrayBuffer
    thumb: ArrayBuffer
    gif?: ArrayBuffer // the behind-the-scenes clip
    originals: ArrayBuffer[] // full-size photos (empty unless "keep originals" is on)
  }

  interface StorageSummary {
    sessionCount: number
    usedBytes: number
    freeBytes: number
    diskBytes: number
  }

  // What the screens can ask the main process to do.
  interface PhotoboothApi {
    getSettings(): Promise<AppSettings>
    updateSettings(patch: Partial<AppSettings>): Promise<AppSettings>
    toggleFullscreen(): Promise<boolean>
    nextDisplay(): Promise<void>
    quit(): Promise<void>
    saveSession(input: SessionSaveInput): Promise<SessionRecord>
    listSessions(limit: number): Promise<SessionRecord[]>
    deleteSession(id: string): Promise<{ remote: 'none' | 'deleted' | 'failed' }>
    deleteAllSessions(): Promise<void>
    removeClip(id: string): Promise<SessionRecord | null>
    storageSummary(): Promise<StorageSummary>
    pruneStorage(): Promise<number>
    ensureStorage(): Promise<{ ok: boolean; freeMB: number }>
    openSessionsFolder(): Promise<void>
    showInFolder(relativePath: string): Promise<void>
    cloudShare(id: string): Promise<CloudInfo | null>
    cloudStatus(id: string): Promise<CloudInfo | null>
    cloudTest(): Promise<CloudTestResult>
    cloudQueue(): Promise<CloudQueue>
    cloudRetry(): Promise<void>
    listPrinters(): Promise<PrinterEntry[]>
    printSheet(request: PrintRequest): Promise<PrintResult>
    readSessionFile(relativePath: string): Promise<ArrayBuffer>
    saveSheetFile(id: string, image: ArrayBuffer): Promise<void>
  }

  interface Window {
    api: PhotoboothApi
  }
}