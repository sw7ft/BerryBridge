import Store from 'electron-store'
import { app, dialog } from 'electron'
import { execFileSync } from 'child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync, unlinkSync } from 'fs'
import { join, basename, extname } from 'path'
import { randomUUID } from 'crypto'
import type { AppStoreEntry, AppStoreCatalog, AppStoreCatalogItem, DeviceProfile } from '@shared/types'
import type { Bb10AppInstaller } from './bb10-app-installer'
import type { Bb10ApkInstaller } from './bb10-apk-installer'

interface CustomStoreSchema {
  apps: AppStoreEntry[]
}

export class AppStoreService {
  private customStore = new Store<CustomStoreSchema>({
    name: 'berrybridge-app-store',
    defaults: { apps: [] }
  })

  constructor(
    private installer: Bb10AppInstaller,
    private apkInstaller: Bb10ApkInstaller
  ) {}

  /** Dev mode HTTPS needs an IP — not an SSH config alias like "passport". */
  private resolveDeviceIp(device: DeviceProfile): string {
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

  private bundledRoot(): string {
    const dirs = [
      join(process.resourcesPath, 'app-store'),
      join(app.getAppPath(), 'resources/app-store'),
      join(__dirname, '../../resources/app-store')
    ]
    for (const dir of dirs) {
      if (existsSync(join(dir, 'catalog.json'))) return dir
    }
    return dirs[1]
  }

  private customPackagesDir(): string {
    const dir = join(app.getPath('userData'), 'app-store', 'packages')
    mkdirSync(dir, { recursive: true })
    return dir
  }

  listCatalog(): AppStoreCatalog {
    const bundledRoot = this.bundledRoot()
    const catalogPath = join(bundledRoot, 'catalog.json')
    let builtin: AppStoreEntry[] = []
    if (existsSync(catalogPath)) {
      try {
        const parsed = JSON.parse(readFileSync(catalogPath, 'utf8')) as AppStoreCatalog
        builtin = (parsed.apps || []).map((a) => {
          const packagePath = join(bundledRoot, 'packages', a.filename)
          return {
            ...a,
            source: 'builtin' as const,
            packagePath,
            packageAvailable: existsSync(packagePath)
          }
        })
      } catch {
        /* empty catalog */
      }
    }

    const custom = this.customStore.get('apps').map((a) => {
      const packagePath = join(this.customPackagesDir(), a.filename)
      return {
        ...a,
        source: 'custom' as const,
        packagePath,
        packageAvailable: existsSync(packagePath)
      }
    })

    return {
      version: 1,
      apps: [...builtin, ...custom]
    }
  }

  async importPackage(): Promise<AppStoreCatalogItem | null> {
    const { filePaths, canceled } = await dialog.showOpenDialog({
      title: 'Add package to your app store',
      properties: ['openFile'],
      filters: [
        { name: 'BB10 packages', extensions: ['bar', 'apk'] },
        { name: 'All files', extensions: ['*'] }
      ]
    })
    if (canceled || !filePaths[0]) return null

    const src = filePaths[0]
    const ext = extname(src).toLowerCase()
    if (ext !== '.bar' && ext !== '.apk') {
      throw new Error('Only .bar and .apk files are supported')
    }

    const original = basename(src)
    const id = randomUUID()
    const filename = `${id}${ext}`
    const dest = join(this.customPackagesDir(), filename)
    copyFileSync(src, dest)

    const name = original.replace(/\.(bar|apk)$/i, '')
    const entry: AppStoreEntry = {
      id,
      name,
      description: 'Custom package',
      type: ext === '.apk' ? 'apk' : 'bar',
      filename,
      source: 'custom'
    }

    const apps = this.customStore.get('apps')
    apps.push(entry)
    this.customStore.set('apps', apps)
    return { ...entry, packagePath: dest, packageAvailable: true }
  }

  removeCustomPackage(id: string): boolean {
    const apps = this.customStore.get('apps')
    const idx = apps.findIndex((a) => a.id === id)
    if (idx < 0) return false
    const [removed] = apps.splice(idx, 1)
    this.customStore.set('apps', apps)
    const pkg = join(this.customPackagesDir(), removed.filename)
    if (existsSync(pkg)) unlinkSync(pkg)
    return true
  }

  resolvePackagePath(entry: AppStoreEntry): string {
    if (entry.source === 'custom') {
      return join(this.customPackagesDir(), entry.filename)
    }
    return join(this.bundledRoot(), 'packages', entry.filename)
  }

  async installPackage(
    device: DeviceProfile,
    entry: AppStoreEntry
  ): Promise<{ ok: boolean; message: string }> {
    const pkg = this.resolvePackagePath(entry)
    if (!existsSync(pkg)) {
      return {
        ok: false,
        message:
          `Package file missing: ${entry.filename}. Run "npm run fetch-app-store" in the Berry Bridge folder (or re-run npm install), then restart the app.`
      }
    }
    if (!device.devModePassword && entry.type === 'bar') {
      return {
        ok: false,
        message:
          'Development Mode password required — add it on the device profile (Devices → Edit).'
      }
    }

    if (entry.type === 'apk') {
      return this.apkInstaller.installApk(device, pkg)
    }

    return this.installer.installPackages(
      this.resolveDeviceIp(device),
      [pkg],
      device.devModePassword
    )
  }
}
