import { useEffect, useState } from 'react'
import type { DeviceProfile } from '@shared/types'
import { PageHeader } from '../components/PageHeader'
import { Panel } from '../components/Panel'

interface Props {
  devices: DeviceProfile[]
}

export function AppsPage({ devices }: Props) {
  const [selectedDevice, setSelectedDevice] = useState('')
  const [ready, setReady] = useState<boolean | null>(null)

  useEffect(() => {
    window.berrybridge.apps.managerInfo().then((info) => {
      setReady(info.ready === true)
    })
  }, [])

  const device = devices.find((d) => d.id === selectedDevice)

  const openManager = () => {
    if (!device) return
    window.berrybridge.apps.openManager(device.host, device.devModePassword)
  }

  return (
    <>
      <PageHeader
        title="Application install"
        subtitle="Install .bar packages to your device through Berry Bridge's built-in development-mode manager."
      />

      {ready === false && (
        <div className="alert alert-warn">
          App Manager runtime is not installed. Run <code>npm install</code> in the Berry Bridge
          project folder, then restart the application.
        </div>
      )}

      <Panel title="Install applications">
        <p className="panel-desc">
          Select a device with Development Mode enabled, then open the app manager to upload and
          install .bar files. Authentication uses your device development password.
        </p>

        <div className="field">
          <label>Device</label>
          <select value={selectedDevice} onChange={(e) => setSelectedDevice(e.target.value)}>
            <option value="">— select device —</option>
            {devices.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} ({d.host})
              </option>
            ))}
          </select>
        </div>

        <div className="btn-row">
          <button className="btn btn-primary" disabled={!device || ready === false} onClick={openManager}>
            Open app manager
          </button>
        </div>
      </Panel>

      <Panel title="Before you install">
        <ol className="bb-steps bb-steps-loose">
          <li>
            <strong>Enable Development Mode</strong>
            <span>Settings → Security → Development Mode on the BB10 device.</span>
          </li>
          <li>
            <strong>Save the dev password</strong>
            <span>Add it to the device profile under Devices → Edit.</span>
          </li>
          <li>
            <strong>Install</strong>
            <span>In the app manager, choose or drag .bar files to install.</span>
          </li>
        </ol>
      </Panel>
    </>
  )
}
