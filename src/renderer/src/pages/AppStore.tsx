import { useCallback, useEffect, useMemo, useState } from 'react'
import type { AppStoreCatalogItem, AppStoreRepo, DeviceProfile } from '@shared/types'
import { PageHeader } from '../components/PageHeader'
import { Panel } from '../components/Panel'
import { readStoredActiveDeviceId, storeActiveDeviceId } from '../utils/active-device'

interface Props {
  devices: DeviceProfile[]
}

type PackageFilter = 'bar' | 'apk'

export function AppStorePage({ devices }: Props) {
  const [catalog, setCatalog] = useState<AppStoreCatalogItem[]>([])
  const [repos, setRepos] = useState<AppStoreRepo[]>([])
  const [pkgFilter, setPkgFilter] = useState<PackageFilter>('bar')
  const [deviceId, setDeviceId] = useState('')
  const [message, setMessage] = useState('')
  const [messageOk, setMessageOk] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [repoInput, setRepoInput] = useState('')
  const [addingRepo, setAddingRepo] = useState(false)
  const [refreshingRepoId, setRefreshingRepoId] = useState<string | null>(null)
  const [showAddRepo, setShowAddRepo] = useState(false)

  const device = devices.find((d) => d.id === deviceId)

  const refresh = useCallback(async () => {
    const list = await window.berrybridge.store.list()
    setCatalog(list.apps)
    setRepos(list.repos)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    if (devices.length === 0) {
      setDeviceId('')
      return
    }
    if (deviceId && devices.some((d) => d.id === deviceId)) return
    setDeviceId(readStoredActiveDeviceId(devices))
  }, [devices, deviceId])

  const filtered = useMemo(
    () => catalog.filter((a) => a.type === pkgFilter),
    [catalog, pkgFilter]
  )

  const builtin = filtered.filter((a) => a.source === 'builtin')
  const repoApps = filtered.filter((a) => a.source === 'repo')
  const custom = filtered.filter((a) => a.source === 'custom')

  const reposWithApps = useMemo(() => {
    return repos.map((repo) => ({
      repo,
      apps: repoApps.filter((a) => a.repoId === repo.id)
    }))
  }, [repos, repoApps])

  const barCount = catalog.filter((a) => a.type === 'bar').length
  const apkCount = catalog.filter((a) => a.type === 'apk').length

  const install = async (entry: AppStoreCatalogItem) => {
    if (!device) return
    setBusyId(entry.id)
    setMessageOk(false)
    setMessage(
      entry.source === 'repo' && !entry.packageAvailable
        ? `Downloading ${entry.name} from GitHub…`
        : entry.type === 'apk'
          ? `Installing ${entry.name}… Uploading APK over WiFi Storage.`
          : `Installing ${entry.name}… A progress window will open. This can take 1–3 minutes.`
    )
    try {
      const result = await window.berrybridge.store.install(device.id, entry.id)
      setMessageOk(result.ok)
      setMessage(result.message)
      if (result.ok) await refresh()
    } catch (e) {
      setMessageOk(false)
      setMessage(String(e))
    } finally {
      setBusyId(null)
    }
  }

  const addPackage = async () => {
    setImporting(true)
    setMessage('')
    try {
      const added = await window.berrybridge.store.importPackage()
      if (added) {
        await refresh()
        setMessageOk(true)
        setMessage(`Added ${added.name} to your app store.`)
        setPkgFilter(added.type)
      }
    } catch (e) {
      setMessageOk(false)
      setMessage(String(e))
    } finally {
      setImporting(false)
    }
  }

  const addRepo = async () => {
    const input = repoInput.trim()
    if (!input) return
    setAddingRepo(true)
    setMessage('')
    try {
      const repo = await window.berrybridge.store.addRepo(input)
      await refresh()
      setMessageOk(true)
      setMessage(`Added ${repo.label} — scanned for .bar and .apk files.`)
      setRepoInput('')
      setShowAddRepo(false)
    } catch (e) {
      setMessageOk(false)
      setMessage(String(e))
    } finally {
      setAddingRepo(false)
    }
  }

  const refreshRepo = async (repoId: string) => {
    setRefreshingRepoId(repoId)
    setMessage('')
    try {
      const repo = await window.berrybridge.store.refreshRepo(repoId)
      await refresh()
      setMessageOk(true)
      setMessage(`Refreshed ${repo.label}.`)
    } catch (e) {
      setMessageOk(false)
      setMessage(String(e))
    } finally {
      setRefreshingRepoId(null)
    }
  }

  const removeRepo = async (repoId: string) => {
    setMessage('')
    const ok = await window.berrybridge.store.removeRepo(repoId)
    if (ok) {
      await refresh()
      setMessageOk(true)
      setMessage('Removed GitHub repo from your app store.')
    }
  }

  const removePackage = async (id: string) => {
    setMessage('')
    const ok = await window.berrybridge.store.remove(id)
    if (ok) {
      await refresh()
      setMessageOk(true)
      setMessage('Removed from your app store.')
    }
  }

  const missingBuiltin = catalog
    .filter((a) => a.source === 'builtin' && a.type === pkgFilter)
    .filter((a) => !a.packageAvailable)

  const installDisabledFor = (entry: AppStoreCatalogItem) => {
    if (!device) return true
    if (entry.type === 'apk') return !device.smbPassword
    return !device.devModePassword
  }

  return (
    <>
      <PageHeader
        title="App Store"
        subtitle={
          pkgFilter === 'bar'
            ? 'Install .bar apps over Development Mode.'
            : 'Install .apk apps over WiFi Storage.'
        }
        actions={
          <div className="data-toolbar">
            <select
              className="select-compact"
              value={deviceId}
              onChange={(e) => {
                setDeviceId(e.target.value)
                storeActiveDeviceId(e.target.value)
              }}
            >
              {devices.length === 0 ? (
                <option value="">No devices</option>
              ) : (
                devices.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))
              )}
            </select>
            <button
              className="btn btn-secondary btn-sm"
              disabled={importing}
              onClick={addPackage}
            >
              {importing ? 'Adding…' : 'Add local file'}
            </button>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setShowAddRepo((v) => !v)}
            >
              {showAddRepo ? 'Cancel' : 'Add GitHub repo'}
            </button>
          </div>
        }
      />

      <div className="store-type-tabs" role="tablist" aria-label="Package type">
        <button
          type="button"
          role="tab"
          aria-selected={pkgFilter === 'bar'}
          className={`store-type-tab${pkgFilter === 'bar' ? ' active' : ''}`}
          onClick={() => setPkgFilter('bar')}
        >
          .bar apps
          <span className="store-type-count">{barCount}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={pkgFilter === 'apk'}
          className={`store-type-tab${pkgFilter === 'apk' ? ' active' : ''}`}
          onClick={() => setPkgFilter('apk')}
        >
          .apk apps
          <span className="store-type-count">{apkCount}</span>
        </button>
      </div>

      {message && (
        <div className={`alert ${messageOk ? 'alert-ok' : 'alert-warn'}`}>{message}</div>
      )}

      {showAddRepo && (
        <Panel title="Add GitHub repo">
          <p className="panel-desc">
            Point Berry Bridge at a public GitHub repo (or subfolder). It scans for{' '}
            <strong>.bar</strong> and <strong>.apk</strong> files — switch tabs above to install
            each type.
          </p>
          <div className="store-add-repo">
            <input
              type="text"
              className="store-repo-input"
              placeholder="owner/repo or https://github.com/owner/repo/tree/main/bar-files"
              value={repoInput}
              onChange={(e) => setRepoInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addRepo()}
            />
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={addingRepo || !repoInput.trim()}
              onClick={addRepo}
            >
              {addingRepo ? 'Scanning…' : 'Add repo'}
            </button>
          </div>
          <p className="field-hint" style={{ marginTop: 10 }}>
            Example:{' '}
            <code className="code-inline">sw7ft/BerryCore/tree/main/bar-files</code>
          </p>
        </Panel>
      )}

      {pkgFilter === 'bar' && !device?.devModePassword && devices.length > 0 && (
        <div className="alert alert-warn">
          <strong>.bar files</strong> need your Development Mode password on the device profile.
        </div>
      )}

      {pkgFilter === 'apk' && devices.length > 0 && !device?.smbPassword && (
        <div className="alert alert-warn">
          <strong>.apk files</strong> install through WiFi Storage — add your WiFi Storage password
          on the device profile.
        </div>
      )}

      {missingBuiltin.length > 0 && (
        <div className="alert alert-warn">
          <strong>{missingBuiltin.length} bundled package(s) not downloaded yet.</strong> Re-run{' '}
          <code>npm install</code> or restart the shipped app — bundled files are included in
          releases.
        </div>
      )}

      <Panel title={`BerryCore · ${builtin.length}`}>
        <p className="panel-desc">
          Default packages from{' '}
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault()
              window.berrybridge.shell.openExternal(
                'https://github.com/sw7ft/BerryCore/tree/main/bar-files'
              )
            }}
          >
            BerryCore bar-files
          </a>
          .
        </p>
        {builtin.length === 0 ? (
          <div className="empty">No bundled {pkgFilter} packages in this tab.</div>
        ) : (
          <ul className="store-list">
            {builtin.map((entry) => (
              <StoreRow
                key={entry.id}
                entry={entry}
                busy={busyId === entry.id}
                disabled={installDisabledFor(entry)}
                onInstall={() => install(entry)}
              />
            ))}
          </ul>
        )}
      </Panel>

      {reposWithApps.map(({ repo, apps }) => (
        <Panel
          key={repo.id}
          title={
            <span className="store-repo-title">
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault()
                  window.berrybridge.shell.openExternal(repo.htmlUrl)
                }}
              >
                {repo.label}
              </a>
              <span className="store-row-meta"> · {apps.length} in this tab</span>
            </span>
          }
        >
          <div className="store-repo-actions">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={refreshingRepoId === repo.id}
              onClick={() => refreshRepo(repo.id)}
            >
              {refreshingRepoId === repo.id ? 'Refreshing…' : 'Refresh from GitHub'}
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => removeRepo(repo.id)}
            >
              Remove repo
            </button>
          </div>
          {apps.length === 0 ? (
            <div className="empty">
              No .{pkgFilter} files in this repo — try the other tab or refresh.
            </div>
          ) : (
            <ul className="store-list">
              {apps.map((entry) => (
                <StoreRow
                  key={entry.id}
                  entry={entry}
                  busy={busyId === entry.id}
                  disabled={installDisabledFor(entry)}
                  onInstall={() => install(entry)}
                  showCacheHint
                />
              ))}
            </ul>
          )}
        </Panel>
      ))}

      {repos.length === 0 && (
        <Panel title="GitHub repos">
          <p className="panel-desc">
            Add a public repo that hosts .bar or .apk files. Packages download from GitHub when you
            tap Install.
          </p>
          <div className="empty">No GitHub repos yet — click Add GitHub repo above.</div>
        </Panel>
      )}

      <Panel title={`Local packages · ${custom.length}`}>
        <p className="panel-desc">Files imported from your computer — stored locally on this Mac/PC.</p>
        {custom.length === 0 ? (
          <div className="empty">Use Add local file to import a .bar or .apk from disk.</div>
        ) : (
          <ul className="store-list">
            {custom.map((entry) => (
              <StoreRow
                key={entry.id}
                entry={entry}
                busy={busyId === entry.id}
                disabled={installDisabledFor(entry)}
                onInstall={() => install(entry)}
                onRemove={() => removePackage(entry.id)}
              />
            ))}
          </ul>
        )}
      </Panel>
    </>
  )
}

function StoreRow({
  entry,
  busy,
  disabled,
  onInstall,
  onRemove,
  showCacheHint
}: {
  entry: AppStoreCatalogItem
  busy: boolean
  disabled: boolean
  onInstall: () => void
  onRemove?: () => void
  showCacheHint?: boolean
}) {
  const unavailable = entry.source === 'builtin' && !entry.packageAvailable
  const installDisabled = disabled || busy || unavailable

  return (
    <li className="store-row">
      <div className="store-row-main">
        <strong>{entry.name}</strong>
        <span className="store-row-meta">
          {entry.type.toUpperCase()}
          {entry.version ? ` · v${entry.version}` : ''}
          {entry.description && entry.source !== 'repo' ? ` · ${entry.description}` : ''}
          {entry.githubPath ? ` · ${entry.githubPath}` : ''}
          {unavailable ? ' · not bundled' : ''}
          {showCacheHint && !entry.packageAvailable ? ' · downloads on install' : ''}
        </span>
      </div>
      <div className="store-row-actions">
        <button
          className="btn btn-primary btn-sm"
          disabled={installDisabled}
          title={
            unavailable
              ? 'Bundled file missing — reinstall Berry Bridge or run fetch-app-store in dev'
              : entry.type === 'apk'
                ? 'Requires WiFi Storage password on device profile'
                : undefined
          }
          onClick={onInstall}
        >
          {busy ? 'Installing…' : unavailable ? 'Unavailable' : 'Install'}
        </button>
        {onRemove && (
          <button className="btn btn-secondary btn-sm" disabled={busy} onClick={onRemove}>
            Remove
          </button>
        )}
      </div>
    </li>
  )
}
