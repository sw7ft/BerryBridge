import { useCallback, useEffect, useMemo, useState } from 'react'
import { BACKUP_FOLDER_PRESETS } from '@shared/backup-presets'
import type { BackupPlan, BackupProgress, BackupRunRecord, DeviceProfile } from '@shared/types'
import { formatBytes } from '@shared/smb-utils'
import { PageHeader } from '../components/PageHeader'
import { Panel } from '../components/Panel'
import { readStoredActiveDeviceId, storeActiveDeviceId } from '../utils/active-device'

interface Props {
  devices: DeviceProfile[]
}

function randomId(): string {
  return crypto.randomUUID()
}

export function BackupPage({ devices }: Props) {
  const [deviceId, setDeviceId] = useState('')
  const [localRoot, setLocalRoot] = useState('')
  const [selectedPresets, setSelectedPresets] = useState<Set<string>>(
    () => new Set(['camera', 'documents'])
  )
  const [customFolder, setCustomFolder] = useState('')
  const [customFolders, setCustomFolders] = useState<string[]>([])
  const [resolvedFolders, setResolvedFolders] = useState<string[]>([])
  const [share, setShare] = useState('media')
  const [plans, setPlans] = useState<BackupPlan[]>([])
  const [runs, setRuns] = useState<BackupRunRecord[]>([])
  const [progress, setProgress] = useState<BackupProgress | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [messageOk, setMessageOk] = useState<boolean | null>(null)
  const [planName, setPlanName] = useState('My backup')

  const device = devices.find((d) => d.id === deviceId)

  const refresh = useCallback(async () => {
    if (!deviceId) {
      setPlans([])
      setRuns([])
      return
    }
    const [p, r] = await Promise.all([
      window.berrybridge.backup.listPlans(deviceId),
      window.berrybridge.backup.listRuns(deviceId)
    ])
    setPlans(p)
    setRuns(r)
  }, [deviceId])

  useEffect(() => {
    if (devices.length === 0) {
      setDeviceId('')
      return
    }
    if (deviceId && devices.some((d) => d.id === deviceId)) return
    setDeviceId(readStoredActiveDeviceId(devices))
  }, [devices, deviceId])

  useEffect(() => {
    if (!deviceId) return
    window.berrybridge.backup.defaultRoot(deviceId).then((root) => {
      if (root) setLocalRoot(root)
    })
    refresh()
  }, [deviceId, refresh])

  useEffect(() => {
    const unsub = window.berrybridge.backup.onProgress(setProgress)
    return unsub
  }, [])

  const presetIds = useMemo(() => [...selectedPresets], [selectedPresets])

  const togglePreset = (id: string) => {
    setSelectedPresets((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const addCustomFolder = () => {
    const path = customFolder.trim().replace(/^\/+/, '')
    if (!path) return
    setCustomFolders((prev) => (prev.includes(path) ? prev : [...prev, path]))
    setCustomFolder('')
  }

  const probeFolders = async () => {
    if (!device) return
    setBusy(true)
    setMessage('')
    try {
      const result = await window.berrybridge.backup.resolveFolders(
        device.id,
        presetIds,
        customFolders,
        share
      )
      setResolvedFolders(result.folders)
      if (result.share) setShare(result.share)
      setMessageOk(result.ok)
      setMessage(result.message)
    } catch (e) {
      setMessageOk(false)
      setMessage(String(e))
    } finally {
      setBusy(false)
    }
  }

  const runBackup = async (plan?: BackupPlan) => {
    if (!device || !localRoot.trim()) return
    setBusy(true)
    setProgress(null)
    setMessage('')
    try {
      const result = await window.berrybridge.backup.run(device.id, {
        presetIds: plan ? [] : presetIds,
        customFolders: plan ? plan.folders : customFolders,
        localRoot: plan?.localRoot || localRoot.trim(),
        share: plan?.share || share,
        planId: plan?.id,
        planName: plan?.name
      })
      setMessageOk(result.ok)
      setMessage(result.message)
      await refresh()
    } catch (e) {
      setMessageOk(false)
      setMessage(String(e))
    } finally {
      setBusy(false)
      setProgress(null)
    }
  }

  const savePlan = async () => {
    if (!device || !localRoot.trim()) return
    setBusy(true)
    try {
      let folders = resolvedFolders
      if (folders.length === 0) {
        const probe = await window.berrybridge.backup.resolveFolders(
          device.id,
          presetIds,
          customFolders,
          share
        )
        folders = probe.folders
        setResolvedFolders(folders)
      }
      if (folders.length === 0) {
        setMessageOk(false)
        setMessage('No folders resolved — check presets or add a custom path.')
        return
      }
      await window.berrybridge.backup.savePlan({
        id: randomId(),
        deviceId: device.id,
        name: planName.trim() || 'My backup',
        share,
        folders,
        localRoot: localRoot.trim(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })
      setMessageOk(true)
      setMessage('Backup plan saved.')
      await refresh()
    } catch (e) {
      setMessageOk(false)
      setMessage(String(e))
    } finally {
      setBusy(false)
    }
  }

  const deletePlan = async (planId: string) => {
    await window.berrybridge.backup.deletePlan(planId)
    await refresh()
  }

  const chooseRoot = async () => {
    const picked = await window.berrybridge.backup.chooseRoot(localRoot)
    if (picked) setLocalRoot(picked)
  }

  const progressIndeterminate =
    progress?.phase === 'connecting' || progress?.phase === 'scanning'

  return (
    <>
      <PageHeader
        title="Backup"
        subtitle="Copy folders from your device over WiFi Storage to a folder on this computer. Separate from Storage browse — built for full directory backups."
        actions={
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
        }
      />

      {!device?.smbPassword && devices.length > 0 && (
        <div className="alert alert-warn">
          WiFi Storage password required — add it on the device profile (Devices → Edit).
        </div>
      )}

      {message && (
        <div className={`alert ${messageOk ? 'alert-ok' : 'alert-warn'}`}>{message}</div>
      )}

      <div className="backup-layout">
        <Panel title="What to back up">
          <p className="panel-desc">
            Choose BB10 folders on the <code className="code-inline">media</code> share. Berry
            Bridge walks each folder recursively and copies every file.
          </p>
          <ul className="backup-preset-list">
            {BACKUP_FOLDER_PRESETS.map((preset) => (
              <li key={preset.id}>
                <label className="backup-preset-item">
                  <input
                    type="checkbox"
                    checked={selectedPresets.has(preset.id)}
                    onChange={() => togglePreset(preset.id)}
                    disabled={busy}
                  />
                  <span>
                    <strong>{preset.label}</strong>
                    <span className="backup-preset-desc">{preset.description}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>

          <div className="backup-custom-path">
            <label>Custom folder path (on device share)</label>
            <div className="backup-add-repo">
              <input
                type="text"
                className="store-repo-input"
                placeholder="accounts/1000/camera"
                value={customFolder}
                onChange={(e) => setCustomFolder(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addCustomFolder()}
                disabled={busy}
              />
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={addCustomFolder}
                disabled={busy}
              >
                Add
              </button>
            </div>
            {customFolders.length > 0 && (
              <ul className="backup-custom-list">
                {customFolders.map((path) => (
                  <li key={path}>
                    <code className="code-inline">{path}</code>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => setCustomFolders((prev) => prev.filter((p) => p !== path))}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="btn-row" style={{ marginTop: 12 }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={busy || !device}
              onClick={probeFolders}
            >
              Check folders on device
            </button>
          </div>

          {resolvedFolders.length > 0 && (
            <div className="backup-resolved">
              <strong>Will back up:</strong>
              <ul>
                {resolvedFolders.map((f) => (
                  <li key={f}>
                    <code className="code-inline">{f}</code>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Panel>

        <Panel title="Where to save">
          <p className="panel-desc">
            Each run creates a timestamped subfolder under this path on your Mac/PC.
          </p>
          <div className="backup-dest-row">
            <input
              type="text"
              className="store-repo-input"
              value={localRoot}
              onChange={(e) => setLocalRoot(e.target.value)}
              disabled={busy}
            />
            <button type="button" className="btn btn-secondary btn-sm" onClick={chooseRoot}>
              Choose…
            </button>
          </div>
          <div className="field" style={{ marginTop: 12 }}>
            <label>Plan name (optional)</label>
            <input
              value={planName}
              onChange={(e) => setPlanName(e.target.value)}
              disabled={busy}
            />
          </div>
          <div className="btn-row" style={{ marginTop: 16 }}>
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy || !device?.smbPassword || !localRoot.trim()}
              onClick={() => runBackup()}
            >
              {busy ? 'Backing up…' : 'Run backup now'}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={busy || !device}
              onClick={savePlan}
            >
              Save plan
            </button>
          </div>

          {progress && (
            <div className="scan-progress backup-progress" style={{ marginTop: 16 }}>
              <div className="scan-progress-bar">
                <div
                  className={`scan-progress-fill${progressIndeterminate ? ' smb-indeterminate' : ''}`}
                  style={
                    progressIndeterminate ? undefined : { width: `${progress.percent ?? 0}%` }
                  }
                />
              </div>
              <span className="scan-progress-label">{progress.message}</span>
            </div>
          )}
        </Panel>
      </div>

      {plans.length > 0 && (
        <Panel title={`Saved plans · ${plans.length}`}>
          <ul className="backup-plan-list">
            {plans.map((plan) => (
              <li key={plan.id} className="backup-plan-row">
                <div>
                  <strong>{plan.name}</strong>
                  <span className="store-row-meta">
                    {plan.folders.length} folder(s) → {plan.localRoot}
                    {plan.lastRunAt
                      ? ` · last run ${new Date(plan.lastRunAt).toLocaleString()}`
                      : ''}
                    {plan.lastRunOk === false ? ' · last run failed' : ''}
                  </span>
                </div>
                <div className="store-row-actions">
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    disabled={busy}
                    onClick={() => runBackup(plan)}
                  >
                    Run
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={busy}
                    onClick={() => deletePlan(plan.id)}
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <Panel title={`History · ${runs.length}`} className="panel-flush">
        {runs.length === 0 ? (
          <div className="empty">No backups yet.</div>
        ) : (
          <table className="smb-table backup-history-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Status</th>
                <th>Files</th>
                <th>Size</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {runs.slice(0, 15).map((run) => (
                <tr key={run.id}>
                  <td>{new Date(run.startedAt).toLocaleString()}</td>
                  <td>{run.ok ? 'OK' : 'Failed'}</td>
                  <td>{run.fileCount}</td>
                  <td>{formatBytes(run.bytesTotal)}</td>
                  <td className="smb-action-cell">
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => window.berrybridge.shell.openPath(run.destination)}
                    >
                      Open
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </>
  )
}
