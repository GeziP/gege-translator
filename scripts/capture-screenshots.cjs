const { app, BrowserWindow } = require('electron')
const { mkdir, writeFile } = require('node:fs/promises')
const { mkdirSync } = require('node:fs')
const { join } = require('node:path')

const isolatedData = join(app.getPath('temp'), `gege-screenshot-${process.pid}`)
mkdirSync(isolatedData, { recursive: true })
app.setPath('userData', isolatedData)
app.whenReady().then(async () => {
  const output = join(process.cwd(), 'docs', 'screenshots')
  await mkdir(output, { recursive: true })
  const win = new BrowserWindow({ width: 1440, height: 980, show: true, webPreferences: { preload: join(__dirname, 'screenshot-preload.cjs'), nodeIntegration: false, contextIsolation: true, sandbox: true } })
  await win.loadFile(join(process.cwd(), 'out', 'renderer', 'index.html'))
  await win.webContents.executeJavaScript(`(() => {
    const profile = { model: 'glm-5.3-flash', contextTokens: '1000000', maxOutputTokens: '8192' };
    localStorage.setItem('model-profiles', JSON.stringify({ glm: profile }));
    localStorage.setItem('saved-models', JSON.stringify([{ provider: 'glm', profile }]));
  })()`)
  await new Promise(resolve => { win.webContents.once('did-finish-load', resolve); win.webContents.reload() })
  win.webContents.setZoomFactor(0.8)
  await new Promise(resolve => setTimeout(resolve, 500))
  await win.webContents.executeJavaScript(`(() => {
    const fields = document.querySelectorAll('.pane textarea');
    const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
    set.call(fields[0], '该检测方法的检出限为 0.05 ng/mL。阴性结果不能排除感染。');
    fields[0].dispatchEvent(new Event('input', { bubbles: true }));
    set.call(fields[1], 'The limit of detection is 0.05 ng/mL. A negative result does not rule out infection.');
    fields[1].dispatchEvent(new Event('input', { bubbles: true }));
    const domain = document.querySelector('.toolbar select');
    domain.value = 'ivd'; domain.dispatchEvent(new Event('change', { bubbles: true }));
  })()`)
  await new Promise(resolve => setTimeout(resolve, 300))
  await writeFile(join(output, 'translation.png'), (await win.webContents.capturePage()).toPNG())
  await win.webContents.executeJavaScript(`document.querySelectorAll('.settings-button')[2].click()`)
  await new Promise(resolve => setTimeout(resolve, 300))
  await writeFile(join(output, 'models.png'), (await win.webContents.capturePage()).toPNG())
  await win.webContents.executeJavaScript(`document.querySelector('.drawer-head button').click(); document.querySelectorAll('.settings-button')[0].click()`)
  await new Promise(resolve => setTimeout(resolve, 300))
  await writeFile(join(output, 'about.png'), (await win.webContents.capturePage()).toPNG())
  win.close(); app.exit(0)
}).catch(() => app.exit(1))
