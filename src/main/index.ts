import { app, desktopCapturer, session } from 'electron'
import { registerIpc } from './ipc'
import { createWindows, getMainWindow, setQuitting } from './windows'

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    const win = getMainWindow()
    if (win) {
      if (win.isMinimized()) win.restore()
      win.focus()
    }
  })

  app.whenReady().then(() => {
    // System-audio (WASAPI loopback) capture: when the renderer calls
    // getDisplayMedia we hand it the primary screen's video (discarded by the
    // renderer) plus loopback audio — i.e. whatever the user hears from
    // Zoom/Teams/Meet — with no picker dialog.
    session.defaultSession.setDisplayMediaRequestHandler(
      (_request, callback) => {
        desktopCapturer
          .getSources({ types: ['screen'] })
          .then((sources) => {
            callback({ video: sources[0], audio: 'loopback' })
          })
          .catch(() => callback({}))
      },
      { useSystemPicker: false }
    )

    session.defaultSession.setPermissionRequestHandler((_wc, permission, cb) => {
      cb(['media', 'display-capture'].includes(permission))
    })

    registerIpc()
    const mainWindow = createWindows()

    if (process.env['ECHOMIND_SMOKE']) {
      mainWindow.webContents.on('console-message', (...args: unknown[]) => {
        const text = args
          .filter((a) => typeof a === 'string' || typeof a === 'number')
          .join(' ')
        console.log('[renderer]', text)
      })
      mainWindow.webContents.on('did-fail-load', (_e, code, desc) => {
        console.error('[smoke] FAIL did-fail-load', code, desc)
        app.exit(1)
      })
      mainWindow.webContents.on('did-finish-load', () => {
        console.log('[smoke] renderer loaded')
        setTimeout(async () => {
          const shotPath = process.env['ECHOMIND_SHOT']
          if (shotPath) {
            const img = await mainWindow.webContents.capturePage()
            const { writeFileSync } = await import('node:fs')
            writeFileSync(shotPath, img.toPNG())
            console.log('[smoke] screenshot saved:', shotPath)
          }
          console.log('[smoke] OK')
          setQuitting()
          app.exit(0)
        }, 2500)
      })
    }
  })

  app.on('before-quit', () => setQuitting())

  app.on('window-all-closed', () => {
    app.quit()
  })
}
