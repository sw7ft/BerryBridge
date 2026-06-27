import { QS_ACTIVE_DEVICE_KEY } from '@shared/quick-start-flow'

export function readStoredActiveDeviceId(devices: { id: string }[]): string {
  if (devices.length === 0) return ''
  try {
    const last = localStorage.getItem(QS_ACTIVE_DEVICE_KEY)
    if (last && devices.some((d) => d.id === last)) return last
  } catch {
    /* ignore */
  }
  return devices[0].id
}

export function storeActiveDeviceId(id: string): void {
  try {
    localStorage.setItem(QS_ACTIVE_DEVICE_KEY, id)
  } catch {
    /* ignore */
  }
}
