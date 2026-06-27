import type { DeviceProfile, SmbShareInfo } from '@shared/types'
import { pickPreferredShare, resolveSmbUsernames } from '@shared/smb-utils'

export interface SmbConnectResult {
  ok: boolean
  message: string
  shares: SmbShareInfo[]
  share?: string
  username?: string
}

/** Test WiFi Storage using existing smb.test IPC — tries multiple usernames, picks media share. */
export async function testSmbForDevice(
  host: string,
  password: string,
  device?: DeviceProfile,
  smbUserInput = ''
): Promise<SmbConnectResult> {
  const usernames = resolveSmbUsernames({
    smbUser: smbUserInput.trim() || device?.smbUser,
    name: device?.name || ''
  })

  let lastMessage = 'WiFi Storage connection failed'
  let lastShares: SmbShareInfo[] = []

  for (const username of usernames) {
    const result = await window.berrybridge.smb.test(host, password, username)
    if (!result.ok) {
      lastMessage = result.message
      continue
    }
    const shares = result.shares || []
    lastShares = shares
    const share = pickPreferredShare(shares)
    if (!share) {
      lastMessage = 'No storage shares found on the phone'
      continue
    }
    return {
      ok: true,
      message: `Connected to ${host} as ${username} — share "${share}".`,
      shares,
      share,
      username
    }
  }

  return { ok: false, message: lastMessage, shares: lastShares }
}
