import {
  Brain,
  History,
  LayoutDashboard,
  Library,
  Radio,
  Settings
} from 'lucide-react'
import type { LiveStatus } from '@shared/types'
import type { Page, Route } from '../App'

const ITEMS: { page: Page; label: string; icon: typeof Radio }[] = [
  { page: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { page: 'live', label: 'Live Session', icon: Radio },
  { page: 'spaces', label: 'Knowledge Spaces', icon: Library },
  { page: 'sessions', label: 'Sessions', icon: History },
  { page: 'memory', label: 'Memory', icon: Brain },
  { page: 'settings', label: 'Settings', icon: Settings }
]

const PARENT: Partial<Record<Page, Page>> = { space: 'spaces', session: 'sessions' }

export default function Sidebar(props: {
  route: Route
  live: LiveStatus
  onNav: (r: Route) => void
}): JSX.Element {
  const activePage = PARENT[props.route.page] ?? props.route.page
  return (
    <aside className="sidebar">
      <div className="logo">
        <div className="logo-mark">
          <Brain size={18} />
        </div>
        <span>EchoMind</span>
      </div>
      <nav>
        {ITEMS.map(({ page, label, icon: Icon }) => (
          <button
            key={page}
            className={`nav-item ${activePage === page ? 'active' : ''}`}
            onClick={() => props.onNav({ page })}
          >
            <Icon size={17} />
            <span>{label}</span>
            {page === 'live' && props.live.active && <span className="live-dot" />}
          </button>
        ))}
      </nav>
      <div className="sidebar-foot">
        {props.live.active ? (
          <button className="live-badge" onClick={() => props.onNav({ page: 'live' })}>
            <span className="live-dot" /> LIVE — session running
          </button>
        ) : (
          <span className="muted small">v0.1.0 · local-first</span>
        )}
      </div>
    </aside>
  )
}
