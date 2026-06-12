import { useContext, useEffect, useState } from 'react'
import { ArrowLeft, Save } from 'lucide-react'
import { api } from '../api'
import { Nav } from '../App'
import { fmtClock, fmtDate, fmtDuration } from '../util'
import { MODE_LABELS, type SessionRecord } from '@shared/types'

export default function SessionDetail(props: { id: string }): JSX.Element {
  const nav = useContext(Nav)
  const [rec, setRec] = useState<SessionRecord | null>(null)
  const [notes, setNotes] = useState('')
  const [savedAt, setSavedAt] = useState(0)

  useEffect(() => {
    void api.getSession(props.id).then((r) => {
      setRec(r)
      setNotes(r?.notes || '')
    })
  }, [props.id])

  if (!rec) {
    return (
      <div className="page">
        <p className="muted pad">Loading…</p>
      </div>
    )
  }

  const save = async (): Promise<void> => {
    await api.saveNotes(rec.id, notes)
    setSavedAt(Date.now())
  }

  const o = rec.outputs

  const ListCard = (p: { title: string; items?: string[] }): JSX.Element | null =>
    !p.items || p.items.length === 0 ? null : (
      <section className="card pad">
        <h2>{p.title}</h2>
        <ul className="bullets">
          {p.items.map((x, i) => (
            <li key={i}>{x}</li>
          ))}
        </ul>
      </section>
    )

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <button className="btn btn-ghost back" onClick={() => nav({ page: 'sessions' })}>
            <ArrowLeft size={15} /> All sessions
          </button>
          <h1>{rec.title}</h1>
          <p className="muted">
            <span className={`chip mode-${rec.mode}`}>{MODE_LABELS[rec.mode]}</span>{' '}
            {fmtDate(rec.startedAt)} · {fmtDuration(rec.durationMs)}
            {rec.spaceName && <> · space: {rec.spaceName}</>}
          </p>
        </div>
      </header>

      {o?.summary && (
        <section className="card pad">
          <h2>Summary</h2>
          <p className="prose">{o.summary}</p>
        </section>
      )}

      <div className="two-col">
        <ListCard title="Action items" items={o?.actionItems} />
        <ListCard title="Decisions" items={o?.decisions} />
        <ListCard title="Risks" items={o?.risks} />
        <ListCard title="Follow-ups" items={o?.followUps} />
      </div>
      <ListCard title="Highlights" items={o?.highlights} />

      <section className="card pad">
        <div className="card-head bare">
          <h2>Notes</h2>
          <button className="btn" onClick={() => void save()}>
            <Save size={14} /> {savedAt && Date.now() - savedAt < 3000 ? 'Saved ✓' : 'Save'}
          </button>
        </div>
        <textarea
          rows={4}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Your private notes about this session…"
        />
      </section>

      <section className="card pad">
        <h2>Transcript</h2>
        {rec.transcript.length === 0 ? (
          <p className="muted">No speech was captured in this session.</p>
        ) : (
          <div className="transcript static">
            {rec.transcript.map((s) => (
              <div key={s.id} className={`seg ${s.speaker}`}>
                <span className="seg-who">{s.speaker === 'you' ? 'You' : 'Them'}</span>
                <span className="seg-time">{fmtClock(s.t)}</span>
                <p>{s.text}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
