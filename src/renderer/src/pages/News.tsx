import { useEffect, useState } from 'react'
import type { BerryCoreRelease } from '@shared/types'

interface Props {
  onSeen: () => void
}

export function NewsPage({ onSeen }: Props) {
  const [releases, setReleases] = useState<BerryCoreRelease[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    window.berrybridge.berrycore.releases().then((r) => {
      setReleases(r)
      setLoading(false)
      if (r[0]) {
        onSeen()
        window.berrybridge.berrycore.markSeen(r[0].tag)
      }
    })
  }, [onSeen])

  return (
    <>
      <header className="page-header">
        <h2>BerryCore News</h2>
        <p>
          Watches{' '}
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault()
              window.berrybridge.shell.openExternal('https://github.com/sw7ft/BerryCore/releases')
            }}
          >
            sw7ft/BerryCore
          </a>{' '}
          for new releases and updates.
        </p>
      </header>

      <div className="card">
        {loading ? (
          <div className="empty">Loading releases…</div>
        ) : releases.length === 0 ? (
          <div className="empty">No releases found.</div>
        ) : (
          releases.map((r) => (
            <div key={r.tag} className="release-item">
              <h4>
                {r.name}
                {r.isNew && <span className="tag-new">NEW</span>}
              </h4>
              <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 8 }}>
                {r.tag} · {new Date(r.publishedAt).toLocaleString()}
              </p>
              <div
                style={{
                  fontSize: 14,
                  lineHeight: 1.6,
                  color: 'var(--text-muted)',
                  marginBottom: 12,
                  maxHeight: 120,
                  overflow: 'hidden'
                }}
              >
                {r.body.slice(0, 400)}
                {r.body.length > 400 ? '…' : ''}
              </div>
              <button
                className="btn btn-secondary"
                onClick={() => window.berrybridge.shell.openExternal(r.htmlUrl)}
              >
                View Release
              </button>
            </div>
          ))
        )}
      </div>
    </>
  )
}
