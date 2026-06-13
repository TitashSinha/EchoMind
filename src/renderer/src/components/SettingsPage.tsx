import { useEffect, useState } from 'react'
import { AlertTriangle, Cpu, FolderOpen, KeyRound, ShieldCheck } from 'lucide-react'
import { api } from '../api'
import type { AppSettings } from '@shared/types'

export default function SettingsPage(): JSX.Element {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [apiKey, setApiKey] = useState('')
  const [savedMsg, setSavedMsg] = useState('')

  useEffect(() => {
    void api.getSettings().then(setSettings)
  }, [])

  if (!settings) {
    return (
      <div className="page">
        <p className="muted pad">Loading…</p>
      </div>
    )
  }

  const flash = (msg: string): void => {
    setSavedMsg(msg)
    setTimeout(() => setSavedMsg(''), 2500)
  }

  const update = async (patch: Partial<AppSettings> & { apiKey?: string }): Promise<void> => {
    setSettings(await api.updateSettings(patch))
    flash('Saved ✓')
  }

  const saveKey = async (): Promise<void> => {
    if (!apiKey.trim()) return
    await update({ apiKey: apiKey.trim() })
    setApiKey('')
  }

  const field = (
    key:
      | 'liveModel'
      | 'summaryModel'
      | 'transcribeModel'
      | 'embedModel'
      | 'ollamaUrl'
      | 'ollamaModel'
      | 'ollamaEmbedModel'
      | 'ollamaVisionModel'
      | 'language',
    label: string,
    hint: string
  ): JSX.Element => (
    <label className="field">
      <span>
        {label} <em className="muted small">{hint}</em>
      </span>
      <input
        defaultValue={settings[key]}
        onBlur={(e) => {
          if (e.target.value !== settings[key]) void update({ [key]: e.target.value })
        }}
      />
    </label>
  )

  return (
    <div className="page narrow">
      <header className="page-head">
        <div>
          <h1>Settings</h1>
          <p className="muted">{savedMsg || 'Everything is stored locally on this computer.'}</p>
        </div>
      </header>

      <section className="card pad form">
        <h2>
          <Cpu size={16} /> AI provider
        </h2>
        <label className="field">
          <span>
            Backend <em className="muted small">— where chat, embeddings & vision run</em>
          </span>
          <select
            value={settings.provider}
            onChange={(e) => void update({ provider: e.target.value as AppSettings['provider'] })}
          >
            <option value="openai">OpenAI (cloud — needs API key & credits)</option>
            <option value="ollama">Ollama (local — free, private, runs on your machine)</option>
          </select>
        </label>
        {settings.provider === 'ollama' && (
          <p className="muted small">
            <ShieldCheck size={13} /> Fully local: no key, no token cost, nothing leaves your
            computer. Requires{' '}
            <b>
              <a href="https://ollama.com" target="_blank" rel="noreferrer">
                Ollama
              </a>
            </b>{' '}
            running. Pull models first, e.g. <code>ollama pull llama3.2</code> and{' '}
            <code>ollama pull nomic-embed-text</code>.
          </p>
        )}
      </section>

      {settings.provider === 'openai' && (
      <section className="card pad form">
        <h2>
          <KeyRound size={16} /> OpenAI API key
        </h2>
        {settings.hasApiKey ? (
          <p className="muted small">
            <ShieldCheck size={13} /> Key saved
            {settings.keyEncrypted ? ' (encrypted with Windows DPAPI)' : ' (plaintext fallback)'} —
            paste a new key below to replace it.
          </p>
        ) : (
          <p className="muted small">
            Required for transcription, suggestions, and document indexing. Get one at
            platform.openai.com.
          </p>
        )}
        <div className="form-inline bare">
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-…"
            onKeyDown={(e) => e.key === 'Enter' && void saveKey()}
          />
          <button className="btn btn-primary" disabled={!apiKey.trim()} onClick={() => void saveKey()}>
            Save key
          </button>
          {settings.hasApiKey && (
            <button className="btn" onClick={() => void update({ apiKey: '' })}>
              Remove
            </button>
          )}
        </div>
      </section>
      )}

      {settings.provider === 'openai' && (
      <section className="card pad form">
        <h2>Models</h2>
        {field('liveModel', 'Live suggestions', '— low latency matters; gpt-5.4-mini recommended')}
        {field('summaryModel', 'Session summaries', '— gpt-5.4 recommended (long context, full transcript)')}
        {field('transcribeModel', 'Transcription', '— whisper-1 recommended')}
        {field('embedModel', 'Embeddings', '— text-embedding-3-small recommended')}
        {field('language', 'Spoken language', '— ISO code like "en", or blank for auto-detect')}
      </section>
      )}

      {settings.provider === 'ollama' && (
      <section className="card pad form">
        <h2>Local models (Ollama)</h2>
        {field('ollamaModel', 'Chat model', '— suggestions & summaries; e.g. llama3.2, qwen2.5')}
        {field('ollamaEmbedModel', 'Embedding model', '— for documents; e.g. nomic-embed-text')}
        {field('ollamaVisionModel', 'Vision model', '— for screenshots; e.g. llama3.2-vision, llava')}
        {field('ollamaUrl', 'Ollama server URL', '— default http://localhost:11434')}
        {field('language', 'Spoken language', '— ISO code like "en", or blank for auto-detect')}
        <div className="banner warn">
          <AlertTriangle size={15} />
          <span>
            Live transcription still needs a speech-to-text engine. Local Whisper is coming next;
            until then, transcription requires the OpenAI provider.
          </span>
        </div>
      </section>
      )}

      <section className="card pad form">
        <h2>Overlay</h2>
        <label className="check">
          <input
            type="checkbox"
            checked={settings.overlayPrivacy}
            onChange={(e) => void update({ overlayPrivacy: e.target.checked })}
          />
          Keep overlay private during screen sharing
          <span className="muted small">
            — excludes the overlay window from screen capture so it never appears in a share or
            recording
          </span>
        </label>
      </section>

      <section className="card pad form">
        <h2>Your data</h2>
        <p className="muted small">
          Documents, transcripts, sessions, memory, and settings live in a local folder. Nothing is
          uploaded anywhere except the audio chunks and text sent to the OpenAI API during
          sessions and indexing.
        </p>
        <div className="form-inline bare">
          <code className="path">{settings.dataDir}</code>
          <button className="btn" onClick={() => void api.openDataDir()}>
            <FolderOpen size={14} /> Open folder
          </button>
        </div>
      </section>
    </div>
  )
}
