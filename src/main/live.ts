import { aiReady, chatJson, transcribe } from './ai'
import { getSettings, newId } from './store'
import { getSpace, retrieve } from './spaces'
import { buildLiveSystemPrompt, buildMemoryPrompt, buildSummaryPrompt } from './modes'
import { saveSession } from './sessions'
import { addExtracted, memoryDigest } from './memory'
import { broadcast } from './windows'
import {
  MODE_LABELS,
  type LiveSnapshot,
  type LiveStatus,
  type SessionMeta,
  type SessionOutputs,
  type SessionRecord,
  type Speaker,
  type StartSessionOptions,
  type SuggestionSet,
  type TranscriptSegment
} from '@shared/types'

interface ActiveSession {
  meta: SessionMeta
  segments: TranscriptSegment[]
  suggestions: SuggestionSet[]
  cumulativeActions: string[]
  cumulativeDecisions: string[]
  startMs: number
  lastGenAt: number
  generating: boolean
  queued: boolean
  timer?: ReturnType<typeof setTimeout>
  /** Serializes transcription so segments stay in spoken order. */
  queue: Promise<void>
}

let active: ActiveSession | null = null

const arr = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && !!x.trim()) : []

export function getLiveStatus(): LiveStatus {
  if (!active) return { active: false, phase: 'idle' }
  return {
    active: true,
    phase: active.generating ? 'thinking' : 'listening',
    sessionId: active.meta.id,
    startedAt: active.meta.startedAt
  }
}

export function getLiveSnapshot(): LiveSnapshot {
  return {
    status: getLiveStatus(),
    meta: active?.meta,
    transcript: active ? [...active.segments] : [],
    latest: active?.suggestions.at(-1)
  }
}

export function startSession(opts: StartSessionOptions): SessionMeta {
  if (active) throw new Error('A session is already running. End it first.')
  const space = opts.spaceId ? getSpace(opts.spaceId) : null
  const now = new Date()
  const meta: SessionMeta = {
    id: newId('s'),
    title:
      (opts.title || '').trim() ||
      `${MODE_LABELS[opts.mode]} — ${now.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}, ${now.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`,
    mode: opts.mode,
    customObjective: opts.customObjective?.trim() || undefined,
    spaceId: space?.id,
    spaceName: space?.name,
    startedAt: now.toISOString()
  }
  active = {
    meta,
    segments: [],
    suggestions: [],
    cumulativeActions: [],
    cumulativeDecisions: [],
    startMs: Date.now(),
    lastGenAt: 0,
    generating: false,
    queued: false,
    queue: Promise.resolve()
  }
  broadcast('live:status', getLiveStatus())
  return meta
}

/** Common transcription artifacts produced from silence/noise. */
function isNoise(t: string): boolean {
  const junk = new Set([
    'you', 'bye.', 'bye', '.', 'uh', 'um', 'hmm', 'thank you.', 'thank you',
    'thanks for watching!', 'thanks for watching.', 'subtitles by the amara.org community'
  ])
  return t.length < 2 || junk.has(t.toLowerCase().trim())
}

/** Commit a transcribed segment to the active session and react to it. */
function ingest(a: ActiveSession, speaker: Speaker, text: string, tAt: number): void {
  const clean = text.trim()
  if (active !== a || !clean || isNoise(clean)) return
  const seg: TranscriptSegment = { id: newId('t'), t: tAt, speaker, text: clean }
  a.segments.push(seg)
  broadcast('live:segment', seg)
  // Only react when the OTHER party speaks. Regenerating while the user is
  // mid-answer would swap out the suggestion they're actively reading aloud,
  // which is jarring. The user's own speech still feeds context for the next
  // generation — it just doesn't trigger one. A short delay lets the other
  // party finish their thought before we respond.
  if (speaker === 'them') scheduleGenerate(1500)
}

/** Cloud path: transcribe an audio chunk (OpenAI), then ingest it. */
export function addChunk(speaker: Speaker, data: Buffer): void {
  if (!active) return
  const a = active
  const tAt = Date.now() - a.startMs
  a.queue = a.queue.then(async () => {
    if (active !== a) return
    let text = ''
    try {
      text = await transcribe(data)
    } catch (err) {
      broadcast('live:error', `Transcription failed: ${err instanceof Error ? err.message : err}`)
      return
    }
    ingest(a, speaker, text, tAt)
  })
}

/** Local path: a segment already transcribed in the renderer (Whisper via transformers.js). */
export function addText(speaker: Speaker, text: string): void {
  if (!active) return
  ingest(active, speaker, text, Date.now() - active.startMs)
}

function scheduleGenerate(delay: number): void {
  if (!active) return
  const minGap = 6000
  const since = Date.now() - active.lastGenAt
  const wait = Math.max(delay, minGap - since)
  clearTimeout(active.timer)
  active.timer = setTimeout(() => void generate(), wait)
}

async function generate(): Promise<void> {
  const a = active
  if (!a || !aiReady()) return
  if (a.generating) {
    a.queued = true
    return
  }
  a.generating = true
  broadcast('live:status', getLiveStatus())
  try {
    const recent = a.segments.slice(-60)
    if (!recent.length) return
    const transcriptTail = recent
      .map((s) => `${s.speaker === 'you' ? 'You' : 'Them'}: ${s.text}`)
      .join('\n')
      .slice(-12000)
    const query = recent.slice(-8).map((s) => s.text).join(' ')
    const docContext = a.meta.spaceId
      ? (await retrieve(a.meta.spaceId, query, 10))
          .map((t, i) => `[${i + 1}] ${t}`)
          .join('\n---\n')
          .slice(0, 18000)
      : ''
    if (active !== a) return
    const system = buildLiveSystemPrompt({
      mode: a.meta.mode,
      customObjective: a.meta.customObjective,
      memoryDigest: memoryDigest(),
      docContext,
      spaceName: a.meta.spaceName
    })
    const settings = getSettings()
    const out = await chatJson<Partial<SuggestionSet>>({
      system,
      user: `LIVE TRANSCRIPT (most recent last):\n${transcriptTail}\n\nGive me your best help for this exact moment.`,
      model: settings.liveModel,
      maxTokens: 700
    })
    if (active !== a) return
    const set: SuggestionSet = {
      generatedAt: Date.now(),
      responses: arr(out.responses).slice(0, 3),
      questions: arr(out.questions).slice(0, 3),
      points: arr(out.points).slice(0, 4),
      warnings: arr(out.warnings).slice(0, 2),
      actionItems: arr(out.actionItems),
      decisions: arr(out.decisions)
    }
    for (const item of set.actionItems) {
      if (!a.cumulativeActions.includes(item)) a.cumulativeActions.push(item)
    }
    for (const item of set.decisions) {
      if (!a.cumulativeDecisions.includes(item)) a.cumulativeDecisions.push(item)
    }
    a.suggestions.push(set)
    a.lastGenAt = Date.now()
    broadcast('live:suggestions', set)
  } catch (err) {
    broadcast('live:error', `Suggestions failed: ${err instanceof Error ? err.message : err}`)
  } finally {
    if (active === a) {
      a.generating = false
      broadcast('live:status', getLiveStatus())
      if (a.queued) {
        a.queued = false
        scheduleGenerate(500)
      }
    }
  }
}

export async function stopSession(): Promise<SessionRecord | null> {
  if (!active) return null
  const a = active
  active = null
  clearTimeout(a.timer)
  broadcast('live:status', getLiveStatus())
  const record: SessionRecord = {
    ...a.meta,
    endedAt: new Date().toISOString(),
    durationMs: Date.now() - a.startMs,
    transcript: a.segments,
    suggestions: a.suggestions
  }
  if (aiReady() && a.segments.length) {
    const fullTranscript = a.segments
      .map((s) => `${s.speaker === 'you' ? 'You' : 'Them'}: ${s.text}`)
      .join('\n')
    const settings = getSettings()
    try {
      const out = await chatJson<Partial<SessionOutputs>>({
        system: buildSummaryPrompt(a.meta.mode),
        user: fullTranscript,
        model: settings.summaryModel,
        maxTokens: 2400
      })
      const merge = (live: string[], post: string[]): string[] => {
        const seen = new Set(post.map((x) => x.toLowerCase()))
        return [...post, ...live.filter((x) => !seen.has(x.toLowerCase()))]
      }
      record.outputs = {
        summary: typeof out.summary === 'string' ? out.summary : '',
        actionItems: merge(a.cumulativeActions, arr(out.actionItems)),
        decisions: merge(a.cumulativeDecisions, arr(out.decisions)),
        risks: arr(out.risks),
        followUps: arr(out.followUps),
        highlights: arr(out.highlights)
      }
    } catch (err) {
      broadcast('live:error', `Summary failed: ${err instanceof Error ? err.message : err}`)
    }
    try {
      const mem = await chatJson<{ memories?: { type?: string; text?: string }[] }>({
        system: buildMemoryPrompt(),
        user: fullTranscript,
        model: settings.liveModel,
        maxTokens: 500
      })
      if (Array.isArray(mem.memories)) addExtracted(mem.memories, record.id)
    } catch {
      /* memory extraction is best-effort */
    }
  }
  saveSession(record)
  broadcast('live:ended', record.id)
  return record
}
