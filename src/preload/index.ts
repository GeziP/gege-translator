import { contextBridge, ipcRenderer } from 'electron'
contextBridge.exposeInMainWorld('desktop', {
  saveKey: (provider: string, key: string, persist: boolean) => ipcRenderer.invoke('save-key', provider, key, persist),
  keyStatus: () => ipcRenderer.invoke('key-status'),
  gatewayModels: (port: number) => ipcRenderer.invoke('gateway-models', port),
  listTerms: () => ipcRenderer.invoke('list-terms'),
  saveTerm: (term: unknown, index?: number) => ipcRenderer.invoke('save-term', term, index),
  deleteTerm: (index: number) => ipcRenderer.invoke('delete-term', index),
  previewTerms: () => ipcRenderer.invoke('preview-terms'),
  confirmTerms: (token: string, replace: boolean) => ipcRenderer.invoke('confirm-terms', token, replace),
  exportTerms: () => ipcRenderer.invoke('export-terms'),
  deleteKey: (provider: string) => ipcRenderer.invoke('delete-key', provider),
  translate: (id: string, request: unknown) => ipcRenderer.invoke('translate', id, request),
  cancel: (id: string) => ipcRenderer.invoke('cancel', id)
})
