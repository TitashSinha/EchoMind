// One-off headless key setup: stores an OpenAI API key in EchoMind's settings
// exactly as the Settings page would (DPAPI-encrypted via safeStorage).
//
//   $env:ECHOMIND_KEY = 'sk-...'; npm run set-key; Remove-Item Env:\ECHOMIND_KEY
//
// Runs under Electron (not plain Node) because safeStorage needs it.
const { app, safeStorage } = require('electron')
const fs = require('node:fs')
const path = require('node:path')

app.setName('EchoMind') // match the real app's userData path

app.whenReady().then(() => {
  const key = (process.env.ECHOMIND_KEY || '').trim()
  if (!key) {
    console.error('ECHOMIND_KEY env var is not set — nothing to do.')
    app.exit(1)
    return
  }
  const dir = path.join(app.getPath('userData'), 'echomind-data')
  fs.mkdirSync(dir, { recursive: true })
  const file = path.join(dir, 'settings.json')
  let settings = {}
  try {
    settings = JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    /* fresh settings */
  }
  if (safeStorage.isEncryptionAvailable()) {
    settings.apiKeyEnc = safeStorage.encryptString(key).toString('base64')
    delete settings.apiKeyPlain
    console.log('API key stored (encrypted with DPAPI).')
  } else {
    settings.apiKeyPlain = key
    delete settings.apiKeyEnc
    console.log('API key stored (plaintext fallback — DPAPI unavailable).')
  }
  fs.writeFileSync(file, JSON.stringify(settings), 'utf8')
  console.log('Settings written:', file)
  app.exit(0)
})
