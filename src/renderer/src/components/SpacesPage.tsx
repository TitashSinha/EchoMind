import { useContext, useEffect, useState } from 'react'
import { FileText, FolderPlus, Library, Trash2 } from 'lucide-react'
import { api } from '../api'
import { Nav } from '../App'
import { fmtDate } from '../util'
import type { Space } from '@shared/types'

export default function SpacesPage(): JSX.Element {
  const nav = useContext(Nav)
  const [spaces, setSpaces] = useState<Space[]>([])
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [creating, setCreating] = useState(false)

  const refresh = (): void => {
    void api.listSpaces().then(setSpaces)
  }
  useEffect(refresh, [])

  const create = async (): Promise<void> => {
    if (!name.trim()) return
    setCreating(true)
    const s = await api.createSpace(name, desc)
    setCreating(false)
    setName('')
    setDesc('')
    nav({ page: 'space', id: s.id })
  }

  const remove = async (id: string, spaceName: string): Promise<void> => {
    if (!confirm(`Delete knowledge space "${spaceName}" and its indexed documents?`)) return
    await api.deleteSpace(id)
    refresh()
  }

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Knowledge spaces</h1>
          <p className="muted">
            One space per interview, company, project, or client. Upload documents and EchoMind
            retrieves from them live.
          </p>
        </div>
      </header>

      <div className="card pad form-inline">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New space name — e.g. Acme Corp interview"
          onKeyDown={(e) => e.key === 'Enter' && void create()}
        />
        <input
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          placeholder="Description (optional)"
          onKeyDown={(e) => e.key === 'Enter' && void create()}
        />
        <button className="btn btn-primary" disabled={creating || !name.trim()} onClick={() => void create()}>
          <FolderPlus size={15} /> Create
        </button>
      </div>

      {spaces.length === 0 ? (
        <div className="card pad empty">
          <Library size={28} />
          <p className="muted">
            No spaces yet. Create one above, then add your resume, the job description, agendas,
            SOPs — anything you want EchoMind to know during the conversation.
          </p>
        </div>
      ) : (
        <div className="space-grid">
          {spaces.map((s) => (
            <div key={s.id} className="space-card">
              <button className="space-body" onClick={() => nav({ page: 'space', id: s.id })}>
                <h2>{s.name}</h2>
                {s.description && <p className="muted">{s.description}</p>}
                <p className="muted small">
                  <FileText size={12} /> {s.docs.length} document{s.docs.length === 1 ? '' : 's'} ·
                  created {fmtDate(s.createdAt)}
                </p>
              </button>
              <button
                className="icon-btn"
                title="Delete space"
                onClick={() => void remove(s.id, s.name)}
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
