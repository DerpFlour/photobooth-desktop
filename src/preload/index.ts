import { contextBridge, ipcRenderer } from 'electron'

// The ONLY things the screens are allowed to do outside the browser.
const api: PhotoboothApi = {
  getSettings: () => ipcRenderer.invoke('settings:get'),
  updateSettings: (patch) => ipcRenderer.invoke('settings:update', patch),
  toggleFullscreen: () => ipcRenderer.invoke('window:toggleFullscreen'),
  nextDisplay: () => ipcRenderer.invoke('window:nextDisplay'),
  quit: () => ipcRenderer.invoke('app:quit'),
  saveSession: (input) => ipcRenderer.invoke('sessions:save', input),
  listSessions: (limit) => ipcRenderer.invoke('sessions:list', limit),
  deleteSession: (id) => ipcRenderer.invoke('sessions:delete', id),
  deleteAllSessions: () => ipcRenderer.invoke('sessions:deleteAll'),
  removeClip: (id) => ipcRenderer.invoke('sessions:removeClip', id),
  storageSummary: () => ipcRenderer.invoke('storage:summary'),
  pruneStorage: () => ipcRenderer.invoke('storage:prune'),
  ensureStorage: () => ipcRenderer.invoke('storage:ensure'),
  openSessionsFolder: () => ipcRenderer.invoke('storage:openFolder'),
  showInFolder: (relativePath) => ipcRenderer.invoke('storage:showInFolder', relativePath),
  cloudShare: (id) => ipcRenderer.invoke('cloud:share', id),
  cloudStatus: (id) => ipcRenderer.invoke('cloud:status', id),
  cloudTest: () => ipcRenderer.invoke('cloud:test'),
  cloudQueue: () => ipcRenderer.invoke('cloud:queue'),
  cloudRetry: () => ipcRenderer.invoke('cloud:retry'),
  listPrinters: () => ipcRenderer.invoke('print:list'),
  printSheet: (request) => ipcRenderer.invoke('print:sheet', request),
  readSessionFile: (relativePath) => ipcRenderer.invoke('sessions:readFile', relativePath),
  saveSheetFile: (id, image) => ipcRenderer.invoke('print:saveSheet', id, image)
}

contextBridge.exposeInMainWorld('api', api)