import { api } from './api'
import type { Speaker } from '@shared/types'

export interface AudioState {
  running: boolean
  mic: boolean
  system: boolean
  micLevel: number
  sysLevel: number
  error?: string
}

const CYCLE_MS = 5000
const VOICE_THRESHOLD = 0.025
const MIN_BLOB_BYTES = 2200

/**
 * Captures microphone ("you") and system loopback audio ("them") as two
 * independent streams. Each stream runs a cycling MediaRecorder — restarted
 * every CYCLE_MS so every blob is a complete standalone WebM file — and
 * silent cycles are dropped client-side before they cost an API call.
 *
 * Module-level singleton so capture survives page navigation within the app.
 */
class LiveAudio {
  state: AudioState = { running: false, mic: false, system: false, micLevel: 0, sysLevel: 0 }
  private stops: (() => void)[] = []
  private listeners = new Set<() => void>()

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  private emit(): void {
    for (const l of this.listeners) l()
  }

  async start(opts: { mic: boolean; system: boolean }): Promise<void> {
    if (this.state.running) return
    this.state = { running: false, mic: false, system: false, micLevel: 0, sysLevel: 0 }
    const errors: string[] = []

    if (opts.mic) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true }
        })
        this.pipe(stream, 'you', (v) => (this.state.micLevel = v))
        this.state.mic = true
      } catch (e) {
        errors.push(`Microphone unavailable (${e instanceof Error ? e.message : e})`)
      }
    }

    if (opts.system) {
      try {
        // The main process display-media handler supplies loopback audio;
        // the video track is mandatory for the API but discarded immediately.
        const disp = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
        disp.getVideoTracks().forEach((t) => t.stop())
        const tracks = disp.getAudioTracks()
        if (tracks.length) {
          this.pipe(new MediaStream(tracks), 'them', (v) => (this.state.sysLevel = v))
          this.state.system = true
        } else {
          errors.push('System audio track not available')
        }
      } catch (e) {
        errors.push(`System audio unavailable (${e instanceof Error ? e.message : e})`)
      }
    }

    this.state.running = this.state.mic || this.state.system
    this.state.error = errors.join(' · ') || undefined
    this.emit()
    if (!this.state.running) {
      throw new Error(this.state.error || 'No audio sources could be started')
    }
  }

  stop(): void {
    for (const s of this.stops) {
      try {
        s()
      } catch {
        /* ignore teardown errors */
      }
    }
    this.stops = []
    this.state = { running: false, mic: false, system: false, micLevel: 0, sysLevel: 0 }
    this.emit()
  }

  private pipe(stream: MediaStream, speaker: Speaker, onLevel: (v: number) => void): void {
    const ctx = new AudioContext()
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 512
    ctx.createMediaStreamSource(stream).connect(analyser)
    const buf = new Uint8Array(analyser.frequencyBinCount)

    let voiced = false
    let stopped = false
    let rec: MediaRecorder | null = null

    const levelTimer = setInterval(() => {
      analyser.getByteFrequencyData(buf)
      let sum = 0
      for (let i = 0; i < buf.length; i++) sum += buf[i]
      const level = sum / buf.length / 255
      if (level > VOICE_THRESHOLD) voiced = true
      onLevel(level)
      this.emit()
    }, 150)

    const cycle = (): void => {
      if (stopped) return
      voiced = false
      const r = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
        audioBitsPerSecond: 48000
      })
      rec = r
      const parts: Blob[] = []
      r.ondataavailable = (e): void => {
        if (e.data.size) parts.push(e.data)
      }
      r.onstop = (): void => {
        const wasVoiced = voiced
        cycle() // start the next window immediately to avoid gaps
        if (wasVoiced && parts.length) {
          const blob = new Blob(parts, { type: 'audio/webm' })
          if (blob.size > MIN_BLOB_BYTES) {
            void blob.arrayBuffer().then((ab) => api.liveChunk(speaker, ab).catch(() => {}))
          }
        }
      }
      r.start()
      setTimeout(() => {
        if (r.state !== 'inactive') r.stop()
      }, CYCLE_MS)
    }
    cycle()

    this.stops.push(() => {
      stopped = true
      clearInterval(levelTimer)
      try {
        if (rec && rec.state !== 'inactive') rec.stop()
      } catch {
        /* ignore */
      }
      stream.getTracks().forEach((t) => t.stop())
      void ctx.close()
    })
  }
}

export const liveAudio = new LiveAudio()
