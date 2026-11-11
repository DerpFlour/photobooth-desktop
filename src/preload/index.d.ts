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

  // One saved guest session. Paths are relative to the app's data folder.
  interface SessionRecord {
    id: string
    createdAt: number // milliseconds since 1970
    layoutId: string
    templateId: string
    stripPath: string
    thumbPath: string
    gifPath?: string // the behind-the-scenes clip, if there is one
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
    deleteSession(id: string): Promise<void>
    deleteAllSessions(): Promise<void>
    removeClip(id: string): Promise<SessionRecord | null>
    storageSummary(): Promise<StorageSummary>
    pruneStorage(): Promise<number>
    ensureStorage(): Promise<{ ok: boolean; freeMB: number }>
    openSessionsFolder(): Promise<void>
    showInFolder(relativePath: string): Promise<void>
  }

  interface Window {
    api: PhotoboothApi
  }
}