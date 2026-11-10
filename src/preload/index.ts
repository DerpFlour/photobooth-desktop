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
  storageSummary: () => ipcRenderer.invoke('storage:summary'),
  pruneStorage: () => ipcRenderer.invoke('storage:prune'),
  ensureStorage: () => ipcRenderer.invoke('storage:ensure'),
  openSessionsFolder: () => ipcRenderer.invoke('storage:openFolder'),
  showInFolder: (relativePath) => ipcRenderer.invoke('storage:showInFolder', relativePath)
}

contextBridge.exposeInMainWorld('api', api)