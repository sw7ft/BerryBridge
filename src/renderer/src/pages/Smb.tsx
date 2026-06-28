import { useEffect, useState, useCallback, useRef } from 'react'
import { SMB_DEFAULTS, type DeviceProfile, type SmbFileEntry, type SmbShareInfo } from '@shared/types'
import { testSmbForDevice } from '../utils/smb-connect'

type ViewMode = 'list' | 'tiles'

const VIEW_STORAGE_KEY = 'berrybridge-smb-view'

interface Props {
  devices: DeviceProfile[]
  onRefresh: () => void
}

function readViewMode(): ViewMode {
  try {
    return localStorage.getItem(VIEW_STORAGE_KEY) === 'tiles' ? 'tiles' : 'list'
  } catch {
    return 'list'
  }
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

export function SmbPage({ devices, onRefresh }: Props) {
  const [clientInfo, setClientInfo] = useState<Record<string, string | boolean> | null>(null)
  const [selectedDeviceId, setSelectedDeviceId] = useState('')
  const [password, setPassword] = useState('')
  const [smbUser, setSmbUser] = useState('')
  const [message, setMessage] = useState('')
  const [connected, setConnected] = useState(false)
  const [shares, setShares] = useState<SmbShareInfo[]>([])
  const [activeShare, setActiveShare] = useState(SMB_DEFAULTS.shareName)
  const [path, setPath] = useState('')
  const [entries, setEntries] = useState<SmbFileEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [busyFile, setBusyFile] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>(() => readViewMode())
  const sessionRef = useRef<string | null>(null)

  const device = devices.find((d) => d.id === selectedDeviceId)
  const host = device?.host || ''

  useEffect(() => {
    window.berrybridge.smb.info().then(setClientInfo)
    return () => {
      if (sessionRef.current) {
        window.berrybridge.smb.closeSession(sessionRef.current)
        sessionRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (device?.smbPassword) setPassword(device.smbPassword)
    if (device?.smbUser) setSmbUser(device.smbUser)
    else setSmbUser('')
  }, [device])

  const setView = (mode: ViewMode) => {
    setViewMode(mode)
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, mode)
    } catch {
      /* ignore */
    }
  }

  const disconnect = useCallback(() => {
    if (sessionRef.current) {
      window.berrybridge.smb.closeSession(sessionRef.current)
      sessionRef.current = null
    }
    setConnected(false)
    setEntries([])
    setPath('')
  }, [])

  const loadDir = useCallback(
    async (share: string, dirPath: string, sessionId?: string) => {
      const sid = sessionId || sessionRef.current
      if (!sid) return
      setLoading(true)
      try {
        const list = await window.berrybridge.smb.listDirSession(sid, dirPath)
        setActiveShare(share)
        setPath(dirPath)
        setEntries(list)
      } catch (e) {
        setMessage(String(e))
        disconnect()
      } finally {
        setLoading(false)
      }
    },
    [disconnect]
  )

  const connect = async () => {
    if (!host || !password) {
      setMessage('Select a device and enter the storage password.')
      return
    }
    disconnect()
    setLoading(true)
    setMessage('Connecting via SMB1…')
    try {
      const result = await testSmbForDevice(host, password, device, smbUser)

      if (!result.ok) {
        setMessage(result.message)
        return
      }

      const share = result.share
      const username = result.username

      if (!share) {
        setMessage('Connected but no storage shares found on the phone.')
        return
      }

      setShares(result.shares || [])
      const sessionId = await window.berrybridge.smb.openSession(
        host,
        share,
        password,
        username
      )
      sessionRef.current = sessionId
      setConnected(true)
      setMessage(result.message)
      await loadDir(share, '', sessionId)
    } catch (e) {
      setMessage(String(e))
    } finally {
      setLoading(false)
    }
  }

  const switchShare = async (share: string) => {
    if (!host || !password) return
    disconnect()
    setLoading(true)
    try {
      const sessionId = await window.berrybridge.smb.openSession(
        host,
        share,
        password,
        smbUser.trim() || device?.smbUser || undefined
      )
      sessionRef.current = sessionId
      setConnected(true)
      await loadDir(share, '', sessionId)
    } catch (e) {
      setMessage(String(e))
    } finally {
      setLoading(false)
    }
  }

  const openEntry = (entry: SmbFileEntry) => {
    if (!entry.isDirectory) return
    const next = path ? `${path}/${entry.name}` : entry.name
    loadDir(activeShare, next)
  }

  const goUp = () => {
    if (!path) return
    const parts = path.split('/')
    parts.pop()
    loadDir(activeShare, parts.join('/'))
  }

  const download = async (entry: SmbFileEntry) => {
    const remote = path ? `${path}/${entry.name}` : entry.name
    setBusyFile(entry.name)
    try {
      const result = await window.berrybridge.smb.download(host, activeShare, password, remote)
      setMessage(result.message)
    } finally {
      setBusyFile(null)
    }
  }

  const upload = async () => {
    setBusyFile('__upload__')
    try {
      const result = await window.berrybridge.smb.upload(host, activeShare, password, path)
      setMessage(result.message)
      if (result.ok) await loadDir(activeShare, path)
    } finally {
      setBusyFile(null)
    }
  }

  const savePassword = async () => {
    if (!device) return
    await window.berrybridge.devices.save({
      ...device,
      smbPassword: password,
      smbUser: smbUser.trim() || undefined
    })
    setMessage('WiFi Storage settings saved to device profile.')
    onRefresh()
  }

  const pathParts = path ? path.split('/') : []
  const dirCount = entries.filter((e) => e.isDirectory).length
  const fileCount = entries.length - dirCount

  const renderEmpty = () => (
    <div className="smb-empty">Empty folder</div>
  )

  const renderList = () => (
    <table className="smb-table">
      <thead>
        <tr>
          <th>Name</th>
          <th>Size</th>
          <th>Modified</th>
          <th />
        </tr>
      </thead>
      <tbody>
        {entries.length === 0 ? (
          <tr>
            <td colSpan={4} className="empty-cell">
              Empty folder
            </td>
          </tr>
        ) : (
          entries.map((entry) => (
            <tr
              key={entry.name}
              className={entry.isDirectory ? 'is-dir' : ''}
              onDoubleClick={() => entry.isDirectory && openEntry(entry)}
            >
              <td
                className="smb-name-cell"
                onClick={() => entry.isDirectory && openEntry(entry)}
              >
                <span className={`smb-type-icon ${entry.isDirectory ? 'dir' : 'file'}`} />
                {entry.name}
              </td>
              <td className="smb-size-cell">
                {entry.isDirectory ? '—' : formatSize(entry.size)}
              </td>
              <td className="smb-date-cell">{entry.modified || '—'}</td>
              <td className="smb-action-cell">
                {!entry.isDirectory && (
                  <button
                    className="btn btn-secondary btn-sm"
                    disabled={busyFile === entry.name}
                    onClick={() => download(entry)}
                  >
                    {busyFile === entry.name ? '…' : '↓'}
                  </button>
                )}
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  )

  const renderTiles = () => {
    if (entries.length === 0) return renderEmpty()
    return (
      <div className="smb-tile-grid">
        {entries.map((entry) => (
          <div
            key={entry.name}
            className={`smb-tile ${entry.isDirectory ? 'is-dir' : ''}`}
            onDoubleClick={() => entry.isDirectory && openEntry(entry)}
          >
            <button
              type="button"
              className="smb-tile-main"
              onClick={() => entry.isDirectory && openEntry(entry)}
              disabled={!entry.isDirectory}
            >
              <span className={`smb-tile-icon smb-type-icon ${entry.isDirectory ? 'dir' : 'file'}`} />
              <span className="smb-tile-name" title={entry.name}>
                {entry.name}
              </span>
              <span className="smb-tile-meta">
                {entry.isDirectory ? 'Folder' : formatSize(entry.size)}
              </span>
            </button>
            {!entry.isDirectory && (
              <button
                type="button"
                className="btn btn-secondary btn-sm smb-tile-dl"
                disabled={busyFile === entry.name}
                onClick={() => download(entry)}
              >
                {busyFile === entry.name ? '…' : 'Download'}
              </button>
            )}
          </div>
        ))}
      </div>
    )
  }

  return (
    <>
      <header className="page-header">
        <h2>Storage</h2>
        <p>
          Browse and transfer files on your device WiFi Storage shares — connect to{' '}
          <code className="code-inline">media</code>, <code className="code-inline">documents</code>,
          or other available shares.
        </p>
      </header>

      {clientInfo && !clientInfo.available && (
        <div className="alert alert-warn">
          WiFi Storage tools are missing from this install. Download the latest Berry Bridge release
          from GitHub.
        </div>
      )}
      {clientInfo?.available && clientInfo.bundled && (
        <p className="field-hint">WiFi Storage tools bundled with Berry Bridge — no extra setup needed.</p>
      )}

      {message && (
        <div className={`alert ${connected ? 'alert-info' : 'alert-warn'}`}>{message}</div>
      )}

      <div className="card smb-connect-card">
        <div className="smb-connect-row">
          <div className="field" style={{ margin: 0, flex: 1 }}>
            <label>Device</label>
            <select
              value={selectedDeviceId}
              onChange={(e) => {
                setSelectedDeviceId(e.target.value)
                disconnect()
                setShares([])
              }}
            >
              <option value="">— select —</option>
              {devices.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.host})
                </option>
              ))}
            </select>
          </div>
          <div className="field" style={{ margin: 0, flex: 1 }}>
            <label>Username</label>
            <input
              value={smbUser}
              onChange={(e) => setSmbUser(e.target.value)}
              placeholder="blackberry (or Identification on Network)"
            />
          </div>
          <div className="field" style={{ margin: 0, flex: 1 }}>
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Storage password"
            />
          </div>
          <div className="smb-connect-actions">
            <button className="btn btn-primary" onClick={connect} disabled={loading || !host}>
              {loading ? '…' : connected ? 'Reconnect' : 'Connect'}
            </button>
            {connected && (
              <button className="btn btn-secondary" onClick={disconnect}>
                Disconnect
              </button>
            )}
            <button
              className="btn btn-secondary"
              onClick={savePassword}
              disabled={!device || !password}
            >
              Save
            </button>
          </div>
        </div>
        {connected && (
          <div className="smb-status-bar">
            <span className="status-pill ok">Connected</span>
            <span>{host}:{SMB_DEFAULTS.port}</span>
            <span>·</span>
            <span>
              {activeShare}
              {path ? `/${path}` : ''}
            </span>
            {!loading && (
              <>
                <span>·</span>
                <span>
                  {dirCount} folders, {fileCount} files
                </span>
              </>
            )}
          </div>
        )}
      </div>

      {connected && shares.length > 1 && (
        <div className="smb-share-tabs">
          {shares.map((s) => (
            <button
              key={s.name}
              className={`smb-share-tab ${activeShare === s.name ? 'active' : ''}`}
              onClick={() => switchShare(s.name)}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}

      {connected && (
        <div className="card smb-browser-card">
          <div className="smb-toolbar">
            <div className="smb-view-toggle" role="group" aria-label="View mode">
              <button
                type="button"
                className={`smb-view-btn ${viewMode === 'list' ? 'active' : ''}`}
                onClick={() => setView('list')}
                title="List view"
                aria-pressed={viewMode === 'list'}
              >
                List
              </button>
              <button
                type="button"
                className={`smb-view-btn ${viewMode === 'tiles' ? 'active' : ''}`}
                onClick={() => setView('tiles')}
                title="Tile view"
                aria-pressed={viewMode === 'tiles'}
              >
                Tiles
              </button>
            </div>
            <div className="btn-row" style={{ margin: 0, marginLeft: 'auto' }}>
              {path && (
                <button className="btn btn-secondary btn-sm" onClick={goUp}>
                  ↑ Up
                </button>
              )}
              <button
                className="btn btn-primary btn-sm"
                onClick={upload}
                disabled={busyFile === '__upload__'}
              >
                {busyFile === '__upload__' ? 'Uploading…' : 'Upload'}
              </button>
            </div>
          </div>

          {pathParts.length > 0 && (
            <div className="smb-breadcrumbs">
              <button className="crumb" onClick={() => loadDir(activeShare, '')}>
                {activeShare}
              </button>
              {pathParts.map((part, i) => (
                <span key={i}>
                  <span className="crumb-sep">/</span>
                  <button
                    className="crumb"
                    onClick={() => loadDir(activeShare, pathParts.slice(0, i + 1).join('/'))}
                  >
                    {part}
                  </button>
                </span>
              ))}
            </div>
          )}

          {loading ? (
            <div className="smb-loading">
              <div className="scan-progress-bar">
                <div className="scan-progress-fill smb-indeterminate" />
              </div>
            </div>
          ) : viewMode === 'list' ? (
            renderList()
          ) : (
            renderTiles()
          )}
        </div>
      )}
    </>
  )
}
