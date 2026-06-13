import { useEffect, useState } from 'react'
import { Brain, ChevronDown, ChevronUp, Square, X } from 'lucide-react'
import { api } from '../api'
import { fmtClock } from '../util'
import type { LiveStatus, SuggestionSet, TranscriptSegment } from '@shared/types'
import { SuggestionList } from './LivePage'

export default function Overlay(): JSX.Element {
  const [status, setStatus] = useState<LiveStatus>({ active: false, phase: 'idle' })
  const [latest, setLatest] = useState<SuggestionSet | null>(null)
  const [lastSeg, setLastSeg] = useState<TranscriptSegment | null>(null)
  const [collapsed, setCollapsed] = useState(false)
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    void api.getLiveSnapshot().then((s) => {
      setStatus(s.status)
      setLatest(s.latest ?? null)
      setLastSeg(s.transcript[s.transcript.length - 1] ?? null)
    })
    const offs = [
      api.on('live:status', (p) => setStatus(p as LiveStatus)),
      api.on('live:suggestions', (p) => setLatest(p as SuggestionSet)),
      api.on('live:segment', (p) => setLastSeg(p as TranscriptSegment)),
      api.on('live:ended', () => {
        setStatus({ active: false, phase: 'idle' })
        setLatest(null)
        setLastSeg(null)
      })
    ]
    return () => offs.forEach((off) => off())
  }, [])

  useEffect(() => {
    if (!status.active || !status.startedAt) return
    const started = new Date(status.startedAt).getTime()
    const t = setInterval(() => setElapsed(Date.now() - started), 1000)
    return () => clearInterval(t)
  }, [status.active, status.startedAt])

  return (
    <div className="overlay-root">
      <div className="overlay-head">
        <Brain size={14} />
        <span className="overlay-title">EchoMind</span>
        {status.active && (
          <span className="overlay-status">
            <span className={`live-dot ${status.phase === 'thinking' ? 'thinking' : ''}`} />
            {fmtClock(elapsed)}
          </span>
        )}
        <span className="spacer" />
        {status.active && (
          <button
            className="overlay-end nodrag"
            onClick={() => void api.requestEndSession()}
            title="End session"
          >
            <Square size={11} /> End
          </button>
        )}
        <button
          className="icon-btn nodrag"
          onClick={() => setCollapsed((c) => !c)}
          title={collapsed ? 'Expand' : 'Collapse'}
        >
          {collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </button>
        <button
          className="icon-btn nodrag"
          onClick={() => void api.toggleOverlay(false)}
          title="Hide overlay"
        >
          <X size={14} />
        </button>
      </div>

      {!collapsed && (
        <div className="overlay-body">
          {!status.active ? (
            <p className="muted pad small">
              No active session. Start one from the EchoMind main window.
            </p>
          ) : !latest ? (
            <p className="muted pad small">Listening… suggestions will appear here.</p>
          ) : (
            <SuggestionList set={latest} compact />
          )}
        </div>
      )}

      {!collapsed && status.active && lastSeg && (
        <div className="overlay-foot">
          <b>{lastSeg.speaker === 'you' ? 'You' : 'Them'}:</b> {lastSeg.text}
        </div>
      )}
    </div>
  )
}
