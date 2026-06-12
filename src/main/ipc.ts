import { dialog, ipcMain, shell } from 'electron'
import { dataDir, getSettings, updateSettings } from './store'
import {
  addDocuments,
  createSpace,
  deleteSpace,
  getSpace,
  listSpaces,
  reindexSpace,
  removeDocument
} from './spaces'
import { addChunk, getLiveSnapshot, startSession, stopSession } from './live'
import {
  deleteSession,
  getSession,
  listSessions,
  saveNotes,
  searchSessions
} from './sessions'
import { addMemory, deleteMemory, listMemory } from './memory'
import { applyOverlayPrivacy, getMainWindow, toggleOverlay } from './windows'
import type { AppSettings, MemoryType, Speaker, StartSessionOptions } from '@shared/types'

export function registerIpc(): void {
  ipcMain.handle('settings:get', () => getSettings())
  ipcMain.handle('settings:update', (_e, patch: Partial<AppSettings> & { apiKey?: string }) => {
    const result = updateSettings(patch)
    applyOverlayPrivacy()
    return result
  })

  ipcMain.handle('dialog:pickFiles', async () => {
    const win = getMainWindow()
    if (!win) return []
    const res = await dialog.showOpenDialog(win, {
      properties: ['openFile', 'multiSelections'],
      filters: [
        {
          name: 'Documents',
          extensions: ['pdf', 'docx', 'pptx', 'xlsx', 'xls', 'csv', 'txt', 'md', 'markdown']
        }
      ]
    })
    return res.canceled ? [] : res.filePaths
  })

  ipcMain.handle('app:openDataDir', () => shell.openPath(dataDir()))

  ipcMain.handle('spaces:list', () => listSpaces())
  ipcMain.handle('spaces:get', (_e, id: string) => getSpace(id))
  ipcMain.handle('spaces:create', (_e, name: string, description: string) =>
    createSpace(name, description)
  )
  ipcMain.handle('spaces:delete', (_e, id: string) => deleteSpace(id))
  ipcMain.handle('spaces:addDocs', (_e, spaceId: string, paths: string[]) =>
    addDocuments(spaceId, paths)
  )
  ipcMain.handle('spaces:removeDoc', (_e, spaceId: string, docId: string) =>
    removeDocument(spaceId, docId)
  )
  ipcMain.handle('spaces:reindex', (_e, spaceId: string) => reindexSpace(spaceId))

  ipcMain.handle('live:start', (_e, opts: StartSessionOptions) => startSession(opts))
  ipcMain.handle('live:stop', () => stopSession())
  ipcMain.handle('live:chunk', (_e, speaker: Speaker, data: ArrayBuffer) => {
    addChunk(speaker, Buffer.from(data))
  })
  ipcMain.handle('live:snapshot', () => getLiveSnapshot())

  ipcMain.handle('sessions:list', () => listSessions())
  ipcMain.handle('sessions:get', (_e, id: string) => getSession(id))
  ipcMain.handle('sessions:delete', (_e, id: string) => deleteSession(id))
  ipcMain.handle('sessions:saveNotes', (_e, id: string, notes: string) => saveNotes(id, notes))
  ipcMain.handle('sessions:search', (_e, q: string) => searchSessions(q))

  ipcMain.handle('memory:list', () => listMemory())
  ipcMain.handle('memory:add', (_e, type: MemoryType, text: string) => addMemory(type, text))
  ipcMain.handle('memory:delete', (_e, id: string) => deleteMemory(id))

  ipcMain.handle('overlay:toggle', (_e, show?: boolean) => toggleOverlay(show))
}
