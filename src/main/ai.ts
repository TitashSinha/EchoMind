import OpenAI, { toFile } from 'openai'
import { getApiKey, getSettings } from './store'

let client: OpenAI | null = null
let clientKey = ''

function getClient(): OpenAI {
  const key = getApiKey()
  if (!key) {
    throw new Error(
      'OpenAI API key is not set. Add it in Settings, or switch the provider to Ollama (local).'
    )
  }
  if (!client || clientKey !== key) {
    client = new OpenAI({ apiKey: key })
    clientKey = key
  }
  return client
}

export function aiReady(): boolean {
  // The local provider needs no key; connection errors surface at call time.
  return getSettings().provider === 'ollama' || !!getApiKey()
}

// ---------- Ollama (local) ----------

async function ollamaFetch<T>(path: string, body: unknown): Promise<T> {
  const url = getSettings().ollamaUrl.replace(/\/$/, '') + path
  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
  } catch {
    throw new Error(
      `Cannot reach Ollama at ${getSettings().ollamaUrl}. Is it running? Start it with "ollama serve".`
    )
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Ollama error ${res.status}: ${text || res.statusText}`)
  }
  return (await res.json()) as T
}

// ---------- Embeddings ----------

export async function embed(texts: string[]): Promise<number[][]> {
  const s = getSettings()
  const input = texts.map((t) => t.slice(0, 8000) || ' ')
  if (s.provider === 'ollama') {
    const data = await ollamaFetch<{ embeddings: number[][] }>('/api/embed', {
      model: s.ollamaEmbedModel,
      input
    })
    return data.embeddings
  }
  const c = getClient()
  const out: number[][] = []
  for (let i = 0; i < input.length; i += 64) {
    const batch = input.slice(i, i + 64)
    const res = await c.embeddings.create({ model: s.embedModel, input: batch })
    for (const item of res.data) out.push(item.embedding)
  }
  return out
}

// ---------- Transcription ----------

export async function transcribe(data: Buffer): Promise<string> {
  const s = getSettings()
  if (s.provider === 'ollama') {
    // Ollama has no speech-to-text endpoint. Local STT runs in the renderer
    // (transformers.js Whisper); reaching here means transcription wasn't routed
    // locally — caller should use the renderer transcriber in local mode.
    throw new Error('Local transcription is handled in the renderer, not via Ollama.')
  }
  const c = getClient()
  const file = await toFile(data, 'chunk.webm', { type: 'audio/webm' })
  const res = await c.audio.transcriptions.create({
    file,
    model: s.transcribeModel,
    ...(s.language ? { language: s.language } : {})
  })
  return (res.text || '').trim()
}

// ---------- Chat (JSON out) ----------

export async function chatJson<T>(opts: {
  system: string
  user: string
  model: string
  maxTokens?: number
}): Promise<T> {
  const s = getSettings()
  let raw: string
  if (s.provider === 'ollama') {
    const data = await ollamaFetch<{ message?: { content?: string } }>('/api/chat', {
      model: s.ollamaModel,
      messages: [
        { role: 'system', content: opts.system },
        { role: 'user', content: opts.user }
      ],
      format: 'json',
      stream: false,
      options: { num_predict: opts.maxTokens ?? 900 }
    })
    raw = data.message?.content || '{}'
  } else {
    const c = getClient()
    const res = await c.chat.completions.create({
      model: opts.model,
      messages: [
        { role: 'system', content: opts.system },
        { role: 'user', content: opts.user }
      ],
      response_format: { type: 'json_object' },
      max_completion_tokens: opts.maxTokens ?? 900
    })
    raw = res.choices[0]?.message?.content || '{}'
  }
  return parseJson<T>(raw)
}

function parseJson<T>(raw: string): T {
  try {
    return JSON.parse(raw) as T
  } catch {
    const m = raw.match(/\{[\s\S]*\}/)
    if (m) {
      try {
        return JSON.parse(m[0]) as T
      } catch {
        /* fall through */
      }
    }
    throw new Error('Model returned invalid JSON')
  }
}

export function cosine(a: number[], b: number[]): number {
  let dot = 0
  let na = 0
  let nb = 0
  const n = Math.min(a.length, b.length)
  for (let i = 0; i < n; i++) {
    dot += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-9)
}
