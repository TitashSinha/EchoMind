export type SessionMode =
  | 'interview'
  | 'meeting'
  | 'sales'
  | 'presentation'
  | 'research'
  | 'custom'

export const MODE_LABELS: Record<SessionMode, string> = {
  interview: 'Interview',
  meeting: 'Meeting',
  sales: 'Sales Call',
  presentation: 'Presentation',
  research: 'Research',
  custom: 'Custom'
}

export type AiProvider = 'openai' | 'ollama'

export interface AppSettings {
  hasApiKey: boolean
  keyEncrypted: boolean
  /** Which backend serves chat / embeddings / vision. 'ollama' = fully local, no key. */
  provider: AiProvider
  liveModel: string
  summaryModel: string
  transcribeModel: string
  embedModel: string
  /** Base URL of the local Ollama server. */
  ollamaUrl: string
  /** Ollama model used for live suggestions and summaries. */
  ollamaModel: string
  /** Ollama model used to embed documents for retrieval. */
  ollamaEmbedModel: string
  /** Ollama vision model used for screenshot analysis. */
  ollamaVisionModel: string
  /** ISO-639-1 code passed to the transcription API. Empty string = auto-detect. */
  language: string
  /** When true the overlay window is excluded from screen capture / screen shares. */
  overlayPrivacy: boolean
  dataDir: string
}

export type DocStatus = 'ready' | 'no-embeddings' | 'error'

export interface SpaceDoc {
  id: string
  name: string
  ext: string
  addedAt: string
  chars: number
  chunkCount: number
  status: DocStatus
  error?: string
}

export interface Space {
  id: string
  name: string
  description: string
  createdAt: string
  docs: SpaceDoc[]
}

export type Speaker = 'you' | 'them'

export interface TranscriptSegment {
  id: string
  /** Milliseconds since session start. */
  t: number
  speaker: Speaker
  text: string
}

export interface SuggestionSet {
  generatedAt: number
  responses: string[]
  questions: string[]
  points: string[]
  warnings: string[]
  actionItems: string[]
  decisions: string[]
}

export interface SessionOutputs {
  summary: string
  actionItems: string[]
  decisions: string[]
  risks: string[]
  followUps: string[]
  highlights: string[]
}

export interface SessionMeta {
  id: string
  title: string
  mode: SessionMode
  customObjective?: string
  spaceId?: string
  spaceName?: string
  startedAt: string
  endedAt?: string
  durationMs?: number
}

export interface SessionRecord extends SessionMeta {
  transcript: TranscriptSegment[]
  suggestions: SuggestionSet[]
  outputs?: SessionOutputs
  notes?: string
}

export type MemoryType = 'profile' | 'achievement' | 'preference' | 'fact'

export interface MemoryEntry {
  id: string
  type: MemoryType
  text: string
  /** 'manual' or the id of the session it was extracted from. */
  source: string
  createdAt: string
}

export interface StartSessionOptions {
  title?: string
  mode: SessionMode
  customObjective?: string
  spaceId?: string
}

export interface LiveStatus {
  active: boolean
  phase: 'idle' | 'listening' | 'thinking'
  sessionId?: string
  startedAt?: string
}

export interface LiveSnapshot {
  status: LiveStatus
  meta?: SessionMeta
  transcript: TranscriptSegment[]
  latest?: SuggestionSet
}

export interface SearchHit {
  session: SessionMeta
  snippet: string
}
