/**
 * Fully-local speech-to-text using transformers.js (Whisper) — runs in the
 * renderer via WebGPU (falling back to WASM), so no audio ever leaves the
 * machine and no API key/token is needed. Used when the AI provider is Ollama.
 *
 * The library and model are loaded lazily on first use (the model is downloaded
 * once from the Hugging Face hub, then cached by the browser for offline reuse).
 */

// Multilingual + small enough to keep up with real-time 5s chunks. Swap for
// 'Xenova/whisper-base' for higher accuracy at the cost of speed.
const MODEL = 'Xenova/whisper-tiny'

type Asr = (input: Float32Array, opts?: Record<string, unknown>) => Promise<{ text?: string }>

let asr: Asr | null = null
let loading: Promise<Asr> | null = null

export type SttProgress = (ratio: number) => void

async function build(onProgress?: SttProgress): Promise<Asr> {
  const tf = (await import('@huggingface/transformers')) as unknown as {
    pipeline: (task: string, model: string, opts?: Record<string, unknown>) => Promise<Asr>
    env: { allowLocalModels: boolean }
  }
  // Always fetch from the hub (and cache); we don't ship local model files.
  tf.env.allowLocalModels = false

  const progress_callback = (info: { status?: string; progress?: number }): void => {
    if (info?.progress != null) onProgress?.(Math.max(0, Math.min(1, info.progress / 100)))
  }

  // Prefer WebGPU for speed; fall back to WASM where it isn't available.
  try {
    return await tf.pipeline('automatic-speech-recognition', MODEL, {
      device: 'webgpu',
      progress_callback
    })
  } catch {
    return await tf.pipeline('automatic-speech-recognition', MODEL, { progress_callback })
  }
}

export function ensureStt(onProgress?: SttProgress): Promise<Asr> {
  if (asr) return Promise.resolve(asr)
  if (!loading) loading = build(onProgress).then((p) => (asr = p))
  return loading
}

/** Decode a WebM/Opus blob to mono 16 kHz Float32 PCM (what Whisper expects). */
async function blobToPcm16k(blob: Blob): Promise<Float32Array> {
  const arrayBuf = await blob.arrayBuffer()
  const tmp = new AudioContext()
  let decoded: AudioBuffer
  try {
    decoded = await tmp.decodeAudioData(arrayBuf)
  } finally {
    void tmp.close()
  }
  const offline = new OfflineAudioContext(1, Math.ceil(decoded.duration * 16000), 16000)
  const src = offline.createBufferSource()
  src.buffer = decoded
  src.connect(offline.destination)
  src.start()
  const rendered = await offline.startRendering()
  return rendered.getChannelData(0)
}

export async function transcribeLocal(blob: Blob, language?: string): Promise<string> {
  const model = await ensureStt()
  const pcm = await blobToPcm16k(blob)
  if (!pcm.length) return ''
  const out = await model(pcm, {
    task: 'transcribe',
    ...(language ? { language } : {})
  })
  return (out?.text || '').trim()
}
