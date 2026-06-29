import { SMB_DEFAULTS, type DeviceProfile, type SmbHost } from '@shared/types'
import { detectSubnets, generateIpRange, probePort } from './network-utils'
import { Bb10SmbClient, SmbSessionPool } from './bb10-smb-client'
import { ensureSmbMediaPreview } from './smb-preview-cache'
import { bundledSambaDir } from './smb-tool-paths'
import { discoverSmbAccess } from './smb-upload-target'

export class SmbScanner {
  private client = new Bb10SmbClient()
  readonly sessions = new SmbSessionPool(this.client)

  async scan(subnet?: string): Promise<SmbHost[]> {
    const subnets = subnet ? [subnet] : detectSubnets()
    const hosts: SmbHost[] = []

    for (const base of subnets) {
      const ips = generateIpRange(base)
      const batchSize = 32
      for (let i = 0; i < ips.length; i += batchSize) {
        const batch = ips.slice(i, i + batchSize)
        const results = await Promise.all(
          batch.map(async (ip) => {
            const open = await probePort(ip, SMB_DEFAULTS.port)
            return open ? { ip, port: SMB_DEFAULTS.port, reachable: true } : null
          })
        )
        hosts.push(...results.filter((h): h is SmbHost => h !== null))
      }
    }

    return hosts
  }

  testConnection(host: string, password: string, username = SMB_DEFAULTS.username) {
    return this.client.testConnection(host, password, username)
  }

  async testDeviceConnection(device: DeviceProfile) {
    if (!device.smbPassword) {
      return { ok: false, message: 'WiFi Storage password required.' }
    }
    try {
      const access = await discoverSmbAccess(this, device)
      return {
        ok: true,
        message: `Connected to ${access.host} as ${access.username} — share "${access.share}" (${access.shares.join(', ')}).`,
        shares: access.shares.map((name) => ({ name, type: 'Disk', comment: '' })),
        username: access.username,
        share: access.share
      }
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : String(err) }
    }
  }

  openSession(host: string, share: string, password: string, username?: string) {
    return this.sessions.open(host, share, password, username)
  }

  listDirSession(sessionId: string, path: string) {
    return this.sessions.listDir(sessionId, path)
  }

  closeSession(sessionId: string) {
    this.sessions.close(sessionId)
  }

  previewMedia(sessionId: string, remotePath: string, expectedSize = 0) {
    const session = this.sessions.getSession(sessionId)
    if (!session) {
      return Promise.reject(new Error('SMB session expired — reconnect'))
    }

    return ensureSmbMediaPreview(
      (localPath, timeoutMs) =>
        this.client.downloadFile(
          session.host,
          session.share,
          session.password,
          remotePath,
          localPath,
          session.username,
          timeoutMs
        ),
      session.host,
      session.share,
      remotePath,
      expectedSize
    )
  }

  listShares(host: string, password: string, username?: string) {
    return this.client.listShares(host, password, username)
  }

  listDirectory(
    host: string,
    share: string,
    password: string,
    path?: string,
    username?: string
  ) {
    return this.client.listDirectory(host, share, password, path, username)
  }

  downloadFile(
    host: string,
    share: string,
    password: string,
    remotePath: string,
    localPath: string,
    username?: string,
    timeoutMs?: number
  ) {
    return this.client.downloadFile(
      host,
      share,
      password,
      remotePath,
      localPath,
      username,
      timeoutMs
    )
  }

  uploadFile(
    host: string,
    share: string,
    password: string,
    localPath: string,
    remotePath: string,
    username?: string,
    timeoutMs?: number
  ) {
    return this.client.uploadFile(
      host,
      share,
      password,
      localPath,
      remotePath,
      username,
      timeoutMs
    )
  }

  provisionSshKey(device: DeviceProfile, publicKeyPath: string) {
    if (!device.smbPassword) {
      return Promise.reject(
        new Error('WiFi Storage password required — add it on the device profile (Settings → Storage and Access on BB10).')
      )
    }
    return discoverSmbAccess(this, device).then((access) =>
      this.client.provisionSshKey(
        access.host,
        access.share,
        access.password,
        publicKeyPath,
        access.username
      )
    )
  }

  getClientInfo() {
    return {
      available: this.client.isAvailable(),
      bundled: Boolean(bundledSambaDir()),
      smbclientPath: this.client.getSmbclientPath(),
      protocol: 'SMB1 (NT1) — batch commands via smbclient',
      port: SMB_DEFAULTS.port,
      username: SMB_DEFAULTS.username,
      defaultShare: SMB_DEFAULTS.shareName
    }
  }
}
