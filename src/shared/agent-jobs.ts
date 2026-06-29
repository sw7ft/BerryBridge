import { randomUUID } from 'crypto'
import { DEVICE_PATHS, SSH_DEFAULTS, type BerryBridgeAgentStatus } from './types'

export const AGENT_MIN_VERSION = '0.1.0'
export const AGENT_POLL_INTERVAL_MS = 3000
export const AGENT_TIMEOUT_BERRYCORE_MS = 45 * 60 * 1000
export const AGENT_TIMEOUT_SSH_MS = 5 * 60 * 1000

export function agentJobTimestamp(date = new Date()): string {
  return date.toISOString().replace(/-/g, '').replace(/:/g, '').split('.')[0] + 'Z'
}

export function agentJobFileName(type: string): string {
  const slug = type.replace(/_/g, '-')
  return `${agentJobTimestamp()}-${randomUUID()}-${slug}.json`
}

export function parseSemver(version: string): [number, number, number] | null {
  const match = version.trim().match(/^(\d+)\.(\d+)\.(\d+)/)
  if (!match) return null
  return [parseInt(match[1], 10), parseInt(match[2], 10), parseInt(match[3], 10)]
}

export function semverGte(version: string, minimum: string): boolean {
  const a = parseSemver(version)
  const b = parseSemver(minimum)
  if (!a || !b) return false
  for (let i = 0; i < 3; i++) {
    if (a[i] > b[i]) return true
    if (a[i] < b[i]) return false
  }
  return true
}

export function agentReady(status: BerryBridgeAgentStatus | null, minVersion = AGENT_MIN_VERSION): boolean {
  if (!status?.agent?.version) return false
  return semverGte(status.agent.version, minVersion)
}

export function pingJobPayload(): Record<string, unknown> {
  return {
    schema: 'berrybridge.job.v1',
    id: randomUUID(),
    type: 'ping',
    created_at: new Date().toISOString(),
    bridge_version: '0.1.6'
  }
}

export function berrycoreJobPayload(mode: 'fresh' | 'upgrade' = 'fresh'): Record<string, unknown> {
  return {
    schema: 'berrybridge.job.v1',
    id: randomUUID(),
    type: 'install_berrycore',
    created_at: new Date().toISOString(),
    bridge_version: '0.1.6',
    workdir: DEVICE_PATHS.berrycore.transferDir,
    zip: 'berrycore.zip',
    installer: 'install.sh',
    mode
  }
}

export function ensureSshKeyJobPayload(
  pubFileName: string,
  publicKeyPath = `${DEVICE_PATHS.berrycore.transferDir}/${pubFileName}`
): Record<string, unknown> {
  return {
    schema: 'berrybridge.job.v1',
    id: randomUUID(),
    type: 'install_ssh_key',
    created_at: new Date().toISOString(),
    bridge_version: '0.1.6',
    public_key_file: pubFileName,
    public_key_path: publicKeyPath,
    authorized_keys_path: DEVICE_PATHS.ssh.authorizedKeys,
    ssh_user: SSH_DEFAULTS.user,
    ssh_port: SSH_DEFAULTS.port,
    start_sshd: true
  }
}

export function ensureSshdJobPayload(): Record<string, unknown> {
  return {
    schema: 'berrybridge.job.v1',
    id: randomUUID(),
    type: 'ensure_sshd',
    created_at: new Date().toISOString(),
    bridge_version: '0.1.6',
    port: SSH_DEFAULTS.port
  }
}
