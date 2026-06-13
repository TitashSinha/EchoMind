import { BrowserWindow, screen, shell } from 'electron'
import { join } from 'node:path'
import { getSettings } from './store'

let mainWindow: BrowserWindow | null = null
let overlayWindow: BrowserWindow | null = null
let quitting = false

export function setQuitting(): void {
  quitting = true
}

export function getMainWindow(): BrowserWindow | null {
  return mainWindow
}

const devUrl = (): string | undefined => process.env['ELECTRON_RENDERER_URL']

function loadRenderer(win: BrowserWindow, hash?: string): void {
  const url = devUrl()
  if (url) {
    void win.loadURL(url + (hash ? `#${hash}` : ''))
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'), hash ? { hash } : undefined)
  }
}

const preloadPath = (): string => join(__dirname, '../preload/index.js')

export function createWindows(): BrowserWindow {
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 980,
    minHeight: 640,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#0a0d13',
    title: 'EchoMind',
    webPreferences: {
      preload: preloadPath(),
      contextIsolation: true,
      sandbox: false
    }
  })
  mainWindow.once('ready-to-show', () => mainWindow?.show())
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })
  mainWindow.on('closed', () => {
    mainWindow = null
  })
  loadRenderer(mainWindow)

  const { workArea } = screen.getPrimaryDisplay()
  overlayWindow = new BrowserWindow({
    width: 400,
    height: 560,
    x: workArea.x + workArea.width - 420,
    y: workArea.y + 60,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: true,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    show: false,
    backgroundColor: '#0a0d13',
    minWidth: 300,
    minHeight: 220,
    webPreferences: {
      preload: preloadPath(),
      contextIsolation: true,
      sandbox: false
    }
  })
  overlayWindow.setAlwaysOnTop(true, 'screen-saver')
  overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  // Windows drops the WDA_EXCLUDEFROMCAPTURE display-affinity flag across hide/show
  // cycles and while the window is hidden, so re-apply it every time the overlay
  // becomes visible and after each (re)load — not just once at creation.
  overlayWindow.on('show', () => applyOverlayPrivacy())
  overlayWindow.webContents.on('did-finish-load', () => applyOverlayPrivacy())
  applyOverlayPrivacy()
  // Hide instead of destroying so it can be re-shown instantly mid-session.
  overlayWindow.on('close', (e) => {
    if (!quitting) {
      e.preventDefault()
      overlayWindow?.hide()
    }
  })
  loadRenderer(overlayWindow, 'overlay')

  return mainWindow
}

export function broadcast(channel: string, payload: unknown): void {
  for (const w of [mainWindow, overlayWindow]) {
    if (w && !w.isDestroyed()) w.webContents.send(channel, payload)
  }
}

export function toggleOverlay(show?: boolean): boolean {
  if (!overlayWindow || overlayWindow.isDestroyed()) return false
  const target = show ?? !overlayWindow.isVisible()
  if (target) {
    // showInactive keeps focus on the user's meeting app.
    overlayWindow.showInactive()
    // Re-assert capture protection now that the HWND is visible; the 'show'
    // event also fires this, but Windows occasionally needs a second pass once
    // the window has fully surfaced.
    applyOverlayPrivacy()
    setTimeout(applyOverlayPrivacy, 120)
  } else {
    overlayWindow.hide()
  }
  return target
}

/** Exclude the overlay from screen capture so it never leaks into a screen share. */
export function applyOverlayPrivacy(): void {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    const on = getSettings().overlayPrivacy
    overlayWindow.setContentProtection(on)
  }
}
