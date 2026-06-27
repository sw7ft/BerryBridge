import { useEffect, useState } from 'react'
import { qsBerryCoreDownloadedKey } from '@shared/quick-start-flow'

interface Props {
  onDoneChange?: (done: boolean) => void
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

export function QsStepBerryCoreDownload({ onDoneChange }: Props) {
  const [busy, setBusy] = useState(false)
  const [checking, setChecking] = useState(true)
  const [cache, setCache] = useState<{ tag: string; name: string } | null>(null)
  const [zipSize, setZipSize] = useState<number | null>(null)
  const [message, setMessage] = useState('')
  const [messageOk, setMessageOk] = useState<boolean | null>(null)

  const markDone = (tag: string | null) => {
    const done = Boolean(tag)
    onDoneChange?.(done)
    if (tag) {
      try {
        localStorage.setItem(qsBerryCoreDownloadedKey(), tag)
      } catch {
        /* ignore */
      }
    }
  }

  useEffect(() => {
    let cancelled = false
    setChecking(true)
    window.berrybridge.berrycore
      .getCached()
      .then((info) => {
        if (cancelled) return
        if (info) {
          setCache({ tag: info.tag, name: info.name })
          markDone(info.tag)
        } else {
          onDoneChange?.(false)
        }
      })
      .finally(() => {
        if (!cancelled) setChecking(false)
      })
    return () => {
      cancelled = true
    }
  }, [onDoneChange])

  useEffect(() => {
    if (!cache) return
    window.berrybridge.berrycore.latest().then((release) => {
      const zip = release?.assets.find((a) => a.name === 'berrycore.zip')
      if (zip) setZipSize(zip.size)
    })
  }, [cache])

  const download = async () => {
    setBusy(true)
    setMessageOk(null)
    setMessage('Downloading berrycore.zip and install.sh to this computer…')
    try {
      const result = await window.berrybridge.berrycore.downloadLatest()
      setMessageOk(result.ok)
      setMessage(result.message)
      if (result.ok && result.cache) {
        setCache({ tag: result.cache.tag, name: result.cache.name })
        markDone(result.cache.tag)
      }
    } catch (e) {
      setMessageOk(false)
      setMessage(String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <p className="panel-desc">
        Berry Bridge downloads the latest BerryCore release to this computer. You will send it to
        your phone in the next step — no browser tabs or manual file hunting.
      </p>
      {checking ? (
        <p className="field-hint">Checking for downloaded files…</p>
      ) : cache ? (
        <p className="field-hint qs-step-ready">
          ✓ Ready: <strong>{cache.name}</strong> ({cache.tag})
          {zipSize != null ? ` · berrycore.zip ${formatSize(zipSize)}` : ''}
        </p>
      ) : null}
      <div className="btn-row">
        <button type="button" className="btn btn-primary" disabled={busy} onClick={download}>
          {busy ? 'Downloading…' : cache ? 'Re-download latest release' : 'Download BerryCore'}
        </button>
      </div>
      {message && (
        <div className={`alert ${messageOk === false ? 'alert-warn' : 'alert-info'}`} style={{ marginTop: 12 }}>
          <pre className="alert-pre">{message}</pre>
        </div>
      )}
    </>
  )
}
