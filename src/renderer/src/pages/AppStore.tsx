import { useCallback, useEffect, useState } from 'react'
import type { AppStoreCatalogItem, DeviceProfile } from '@shared/types'
import { PageHeader } from '../components/PageHeader'
import { Panel } from '../components/Panel'
import { readStoredActiveDeviceId, storeActiveDeviceId } from '../utils/active-device'

interface Props {
  devices: DeviceProfile[]
}

export function AppStorePage({ devices }: Props) {
  const [catalog, setCatalog] = useState<AppStoreCatalogItem[]>([])
  const [deviceId, setDeviceId] = useState('')
  const [message, setMessage] = useState('')
  const [messageOk, setMessageOk] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)

  const device = devices.find((d) => d.id === deviceId)

  const refresh = useCallback(async () => {
    const list = await window.berrybridge.store.list()
    setCatalog(list.apps)
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

  const install = async (entry: AppStoreCatalogItem) => {
    if (!device) return
    if (!entry.packageAvailable) {
      setMessageOk(false)
      setMessage(
        `Package file missing: ${entry.filename}. Run "npm run fetch-app-store" in the Berry Bridge folder, then restart the app.`
      )
      return
    }
    setBusyId(entry.id)
    setMessageOk(false)
    setMessage(
      entry.type === 'apk'
        ? `Installing ${entry.name}… Uploading APK over WiFi Storage.`
        : `Installing ${entry.name}… A progress window will open. This can take 1–3 minutes.`
    )
    try {
      const result = await window.berrybridge.store.install(device.id, entry.id)
      setMessageOk(result.ok)
      setMessage(result.message)
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
      }
    } catch (e) {
      setMessageOk(false)
      setMessage(String(e))
    } finally {
      setImporting(false)
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

  const builtin = catalog.filter((a) => a.source === 'builtin')
  const custom = catalog.filter((a) => a.source === 'custom')
  const missingBuiltin = builtin.filter((a) => !a.packageAvailable)

  const installDisabledFor = (entry: AppStoreCatalogItem) => {
    if (!device) return true
    if (entry.type === 'apk') return !device.smbPassword
    return !device.devModePassword
  }

  return (
    <>
      <PageHeader
        title="App Store"
        subtitle="Install bundled and custom .bar / .apk packages to your device over Development Mode."
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
            <button className="btn btn-secondary btn-sm" disabled={importing} onClick={addPackage}>
              {importing ? 'Adding…' : 'Add package'}
            </button>
          </div>
        }
      />

      {message && (
        <div className={`alert ${messageOk ? 'alert-ok' : 'alert-warn'}`}>{message}</div>
      )}

      {missingBuiltin.length > 0 && (
        <div className="alert alert-warn">
          <strong>{missingBuiltin.length} bundled package(s) not downloaded yet.</strong> Run{' '}
          <code>npm run fetch-app-store</code> in the Berry Bridge project folder (or re-run{' '}
          <code>npm install</code>), then restart the app. Install buttons are disabled until files
          are present.
        </div>
      )}

      {!device?.devModePassword && devices.length > 0 && catalog.some((a) => a.type === 'bar') && (
        <div className="alert alert-warn">
          <strong>.bar files</strong> need your Development Mode password on the device profile
          (Devices → Edit). This is separate from the WiFi/storage password.
        </div>
      )}

      {catalog.some((a) => a.type === 'apk') && devices.length > 0 && !device?.smbPassword && (
        <div className="alert alert-warn">
          <strong>.apk files</strong> install through WiFi Storage (not Development Mode). Add your{' '}
          <strong>WiFi Storage</strong> password on the device profile — Settings → Storage and
          Access on BB10.
        </div>
      )}

      {catalog.some((a) => a.type === 'apk') && (
        <div className="alert alert-ok" style={{ opacity: 0.95 }}>
          Android <strong>.apk</strong> packages upload to Documents on your phone, then install via
          the Android installer (you may need to tap Install on the device).
        </div>
      )}

      <Panel title={`BerryCore apps · ${builtin.length}`}>
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
          . One-click install — <strong>.bar</strong> over Development Mode, <strong>.apk</strong>{' '}
          over WiFi Storage.
        </p>
        {builtin.length === 0 ? (
          <div className="empty">No bundled apps yet — defaults will appear here when added.</div>
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

      <Panel title={`Your app store · ${custom.length}`}>
        <p className="panel-desc">
          Upload your own packages — they are stored locally and can be installed to any saved device.
        </p>
        {custom.length === 0 ? (
          <div className="empty">Use Add package to import a .bar or .apk file.</div>
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
  onRemove
}: {
  entry: AppStoreCatalogItem
  busy: boolean
  disabled: boolean
  onInstall: () => void
  onRemove?: () => void
}) {
  const unavailable = !entry.packageAvailable
  const installDisabled = disabled || busy || unavailable

  return (
    <li className="store-row">
      <div className="store-row-main">
        <strong>{entry.name}</strong>
        <span className="store-row-meta">
          {entry.type.toUpperCase()}
          {entry.version ? ` · v${entry.version}` : ''}
          {entry.description ? ` · ${entry.description}` : ''}
          {unavailable ? ' · package not downloaded' : ''}
        </span>
      </div>
      <div className="store-row-actions">
        <button
          className="btn btn-primary btn-sm"
          disabled={installDisabled}
          title={
            unavailable
              ? 'Run npm run fetch-app-store to download this package'
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
