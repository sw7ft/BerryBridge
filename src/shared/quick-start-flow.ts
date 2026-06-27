/** Steps shown in Quick Start roadmap and Overview — keep in sync with QuickStart.tsx */
export const QUICK_START_FLOW = [
  'Enable Development Mode & WiFi Storage on the BB10',
  'Find your BB10 on the network & save it',
  'Save Development Mode & WiFi Storage passwords',
  'Install Term49 on your phone',
  'Download BerryCore to this computer',
  'Send BerryCore to your phone & run installer in Term49',
  'Generate an SSH key on this computer',
  'Install the SSH key on the device (Term49)',
  'Link the key & write ~/.ssh/config',
  'Test SSH connection'
] as const

export const QS_PHONE_SETUP_KEY = 'berrybridge-qs-phone-setup'
export const QS_ACTIVE_DEVICE_KEY = 'berrybridge-qs-active-device'

/** App Store catalog id for Term49 (all permissions) — Quick Start step 4. */
export const QS_TERM49_PACKAGE_ID = 'term49-all'

export function qsKeyTerm49DoneKey(deviceId: string): string {
  return `berrybridge-qs-key-term49-${deviceId}`
}

export function qsTerm49InstalledKey(deviceId: string): string {
  return `berrybridge-qs-term49-installed-${deviceId}`
}

export function qsBerryCoreDownloadedKey(): string {
  return 'berrybridge-qs-berrycore-downloaded-tag'
}

export function qsBerryCoreUploadedKey(deviceId: string): string {
  return `berrybridge-qs-berrycore-uploaded-${deviceId}`
}

export function qsBerryCoreInstalledKey(deviceId: string): string {
  return `berrybridge-qs-berrycore-installed-${deviceId}`
}
