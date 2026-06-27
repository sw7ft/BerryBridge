import { useEffect, useState } from 'react'
import type { DeviceProfile } from '@shared/types'
import { PageHeader } from '../components/PageHeader'
import { SshTerminal } from '../components/SshTerminal'

interface Props {
  devices: DeviceProfile[]
  selectedDeviceId?: string | null
}

export function TerminalPage({ devices, selectedDeviceId }: Props) {
  const [deviceId, setDeviceId] = useState(selectedDeviceId || devices[0]?.id || '')
  const [status, setStatus] = useState('Ready')
  const [connected, setConnected] = useState(false)
  const [reconnectKey, setReconnectKey] = useState(0)

  useEffect(() => {
    if (selectedDeviceId) setDeviceId(selectedDeviceId)
  }, [selectedDeviceId])

  useEffect(() => {
    if (!deviceId && devices[0]?.id) setDeviceId(devices[0].id)
  }, [devices, deviceId])

  const device = devices.find((d) => d.id === deviceId) ?? null

  return (
    <div className="terminal-page">
      <PageHeader
        title="Terminal"
        subtitle="Interactive shell over SSH"
        meta={status}
        actions={
          devices.length > 0 ? (
            <div className="terminal-toolbar">
              <select
                className="select-compact"
                value={deviceId}
                onChange={(e) => setDeviceId(e.target.value)}
              >
                {devices.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} · {d.sshHostAlias || `${d.host}:${d.sshPort}`}
                  </option>
                ))}
              </select>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setReconnectKey((k) => k + 1)}
              >
                Reconnect
              </button>
              <span className={`status-pill ${connected ? 'ok' : ''}`}>
                {connected ? 'live' : 'idle'}
              </span>
            </div>
          ) : undefined
        }
      />

      {devices.length === 0 ? (
        <div className="bb-empty">
          <p>No devices configured</p>
          <span>Add a device under Devices, then return here.</span>
        </div>
      ) : (
        <SshTerminal
          device={device}
          reconnectKey={reconnectKey}
          onStatus={setStatus}
          onConnectedChange={setConnected}
        />
      )}
    </div>
  )
}
