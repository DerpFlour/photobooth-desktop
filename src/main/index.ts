import { app, BrowserWindow, ipcMain, Menu, net, protocol, screen, session, shell } from 'electron'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import {
  deleteRemote,
  deleteRemotes,
  kickQueue,
  normalizeBase,
  queueSummary,
  retryNow,
  shareSession,
  startCloudQueue,
  testConnection
} from './cloud'
import { getSettings, loadSettings, updateSettings } from './settings'
import {
  cloudTokens,
  deleteAllSessions,
  deleteSession,
  ensureStorage,
  getSession,
  listSessions,
  loadSessions,
  pruneStorage,
  reconcileStorage,
  removeClip,
  resolveSessionFile,
  saveSession,
  sessionsDir,
  storageSummary
} from './storage'

// Saved photos are shown through our own address: pbfile://local/sessions/...
// (This must be declared before the app is ready.)
protocol.registerSchemesAsPrivileged([
  { scheme: 'pbfile', privileges: { standard: true, secure: true, supportFetchAPI: true } }
])

let win: BrowserWindow | null = null

// The booth key never leaves this process: screens only see this mask.
const MASK = '********'
const forScreens = (s: AppSettings): AppSettings => ({ ...s, cloudBoothKey: s.cloudBoothKey ? MASK : '' })

function createWindow(): void {
  const settings = getSettings()

  // Open on the display we used last time (if it's still connected).
  const display =
    screen.getAllDisplays().find((d) => d.id === settings.displayId) ?? screen.getPrimaryDisplay()

  const preloadJs = join(__dirname, '../preload/index.js')
  const preload = existsSync(preloadJs) ? preloadJs : join(__dirname, '../preload/index.mjs')

  win = new BrowserWindow({
    x: display.bounds.x + 80,
    y: display.bounds.y + 80,
    width: 1280,
    height: 720,
    show: false,
    title: 'Photo Booth',
    backgroundColor: '#FFF5F8',
    autoHideMenuBar: true,
    webPreferences: { preload, sandbox: false, contextIsolation: true, nodeIntegration: false }
  })

  win.once('ready-to-show', () => {
    win?.show()
    // A short delay makes Windows pick the right monitor for fullscreen.
    if (settings.fullscreen) setTimeout(() => win?.setFullScreen(true), 150)
  })

  // Guests can't pinch-zoom or open new windows.
  win.webContents.setVisualZoomLevelLimits(1, 1)
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))

  // Print problems to the terminal so they're easy to copy and send to me.
  win.webContents.on('preload-error', (_event, path, error) =>
    console.error('PRELOAD FAILED:', path, error)
  )
  win.webContents.on('did-fail-load', (_event, code, description, url) =>
    console.error('PAGE FAILED TO LOAD:', code, description, url)
  )

  // Keyboard shortcuts for the operator (the laptop's keyboard).
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return
    const key = input.key.toLowerCase()
    if (key === 'f11') {
      event.preventDefault()
      toggleFullscreen()
    } else if (key === 'm' && input.control && input.shift) {
      event.preventDefault()
      nextDisplay()
    } else if (key === 'q' && input.control) {
      event.preventDefault()
      app.quit()
    } else if (key === 'f12' && !app.isPackaged) {
      win?.webContents.toggleDevTools() // developer tools, only while developing
    }
  })

  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (!app.isPackaged && devUrl) win.loadURL(devUrl)
  else win.loadFile(join(__dirname, '../renderer/index.html'))
}

function toggleFullscreen(): boolean {
  if (!win) return false
  const next = !win.isFullScreen()
  win.setFullScreen(next)
  updateSettings({ fullscreen: next })
  return next
}

// Moves the window to the next monitor (e.g. onto the tablet's screen).
function nextDisplay(): void {
  if (!win) return
  const displays = screen.getAllDisplays()
  if (displays.length < 2) return
  const current = screen.getDisplayMatching(win.getBounds())
  const index = displays.findIndex((d) => d.id === current.id)
  const next = displays[(index + 1) % displays.length]

  const wasFullscreen = win.isFullScreen()
  if (wasFullscreen) win.setFullScreen(false)
  win.setBounds({ x: next.bounds.x + 80, y: next.bounds.y + 80, width: 1280, height: 720 })
  if (wasFullscreen) setTimeout(() => win?.setFullScreen(true), 250)
  updateSettings({ displayId: next.id })
}

// Only one copy of the booth may run at a time.
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (win) {
      if (win.isMinimized()) win.restore()
      win.focus()
    }
  })

  app.whenReady().then(() => {
    app.setAppUserModelId('com.photobooth.desktop')
    Menu.setApplicationMenu(null) // no menu bar, and no menu shortcuts like Ctrl+R
    loadSettings()
    loadSessions()
    try {
      reconcileStorage()
    } catch (e) {
      console.warn('[startup] storage repair failed (continuing)', e)
    }
    pruneStorage().catch((e) => console.warn('[startup] cleanup failed', e))
    startCloudQueue() // uploads anything still waiting, and keeps checking

    // Serve saved pictures to the screens, from the sessions folder only.
    protocol.handle('pbfile', (request) => {
      const relative = decodeURIComponent(new URL(request.url).pathname).replace(/^\/+/, '')
      const full = resolveSessionFile(relative)
      if (!full || !existsSync(full)) {
        console.warn('[pbfile] file not found:', relative)
        return new Response('Not found', { status: 404 })
      }
      return net.fetch(pathToFileURL(full).toString())
    })

    // The app may use the camera and go fullscreen. Nothing else.
    const allowed = (permission: string): boolean => permission === 'media' || permission === 'fullscreen'
    session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) =>
      callback(allowed(permission))
    )
    session.defaultSession.setPermissionCheckHandler((_wc, permission) => allowed(permission))

    ipcMain.handle('settings:get', () => forScreens(getSettings()))
    ipcMain.handle('settings:update', (_e, patch: Partial<AppSettings>) => {
      const clean: Partial<AppSettings> = { ...patch }
      if (clean.cloudBoothKey === MASK) delete clean.cloudBoothKey // unchanged
      if (typeof clean.cloudBaseUrl === 'string') clean.cloudBaseUrl = normalizeBase(clean.cloudBaseUrl)
      const next = updateSettings(clean)
      if (clean.fullscreen !== undefined) win?.setFullScreen(next.fullscreen)
      if ('cloudEnabled' in clean || 'cloudBaseUrl' in clean || 'cloudBoothKey' in clean) kickQueue()
      return forScreens(next)
    })
    ipcMain.handle('window:toggleFullscreen', () => toggleFullscreen())
    ipcMain.handle('window:nextDisplay', () => nextDisplay())
    ipcMain.handle('app:quit', () => app.quit())

    ipcMain.handle('sessions:save', (_e, input: SessionSaveInput) => saveSession(input))
    ipcMain.handle('sessions:list', (_e, limit: number) => listSessions(limit))
    ipcMain.handle('sessions:delete', async (_e, id: string) => {
      const token = getSession(id)?.cloud?.token
      deleteSession(id)
      if (!token) return { remote: 'none' as const }
      return { remote: (await deleteRemote(token)) ? ('deleted' as const) : ('failed' as const) }
    })
    ipcMain.handle('sessions:deleteAll', () => {
      const tokens = cloudTokens()
      deleteAllSessions()
      void deleteRemotes(tokens) // the online copies are deleted in the background
    })
    ipcMain.handle('sessions:removeClip', (_e, id: string) => removeClip(id))
    ipcMain.handle('storage:summary', () => storageSummary())
    ipcMain.handle('storage:prune', () => pruneStorage())
    ipcMain.handle('storage:ensure', () => ensureStorage())
    ipcMain.handle('storage:openFolder', async () => {
      await shell.openPath(sessionsDir())
    })
    ipcMain.handle('storage:showInFolder', (_e, relativePath: string) => {
      const full = resolveSessionFile(relativePath)
      if (full) shell.showItemInFolder(full)
    })

    ipcMain.handle('cloud:share', (_e, id: string) => shareSession(id))
    ipcMain.handle('cloud:status', (_e, id: string) => getSession(id)?.cloud ?? null)
    ipcMain.handle('cloud:test', () => testConnection())
    ipcMain.handle('cloud:queue', () => queueSummary())
    ipcMain.handle('cloud:retry', () => retryNow())

    createWindow()
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  app.on('window-all-closed', () => app.quit())
}