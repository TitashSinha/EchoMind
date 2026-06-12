import type {
  AppSettings,
  LiveSnapshot,
  MemoryEntry,
  MemoryType,
  SearchHit,
  SessionMeta,
  SessionRecord,
  Space,
  Speaker,
  StartSessionOptions
} from './types'

export type LiveChannel =
  | 'live:segment'
  | 'live:suggestions'
  | 'live:status'
  | 'live:ended'
  | 'live:error'

/** API surface exposed to the renderer via contextBridge as `window.echomind`. */
export interface EchoBridge {
  getSettings(): Promise<AppSettings>
  updateSettings(patch: Partial<AppSettings> & { apiKey?: string }): Promise<AppSettings>
  pickFiles(): Promise<string[]>
  openDataDir(): Promise<void>

  listSpaces(): Promise<Space[]>
  getSpace(id: string): Promise<Space | null>
  createSpace(name: string, description: string): Promise<Space>
  deleteSpace(id: string): Promise<void>
  addDocuments(spaceId: string, paths: string[]): Promise<Space>
  removeDocument(spaceId: string, docId: string): Promise<Space>
  reindexSpace(spaceId: string): Promise<Space>

  startSession(opts: StartSessionOptions): Promise<SessionMeta>
  stopSession(): Promise<SessionRecord | null>
  liveChunk(speaker: Speaker, data: ArrayBuffer): Promise<void>
  getLiveSnapshot(): Promise<LiveSnapshot>

  listSessions(): Promise<SessionMeta[]>
  getSession(id: string): Promise<SessionRecord | null>
  deleteSession(id: string): Promise<void>
  saveNotes(id: string, notes: string): Promise<void>
  searchSessions(q: string): Promise<SearchHit[]>

  listMemory(): Promise<MemoryEntry[]>
  addMemory(type: MemoryType, text: string): Promise<MemoryEntry[]>
  deleteMemory(id: string): Promise<MemoryEntry[]>

  toggleOverlay(show?: boolean): Promise<boolean>

  on(channel: LiveChannel, cb: (payload: unknown) => void): () => void
}
