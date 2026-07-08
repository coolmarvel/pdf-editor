import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { writeFile, readFile } from 'fs/promises'

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 980,
    minHeight: 640,
    show: false,
    autoHideMenuBar: true,
    title: 'PDF 편집기',
    icon: app.isPackaged ? join(process.resourcesPath, 'icon.png') : join(__dirname, '../../build/icon.png'),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true
    }
  })

  mainWindow.on('ready-to-show', () => mainWindow.show())

  // 렌더러가 메모리 부족 등으로 죽으면(대용량 PDF 등) 앱이 그냥 꺼진 것처럼 보인다
  // → 창을 자동으로 다시 로드해 복구한다. (반복 크래시 루프 방지로 10초에 1회만)
  let lastRecover = 0
  mainWindow.webContents.on('render-process-gone', (_e, details) => {
    if (details.reason === 'clean-exit') return
    const now = Date.now()
    if (now - lastRecover < 10_000) return
    lastRecover = now
    mainWindow.webContents.once('did-finish-load', () => mainWindow.webContents.send('app:recovered', details.reason))
    mainWindow.webContents.reload()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// ── IPC: 파일 열기/저장 (렌더러는 파일시스템 직접 접근 불가) ──────────────

/** PDF 열기 다이얼로그 → { name, data } 또는 null(취소) */
ipcMain.handle('fs:openPdf', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'PDF 열기',
    filters: [{ name: 'PDF 문서', extensions: ['pdf'] }],
    properties: ['openFile']
  })
  if (canceled || filePaths.length === 0) return null
  const data = await readFile(filePaths[0])
  return { name: filePaths[0].split(/[\\/]/).pop() ?? 'document.pdf', data: new Uint8Array(data) }
})

/** 저장 다이얼로그로 버퍼 저장 → 저장한 경로 또는 null(취소) */
ipcMain.handle('fs:saveBuffer', async (_e, defaultName: string, data: Uint8Array) => {
  const { canceled, filePath } = await dialog.showSaveDialog({
    defaultPath: defaultName,
    title: '저장 위치 선택',
    filters: [{ name: 'PDF 문서', extensions: ['pdf'] }]
  })
  if (canceled || !filePath) return null
  await writeFile(filePath, Buffer.from(data))
  return filePath
})

/** 저장한 파일을 탐색기에서 보여주기 */
ipcMain.handle('shell:showItem', async (_e, fullPath: string) => {
  shell.showItemInFolder(fullPath)
})

/** 인쇄: 완성본 PDF를 숨김 창에 띄워 시스템 인쇄 다이얼로그 호출 */
ipcMain.handle('app:printPdf', async (_e, data: Uint8Array) => {
  const tmp = join(app.getPath('temp'), `pdf-editor-print-${Date.now()}.pdf`)
  await writeFile(tmp, Buffer.from(data))
  const win = new BrowserWindow({ show: false })
  await win.loadURL(`file://${tmp}`)
  // Chromium 내장 PDF 뷰어 로드 후 인쇄 다이얼로그
  win.webContents.print({}, () => {
    win.close()
  })
})

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
