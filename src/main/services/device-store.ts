import Store from 'electron-store'
import { randomUUID } from 'crypto'
import type { DeviceProfile } from '@shared/types'

interface StoreSchema {
  devices: DeviceProfile[]
  lastSeenBerryCoreRelease: string | null
}

export class DeviceStore {
  private store = new Store<StoreSchema>({
    name: 'berrybridge',
    defaults: {
      devices: [],
      lastSeenBerryCoreRelease: null
    }
  })

  listDevices(): DeviceProfile[] {
    return this.store.get('devices')
  }

  getDevice(id: string): DeviceProfile | undefined {
    return this.store.get('devices').find((d) => d.id === id)
  }

  saveDevice(device: DeviceProfile): DeviceProfile {
    const devices = this.store.get('devices')
    const now = new Date().toISOString()
    const existing = devices.findIndex((d) => d.id === device.id)

    const saved: DeviceProfile = {
      ...device,
      updatedAt: now,
      createdAt: existing >= 0 ? devices[existing].createdAt : now,
      id: device.id || randomUUID()
    }

    if (existing >= 0) {
      devices[existing] = saved
    } else {
      devices.push(saved)
    }

    this.store.set('devices', devices)
    return saved
  }

  deleteDevice(id: string): void {
    this.store.set(
      'devices',
      this.store.get('devices').filter((d) => d.id !== id)
    )
  }

  getLastSeenRelease(): string | null {
    return this.store.get('lastSeenBerryCoreRelease')
  }

  setLastSeenRelease(tag: string): void {
    this.store.set('lastSeenBerryCoreRelease', tag)
  }
}
