import { useContext, useEffect, useState } from 'react'
import { FileText, History, Library, Brain, Radio, AlertTriangle } from 'lucide-react'
import { api } from '../api'
import { Nav } from '../App'
import { fmtDate, fmtDuration } from '../util'
import { MODE_LABELS, type AppSettings, type MemoryEntry, type SessionMeta, type Space } from '@shared/types'

export default function Dashboard(): JSX.Element {
  const nav = useContext(Nav)
  const [spaces, setSpaces] = useState<Space[]>([])
  const [sessions, setSessions] = useState<SessionMeta[]>([])
  const [memory, setMemory] = useState<MemoryEntry[]>([])
  const [settings, setSettings] = useState<AppSettings | null>(null)

  useEffect(() => {
    void Promise.all([
      api.listSpaces(),
      api.listSessions(),
      api.listMemory(),
      api.getSettings()
    ]).then(([sp, se, me, st]) => {
      setSpaces(sp)
      setSessions(se)
      setMemory(me)
      setSettings(st)
    })
  }, [])

  const docCount = spaces.reduce((n, s) => n + s.docs.length, 0)
  const hr = new Date().getHours()
  const greeting = hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>{greeting}</h1>
          <p className="muted">Your personal intelligence layer for professional conversations.</p>
        </div>
        <button className="btn btn-primary" onClick={() => nav({ page: 'live' })}>
          <Radio size={16} /> Start a session
        </button>
      </header>

      {settings && settings.provider === 'openai' && !settings.hasApiKey && (
        <div className="banner warn" onClick={() => nav({ page: 'settings' })} role="button">
          <AlertTriangle size={16} />
          <span>
            No OpenAI API key configured. Add one in <b>Settings</b>, or switch to the local
            <b> Ollama</b> provider to run free.
          </span>
        </div>
      )}

      <div className="stat-grid">
        <button className="stat-card" onClick={() => nav({ page: 'spaces' })}>
          <span className="stat-icon">
            <Library size={18} />
          </span>
          <div className="stat-meta">
            <b>{spaces.length}</b>
            <span>Knowledge spaces</span>
          </div>
        </button>
        <button className="stat-card" onClick={() => nav({ page: 'spaces' })}>
          <span className="stat-icon">
            <FileText size={18} />
          </span>
          <div className="stat-meta">
            <b>{docCount}</b>
            <span>Documents</span>
          </div>
        </button>
        <button className="stat-card" onClick={() => nav({ page: 'sessions' })}>
          <span className="stat-icon">
            <History size={18} />
          </span>
          <div className="stat-meta">
            <b>{sessions.length}</b>
            <span>Sessions</span>
          </div>
        </button>
        <button className="stat-card" onClick={() => nav({ page: 'memory' })}>
          <span className="stat-icon">
            <Brain size={18} />
          </span>
          <div className="stat-meta">
            <b>{memory.length}</b>
            <span>Memory entries</span>
          </div>
        </button>
      </div>

      <section className="card">
        <div className="card-head">
          <h2>Recent sessions</h2>
          <button className="btn btn-ghost" onClick={() => nav({ page: 'sessions' })}>
            View all
          </button>
        </div>
        {sessions.length === 0 ? (
          <p className="muted pad">
            No sessions yet. Create a knowledge space, upload your documents (resume, job
            description, agendas…), then start a live session before your next interview or
            meeting.
          </p>
        ) : (
          <div className="rows">
            {sessions.slice(0, 5).map((s) => (
              <button key={s.id} className="row" onClick={() => nav({ page: 'session', id: s.id })}>
                <span className={`chip mode-${s.mode}`}>{MODE_LABELS[s.mode]}</span>
                <span className="row-title">{s.title}</span>
                <span className="muted">{fmtDuration(s.durationMs)}</span>
                <span className="muted">{fmtDate(s.startedAt)}</span>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
