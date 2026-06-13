import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import type { EchoBridge, LiveChannel } from '@shared/bridge'
import type { AppSettings, MemoryType, Speaker, StartSessionOptions } from '@shared/types'

const LIVE_CHANNELS = new Set<LiveChannel>([
  'live:segment',
  'live:suggestions',
  'live:status',
  'live:ended',
  'live:error',
  'live:end-requested'
])

const api: EchoBridge = {
  getSettings: () => ipcRenderer.invoke('settings:get'),
  updateSettings: (patch: Partial<AppSettings> & { apiKey?: string }) =>
    ipcRenderer.invoke('settings:update', patch),
  pickFiles: () => ipcRenderer.invoke('dialog:pickFiles'),
  openDataDir: () => ipcRenderer.invoke('app:openDataDir'),

  listSpaces: () => ipcRenderer.invoke('spaces:list'),
  getSpace: (id: string) => ipcRenderer.invoke('spaces:get', id),
  createSpace: (name: string, description: string) =>
    ipcRenderer.invoke('spaces:create', name, description),
  deleteSpace: (id: string) => ipcRenderer.invoke('spaces:delete', id),
  addDocuments: (spaceId: string, paths: string[]) =>
    ipcRenderer.invoke('spaces:addDocs', spaceId, paths),
  removeDocument: (spaceId: string, docId: string) =>
    ipcRenderer.invoke('spaces:removeDoc', spaceId, docId),
  reindexSpace: (spaceId: string) => ipcRenderer.invoke('spaces:reindex', spaceId),

  startSession: (opts: StartSessionOptions) => ipcRenderer.invoke('live:start', opts),
  stopSession: () => ipcRenderer.invoke('live:stop'),
  liveChunk: (speaker: Speaker, data: ArrayBuffer) =>
    ipcRenderer.invoke('live:chunk', speaker, data),
  getLiveSnapshot: () => ipcRenderer.invoke('live:snapshot'),

  listSessions: () => ipcRenderer.invoke('sessions:list'),
  getSession: (id: string) => ipcRenderer.invoke('sessions:get', id),
  deleteSession: (id: string) => ipcRenderer.invoke('sessions:delete', id),
  saveNotes: (id: string, notes: string) => ipcRenderer.invoke('sessions:saveNotes', id, notes),
  searchSessions: (q: string) => ipcRenderer.invoke('sessions:search', q),

  listMemory: () => ipcRenderer.invoke('memory:list'),
  addMemory: (type: MemoryType, text: string) => ipcRenderer.invoke('memory:add', type, text),
  deleteMemory: (id: string) => ipcRenderer.invoke('memory:delete', id),

  toggleOverlay: (show?: boolean) => ipcRenderer.invoke('overlay:toggle', show),
  requestEndSession: () => ipcRenderer.invoke('overlay:endSession'),

  on: (channel: LiveChannel, cb: (payload: unknown) => void) => {
    if (!LIVE_CHANNELS.has(channel)) throw new Error(`Unknown channel: ${channel}`)
    const listener = (_e: IpcRendererEvent, payload: unknown): void => cb(payload)
    ipcRenderer.on(channel, listener)
    return () => ipcRenderer.removeListener(channel, listener)
  }
}

contextBridge.exposeInMainWorld('echomind', api)
