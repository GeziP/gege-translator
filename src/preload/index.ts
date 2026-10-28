import { contextBridge, ipcRenderer } from 'electron'
contextBridge.exposeInMainWorld('desktop', {
  saveKey: (provider: string, key: string, persist: boolean) => ipcRenderer.invoke('save-key', provider, key, persist),
  keyStatus: () => ipcRenderer.invoke('key-status'),
  deleteKey: (provider: string) => ipcRenderer.invoke('delete-key', provider),
  translate: (id: string, request: unknown) => ipcRenderer.invoke('translate', id, request),
  cancel: (id: string) => ipcRenderer.invoke('cancel', id)
})
