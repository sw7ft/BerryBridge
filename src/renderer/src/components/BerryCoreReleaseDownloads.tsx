import { useEffect, useState } from 'react'
import type { BerryCoreRelease } from '@shared/types'

const BERRYCORE_RELEASES_URL = 'https://github.com/sw7ft/BerryCore/releases'

function openExternal(url: string) {
  window.berrybridge.shell.openExternal(url)
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

export function BerryCoreReleaseDownloads() {
  const [latest, setLatest] = useState<BerryCoreRelease | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    window.berrybridge.berrycore.latest().then((r) => {
      setLatest(r)
      setLoading(false)
    })
  }, [])

  const berrycoreZip = latest?.assets.find((a) => a.name === 'berrycore.zip')
  const installSh = latest?.assets.find((a) => a.name === 'install.sh')

  if (loading) {
    return <p className="field-hint">Loading latest release…</p>
  }

  if (!latest) {
    return (
      <p className="field-hint">
        Could not load releases.{' '}
        <button type="button" className="bb-home-link" onClick={() => openExternal(BERRYCORE_RELEASES_URL)}>
          Open GitHub releases
        </button>
      </p>
    )
  }

  return (
    <>
      <p className="field-hint" style={{ marginBottom: 10 }}>
        <strong>{latest.name}</strong> · {latest.tag} ·{' '}
        {new Date(latest.publishedAt).toLocaleDateString()}
      </p>
      <div className="btn-row berrycore-dl-row">
        {berrycoreZip && (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => openExternal(berrycoreZip.downloadUrl)}
          >
            Download berrycore.zip ({formatSize(berrycoreZip.size)})
          </button>
        )}
        {installSh && (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => openExternal(installSh.downloadUrl)}
          >
            Download install.sh
          </button>
        )}
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => openExternal(BERRYCORE_RELEASES_URL)}
        >
          All releases
        </button>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => openExternal(latest.htmlUrl)}
        >
          Release notes
        </button>
      </div>
    </>
  )
}
