import fs from 'node:fs'
import path from 'node:path'
import { dirFor, newId, readJson, writeJson } from './store'
import { extractText } from './extract'
import { aiReady, cosine, embed } from './ai'
import type { Space, SpaceDoc } from '@shared/types'

interface Chunk {
  docId: string
  idx: number
  text: string
  vec?: number[]
}

interface SpaceFile extends Space {
  chunks: Chunk[]
}

const spacesDir = (): string => dirFor('spaces')
const fileFor = (id: string): string => path.join(spacesDir(), `${id}.json`)

function readSpaceFile(id: string): SpaceFile | null {
  const f = fileFor(id)
  if (!fs.existsSync(f)) return null
  const s = readJson<SpaceFile | null>(f, null)
  if (!s) return null
  s.docs ??= []
  s.chunks ??= []
  return s
}

function saveSpaceFile(s: SpaceFile): void {
  writeJson(fileFor(s.id), s)
}

function publicSpace(s: SpaceFile): Space {
  const { chunks: _chunks, ...rest } = s
  return rest
}

export function listSpaces(): Space[] {
  const out: Space[] = []
  for (const f of fs.readdirSync(spacesDir())) {
    if (!f.endsWith('.json')) continue
    const s = readSpaceFile(f.slice(0, -5))
    if (s) out.push(publicSpace(s))
  }
  return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function getSpace(id: string): Space | null {
  const s = readSpaceFile(id)
  return s ? publicSpace(s) : null
}

export function createSpace(name: string, description: string): Space {
  const s: SpaceFile = {
    id: newId('sp'),
    name: name.trim() || 'Untitled space',
    description: (description || '').trim(),
    createdAt: new Date().toISOString(),
    docs: [],
    chunks: []
  }
  saveSpaceFile(s)
  return publicSpace(s)
}

export function deleteSpace(id: string): void {
  const f = fileFor(id)
  if (fs.existsSync(f)) fs.unlinkSync(f)
}

function chunkText(text: string, size = 1400, overlap = 200): string[] {
  const out: string[] = []
  let i = 0
  while (i < text.length) {
    let end = Math.min(i + size, text.length)
    if (end < text.length) {
      const slice = text.slice(i, end)
      const brk = Math.max(slice.lastIndexOf('\n\n'), slice.lastIndexOf('. '))
      if (brk > size * 0.5) end = i + brk + 1
    }
    const piece = text.slice(i, end).trim()
    if (piece) out.push(piece)
    if (end >= text.length) break
    i = Math.max(end - overlap, i + 1)
  }
  return out
}

export async function addDocuments(spaceId: string, paths: string[]): Promise<Space> {
  const s = readSpaceFile(spaceId)
  if (!s) throw new Error('Knowledge space not found')
  for (const p of paths) {
    const doc: SpaceDoc = {
      id: newId('d'),
      name: path.basename(p),
      ext: path.extname(p).toLowerCase(),
      addedAt: new Date().toISOString(),
      chars: 0,
      chunkCount: 0,
      status: 'ready'
    }
    try {
      const text = (await extractText(p)).replace(/\r/g, '').trim()
      doc.chars = text.length
      const parts = chunkText(text)
      doc.chunkCount = parts.length
      let vecs: (number[] | undefined)[] = parts.map(() => undefined)
      if (parts.length && aiReady()) {
        try {
          vecs = await embed(parts)
        } catch {
          doc.status = 'no-embeddings'
        }
      } else if (parts.length) {
        doc.status = 'no-embeddings'
      }
      parts.forEach((t, i) => s.chunks.push({ docId: doc.id, idx: i, text: t, vec: vecs[i] }))
    } catch (err) {
      doc.status = 'error'
      doc.error = err instanceof Error ? err.message : String(err)
    }
    s.docs.push(doc)
  }
  saveSpaceFile(s)
  return publicSpace(s)
}

export function removeDocument(spaceId: string, docId: string): Space {
  const s = readSpaceFile(spaceId)
  if (!s) throw new Error('Knowledge space not found')
  s.docs = s.docs.filter((d) => d.id !== docId)
  s.chunks = s.chunks.filter((c) => c.docId !== docId)
  saveSpaceFile(s)
  return publicSpace(s)
}

/** Embed any chunks that are missing vectors (e.g. docs added before the API key was set). */
export async function reindexSpace(spaceId: string): Promise<Space> {
  const s = readSpaceFile(spaceId)
  if (!s) throw new Error('Knowledge space not found')
  const missing = s.chunks.filter((c) => !c.vec)
  if (missing.length && aiReady()) {
    const vecs = await embed(missing.map((c) => c.text))
    missing.forEach((c, i) => (c.vec = vecs[i]))
    for (const d of s.docs) {
      if (d.status === 'no-embeddings') d.status = 'ready'
    }
    saveSpaceFile(s)
  }
  return publicSpace(s)
}

/** Top-k chunks relevant to the query: embedding similarity, keyword fallback. */
export async function retrieve(spaceId: string, query: string, k = 6): Promise<string[]> {
  const s = readSpaceFile(spaceId)
  if (!s || !s.chunks.length || !query.trim()) return []
  const withVec = s.chunks.filter((c) => c.vec)
  if (withVec.length && aiReady()) {
    try {
      const [qv] = await embed([query.slice(0, 4000)])
      return withVec
        .map((c) => ({ c, score: cosine(qv, c.vec!) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, k)
        .map((x) => x.c.text)
    } catch {
      /* fall through to keyword search */
    }
  }
  const words = [...new Set(query.toLowerCase().split(/\W+/).filter((w) => w.length > 3))]
  return s.chunks
    .map((c) => {
      const lc = c.text.toLowerCase()
      let score = 0
      for (const w of words) if (lc.includes(w)) score++
      return { c, score }
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map((x) => x.c.text)
}
