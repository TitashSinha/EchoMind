import path from 'node:path'
import { dataDir, newId, readJson, writeJson } from './store'
import type { MemoryEntry, MemoryType } from '@shared/types'

const MEMORY_TYPES: MemoryType[] = ['profile', 'achievement', 'preference', 'fact']

const memoryPath = (): string => path.join(dataDir(), 'memory.json')

export function listMemory(): MemoryEntry[] {
  return readJson<MemoryEntry[]>(memoryPath(), [])
}

function save(entries: MemoryEntry[]): void {
  writeJson(memoryPath(), entries)
}

export function addMemory(type: MemoryType, text: string, source = 'manual'): MemoryEntry[] {
  const entries = listMemory()
  const t = text.trim()
  if (t && !entries.some((e) => e.text.toLowerCase() === t.toLowerCase())) {
    entries.push({
      id: newId('m'),
      type: MEMORY_TYPES.includes(type) ? type : 'fact',
      text: t,
      source,
      createdAt: new Date().toISOString()
    })
    save(entries)
  }
  return entries
}

export function deleteMemory(id: string): MemoryEntry[] {
  const entries = listMemory().filter((e) => e.id !== id)
  save(entries)
  return entries
}

/** Entries extracted automatically from a finished session. */
export function addExtracted(
  items: { type?: string; text?: string }[],
  sessionId: string
): void {
  let count = 0
  for (const item of items) {
    if (!item.text || count >= 5) continue
    addMemory((item.type as MemoryType) || 'fact', item.text, sessionId)
    count++
  }
}

/** Compact digest of memory for inclusion in live prompts. */
export function memoryDigest(maxChars = 1800): string {
  const entries = listMemory()
  const lines: string[] = []
  let used = 0
  // Newest first so fresh facts survive the cap.
  for (const e of [...entries].reverse()) {
    const line = `- [${e.type}] ${e.text}`
    if (used + line.length > maxChars) break
    lines.push(line)
    used += line.length + 1
  }
  return lines.join('\n')
}
