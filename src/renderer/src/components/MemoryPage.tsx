import { useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { api } from '../api'
import type { MemoryEntry, MemoryType } from '@shared/types'

const TYPE_LABELS: Record<MemoryType, string> = {
  profile: 'Profile',
  achievement: 'Achievements',
  preference: 'Preferences',
  fact: 'Facts'
}

export default function MemoryPage(): JSX.Element {
  const [entries, setEntries] = useState<MemoryEntry[]>([])
  const [type, setType] = useState<MemoryType>('profile')
  const [text, setText] = useState('')

  useEffect(() => {
    void api.listMemory().then(setEntries)
  }, [])

  const add = async (): Promise<void> => {
    if (!text.trim()) return
    setEntries(await api.addMemory(type, text))
    setText('')
  }

  const remove = async (id: string): Promise<void> => {
    setEntries(await api.deleteMemory(id))
  }

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Memory</h1>
          <p className="muted">
            What EchoMind knows about you. It grows automatically after each session and feeds
            every live suggestion. You have full control — delete anything.
          </p>
        </div>
      </header>

      <div className="card pad form-inline">
        <select value={type} onChange={(e) => setType(e.target.value as MemoryType)}>
          {(Object.keys(TYPE_LABELS) as MemoryType[]).map((t) => (
            <option key={t} value={t}>
              {TYPE_LABELS[t]}
            </option>
          ))}
        </select>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="e.g. Led a content design system migration used by 40+ writers"
          onKeyDown={(e) => e.key === 'Enter' && void add()}
        />
        <button className="btn btn-primary" disabled={!text.trim()} onClick={() => void add()}>
          <Plus size={15} /> Add
        </button>
      </div>

      {(Object.keys(TYPE_LABELS) as MemoryType[]).map((t) => {
        const group = entries.filter((e) => e.type === t)
        if (!group.length) return null
        return (
          <section key={t} className="card pad">
            <h2>{TYPE_LABELS[t]}</h2>
            <div className="mem-list">
              {group.map((e) => (
                <div key={e.id} className="mem-item">
                  <span>{e.text}</span>
                  <span className="muted small">
                    {e.source === 'manual' ? 'added manually' : 'learned from a session'}
                  </span>
                  <button className="icon-btn" title="Forget" onClick={() => void remove(e.id)}>
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </section>
        )
      })}

      {entries.length === 0 && (
        <div className="card pad empty">
          <p className="muted">
            Nothing remembered yet. Add facts manually above, or run sessions — EchoMind extracts
            durable facts about you automatically when a session ends.
          </p>
        </div>
      )}
    </div>
  )
}
