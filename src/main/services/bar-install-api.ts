import { execFileSync } from 'child_process'
import { existsSync, realpathSync } from 'fs'
import { resolve, extname } from 'path'
import type { DeviceProfile } from '@shared/types'
import type {
  BarInstallRequest,
  InstallResponse,
  LocalApiDeviceSummary
} from '@shared/local-api'
import type { DeviceStore } from './device-store'
import type { Bb10AppInstaller } from './bb10-app-installer'
import type { AppStoreService } from './app-store-service'

interface InstallTarget {
  deviceIp: string
  devPassword?: string
  device?: DeviceProfile
}

export class BarInstallApi {
  private installChain: Promise<unknown> = Promise.resolve()

  constructor(
    private store: DeviceStore,
    private installer: Bb10AppInstaller,
    private appStore: AppStoreService
  ) {}

  getManagerInfo() {
    return this.installer.getManagerInfo()
  }

  listDevices(): LocalApiDeviceSummary[] {
    return this.store.listDevices().map((d) => ({
      id: d.id,
      name: d.name,
      host: d.host,
      hasDevPassword: Boolean(d.devModePassword)
    }))
  }

  async installBar(request: BarInstallRequest): Promise<InstallResponse> {
    return this.withInstallLock(async () => {
      const paths = normalizeBarPaths(request)
      if (paths.length === 0) {
        return { ok: false, message: 'Provide barPath or barPaths (absolute .bar file path(s)).' }
      }

      let target: InstallTarget
      try {
        target = this.resolveTarget(request)
      } catch (err) {
        return {
          ok: false,
          message: err instanceof Error ? err.message : String(err)
        }
      }

      if (!target.devPassword) {
        if (request.openManager) {
          this.installer.openAppManager(target.deviceIp)
          return {
            ok: true,
            message: `Opened app manager for ${target.deviceIp}. Upload .bar files in the manager window.`
          }
        }
        return {
          ok: false,
          message:
            'Development Mode password required — pass devPassword or save it on the device profile (Devices → Edit).'
        }
      }

      return this.installer.installPackages(target.deviceIp, paths, target.devPassword)
    })
  }

  async installCatalog(deviceId: string, entryId: string): Promise<InstallResponse> {
    return this.withInstallLock(async () => {
      const device = this.store.getDevice(deviceId)
      if (!device) {
        return { ok: false, message: 'Device not found' }
      }
      const entry = this.appStore.listCatalog().apps.find((a) => a.id === entryId)
      if (!entry) {
        return { ok: false, message: 'Package not found in catalog' }
      }
      if (entry.type !== 'bar') {
        return {
          ok: false,
          message: `Catalog entry "${entry.name}" is ${entry.type.toUpperCase()} — use the App Store UI or a separate APK flow.`
        }
      }
      return this.appStore.installPackage(device, entry)
    })
  }

  private withInstallLock<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.installChain.then(fn, fn)
    this.installChain = run.then(
      () => undefined,
      () => undefined
    )
    return run
  }

  private resolveTarget(request: BarInstallRequest): InstallTarget {
    if (request.deviceId) {
      const device = this.store.getDevice(request.deviceId)
      if (!device) {
        throw new Error(`Device not found: ${request.deviceId}`)
      }
      return {
        device,
        deviceIp: resolveDeviceIp(device),
        devPassword: request.devPassword || device.devModePassword
      }
    }

    const deviceIp = request.deviceIp?.trim()
    if (!deviceIp) {
      throw new Error('Provide deviceId or deviceIp.')
    }

    return {
      deviceIp,
      devPassword: request.devPassword
    }
  }
}

function normalizeBarPaths(request: BarInstallRequest): string[] {
  const raw = [
    ...(request.barPaths ?? []),
    ...(request.barPath ? [request.barPath] : [])
  ]
    .map((p) => p.trim())
    .filter(Boolean)

  const paths: string[] = []
  for (const p of raw) {
    const abs = resolve(p)
    if (extname(abs).toLowerCase() !== '.bar') {
      throw new Error(`Not a .bar file: ${abs}`)
    }
    if (!existsSync(abs)) {
      throw new Error(`BAR file not found: ${abs}`)
    }
    try {
      paths.push(realpathSync(abs))
    } catch {
      paths.push(abs)
    }
  }
  return [...new Set(paths)]
}

function resolveDeviceIp(device: DeviceProfile): string {
  const host = device.host.trim()
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return host
  if (device.sshHostAlias) {
    try {
      const out = execFileSync('ssh', ['-G', device.sshHostAlias], {
        encoding: 'utf8',
        timeout: 5000
      })
      for (const line of out.split('\n')) {
        if (line.startsWith('hostname ')) {
          const ip = line.slice(9).trim()
          if (ip) return ip
        }
      }
    } catch {
      /* fall through */
    }
  }
  return host
}
