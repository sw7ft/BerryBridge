import { app } from 'electron'
import { createWriteStream, existsSync, mkdirSync, statSync, unlinkSync, writeFileSync } from 'fs'
import { join } from 'path'
import { pipeline } from 'stream/promises'
import { Readable } from 'stream'
import { randomUUID } from 'crypto'
import { tmpdir } from 'os'
import {
  type BerryCoreRelease,
  type BerryCoreUploadProgress,
  type DeviceProfile
} from '@shared/types'
import { formatBytes, smbUploadTimeoutMs } from '@shared/smb-utils'
import {
  TERM49_BERRYCORE_SCRIPT,
  term49BerryCoreInstallScriptContent,
  term49BerryCoreUploadMessage
} from '@shared/berrycore-install-commands'
import type { BerryCoreFeed } from './berrycore-feed'
import type { SmbScanner } from './smb-scanner'
import type { BerryBridgeAgentService } from './berrybridge-agent-service'
import { smbUnavailableMessage } from './smb-tool-paths'
import { discoverSmbAccess, uploadFileToDocuments } from './smb-upload-target'

export interface BerryCoreCacheInfo {
  tag: string
  name: string
  berrycoreZip: string
  installSh: string
  release: BerryCoreRelease
}

export class BerryCoreSetupService {
  constructor(
    private feed: BerryCoreFeed,
    private smb: SmbScanner,
    private agent?: BerryBridgeAgentService
  ) {}

  private cacheRoot(): string {
    return join(app.getPath('userData'), 'berrycore-cache')
  }

  private releaseDir(tag: string): string {
    return join(this.cacheRoot(), tag.replace(/[^\w.-]/g, '_'))
  }

  async getCachedLatest(): Promise<BerryCoreCacheInfo | null> {
    const latest = await this.feed.fetchLatest()
    if (!latest) return null
    return this.getCachedRelease(latest.tag, latest)
  }

  getCachedRelease(tag: string, release?: BerryCoreRelease | null): BerryCoreCacheInfo | null {
    const dir = this.releaseDir(tag)
    const berrycoreZip = join(dir, 'berrycore.zip')
    const installSh = join(dir, 'install.sh')
    if (!existsSync(berrycoreZip) || !existsSync(installSh)) return null
    return {
      tag,
      name: release?.name || tag,
      berrycoreZip,
      installSh,
      release: release || {
        tag,
        name: tag,
        publishedAt: '',
        htmlUrl: '',
        body: '',
        assets: []
      }
    }
  }

  async downloadLatest(): Promise<{
    ok: boolean
    message: string
    cache?: BerryCoreCacheInfo
  }> {
    const latest = await this.feed.fetchLatest()
    if (!latest) {
      return { ok: false, message: 'Could not load the latest BerryCore release from GitHub.' }
    }

    const berrycoreAsset = latest.assets.find((a) => a.name === 'berrycore.zip')
    const installAsset = latest.assets.find((a) => a.name === 'install.sh')
    if (!berrycoreAsset || !installAsset) {
      return {
        ok: false,
        message: 'Latest release is missing berrycore.zip or install.sh on GitHub.'
      }
    }

    const existing = this.getCachedRelease(latest.tag, latest)
    if (existing) {
      return {
        ok: true,
        message: `${latest.name} is already downloaded on this computer.`,
        cache: existing
      }
    }

    const dir = this.releaseDir(latest.tag)
    mkdirSync(dir, { recursive: true })

    try {
      await this.downloadAsset(berrycoreAsset.downloadUrl, join(dir, 'berrycore.zip'))
      await this.downloadAsset(installAsset.downloadUrl, join(dir, 'install.sh'))
    } catch (err) {
      const hint = err instanceof Error ? err.message : String(err)
      return { ok: false, message: `Download failed: ${hint}` }
    }

    const cache = this.getCachedRelease(latest.tag, latest)!
    return {
      ok: true,
      message: `Downloaded ${latest.name} (${latest.tag}) to this computer.`,
      cache
    }
  }

  async uploadToDevice(
    device: DeviceProfile,
    onProgress?: (progress: BerryCoreUploadProgress) => void
  ): Promise<import('@shared/types').BerryCoreDeviceUploadResult> {
    const emit = (progress: BerryCoreUploadProgress) => onProgress?.(progress)

    if (!device.smbPassword) {
      return {
        ok: false,
        message:
          'WiFi Storage password required — save it in Quick Start step 3 (Settings → Storage and Access on BB10).'
      }
    }

    if (!this.smb.getClientInfo().available) {
      return {
        ok: false,
        message: smbUnavailableMessage()
      }
    }

    const cached = await this.getCachedLatest()
    if (!cached) {
      return {
        ok: false,
        message: 'Download BerryCore first (step 5) before sending files to your phone.'
      }
    }

    const host = device.host.trim()

    const scriptLocal = join(tmpdir(), `berrybridge-${randomUUID()}-${TERM49_BERRYCORE_SCRIPT}`)
    writeFileSync(scriptLocal, term49BerryCoreInstallScriptContent(), 'utf8')

    const uploads: { localPath: string; fileName: string }[] = [
      { localPath: cached.berrycoreZip, fileName: 'berrycore.zip' },
      { localPath: cached.installSh, fileName: 'install.sh' },
      { localPath: scriptLocal, fileName: TERM49_BERRYCORE_SCRIPT }
    ]

    const agentTgz = this.agent?.resolveAgentTgzPath()
    if (agentTgz) {
      uploads.splice(2, 0, { localPath: agentTgz, fileName: 'berrybridge-agent-bb10-0.1.0.tgz' })
    }

    const sizes = uploads.map((u) => statSync(u.localPath).size)
    const totalBytes = sizes.reduce((sum, n) => sum + n, 0)
    let completedBytes = 0

    try {
      emit({
        phase: 'connecting',
        message: `Connecting to ${device.name} over WiFi Storage…`,
        percent: 0,
        indeterminate: true
      })

      const access = await discoverSmbAccess(this.smb, device)

      for (let i = 0; i < uploads.length; i++) {
        const { localPath, fileName } = uploads[i]
        const size = sizes[i]
        const isLarge = size > 5 * 1024 * 1024
        const percent = totalBytes > 0 ? Math.round((completedBytes / totalBytes) * 100) : 0

        emit({
          phase: 'uploading',
          message: isLarge
            ? `Uploading ${fileName} (${formatBytes(size)}) — usually 5–10 minutes over WiFi…`
            : `Uploading ${fileName}…`,
          file: fileName,
          fileIndex: i + 1,
          fileCount: uploads.length,
          percent,
          indeterminate: isLarge
        })

        await uploadFileToDocuments(
          this.smb,
          device,
          localPath,
          fileName,
          access,
          smbUploadTimeoutMs(size)
        )

        completedBytes += size
        emit({
          phase: 'uploading',
          message: `Uploaded ${fileName}`,
          file: fileName,
          fileIndex: i + 1,
          fileCount: uploads.length,
          percent: totalBytes > 0 ? Math.round((completedBytes / totalBytes) * 100) : 100,
          indeterminate: false
        })
      }

      emit({
        phase: 'done',
        message: 'All BerryCore files sent to your phone.',
        fileCount: uploads.length,
        percent: 100,
        indeterminate: false
      })

      const agentStatus = this.agent ? await this.agent.readStatus(device, access) : null
      const agentReady = this.agent?.isAgentReady(agentStatus) ?? false

      if (agentReady && this.agent) {
        emit({
          phase: 'agent-running',
          message: 'Berry Bridge agent detected — installing BerryCore…',
          indeterminate: true
        })
        const agentResult = await this.agent.runInstallBerryCore(device, access, (p) => {
          emit({
            phase: p.phase === 'agent-polling' ? 'agent-polling' : 'agent-running',
            message: p.message,
            indeterminate: true
          })
        })
        if (agentResult.ok) {
          emit({
            phase: 'done',
            message: agentResult.message,
            percent: 100,
            indeterminate: false
          })
          return {
            ok: true,
            message: agentResult.message,
            method: 'agent',
            berrycoreInstalled: true
          }
        }
      }

      if (agentStatus?.berrycore?.installed) {
        return {
          ok: true,
          message: `BerryCore is already installed on ${device.name} (agent v${agentStatus.agent?.version || '?'}).`,
          method: 'agent',
          berrycoreInstalled: true
        }
      }

      return {
        ok: true,
        message: term49BerryCoreUploadMessage(agentReady),
        method: 'term49',
        berrycoreInstalled: false
      }
    } catch (err) {
      const hint = err instanceof Error ? err.message : String(err)
      emit({
        phase: 'error',
        message: `Could not upload to ${host}: ${hint}`,
        percent: totalBytes > 0 ? Math.round((completedBytes / totalBytes) * 100) : 0,
        indeterminate: false
      })
      return {
        ok: false,
        message: `Could not upload to ${host}: ${hint}`
      }
    } finally {
      try {
        unlinkSync(scriptLocal)
      } catch {
        /* ignore */
      }
    }
  }

  private async downloadAsset(url: string, dest: string): Promise<void> {
    const res = await fetch(url, {
      headers: { Accept: 'application/octet-stream', 'User-Agent': 'BerryBridge' }
    })
    if (!res.ok || !res.body) {
      throw new Error(`HTTP ${res.status} downloading ${url.split('/').pop()}`)
    }
    await pipeline(Readable.fromWeb(res.body as import('stream/web').ReadableStream), createWriteStream(dest))
  }
}
