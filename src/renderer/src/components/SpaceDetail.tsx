import { useContext, useEffect, useState } from 'react'
import { ArrowLeft, FilePlus2, RefreshCw, Trash2 } from 'lucide-react'
import { api } from '../api'
import { Nav } from '../App'
import { fmtDate } from '../util'
import type { Space } from '@shared/types'

export default function SpaceDetail(props: { id: string }): JSX.Element {
  const nav = useContext(Nav)
  const [space, setSpace] = useState<Space | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    void api.getSpace(props.id).then(setSpace)
  }, [props.id])

  if (!space) {
    return (
      <div className="page">
        <p className="muted pad">Loading…</p>
      </div>
    )
  }

  const run = async (fn: () => Promise<Space>): Promise<void> => {
    setBusy(true)
    setError('')
    try {
      setSpace(await fn())
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const addDocs = async (): Promise<void> => {
    const paths = await api.pickFiles()
    if (paths.length) await run(() => api.addDocuments(space.id, paths))
  }

  const needsReindex = space.docs.some((d) => d.status === 'no-embeddings')

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <button className="btn btn-ghost back" onClick={() => nav({ page: 'spaces' })}>
            <ArrowLeft size={15} /> All spaces
          </button>
          <h1>{space.name}</h1>
          {space.description && <p className="muted">{space.description}</p>}
        </div>
        <div className="head-actions">
          {needsReindex && (
            <button className="btn" disabled={busy} onClick={() => void run(() => api.reindexSpace(space.id))}>
              <RefreshCw size={15} /> Build embeddings
            </button>
          )}
          <button className="btn btn-primary" disabled={busy} onClick={() => void addDocs()}>
            <FilePlus2 size={15} /> {busy ? 'Processing…' : 'Add documents'}
          </button>
        </div>
      </header>

      {error && <div className="banner warn">{error}</div>}
      {needsReindex && (
        <div className="banner info">
          Some documents were indexed without embeddings (no API key at the time). Click{' '}
          <b>Build embeddings</b> for better retrieval — keyword search is used until then.
        </div>
      )}

      {space.docs.length === 0 ? (
        <div className="card pad empty">
          <p className="muted">
            No documents yet. Add your resume, the job description, company research, agendas,
            SOPs, specs — PDF, DOCX, PPTX, XLSX, CSV, TXT, or Markdown.
          </p>
        </div>
      ) : (
        <div className="card">
          <table className="table">
            <thead>
              <tr>
                <th>Document</th>
                <th>Type</th>
                <th>Size</th>
                <th>Chunks</th>
                <th>Status</th>
                <th>Added</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {space.docs.map((d) => (
                <tr key={d.id}>
                  <td className="strong">{d.name}</td>
                  <td className="muted">{d.ext.replace('.', '').toUpperCase()}</td>
                  <td className="muted">{(d.chars / 1000).toFixed(1)}k chars</td>
                  <td className="muted">{d.chunkCount}</td>
                  <td>
                    {d.status === 'ready' && <span className="chip ok">indexed</span>}
                    {d.status === 'no-embeddings' && <span className="chip pending">keyword only</span>}
                    {d.status === 'error' && (
                      <span className="chip bad" title={d.error}>
                        error
                      </span>
                    )}
                  </td>
                  <td className="muted">{fmtDate(d.addedAt)}</td>
                  <td>
                    <button
                      className="icon-btn"
                      title="Remove document"
                      disabled={busy}
                      onClick={() => void run(() => api.removeDocument(space.id, d.id))}
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
