import { useCallback, useEffect, useState } from 'react'
import type { DeviceProfile, PimKind, RemotePimEntry } from '@shared/types'
import { stripPimHtml } from '@shared/pim-utils'
import { PageHeader } from '../components/PageHeader'
import { Panel } from '../components/Panel'

interface Props {
  devices: DeviceProfile[]
}

type Tab = 'clipboard' | PimKind

const TABS: { id: Tab; label: string }[] = [
  { id: 'clipboard', label: 'Clipboard' },
  { id: 'messages', label: 'Messages' },
  { id: 'notebooks', label: 'Notebooks' }
]

function stripHtml(html: string): string {
  return stripPimHtml(html)
}

export function FilesPage({ devices }: Props) {
  const [deviceId, setDeviceId] = useState(devices[0]?.id || '')
  const [tab, setTab] = useState<Tab>('clipboard')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [clipboard, setClipboard] = useState('')
  const [entries, setEntries] = useState<RemotePimEntry[]>([])
  const [selected, setSelected] = useState<RemotePimEntry | null>(null)
  const [content, setContent] = useState('')
  const [copied, setCopied] = useState(false)

  const device = devices.find((d) => d.id === deviceId)

  useEffect(() => {
    if (!deviceId && devices[0]?.id) setDeviceId(devices[0].id)
  }, [devices, deviceId])

  useEffect(() => {
    setSelected(null)
    setContent('')
    setEntries([])
    setClipboard('')
    setError('')
  }, [deviceId, tab])

  const load = useCallback(async () => {
    if (!device) return
    setLoading(true)
    setError('')
    setCopied(false)
    try {
      if (tab === 'clipboard') {
        const text = await window.berrybridge.ssh.readClipboard(device)
        setClipboard(text.trim() || '(empty — copy something on the device first)')
      } else {
        const list = await window.berrybridge.ssh.listPimFiles(device, tab)
        setEntries(list)
        if (list.length === 0) setError(`No ${tab} files found on device.`)
      }
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }, [device, tab])

  const openEntry = async (entry: RemotePimEntry) => {
    if (!device) return
    setSelected(entry)
    setLoading(true)
    setError('')
    setCopied(false)
    try {
      const raw = await window.berrybridge.ssh.readRemoteFile(device, entry.path)
      setContent(entry.path.endsWith('.html') ? stripHtml(raw) : raw)
    } catch (e) {
      setContent('')
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('Could not copy to clipboard')
    }
  }

  const displayText = tab === 'clipboard' ? clipboard : content

  return (
    <>
      <PageHeader
        title="Device data"
        subtitle="Read clipboard, messages, and notebooks from your device over SSH."
        actions={
          devices.length > 0 ? (
            <div className="data-toolbar">
              <select
                className="select-compact"
                value={deviceId}
                onChange={(e) => setDeviceId(e.target.value)}
              >
                {devices.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
              <button className="btn btn-primary btn-sm" disabled={!device || loading} onClick={load}>
                {loading ? 'Loading…' : 'Refresh'}
              </button>
            </div>
          ) : undefined
        }
      />

      {devices.length === 0 ? (
        <Panel>
          <div className="empty">Add a device first, then return here to read clipboard and PIM data.</div>
        </Panel>
      ) : (
        <>
          <div className="data-tabs">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`data-tab ${tab === t.id ? 'active' : ''}`}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>

          {error && <div className="alert alert-warn">{error}</div>}

          {tab === 'clipboard' ? (
            <Panel title="Device clipboard">
              <p className="data-hint">Copy text on your BB10 device — it syncs to a file BerryBridge reads over SSH.</p>
              {!clipboard && !loading && (
                <div className="data-empty">Press Refresh to read the current clipboard.</div>
              )}
              {clipboard && (
                <>
                  <pre className="data-viewer">{clipboard}</pre>
                  <div className="btn-row">
                    <button className="btn btn-secondary btn-sm" onClick={() => copyText(clipboard)}>
                      {copied ? 'Copied' : 'Copy to Mac'}
                    </button>
                  </div>
                </>
              )}
            </Panel>
          ) : (
            <div className="data-split">
              <Panel title={`${tab === 'messages' ? 'Messages' : 'Notebooks'} · ${entries.length}`} className="panel-flush">
                {entries.length === 0 && !loading ? (
                  <div className="data-empty">Press Refresh to list files from the device.</div>
                ) : (
                  <ul className="data-list">
                    {entries.map((entry) => (
                      <li key={entry.path}>
                        <button
                          type="button"
                          className={selected?.path === entry.path ? 'active' : ''}
                          onClick={() => openEntry(entry)}
                        >
                          <strong>{entry.name}</strong>
                          <span>{entry.path.replace(/^.*\/(messages|notebooks)\//, '')}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>

              <Panel title={selected ? selected.name : 'Preview'}>
                {!selected ? (
                  <div className="data-empty">Select a file to read its contents.</div>
                ) : (
                  <>
                    <pre className="data-viewer">{content || (loading ? 'Loading…' : '(empty file)')}</pre>
                    {content && (
                      <div className="btn-row">
                        <button className="btn btn-secondary btn-sm" onClick={() => copyText(content)}>
                          {copied ? 'Copied' : 'Copy to Mac'}
                        </button>
                      </div>
                    )}
                  </>
                )}
              </Panel>
            </div>
          )}
        </>
      )}
    </>
  )
}
