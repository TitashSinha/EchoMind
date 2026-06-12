import fs from 'node:fs'
import path from 'node:path'
import { dirFor, readJson, writeJson } from './store'
import type { SearchHit, SessionMeta, SessionRecord } from '@shared/types'

const sessionsDir = (): string => dirFor('sessions')
const fileFor = (id: string): string => path.join(sessionsDir(), `${id}.json`)

export function saveSession(record: SessionRecord): void {
  writeJson(fileFor(record.id), record)
}

export function getSession(id: string): SessionRecord | null {
  const f = fileFor(id)
  if (!fs.existsSync(f)) return null
  return readJson<SessionRecord | null>(f, null)
}

export function listSessions(): SessionMeta[] {
  const out: SessionMeta[] = []
  for (const f of fs.readdirSync(sessionsDir())) {
    if (!f.endsWith('.json')) continue
    const rec = readJson<SessionRecord | null>(path.join(sessionsDir(), f), null)
    if (!rec) continue
    const { transcript: _t, suggestions: _s, outputs: _o, notes: _n, ...meta } = rec
    out.push(meta)
  }
  return out.sort((a, b) => b.startedAt.localeCompare(a.startedAt))
}

export function deleteSession(id: string): void {
  const f = fileFor(id)
  if (fs.existsSync(f)) fs.unlinkSync(f)
}

export function saveNotes(id: string, notes: string): void {
  const rec = getSession(id)
  if (!rec) throw new Error('Session not found')
  rec.notes = notes
  saveSession(rec)
}

export function searchSessions(q: string): SearchHit[] {
  const needle = q.toLowerCase().trim()
  if (!needle) return []
  const hits: SearchHit[] = []
  for (const meta of listSessions()) {
    const rec = getSession(meta.id)
    if (!rec) continue
    const hay = [
      rec.title,
      rec.outputs?.summary || '',
      rec.notes || '',
      rec.transcript.map((s) => s.text).join(' ')
    ].join('\n')
    const idx = hay.toLowerCase().indexOf(needle)
    if (idx >= 0) {
      const snippet = hay
        .slice(Math.max(0, idx - 60), idx + needle.length + 90)
        .replace(/\s+/g, ' ')
        .trim()
      hits.push({ session: meta, snippet: `…${snippet}…` })
    }
  }
  return hits
}
