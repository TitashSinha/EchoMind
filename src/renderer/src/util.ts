export function fmtDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) +
    ' · ' + d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

export function fmtDuration(ms?: number): string {
  if (!ms || ms < 1000) return '—'
  const s = Math.floor(ms / 1000)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h) return `${h}h ${m}m`
  if (m) return `${m}m ${sec}s`
  return `${sec}s`
}

export function fmtClock(ms: number): string {
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  const sec = (s % 60).toString().padStart(2, '0')
  if (m >= 60) {
    const h = Math.floor(m / 60)
    return `${h}:${(m % 60).toString().padStart(2, '0')}:${sec}`
  }
  return `${m}:${sec}`
}
