import { SMB_DEFAULTS, type DeviceProfile, type SmbShareInfo } from '@shared/types'

/** WiFi Storage usernames to try — BB10 "Identification on Network" may differ from blackberry. */
export function resolveSmbUsernames(device: Pick<DeviceProfile, 'smbUser' | 'name'>): string[] {
  const out: string[] = []
  if (device.smbUser?.trim()) out.push(device.smbUser.trim())
  out.push(SMB_DEFAULTS.username)
  const name = device.name?.trim()
  if (name) out.push(name)
  return [...new Set(out)]
}

/** Prefer internal storage share for BerryCore / documents uploads. */
export function pickPreferredShare(shares: SmbShareInfo[]): string | null {
  const disks = shares.filter((s) => s.type.toLowerCase() === 'disk')
  if (disks.length === 0) return null

  for (const preferred of ['media', 'documents']) {
    const hit = disks.find((s) => s.name.toLowerCase() === preferred)
    if (hit) return hit.name
  }

  return disks[0]?.name ?? null
}

export function formatShareList(shares: SmbShareInfo[]): string {
  const disks = shares.filter((s) => s.type.toLowerCase() === 'disk')
  return disks.map((s) => s.name).join(', ') || 'none'
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/** SMB upload timeout from file size (~20 KB/s floor, 15–45 min cap for large zips). */
export function smbUploadTimeoutMs(fileSizeBytes: number): number {
  const minMs = fileSizeBytes > 5 * 1024 * 1024 ? 15 * 60_000 : 3 * 60_000
  const estimatedMs = Math.ceil(fileSizeBytes / 20480) * 1000
  return Math.min(45 * 60_000, Math.max(minMs, estimatedMs))
}
