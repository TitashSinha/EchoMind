import { useContext, useEffect, useState } from 'react'
import { Search, Trash2 } from 'lucide-react'
import { api } from '../api'
import { Nav } from '../App'
import { fmtDate, fmtDuration } from '../util'
import { MODE_LABELS, type SearchHit, type SessionMeta } from '@shared/types'

export default function SessionsPage(): JSX.Element {
  const nav = useContext(Nav)
  const [sessions, setSessions] = useState<SessionMeta[]>([])
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<SearchHit[] | null>(null)

  const refresh = (): void => {
    void api.listSessions().then(setSessions)
  }
  useEffect(refresh, [])

  useEffect(() => {
    const q = query.trim()
    if (!q) {
      setHits(null)
      return
    }
    const t = setTimeout(() => {
      void api.searchSessions(q).then(setHits)
    }, 250)
    return () => clearTimeout(t)
  }, [query])

  const remove = async (id: string, title: string): Promise<void> => {
    if (!confirm(`Delete session "${title}" including its transcript and summary?`)) return
    await api.deleteSession(id)
    refresh()
    if (hits) setHits(hits.filter((h) => h.session.id !== id))
  }

  const shown: { meta: SessionMeta; snippet?: string }[] = hits
    ? hits.map((h) => ({ meta: h.session, snippet: h.snippet }))
    : sessions.map((meta) => ({ meta }))

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Sessions</h1>
          <p className="muted">Every conversation, transcribed, summarized, and searchable.</p>
        </div>
      </header>

      <div className="search-box">
        <Search size={16} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search transcripts, summaries, and notes…"
        />
      </div>

      {shown.length === 0 ? (
        <div className="card pad empty">
          <p className="muted">{query ? 'No matches.' : 'No sessions yet.'}</p>
        </div>
      ) : (
        <div className="card rows">
          {shown.map(({ meta, snippet }) => (
            <div key={meta.id} className="row-wrap">
              <button className="row" onClick={() => nav({ page: 'session', id: meta.id })}>
                <span className={`chip mode-${meta.mode}`}>{MODE_LABELS[meta.mode]}</span>
                <span className="row-title">
                  {meta.title}
                  {snippet && <em className="snippet">{snippet}</em>}
                </span>
                <span className="muted">{fmtDuration(meta.durationMs)}</span>
                <span className="muted">{fmtDate(meta.startedAt)}</span>
              </button>
              <button
                className="icon-btn"
                title="Delete session"
                onClick={() => void remove(meta.id, meta.title)}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
