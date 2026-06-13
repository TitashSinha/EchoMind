import { BrowserWindow, screen, shell } from 'electron'
import { join } from 'node:path'
import { getSettings } from './store'

let mainWindow: BrowserWindow | null = null
let overlayWindow: BrowserWindow | null = null
let quitting = false
let privacyTimer: ReturnType<typeof setInterval> | null = null

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
      sandbox: false,
      // The audio-capture loop (cycling MediaRecorder + level meter) lives in
      // this window's renderer and must keep running at full speed even when the
      // window is minimized during a session — so disable timer throttling.
      backgroundThrottling: false
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
  // Windows can clear the WDA_EXCLUDEFROMCAPTURE display-affinity flag across
  // show/restore/move transitions, briefly exposing the overlay to screenshots
  // and recordings. Re-apply on every relevant event AND keep a cheap watchdog
  // running while it's visible so protection is continuous, not best-effort.
  overlayWindow.on('show', startPrivacyWatch)
  overlayWindow.on('hide', stopPrivacyWatch)
  overlayWindow.on('restore', applyOverlayPrivacy)
  overlayWindow.on('move', applyOverlayPrivacy)
  overlayWindow.webContents.on('did-finish-load', applyOverlayPrivacy)
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
    // showInactive keeps focus on the user's meeting app. The 'show' event
    // starts the privacy watchdog; call it here too so protection is asserted
    // before the window can be painted into any capture.
    overlayWindow.showInactive()
    startPrivacyWatch()
    // Collapse the main control window so only the in-meeting HUD is on screen —
    // having both visible makes it unclear where to look during a conversation.
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.minimize()
  } else {
    overlayWindow.hide()
    stopPrivacyWatch()
    // Bring the control window back (e.g. to show the session summary).
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  }
  return target
}

/**
 * Exclude the overlay from ALL screen capture — recordings, screen shares, and
 * screenshots (Print Screen / Snipping Tool) — via the WDA_EXCLUDEFROMCAPTURE
 * window display affinity. Reads the live setting so toggling it takes effect
 * within one watchdog tick.
 */
export function applyOverlayPrivacy(): void {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.setContentProtection(getSettings().overlayPrivacy)
  }
}

/** Continuously re-assert capture protection while the overlay is on screen. */
function startPrivacyWatch(): void {
  applyOverlayPrivacy()
  if (privacyTimer) return
  privacyTimer = setInterval(applyOverlayPrivacy, 500)
}

function stopPrivacyWatch(): void {
  if (privacyTimer) {
    clearInterval(privacyTimer)
    privacyTimer = null
  }
}
