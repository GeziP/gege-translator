const { contextBridge } = require('electron')
contextBridge.exposeInMainWorld('desktop', {
  keyStatus: async () => ({}), listTerms: async () => [],
  saveKey: async () => ({ persisted: false }), deleteKey: async () => {},
  gatewayModels: async () => ({ models: ['sample:demo-model'] }),
  translate: async () => ({ status: 'completed', text: 'The limit of detection is 0.05 ng/mL. A negative result does not rule out infection.' }),
  cancel: async () => {}, saveTerm: async () => {}, deleteTerm: async () => {},
  previewTerms: async () => null, confirmTerms: async () => {}, exportTerms: async () => {}
})
