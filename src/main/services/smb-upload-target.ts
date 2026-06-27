import { SMB_PATHS, type DeviceProfile } from '@shared/types'
import { formatShareList, pickPreferredShare, resolveSmbUsernames } from '@shared/smb-utils'
import type { SmbScanner } from './smb-scanner'

export interface SmbDeviceAccess {
  host: string
  password: string
  username: string
  share: string
  shares: string[]
}

const DOCUMENTS_DIR_CANDIDATES = [
  SMB_PATHS.sharedDocumentsOnMedia,
  SMB_PATHS.sharedDocuments,
  'shared/documents',
  ''
]

export async function discoverSmbAccess(
  smb: SmbScanner,
  device: DeviceProfile
): Promise<SmbDeviceAccess> {
  const password = device.smbPassword
  if (!password) {
    throw new Error('WiFi Storage password required')
  }

  const host = device.host.trim()
  const usernames = resolveSmbUsernames(device)
  let lastError: Error | null = null
  let lastShares: import('@shared/types').SmbShareInfo[] = []

  for (const username of usernames) {
    try {
      const shares = await smb.listShares(host, password, username)
      lastShares = shares
      const share = device.smbShare || pickPreferredShare(shares)
      if (!share) {
        lastError = new Error('No disk shares returned from the phone')
        continue
      }

      await smb.listDirectory(host, share, password, '', username)
      return {
        host,
        password,
        username,
        share,
        shares: shares.filter((s) => s.type.toLowerCase() === 'disk').map((s) => s.name)
      }
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
    }
  }

  const listed = formatShareList(lastShares)
  const userHint = usernames.join(', ')
  throw new Error(
    `${lastError?.message || 'WiFi Storage connection failed'} — tried username(s): ${userHint}; shares seen: ${listed}. Check Settings → Storage and Access → Identification on Network on your BB10.`
  )
}

async function probeDocumentsDir(smb: SmbScanner, access: SmbDeviceAccess): Promise<string> {
  for (const dir of DOCUMENTS_DIR_CANDIDATES) {
    try {
      await smb.listDirectory(access.host, access.share, access.password, dir, access.username)
      return dir
    } catch {
      /* try next */
    }
  }
  return SMB_PATHS.sharedDocumentsOnMedia
}

export function remoteUploadPath(remoteDir: string, fileName: string): string {
  const dir = remoteDir.replace(/\/+$/, '')
  return dir ? `${dir}/${fileName}` : fileName
}

export async function uploadFileToDocuments(
  smb: SmbScanner,
  device: DeviceProfile,
  localPath: string,
  fileName: string,
  access?: SmbDeviceAccess,
  timeoutMs?: number
): Promise<{ share: string; remotePath: string; username: string }> {
  const conn = access ?? (await discoverSmbAccess(smb, device))
  const remoteDir = await probeDocumentsDir(smb, conn)
  const remotePath = remoteUploadPath(remoteDir, fileName)

  try {
    await smb.uploadFile(
      conn.host,
      conn.share,
      conn.password,
      localPath,
      remotePath,
      conn.username,
      timeoutMs
    )
  } catch (err) {
    const hint = err instanceof Error ? err.message : String(err)
    throw new Error(
      `${hint} — connected as ${conn.username} on share "${conn.share}" (available: ${conn.shares.join(', ')}).`
    )
  }

  return { share: conn.share, remotePath, username: conn.username }
}
