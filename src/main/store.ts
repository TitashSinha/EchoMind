import { app, safeStorage } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import type { AiProvider, AppSettings } from '@shared/types'

let cachedKey: string | null | undefined

export function dataDir(): string {
  const d = path.join(app.getPath('userData'), 'echomind-data')
  fs.mkdirSync(d, { recursive: true })
  return d
}

export function dirFor(sub: string): string {
  const d = path.join(dataDir(), sub)
  fs.mkdirSync(d, { recursive: true })
  return d
}

export function readJson<T>(file: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as T
  } catch {
    return fallback
  }
}

export function writeJson(file: string, value: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const tmp = file + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(value), 'utf8')
  fs.renameSync(tmp, file)
}

export function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`
}

interface SettingsFile {
  apiKeyEnc?: string
  apiKeyPlain?: string
  provider: AiProvider
  liveModel: string
  summaryModel: string
  transcribeModel: string
  embedModel: string
  ollamaUrl: string
  ollamaModel: string
  ollamaEmbedModel: string
  ollamaVisionModel: string
  language: string
  overlayPrivacy: boolean
}

const DEFAULTS: Omit<SettingsFile, 'apiKeyEnc' | 'apiKeyPlain'> = {
  provider: 'openai',
  liveModel: 'gpt-5.4-mini',
  summaryModel: 'gpt-5.4',
  transcribeModel: 'whisper-1',
  embedModel: 'text-embedding-3-small',
  ollamaUrl: 'http://localhost:11434',
  ollamaModel: 'llama3.2',
  ollamaEmbedModel: 'nomic-embed-text',
  ollamaVisionModel: 'llama3.2-vision',
  language: '',
  overlayPrivacy: true
}

const settingsPath = (): string => path.join(dataDir(), 'settings.json')

function readSettingsFile(): SettingsFile {
  return { ...DEFAULTS, ...readJson<Partial<SettingsFile>>(settingsPath(), {}) }
}

export function getApiKey(): string | null {
  if (cachedKey !== undefined) return cachedKey
  const s = readSettingsFile()
  if (s.apiKeyEnc) {
    try {
      cachedKey = safeStorage.decryptString(Buffer.from(s.apiKeyEnc, 'base64'))
    } catch {
      cachedKey = null
    }
  } else if (s.apiKeyPlain) {
    cachedKey = s.apiKeyPlain
  } else {
    cachedKey = null
  }
  return cachedKey
}

function setApiKey(key: string): void {
  const s = readSettingsFile()
  if (!key) {
    delete s.apiKeyEnc
    delete s.apiKeyPlain
    cachedKey = null
  } else if (safeStorage.isEncryptionAvailable()) {
    s.apiKeyEnc = safeStorage.encryptString(key).toString('base64')
    delete s.apiKeyPlain
    cachedKey = key
  } else {
    s.apiKeyPlain = key
    delete s.apiKeyEnc
    cachedKey = key
  }
  writeJson(settingsPath(), s)
}

export function getSettings(): AppSettings {
  const s = readSettingsFile()
  return {
    hasApiKey: !!getApiKey(),
    keyEncrypted: !!s.apiKeyEnc,
    provider: s.provider,
    liveModel: s.liveModel,
    summaryModel: s.summaryModel,
    transcribeModel: s.transcribeModel,
    embedModel: s.embedModel,
    ollamaUrl: s.ollamaUrl,
    ollamaModel: s.ollamaModel,
    ollamaEmbedModel: s.ollamaEmbedModel,
    ollamaVisionModel: s.ollamaVisionModel,
    language: s.language,
    overlayPrivacy: s.overlayPrivacy,
    dataDir: dataDir()
  }
}

export function updateSettings(patch: Partial<AppSettings> & { apiKey?: string }): AppSettings {
  if (patch.apiKey !== undefined) setApiKey(patch.apiKey)
  const s = readSettingsFile()
  const stringKeys = [
    'liveModel',
    'summaryModel',
    'transcribeModel',
    'embedModel',
    'ollamaUrl',
    'ollamaModel',
    'ollamaEmbedModel',
    'ollamaVisionModel',
    'language'
  ] as const
  for (const k of stringKeys) {
    const v = patch[k]
    if (typeof v === 'string') s[k] = v
  }
  if (patch.provider === 'openai' || patch.provider === 'ollama') s.provider = patch.provider
  if (typeof patch.overlayPrivacy === 'boolean') s.overlayPrivacy = patch.overlayPrivacy
  writeJson(settingsPath(), s)
  return getSettings()
}
