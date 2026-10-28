import { app, BrowserWindow, ipcMain, safeStorage, session } from 'electron'
import { join } from 'node:path'
import { readFile, writeFile, rename } from 'node:fs/promises'
import { translate, type Request } from './core'

let window: BrowserWindow | null = null
const tasks = new Map<string, AbortController>()
const keys = new Map<string, string>()
const storePath = () => join(app.getPath('userData'), 'credentials.json')
const validProvider = (provider: string): provider is Request['provider'] => provider === 'glm' || provider === 'deepseek'

async function readStore(): Promise<Record<string, string>> {
  try { return JSON.parse(await readFile(storePath(), 'utf8')) as Record<string, string> } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return {}
    throw error
  }
}
async function saveStore(data: Record<string, string>) {
  const path = storePath(), temp = `${path}.${crypto.randomUUID()}.tmp`
  await writeFile(temp, JSON.stringify(data), { flag: 'wx' })
  await rename(temp, path)
}
function registerHandlers() {
  const handle = (channel: string, fn: (...args: any[]) => unknown) => ipcMain.handle(channel, (event, ...args) => {
    if (!window || event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame) throw new Error('Unauthorized')
    return fn(...args)
  })
  handle('save-key', async (provider: string, key: string, persist: boolean) => {
    if (!validProvider(provider) || typeof key !== 'string' || key.length > 4096) throw new Error('Invalid configuration')
    if (persist && await safeStorage.isAsyncEncryptionAvailable()) {
      try {
        const data = await readStore()
        data[provider] = (await safeStorage.encryptStringAsync(key)).toString('base64')
        await saveStore(data)
        keys.set(provider, key)
        return { persisted: true }
      } catch { /* Fall back to session-only storage. */ }
    }
    const data = await readStore()
    if (data[provider]) { delete data[provider]; await saveStore(data) }
    keys.set(provider, key)
    return { persisted: false }
  })
  handle('key-status', async () => {
    try { const data = await readStore(); return { glm: Boolean(data.glm || keys.get('glm')), deepseek: Boolean(data.deepseek || keys.get('deepseek')) } } catch { return { glm: Boolean(keys.get('glm')), deepseek: Boolean(keys.get('deepseek')) } }
  })
  handle('delete-key', async (provider: string) => {
    if (!validProvider(provider)) throw new Error('Invalid provider')
    const data = await readStore(); delete data[provider]; await saveStore(data); keys.delete(provider)
  })
  handle('translate', async (id: string, request: Omit<Request, 'key'>) => {
    if (typeof id !== 'string' || id.length > 100 || tasks.has(id) || !request || !validProvider(request.provider) || typeof request.text !== 'string' || typeof request.model !== 'string' || typeof request.context !== 'string' || !['en', 'zh-CN'].includes(request.source) || !['en', 'zh-CN'].includes(request.target) || !['general', 'ivd', 'computing', 'internet'].includes(request.domain)) return { status: 'incomplete', text: '', error: 'invalid_input' }
    let key = keys.get(request.provider)
    if (!key) {
      try { const data = await readStore(); if (data[request.provider] && await safeStorage.isAsyncEncryptionAvailable()) key = (await safeStorage.decryptStringAsync(Buffer.from(data[request.provider], 'base64'))).result } catch { return { status: 'incomplete', text: '', error: 'credentials' } }
    }
    if (!key) return { status: 'incomplete', text: '', error: 'credentials' }
    const controller = new AbortController(); tasks.set(id, controller)
    const timer = setTimeout(() => controller.abort(), 90000)
    try { return await translate({ ...request, key }, controller.signal) } finally { clearTimeout(timer); tasks.delete(id) }
  })
  handle('cancel', (id: string) => { tasks.get(id)?.abort() })
}
app.whenReady().then(() => {
  registerHandlers()
  session.defaultSession.setPermissionRequestHandler((_wc, _permission, callback) => callback(false))
  window = new BrowserWindow({ width: 1280, height: 820, minWidth: 840, minHeight: 620, title: '译间', webPreferences: { preload: join(__dirname, '../preload/index.js'), nodeIntegration: false, contextIsolation: true, sandbox: true } })
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  window.webContents.on('will-navigate', event => event.preventDefault())
  if (process.env.ELECTRON_RENDERER_URL) window.loadURL(process.env.ELECTRON_RENDERER_URL)
  else window.loadFile(join(__dirname, '../renderer/index.html'))
})
app.on('window-all-closed', () => app.quit())
