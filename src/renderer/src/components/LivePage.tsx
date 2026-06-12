import { useContext, useEffect, useRef, useState } from 'react'
import {
  AlertTriangle,
  CheckSquare,
  Gavel,
  HelpCircle,
  Lightbulb,
  MessageSquare,
  Mic,
  MonitorSpeaker,
  PictureInPicture2,
  Square
} from 'lucide-react'
import { api } from '../api'
import { liveAudio } from '../audio'
import { Nav } from '../App'
import { fmtClock } from '../util'
import {
  MODE_LABELS,
  type LiveStatus,
  type SessionMode,
  type Space,
  type SuggestionSet,
  type TranscriptSegment
} from '@shared/types'

export default function LivePage(): JSX.Element {
  const nav = useContext(Nav)
  const [status, setStatus] = useState<LiveStatus>({ active: false, phase: 'idle' })
  const [title, setTitle] = useState<string>('')

  useEffect(() => {
    void api.getLiveSnapshot().then((s) => {
      setStatus(s.status)
      if (s.meta) setTitle(s.meta.title)
    })
    const off = api.on('live:status', (s) => setStatus(s as LiveStatus))
    return off
  }, [])

  return status.active ? (
    <ActiveSession status={status} title={title} />
  ) : (
    <SetupForm
      onStarted={(t) => {
        setTitle(t)
        void api.getLiveSnapshot().then((s) => setStatus(s.status))
      }}
      onNavSettings={() => nav({ page: 'settings' })}
    />
  )
}

function SetupForm(props: {
  onStarted: (title: string) => void
  onNavSettings: () => void
}): JSX.Element {
  const [spaces, setSpaces] = useState<Space[]>([])
  const [title, setTitle] = useState('')
  const [mode, setMode] = useState<SessionMode>('interview')
  const [spaceId, setSpaceId] = useState('')
  const [objective, setObjective] = useState('')
  const [useMic, setUseMic] = useState(true)
  const [useSystem, setUseSystem] = useState(true)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    void api.listSpaces().then(setSpaces)
  }, [])

  const start = async (): Promise<void> => {
    setStarting(true)
    setError('')
    try {
      const settings = await api.getSettings()
      if (!settings.hasApiKey) {
        throw new Error('Add your OpenAI API key in Settings before starting a session.')
      }
      if (!useMic && !useSystem) {
        throw new Error('Enable at least one audio source.')
      }
      const meta = await api.startSession({
        title: title.trim() || undefined,
        mode,
        customObjective: mode === 'custom' ? objective : undefined,
        spaceId: spaceId || undefined
      })
      try {
        await liveAudio.start({ mic: useMic, system: useSystem })
      } catch (e) {
        await api.stopSession()
        throw e
      }
      void api.toggleOverlay(true)
      props.onStarted(meta.title)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setStarting(false)
    }
  }

  return (
    <div className="page narrow">
      <header className="page-head">
        <div>
          <h1>Start a live session</h1>
          <p className="muted">
            EchoMind listens, retrieves from your documents, and whispers suggestions in real time.
          </p>
        </div>
      </header>

      {error && (
        <div className="banner warn">
          <AlertTriangle size={16} />
          <span>{error}</span>
          {error.includes('Settings') && (
            <button className="btn btn-ghost" onClick={props.onNavSettings}>
              Open Settings
            </button>
          )}
        </div>
      )}

      <div className="card pad form">
        <label className="field">
          <span>Session title</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Interview — Acme Corp, Senior Content Strategist"
          />
        </label>

        <div className="field">
          <span>Mode</span>
          <div className="pills">
            {(Object.keys(MODE_LABELS) as SessionMode[]).map((m) => (
              <button
                key={m}
                className={`pill ${mode === m ? 'active' : ''}`}
                onClick={() => setMode(m)}
              >
                {MODE_LABELS[m]}
              </button>
            ))}
          </div>
        </div>

        {mode === 'custom' && (
          <label className="field">
            <span>Your objective</span>
            <textarea
              rows={3}
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              placeholder="Describe what you want EchoMind to listen for and help with…"
            />
          </label>
        )}

        <label className="field">
          <span>Knowledge space (documents EchoMind can draw from)</span>
          <select value={spaceId} onChange={(e) => setSpaceId(e.target.value)}>
            <option value="">None</option>
            {spaces.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.docs.length} docs)
              </option>
            ))}
          </select>
        </label>

        <div className="field">
          <span>Audio sources</span>
          <label className="check">
            <input type="checkbox" checked={useMic} onChange={(e) => setUseMic(e.target.checked)} />
            <Mic size={15} /> My microphone <span className="muted">(what you say)</span>
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={useSystem}
              onChange={(e) => setUseSystem(e.target.checked)}
            />
            <MonitorSpeaker size={15} /> System audio{' '}
            <span className="muted">(the other side — Zoom, Teams, Meet…)</span>
          </label>
        </div>

        <button className="btn btn-primary big" disabled={starting} onClick={() => void start()}>
          {starting ? 'Starting…' : 'Start session'}
        </button>
      </div>
    </div>
  )
}

function ActiveSession(props: { status: LiveStatus; title: string }): JSX.Element {
  const nav = useContext(Nav)
  const [segments, setSegments] = useState<TranscriptSegment[]>([])
  const [latest, setLatest] = useState<SuggestionSet | null>(null)
  const [error, setError] = useState('')
  const [ending, setEnding] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [, forceAudio] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    void api.getLiveSnapshot().then((s) => {
      setSegments(s.transcript)
      setLatest(s.latest ?? null)
    })
    const offs = [
      api.on('live:segment', (p) => setSegments((prev) => [...prev, p as TranscriptSegment])),
      api.on('live:suggestions', (p) => setLatest(p as SuggestionSet)),
      api.on('live:error', (p) => setError(String(p)))
    ]
    const offAudio = liveAudio.subscribe(() => forceAudio((n) => n + 1))
    return () => {
      offs.forEach((off) => off())
      offAudio()
    }
  }, [])

  useEffect(() => {
    const started = props.status.startedAt ? new Date(props.status.startedAt).getTime() : Date.now()
    const t = setInterval(() => setElapsed(Date.now() - started), 1000)
    return () => clearInterval(t)
  }, [props.status.startedAt])

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [segments])

  const end = async (): Promise<void> => {
    setEnding(true)
    liveAudio.stop()
    const rec = await api.stopSession()
    void api.toggleOverlay(false)
    setEnding(false)
    if (rec) nav({ page: 'session', id: rec.id })
  }

  const a = liveAudio.state

  return (
    <div className="page full">
      <header className="page-head live-head">
        <div>
          <h1>
            <span className="live-dot big" /> {props.title}
          </h1>
          <p className="muted">
            {fmtClock(elapsed)} ·{' '}
            {props.status.phase === 'thinking' ? 'Thinking…' : 'Listening'}
            {a.mic && (
              <span className="meter" title="Microphone level">
                <Mic size={12} />
                <i style={{ width: `${Math.min(100, a.micLevel * 300)}%` }} />
              </span>
            )}
            {a.system && (
              <span className="meter" title="System audio level">
                <MonitorSpeaker size={12} />
                <i style={{ width: `${Math.min(100, a.sysLevel * 300)}%` }} />
              </span>
            )}
          </p>
        </div>
        <div className="head-actions">
          <button className="btn" onClick={() => void api.toggleOverlay()}>
            <PictureInPicture2 size={15} /> Overlay
          </button>
          <button className="btn btn-danger" disabled={ending} onClick={() => void end()}>
            <Square size={14} /> {ending ? 'Generating summary…' : 'End session'}
          </button>
        </div>
      </header>

      {error && (
        <div className="banner warn">
          <AlertTriangle size={16} />
          <span>{error}</span>
          <button className="btn btn-ghost" onClick={() => setError('')}>
            Dismiss
          </button>
        </div>
      )}
      {a.error && (
        <div className="banner warn">
          <AlertTriangle size={16} />
          <span>{a.error}</span>
        </div>
      )}

      <div className="live-grid">
        <section className="card transcript" ref={scrollRef}>
          {segments.length === 0 ? (
            <p className="muted pad">Waiting for speech… talk or let the other side talk.</p>
          ) : (
            segments.map((s) => (
              <div key={s.id} className={`seg ${s.speaker}`}>
                <span className="seg-who">{s.speaker === 'you' ? 'You' : 'Them'}</span>
                <span className="seg-time">{fmtClock(s.t)}</span>
                <p>{s.text}</p>
              </div>
            ))
          )}
        </section>

        <section className="sugg-panel">
          {!latest ? (
            <div className="card pad muted">
              Suggestions will appear here as the conversation develops.
            </div>
          ) : (
            <SuggestionList set={latest} />
          )}
        </section>
      </div>
    </div>
  )
}

export function SuggestionList(props: { set: SuggestionSet; compact?: boolean }): JSX.Element {
  const { set } = props
  const copy = (text: string): void => {
    void navigator.clipboard.writeText(text)
  }
  const Block = (p: {
    items: string[]
    label: string
    icon: JSX.Element
    cls: string
  }): JSX.Element | null =>
    p.items.length === 0 ? null : (
      <div className="sugg-block">
        <h3>
          {p.icon} {p.label}
        </h3>
        {p.items.map((t, i) => (
          <button key={i} className={`sugg ${p.cls}`} onClick={() => copy(t)} title="Click to copy">
            {t}
          </button>
        ))}
      </div>
    )

  return (
    <div className={`sugg-list ${props.compact ? 'compact' : ''}`}>
      <Block items={set.warnings} label="Heads up" icon={<AlertTriangle size={13} />} cls="warn" />
      <Block
        items={set.responses}
        label="Say this"
        icon={<MessageSquare size={13} />}
        cls="primary"
      />
      <Block items={set.questions} label="Ask this" icon={<HelpCircle size={13} />} cls="ask" />
      <Block items={set.points} label="Key points" icon={<Lightbulb size={13} />} cls="point" />
      <Block
        items={set.actionItems}
        label="Action items"
        icon={<CheckSquare size={13} />}
        cls="action"
      />
      <Block items={set.decisions} label="Decisions" icon={<Gavel size={13} />} cls="action" />
    </div>
  )
}
