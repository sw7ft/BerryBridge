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
export function term49BerryCoreUploadMessage(agentDetected = false): string {
  const dir = DEVICE_PATHS.berrycore.transferDir
  const share = DEVICE_PATHS.berrycore.transferShare
  if (agentDetected) {
    return `Upload complete. Berry Bridge agent is on the device but could not finish the install automatically.

Open ${TERM49_BERRYCORE_SCRIPT} in ${dir} (WiFi Storage → ${share} share), copy the commands, paste into Term49, and run install.sh once. The agent will handle SSH setup afterward.`
  }
  return `Upload complete — finish on your phone before continuing.

Open ${TERM49_BERRYCORE_SCRIPT} in ${dir} (WiFi Storage → ${share} share), copy the commands, paste into Term49 (meta mode + Ctrl+V), and run the installer. berrybridge-agent-bb10-0.1.0.tgz is included for bootstrap — install.sh installs the agent automatically.`
}
