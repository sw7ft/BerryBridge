import type { DeviceProfile } from '@shared/types'

/** One-line device reference — use inside a step, not at page top. */
export function QsDeviceLine({ device }: { device: DeviceProfile }) {
  return (
    <div className="qs-device-line">
      <strong className="qs-device-line-name">{device.name || 'Device'}</strong>
      <span className="qs-device-line-detail">
        {device.host}:{device.sshPort}
      </span>
      <span className="qs-device-line-detail">
        SSH user <code>{device.sshUser}</code>
      </span>
    </div>
  )
}
