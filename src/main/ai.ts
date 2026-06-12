import OpenAI, { toFile } from 'openai'
import { getApiKey, getSettings } from './store'

let client: OpenAI | null = null
let clientKey = ''

function getClient(): OpenAI {
  const key = getApiKey()
  if (!key) throw new Error('OpenAI API key is not set. Add it in Settings.')
  if (!client || clientKey !== key) {
    client = new OpenAI({ apiKey: key })
    clientKey = key
  }
  return client
}

export function aiReady(): boolean {
  return !!getApiKey()
}

export async function embed(texts: string[]): Promise<number[][]> {
  const c = getClient()
  const { embedModel } = getSettings()
  const out: number[][] = []
  for (let i = 0; i < texts.length; i += 64) {
    const batch = texts.slice(i, i + 64).map((t) => t.slice(0, 8000) || ' ')
    const res = await c.embeddings.create({ model: embedModel, input: batch })
    for (const item of res.data) out.push(item.embedding)
  }
  return out
}

export async function transcribe(data: Buffer): Promise<string> {
  const c = getClient()
  const { transcribeModel, language } = getSettings()
  const file = await toFile(data, 'chunk.webm', { type: 'audio/webm' })
  const res = await c.audio.transcriptions.create({
    file,
    model: transcribeModel,
    ...(language ? { language } : {})
  })
  return (res.text || '').trim()
}

export async function chatJson<T>(opts: {
  system: string
  user: string
  model: string
  maxTokens?: number
}): Promise<T> {
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
  const raw = res.choices[0]?.message?.content || '{}'
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
