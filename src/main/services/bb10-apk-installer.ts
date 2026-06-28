import { execFileSync } from 'child_process'
import { basename } from 'path'
import { DEVICE_PATHS, type DeviceProfile } from '@shared/types'
import type { SmbScanner } from './smb-scanner'
import type { SshManager } from './ssh-manager'
import { uploadFileToDocuments } from './smb-upload-target'
import { smbUnavailableMessage } from './smb-tool-paths'

/** APK sideload — BB10 dev-mode "Install" is BAR-only and returns failure 500 'Package-Id'. */
export class Bb10ApkInstaller {
  constructor(
    private smb: SmbScanner,
    private ssh: SshManager
  ) {}

  extractPackageId(apkPath: string): string | null {
    try {
      const buf = execFileSync('unzip', ['-p', apkPath, 'AndroidManifest.xml'], {
        encoding: 'buffer',
        maxBuffer: 10 * 1024 * 1024
      }) as Buffer
      const text = buf.toString('utf16le')
      const ids = [...text.matchAll(/com\.[a-zA-Z0-9_]+(?:\.[a-zA-Z0-9_]+)*/g)].map((m) => m[0])
      const filtered = ids.filter(
        (id) =>
          !/\.(provider|activity|service|receiver|debug|imagepicker|myfileprovider|preferences|processor)$/i.test(
            id
          )
      )
      const candidates = filtered.length ? filtered : ids
      return candidates.sort((a, b) => a.length - b.length)[0] || null
    } catch {
      return null
    }
  }

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

  private async trySshInstall(remotePath: string, device: DeviceProfile): Promise<boolean> {
    const quoted = `'${remotePath.replace(/'/g, `'\\''`)}'`
    const attempts = [
      `open ${quoted}`,
      `xdg-open ${quoted} 2>/dev/null`,
      `command -v adb >/dev/null 2>&1 && adb install -r ${quoted}`,
      `pm install -r ${quoted} 2>/dev/null`
    ]

    for (const cmd of attempts) {
      try {
        await this.ssh.runRemote(device, cmd)
        return true
      } catch {
        /* try next */
      }
    }
    return false
  }

  async installApk(
    device: DeviceProfile,
    apkPath: string
  ): Promise<{ ok: boolean; message: string }> {
    if (!device.smbPassword) {
      return {
        ok: false,
        message:
          'WiFi Storage password required for APK install — add it on the device profile (Settings → Storage and Access). APK files install through Android on the phone, not Development Mode BAR upload.'
      }
    }

    if (!this.smb.getClientInfo().available) {
      return {
        ok: false,
        message: smbUnavailableMessage()
      }
    }

    const fileName = basename(apkPath)
    const remotePath = `${DEVICE_PATHS.berrycore.transferDir}/${fileName}`
    const host = this.resolveDeviceIp(device)
    const packageId = this.extractPackageId(apkPath)

    try {
      await uploadFileToDocuments(this.smb, device, apkPath, fileName)
    } catch (err) {
      const hint = err instanceof Error ? err.message : String(err)
      return {
        ok: false,
        message: `Could not upload APK over WiFi Storage: ${hint}`
      }
    }

    let launched = false
    try {
      launched = await this.trySshInstall(remotePath, device)
    } catch {
      /* upload alone is still useful */
    }

    if (launched) {
      return {
        ok: true,
        message: `Uploaded ${fileName} and opened the Android installer on your phone — tap Install on the device to finish.${packageId ? ` Package: ${packageId}.` : ''}`
      }
    }

    return {
      ok: true,
      message: `Uploaded ${fileName} to Documents on your phone. Open File Manager → Documents → tap the APK → Install.${packageId ? ` (${packageId})` : ''}`
    }
  }
}
