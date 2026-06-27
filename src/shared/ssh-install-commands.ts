import { DEVICE_PATHS } from './types'

/** Text file uploaded beside the .pub — open on BB10, copy, paste into Term49. */
export const TERM49_SSH_KEY_SCRIPT = 'term49-ssh-key-install.txt'

/** Match ssh-keygen naming in SshManager.generateKey (adds id_ prefix). */
export function sshKeyBaseName(nameOrPath: string): string {
  let base = nameOrPath.split('/').pop() || nameOrPath || 'rsa_bb10'
  if (base.endsWith('.pub')) base = base.slice(0, -4)
  return base.startsWith('id_') ? base : `id_${base}`
}

export function pubKeyFileName(keyPathOrName: string): string {
  return `${sshKeyBaseName(keyPathOrName)}.pub`
}

/** Shell commands to run in Term49 after uploading *.pub via WiFi Storage. */
export function term49AuthorizedKeysCommands(pubFileName: string): string {
  const { sshDir, authorizedKeys } = DEVICE_PATHS.ssh
  const setupDir = DEVICE_PATHS.berrycore.transferDir
  const berrycore = DEVICE_PATHS.berrycore.defaultInstall
  return [
    `source ${berrycore}/env.sh`,
    `mkdir -p ${sshDir}`,
    `chmod 700 ${sshDir}`,
    `test -f ${sshDir}/id_rsa || ssh-keygen -t rsa -b 2048 -f ${sshDir}/id_rsa -N ""`,
    `cat ${setupDir}/${pubFileName} >> ${authorizedKeys}`,
    `chmod 600 ${authorizedKeys}`,
    'sshd'
  ].join('\n')
}

/** Contents of {@link TERM49_SSH_KEY_SCRIPT} — plain commands, one block to copy. */
export function term49SshKeyInstallScriptContent(pubFileName: string): string {
  return term49AuthorizedKeysCommands(pubFileName)
}

/** Short instructions for alerts / backend messages after WiFi Storage upload. */
export function term49ManualInstallMessage(pubFileName: string): string {
  const dir = DEVICE_PATHS.berrycore.transferDir
  return `Uploaded ${pubFileName} and ${TERM49_SSH_KEY_SCRIPT} to ${dir}/ via WiFi Storage.

Finish on the phone: open ${TERM49_SSH_KEY_SCRIPT} in ${dir}, copy all, paste into Term49 (meta mode + Ctrl+V), and run. The script runs ssh-keygen on the device, adds your Mac key to authorized_keys, and starts sshd. Then test SSH again in Berry Bridge.`
}

