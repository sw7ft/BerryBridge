import { useEffect, useState } from 'react'
import type { DeviceProfile } from '@shared/types'
import type { LocalApiInfo } from '@shared/local-api'
import { PageHeader } from '../components/PageHeader'
import { Panel } from '../components/Panel'

interface Props {
  devices: DeviceProfile[]
}

export function AppsPage({ devices }: Props) {
  const [selectedDevice, setSelectedDevice] = useState('')
  const [ready, setReady] = useState<boolean | null>(null)
  const [apiInfo, setApiInfo] = useState<LocalApiInfo | null>(null)

  useEffect(() => {
    window.berrybridge.apps.managerInfo().then((info) => {
      setReady(info.ready === true)
    })
    window.berrybridge.api.info().then(setApiInfo)
  }, [])

  const device = devices.find((d) => d.id === selectedDevice)

  const openManager = () => {
    if (!device) return
    window.berrybridge.apps.openManager(device.host, device.devModePassword)
  }

  const exampleInstall = apiInfo
    ? `curl -sS -X POST ${apiInfo.baseUrl}/v1/install/bar \\
  -H 'Content-Type: application/json' \\
  -d '{"deviceId":"${device?.id || '<device-id>'}","barPath":"/path/to/app.bar"}'`
    : ''

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

      {apiInfo?.enabled && (
        <Panel title="Local install API">
          <p className="panel-desc">
            While Berry Bridge is running, scripts and other tools on this computer can install
            .bar files through a localhost HTTP API. Uses the same headless dev-mode installer as
            the App Store.
          </p>

          <p className="panel-desc">
            Base URL: <code>{apiInfo.baseUrl}</code>
          </p>
          {apiInfo.tokenRequired && (
            <p className="panel-desc">
              Auth header: <code>Authorization: Bearer &lt;BERRYBRIDGE_API_TOKEN&gt;</code>
            </p>
          )}

          <pre className="mono">{exampleInstall}</pre>

          <p className="panel-desc muted">
            Endpoints: <code>GET /v1/health</code>, <code>GET /v1/devices</code>,{' '}
            <code>POST /v1/install/bar</code>, <code>POST /v1/install/catalog</code>. Set{' '}
            <code>BERRYBRIDGE_API_TOKEN</code> to require a bearer token. Set{' '}
            <code>BERRYBRIDGE_API_ENABLED=0</code> to disable.
          </p>
        </Panel>
      )}

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
