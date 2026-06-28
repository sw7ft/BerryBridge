import Store from 'electron-store'
import { app, dialog } from 'electron'
import { execFileSync } from 'child_process'
import { createWriteStream, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync, copyFileSync, unlinkSync } from 'fs'
import { join, basename, extname, dirname } from 'path'
import { pipeline } from 'stream/promises'
import { Readable } from 'stream'
import { randomUUID, createHash } from 'crypto'
import type {
  AppStoreEntry,
  AppStoreCatalog,
  AppStoreCatalogItem,
  AppStoreRepo,
  AppStoreRepoManifest,
  DeviceProfile
} from '@shared/types'
import type { Bb10AppInstaller } from './bb10-app-installer'
import type { Bb10ApkInstaller } from './bb10-apk-installer'
import {
  parseGitHubRepoInput,
  repoHtmlUrl,
  repoLabel,
  scanGitHubRepo
} from './app-store-github'

interface CustomStoreSchema {
  apps: AppStoreEntry[]
  repos: AppStoreRepo[]
  manifests: AppStoreRepoManifest[]
}

export class AppStoreService {
  private customStore = new Store<CustomStoreSchema>({
    name: 'berrybridge-app-store',
    defaults: { apps: [], repos: [], manifests: [] }
  })

  constructor(
    private installer: Bb10AppInstaller,
    private apkInstaller: Bb10ApkInstaller
  ) {}

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

  private repoCacheDir(repoId: string): string {
    const dir = join(app.getPath('userData'), 'app-store', 'repo-cache', repoId)
    mkdirSync(dir, { recursive: true })
    return dir
  }

  private cacheFilename(repoId: string, githubPath: string): string {
    const ext = extname(githubPath).toLowerCase()
    const hash = createHash('sha256').update(githubPath).digest('hex').slice(0, 16)
    return `${hash}${ext}`
  }

  listRepos(): AppStoreRepo[] {
    return this.customStore.get('repos')
  }

  listCatalog(): AppStoreCatalog {
    const bundledRoot = this.bundledRoot()
    const catalogPath = join(bundledRoot, 'catalog.json')
    let builtin: AppStoreCatalogItem[] = []
    if (existsSync(catalogPath)) {
      try {
        const parsed = JSON.parse(readFileSync(catalogPath, 'utf8')) as { apps?: AppStoreEntry[] }
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

    const repos = this.listRepos()
    const manifests = this.customStore.get('manifests')
    const repoApps: AppStoreCatalogItem[] = []

    for (const manifest of manifests) {
      const repo = repos.find((r) => r.id === manifest.repoId)
      if (!repo) continue
      for (const pkg of manifest.packages) {
        const filename = this.cacheFilename(repo.id, pkg.path)
        const packagePath = join(this.repoCacheDir(repo.id), filename)
        repoApps.push({
          id: `${repo.id}:${pkg.path}`,
          name: pkg.name,
          description: repo.label,
          type: pkg.type,
          filename,
          source: 'repo',
          author: repo.owner,
          repoId: repo.id,
          githubPath: pkg.path,
          downloadUrl: pkg.downloadUrl,
          packagePath,
          packageAvailable: existsSync(packagePath),
          repoLabel: repo.label
        })
      }
    }

    return {
      version: 1,
      apps: [...builtin, ...repoApps, ...custom],
      repos
    }
  }

  async addGitHubRepo(input: string): Promise<AppStoreRepo> {
    const parsed = parseGitHubRepoInput(input)
    if (!parsed) {
      throw new Error(
        'Invalid GitHub URL — use owner/repo, https://github.com/owner/repo, or https://github.com/owner/repo/tree/branch/folder'
      )
    }

    const repos = this.listRepos()
    const duplicate = repos.find(
      (r) =>
        r.owner.toLowerCase() === parsed.owner.toLowerCase() &&
        r.repo.toLowerCase() === parsed.repo.toLowerCase() &&
        r.path === parsed.path
    )
    if (duplicate) {
      await this.refreshGitHubRepo(duplicate.id)
      return duplicate
    }

    const { branch, packages } = await scanGitHubRepo(parsed)
    if (packages.length === 0) {
      throw new Error(
        `No .bar or .apk files found in ${repoLabel(parsed)} (branch ${branch})`
      )
    }

    const id = randomUUID()
    const now = new Date().toISOString()
    const entry: AppStoreRepo = {
      id,
      owner: parsed.owner,
      repo: parsed.repo,
      branch,
      path: parsed.path,
      label: repoLabel({ ...parsed, branch }),
      htmlUrl: repoHtmlUrl({ ...parsed, branch }, branch),
      addedAt: now,
      lastSyncedAt: now
    }

    repos.push(entry)
    this.customStore.set('repos', repos)
    this.saveManifest(id, branch, packages)
    return entry
  }

  async refreshGitHubRepo(repoId: string): Promise<AppStoreRepo> {
    const repos = this.listRepos()
    const repo = repos.find((r) => r.id === repoId)
    if (!repo) throw new Error('Repo not found')

    const { branch, packages } = await scanGitHubRepo({
      owner: repo.owner,
      repo: repo.repo,
      branch: repo.branch,
      path: repo.path
    })

    repo.branch = branch
    repo.lastSyncedAt = new Date().toISOString()
    repo.htmlUrl = repoHtmlUrl(
      { owner: repo.owner, repo: repo.repo, branch, path: repo.path },
      branch
    )
    this.customStore.set('repos', repos)
    this.saveManifest(repoId, branch, packages)
    return repo
  }

  removeGitHubRepo(repoId: string): boolean {
    const repos = this.listRepos()
    const idx = repos.findIndex((r) => r.id === repoId)
    if (idx < 0) return false
    repos.splice(idx, 1)
    this.customStore.set('repos', repos)

    const manifests = this.customStore.get('manifests').filter((m) => m.repoId !== repoId)
    this.customStore.set('manifests', manifests)

    const cacheDir = join(app.getPath('userData'), 'app-store', 'repo-cache', repoId)
    if (existsSync(cacheDir)) {
      for (const file of readdirSync(cacheDir)) {
        unlinkSync(join(cacheDir, file))
      }
    }
    return true
  }

  private saveManifest(
    repoId: string,
    branch: string,
    packages: AppStoreRepoManifest['packages']
  ): void {
    const manifests = this.customStore.get('manifests').filter((m) => m.repoId !== repoId)
    manifests.push({
      repoId,
      branch,
      packages,
      syncedAt: new Date().toISOString()
    })
    this.customStore.set('manifests', manifests)
  }

  async ensureRepoPackageCached(entry: AppStoreCatalogItem): Promise<string> {
    if (entry.source !== 'repo' || !entry.repoId || !entry.githubPath || !entry.downloadUrl) {
      return this.resolvePackagePath(entry)
    }

    const packagePath = join(
      this.repoCacheDir(entry.repoId),
      this.cacheFilename(entry.repoId, entry.githubPath)
    )
    if (existsSync(packagePath) && statSync(packagePath).size > 0) {
      return packagePath
    }

    mkdirSync(dirname(packagePath), { recursive: true })
    const res = await fetch(entry.downloadUrl, {
      headers: { 'User-Agent': 'BerryBridge' }
    })
    if (!res.ok) {
      throw new Error(`Download failed (HTTP ${res.status}): ${entry.githubPath}`)
    }
    if (!res.body) throw new Error('Download failed — empty response')

    await pipeline(Readable.fromWeb(res.body as import('stream/web').ReadableStream), createWriteStream(packagePath))
    return packagePath
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
    if (entry.source === 'repo' && entry.repoId && entry.githubPath) {
      return join(
        this.repoCacheDir(entry.repoId),
        this.cacheFilename(entry.repoId, entry.githubPath)
      )
    }
    return join(this.bundledRoot(), 'packages', entry.filename)
  }

  async installPackage(
    device: DeviceProfile,
    entry: AppStoreCatalogItem
  ): Promise<{ ok: boolean; message: string }> {
    if (!device.devModePassword && entry.type === 'bar') {
      return {
        ok: false,
        message:
          'Development Mode password required — add it on the device profile (Devices → Edit).'
      }
    }

    let pkg: string
    try {
      if (entry.source === 'repo') {
        pkg = await this.ensureRepoPackageCached(entry)
      } else {
        pkg = this.resolvePackagePath(entry)
        if (!existsSync(pkg)) {
          return {
            ok: false,
            message:
              entry.source === 'builtin'
                ? `Package file missing: ${entry.filename}. Run "npm run fetch-app-store" in the Berry Bridge folder (or re-run npm install), then restart the app.`
                : `Package file missing: ${entry.filename}`
          }
        }
      }
    } catch (err) {
      return {
        ok: false,
        message: err instanceof Error ? err.message : String(err)
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
