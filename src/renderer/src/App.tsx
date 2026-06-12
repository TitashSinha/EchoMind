import { createContext, useEffect, useState } from 'react'
import { api } from './api'
import type { LiveStatus } from '@shared/types'
import Sidebar from './components/Sidebar'
import Dashboard from './components/Dashboard'
import LivePage from './components/LivePage'
import SpacesPage from './components/SpacesPage'
import SpaceDetail from './components/SpaceDetail'
import SessionsPage from './components/SessionsPage'
import SessionDetail from './components/SessionDetail'
import MemoryPage from './components/MemoryPage'
import SettingsPage from './components/SettingsPage'
import Overlay from './components/Overlay'

export type Page =
  | 'dashboard'
  | 'live'
  | 'spaces'
  | 'space'
  | 'sessions'
  | 'session'
  | 'memory'
  | 'settings'

export interface Route {
  page: Page
  id?: string
}

export const Nav = createContext<(r: Route) => void>(() => {})

export default function App(): JSX.Element {
  if (window.location.hash.replace('#', '').startsWith('overlay')) {
    return <Overlay />
  }
  return <Shell />
}

function Shell(): JSX.Element {
  const [route, setRoute] = useState<Route>({ page: 'dashboard' })
  const [live, setLive] = useState<LiveStatus>({ active: false, phase: 'idle' })

  useEffect(() => {
    void api.getLiveSnapshot().then((s) => setLive(s.status))
    const offs = [
      api.on('live:status', (s) => setLive(s as LiveStatus)),
      api.on('live:ended', () => setLive({ active: false, phase: 'idle' }))
    ]
    return () => offs.forEach((off) => off())
  }, [])

  return (
    <Nav.Provider value={setRoute}>
      <div className="shell">
        <Sidebar route={route} live={live} onNav={setRoute} />
        <main className="content">
          {route.page === 'dashboard' && <Dashboard key="dash" />}
          {route.page === 'live' && <LivePage key="live" />}
          {route.page === 'spaces' && <SpacesPage key="spaces" />}
          {route.page === 'space' && route.id && <SpaceDetail key={route.id} id={route.id} />}
          {route.page === 'sessions' && <SessionsPage key="sessions" />}
          {route.page === 'session' && route.id && (
            <SessionDetail key={route.id} id={route.id} />
          )}
          {route.page === 'memory' && <MemoryPage key="memory" />}
          {route.page === 'settings' && <SettingsPage key="settings" />}
        </main>
      </div>
    </Nav.Provider>
  )
}
