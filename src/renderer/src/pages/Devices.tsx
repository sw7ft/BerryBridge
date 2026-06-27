import { useEffect, useState } from 'react'
import { randomUUID } from '../utils/id'
import { SSH_DEFAULTS, type DeviceProfile, type DiscoveredDevice } from '@shared/types'
import { DiscoveredDevicesPanel } from '../components/DiscoveredDevicesPanel'
import { PageHeader } from '../components/PageHeader'
import { Panel } from '../components/Panel'
import { SshKeySelect } from '../components/SshKeySelect'
import type { useDeviceScan } from '../hooks/useDeviceScan'

type ScanState = ReturnType<typeof useDeviceScan>

interface Props {
  devices: DeviceProfile[]
  scan: ScanState
  pendingDiscovery?: DiscoveredDevice | null
  onClearPending?: () => void
  onRefresh: () => void
  onOpenTerminal: (deviceId: string) => void
}

const emptyDevice = (): DeviceProfile => ({
  id: randomUUID(),
  name: '',
  host: '',
  sshPort: SSH_DEFAULTS.port,
  sshUser: SSH_DEFAULTS.user,
  identityFile: '',
  devModePassword: '',
  smbPassword: '',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
})

function deviceFromDiscovery(d: DiscoveredDevice): DeviceProfile {
  const base = d.hostname?.split('.')[0] || `bb10-${d.ip.split('.').pop()}`
  return {
    ...emptyDevice(),
    name: base.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase(),
    host: d.ip,
    sshPort: d.sshPort || SSH_DEFAULTS.port,
    sshUser: SSH_DEFAULTS.user
  }
}

function endpoint(d: DeviceProfile): string {
  if (d.sshHostAlias) return d.sshHostAlias
  return `${d.sshUser}@${d.host}:${d.sshPort}`
}

export function DevicesPage({
  devices,
  scan,
  pendingDiscovery,
  onClearPending,
  onRefresh,
  onOpenTerminal
}: Props) {
  const [editing, setEditing] = useState<DeviceProfile | null>(null)
  const [status, setStatus] = useState('')
  const [configHosts, setConfigHosts] = useState<{ host: string; hostName: string }[]>([])

  useEffect(() => {
    window.berrybridge.ssh.listConfigHosts().then(setConfigHosts)
  }, [])

  useEffect(() => {
    if (pendingDiscovery) {
      setEditing(deviceFromDiscovery(pendingDiscovery))
      setStatus(`Pre-filled from scan: ${pendingDiscovery.ip}`)
      onClearPending?.()
    }
  }, [pendingDiscovery, onClearPending])

  const save = async () => {
    if (!editing?.name || !editing?.host) {
      setStatus('Name and IP address are required.')
      return
    }
    await window.berrybridge.devices.save(editing)
    setEditing(null)
    setStatus('Device saved.')
    onRefresh()
  }

  const remove = async (id: string) => {
    await window.berrybridge.devices.delete(id)
    onRefresh()
  }

  const test = async (device: DeviceProfile) => {
    setStatus('Testing SSH…')
    const result = await window.berrybridge.ssh.testConnection(device)
    setStatus(result.message)
  }

  const addDiscovered = (d: DiscoveredDevice) => {
    setEditing(deviceFromDiscovery(d))
    setStatus(`Pre-filled from scan: ${d.ip}`)
  }

  const importFromSshConfig = async (alias: string) => {
    const imported = await window.berrybridge.ssh.importConfigHost(alias)
    if (!imported?.host) {
      setStatus(`Could not import Host ${alias} from ~/.ssh/config`)
      return
    }
    setEditing({
      ...emptyDevice(),
      ...imported,
      id: randomUUID(),
      name: imported.name || alias,
      host: imported.host,
      sshPort: imported.sshPort || SSH_DEFAULTS.port,
      sshUser: imported.sshUser || SSH_DEFAULTS.user,
      identityFile: imported.identityFile || ''
    } as DeviceProfile)
    setStatus(`Imported from ~/.ssh/config Host ${alias}`)
  }

  return (
    <>
      <PageHeader
        title="Devices"
        subtitle="Register BerryCore devices on your network. Use Scan LAN to discover devices, or add one manually."
        meta={scan.subnets.length > 0 ? `Subnets: ${scan.subnets.join(', ')}` : undefined}
        actions={
          <div className="btn-row" style={{ margin: 0 }}>
            <button className="btn btn-secondary" onClick={() => setEditing(emptyDevice())}>
              + Add
            </button>
            {configHosts.length > 0 && (
              <select
                className="select-compact"
                defaultValue=""
                onChange={(e) => {
                  if (e.target.value) importFromSshConfig(e.target.value)
                  e.target.value = ''
                }}
              >
                <option value="">Import ~/.ssh/config</option>
                {configHosts.map((h) => (
                  <option key={h.host} value={h.host}>
                    {h.host} → {h.hostName}
                  </option>
                ))}
              </select>
            )}
          </div>
        }
      />

      {status && <div className="alert alert-info">{status}</div>}

      <DiscoveredDevicesPanel
        discovered={scan.discovered}
        scanning={scan.scanning}
        progress={scan.progress}
        onAdd={addDiscovered}
        onRescan={() => scan.startScan()}
        onStop={scan.stopScan}
      />

      <Panel title={`Saved · ${devices.length}`} className="panel-flush">
        {devices.length === 0 ? (
          <div className="empty">No saved devices — add one from the scan above.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Endpoint</th>
                <th>Key</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {devices.map((d) => (
                <tr key={d.id}>
                  <td>
                    <span className="device-name">{d.name}</span>
                  </td>
                  <td>
                    <code className="code-inline">{endpoint(d)}</code>
                  </td>
                  <td>
                    <span className="text-muted mono-truncate">
                      {d.identityFile ? d.identityFile.split('/').pop() : '—'}
                    </span>
                  </td>
                  <td className="cell-actions">
                    <button className="btn btn-primary btn-sm" onClick={() => onOpenTerminal(d.id)}>
                      Terminal
                    </button>
                    <button className="btn btn-secondary btn-sm" onClick={() => test(d)}>
                      Test
                    </button>
                    <button className="btn btn-secondary btn-sm" onClick={() => setEditing({ ...d })}>
                      Edit
                    </button>
                    <button className="btn btn-danger btn-sm" onClick={() => remove(d.id)}>
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>

      {editing && (
        <Panel title={devices.find((d) => d.id === editing.id) ? 'Edit device' : 'New device'}>
          <div className="grid-2">
            <div className="field">
              <label>Name</label>
              <input
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                placeholder="passport"
              />
            </div>
            <div className="field">
              <label>IP address</label>
              <input
                value={editing.host}
                onChange={(e) => setEditing({ ...editing, host: e.target.value })}
                placeholder="192.168.1.226"
              />
            </div>
            <div className="field">
              <label>SSH port</label>
              <input
                type="number"
                value={editing.sshPort}
                onChange={(e) =>
                  setEditing({ ...editing, sshPort: parseInt(e.target.value) || 2022 })
                }
              />
            </div>
            <div className="field">
              <label>SSH user</label>
              <input
                value={editing.sshUser}
                onChange={(e) => setEditing({ ...editing, sshUser: e.target.value })}
              />
            </div>
            <div className="field">
              <SshKeySelect
                value={editing.identityFile || ''}
                onChange={(path) => setEditing({ ...editing, identityFile: path })}
              />
            </div>
            {editing.sshHostAlias && (
              <div className="field">
                <label>SSH config alias</label>
                <input value={editing.sshHostAlias} readOnly className="readonly" />
                <span className="field-hint">
                  Uses <code className="code-inline">ssh {editing.sshHostAlias}</code>
                </span>
              </div>
            )}
            <div className="field">
              <label>Development Mode password</label>
              <input
                type="password"
                value={editing.devModePassword || ''}
                onChange={(e) => setEditing({ ...editing, devModePassword: e.target.value })}
              />
              <span className="field-hint">
                Not the WiFi/storage password — this is what you set under Settings → Security →
                Development Mode. Required for App Store installs.
              </span>
            </div>
            <div className="field">
              <label>WiFi storage password</label>
              <input
                type="password"
                value={editing.smbPassword || ''}
                onChange={(e) => setEditing({ ...editing, smbPassword: e.target.value })}
              />
            </div>
          </div>
          <div className="btn-row">
            <button className="btn btn-primary" onClick={save}>
              Save
            </button>
            <button className="btn btn-secondary" onClick={() => setEditing(null)}>
              Cancel
            </button>
          </div>
        </Panel>
      )}
    </>
  )
}
