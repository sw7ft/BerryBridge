import { DEVICE_PATHS } from '@shared/types'

/** Text file uploaded beside berrycore.zip — open on BB10, copy, paste into Term49. */
export const TERM49_BERRYCORE_SCRIPT = 'term49-berrycore-install.txt'

/** Absolute path for Term49 — do not use ~ on BB10. */
const BERRYCORE_INSTALL_DIR = DEVICE_PATHS.berrycore.transferDir

/** Term49 commands after uploading berrycore.zip + install.sh via WiFi Storage. */
export function term49BerryCoreInstallCommands(): string {
  return [`cd ${BERRYCORE_INSTALL_DIR}`, 'sh install.sh'].join('\n')
}

export function term49BerryCoreUpgradeCommands(): string {
  return [`cd ${BERRYCORE_INSTALL_DIR}`, 'sh install.sh --upgrade'].join('\n')
}

/** Contents of {@link TERM49_BERRYCORE_SCRIPT}. */
export function term49BerryCoreInstallScriptContent(): string {
  return term49BerryCoreInstallCommands()
}

/** Short instructions after WiFi Storage upload of BerryCore files. */
export function term49BerryCoreUploadMessage(): string {
  const dir = DEVICE_PATHS.berrycore.transferDir
  const share = DEVICE_PATHS.berrycore.transferShare
  return `Upload complete — finish on your phone before continuing.

Open ${TERM49_BERRYCORE_SCRIPT} in ${dir} (WiFi Storage → ${share} share), copy the commands, paste into Term49 (meta mode + Ctrl+V), and run the installer.`
}
