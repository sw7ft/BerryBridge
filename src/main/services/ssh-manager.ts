import { spawn, spawnSync, execFileSync } from 'child_process'
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
import {
  DEVICE_PATHS,
  SSH_DEFAULTS,
  type DeviceProfile,
  type SshConfigEntry,
  type SshKeyInfo,
  type PimKind,
  type RemotePimEntry,
  type RemotePimEntryMeta
} from '@shared/types'
import { pubKeyFileName, TERM49_SSH_KEY_SCRIPT, term49ManualInstallMessage } from '@shared/ssh-install-commands'

const SSH_DIR = join(homedir(), '.ssh')
const SSH_CONFIG = join(SSH_DIR, 'config')

/** Non-interactive / one-shot commands (Device Data, test connection, etc.) */
const SSH_BATCH_OPTS = [
  '-o',
  'BatchMode=yes',
  '-o',
  'ConnectTimeout=15',
  '-o',
  'StrictHostKeyChecking=no',
  '-o',
  'UserKnownHostsFile=/dev/null'
] as const

/** Interactive terminal — no BatchMode; keepalive for flaky BB10 sshd */
const SSH_INTERACTIVE_OPTS = [
  '-o',
  'BatchMode=no',
  '-o',
  'ConnectTimeout=15',
  '-o',
  'StrictHostKeyChecking=no',
  '-o',
  'UserKnownHostsFile=/dev/null',
  '-o',
  'ServerAliveInterval=15',
  '-o',
  'ServerAliveCountMax=4'
] as const

/** Legacy BB10 algorithms when not using a ~/.ssh/config Host alias */
const SSH_LEGACY_OPTS = [
  '-o',
  'KexAlgorithms=diffie-hellman-group1-sha1,diffie-hellman-group14-sha1',
  '-o',
  'HostKeyAlgorithms=ssh-rsa',
  '-o',
  'PubkeyAcceptedAlgorithms=ssh-rsa',
  '-o',
  'Ciphers=aes128-ctr,aes128-cbc,3des-cbc',
  '-o',
  'MACs=hmac-sha1,hmac-sha1-96'
] as const

export class SshManager {
  listLocalKeys(): SshKeyInfo[] {
    if (!existsSync(SSH_DIR)) return []

    const keys: SshKeyInfo[] = []
    for (const file of readdirSync(SSH_DIR)) {
      if (!file.endsWith('.pub')) continue
      const pubPath = join(SSH_DIR, file)
      const privPath = pubPath.replace(/\.pub$/, '')
      const publicKey = readFileSync(pubPath, 'utf8').trim()
      keys.push({
        path: privPath,
        publicKey,
        fingerprint: this.fingerprint(publicKey),
        exists: existsSync(privPath)
      })
    }

    return keys.sort((a, b) => {
      const score = (p: string) =>
        p.includes('bb10') || p.includes('blackberry') ? 0 : 1
      return score(a.path) - score(b.path)
    })
  }

  listConfigHosts(): SshConfigEntry[] {
    return this.readSshConfig().filter(
      (e) => e.port === 2022 || e.user === 'blackberry' || e.host.includes('passport')
    )
  }

  /** Resolve a ~/.ssh/config Host alias via `ssh -G` (same as `ssh passport`) */
  importConfigHost(alias: string): Partial<DeviceProfile> | null {
    try {
      const out = execFileSync('ssh', ['-G', alias], { encoding: 'utf8', timeout: 5000 })
      const parsed: Record<string, string> = {}
      for (const line of out.split('\n')) {
        const sp = line.indexOf(' ')
        if (sp <= 0) continue
        parsed[line.slice(0, sp)] = line.slice(sp + 1)
      }

      const hostName = parsed.hostname
      if (!hostName) return null

      const identityRaw = parsed.identityfile?.split('\n')[0] || join(SSH_DIR, 'id_rsa_bb10')

      return {
        name: alias,
        host: hostName,
        sshPort: parseInt(parsed.port || '2022', 10),
        sshUser: parsed.user || SSH_DEFAULTS.user,
        identityFile: this.expandPath(identityRaw),
        sshHostAlias: alias
      }
    } catch {
      return null
    }
  }

  generateKey(name: string): SshKeyInfo {
    mkdirSync(SSH_DIR, { recursive: true, mode: 0o700 })
    const keyPath = join(SSH_DIR, name.startsWith('id_') ? name : `id_${name}`)

    if (existsSync(keyPath)) {
      throw new Error(`Key already exists: ${keyPath}`)
    }

    spawnSync(
      'ssh-keygen',
      ['-t', 'rsa', '-b', '2048', '-f', keyPath, '-N', '', '-C', 'berrybridge@bb10'],
      { stdio: 'pipe' }
    )

    const publicKey = readFileSync(`${keyPath}.pub`, 'utf8').trim()
    return {
      path: keyPath,
      publicKey,
      fingerprint: this.fingerprint(publicKey),
      exists: true
    }
  }

  readSshConfig(): SshConfigEntry[] {
    if (!existsSync(SSH_CONFIG)) return []

    const content = readFileSync(SSH_CONFIG, 'utf8')
    const entries: SshConfigEntry[] = []
    let current: Partial<SshConfigEntry> = {}

    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue

      const match = trimmed.match(/^(\w+)\s+(.+)$/)
      if (!match) continue

      const [, key, value] = match
      if (key === 'Host') {
        if (current.host && current.hostName) entries.push(current as SshConfigEntry)
        current = { host: value }
      } else if (key === 'HostName') current.hostName = value
      else if (key === 'User') current.user = value
      else if (key === 'Port') current.port = parseInt(value, 10)
      else if (key === 'IdentityFile') current.identityFile = this.expandPath(value)
    }

    if (current.host && current.hostName) entries.push(current as SshConfigEntry)
    return entries
  }

  writeConfigEntry(device: DeviceProfile): string {
    mkdirSync(SSH_DIR, { recursive: true, mode: 0o700 })
    const identityFile = this.resolveIdentityPath(device)
    const hostAlias = device.sshHostAlias || device.name.toLowerCase().replace(/\s+/g, '-')

    const block = `
Host ${hostAlias}
  HostName ${device.host}
  User ${device.sshUser || SSH_DEFAULTS.user}
  Port ${device.sshPort || SSH_DEFAULTS.port}
  IdentityFile ${identityFile}
  PubkeyAcceptedAlgorithms +ssh-rsa
  HostKeyAlgorithms +ssh-rsa
  KexAlgorithms +diffie-hellman-group1-sha1
  Ciphers aes128-ctr,aes128-cbc,3des-cbc
  MACs hmac-sha1
`

    let config = existsSync(SSH_CONFIG) ? readFileSync(SSH_CONFIG, 'utf8') : ''
    const hostRegex = new RegExp(`\\nHost ${hostAlias}[\\s\\S]*?(?=\\nHost |$)`, 'g')
    config = config.replace(hostRegex, '')
    config = config.trimEnd() + block

    writeFileSync(SSH_CONFIG, config.trimStart() + '\n', { mode: 0o600 })
    return hostAlias
  }

  async installKeyFromSetup(device: DeviceProfile, pubFileName: string): Promise<string> {
    const setupPath = `${DEVICE_PATHS.berrycore.transferDir}/${pubFileName}`
    await this.execRemote(
      device,
      `mkdir -p ${DEVICE_PATHS.ssh.sshDir} && chmod 700 ${DEVICE_PATHS.ssh.sshDir}`
    )
    const existing = await this.readRemoteFile(device, DEVICE_PATHS.ssh.authorizedKeys).catch(
      () => ''
    )
    const keyContent = await this.readRemoteFile(device, setupPath)
    const keyToken = keyContent.trim().split(/\s+/)[1]
    if (keyToken && existing.includes(keyToken)) {
      return 'Public key already in authorized_keys.'
    }
    await this.execRemote(
      device,
      `cat ${miscPath} >> ${DEVICE_PATHS.ssh.authorizedKeys} && chmod 600 ${DEVICE_PATHS.ssh.authorizedKeys}`
    )
    return `Key installed from ${miscPath} → ${DEVICE_PATHS.ssh.authorizedKeys}.`
  }

  async provisionKeyToDevice(
    device: DeviceProfile,
    publicKeyPath: string
  ): Promise<{ method: string; message: string }> {
    const pubKey = readFileSync(
      publicKeyPath.endsWith('.pub') ? publicKeyPath : `${publicKeyPath}.pub`,
      'utf8'
    ).trim()

    try {
      await this.execRemote(
        device,
        `mkdir -p ${DEVICE_PATHS.ssh.sshDir} && chmod 700 ${DEVICE_PATHS.ssh.sshDir}`
      )
      const existing = await this.readRemoteFile(device, DEVICE_PATHS.ssh.authorizedKeys).catch(
        () => ''
      )
      if (existing.includes(pubKey.split(' ')[1] || pubKey)) {
        return { method: 'ssh', message: 'Public key already present in authorized_keys on device.' }
      }
      await this.execRemote(
        device,
        `echo '${pubKey.replace(/'/g, "'\\''")}' >> ${DEVICE_PATHS.ssh.authorizedKeys} && chmod 600 ${DEVICE_PATHS.ssh.authorizedKeys}`
      )
      return {
        method: 'ssh',
        message: `Key installed to ${DEVICE_PATHS.ssh.authorizedKeys}.`
      }
    } catch (err) {
      const hint = err instanceof Error ? err.message : String(err)
      return {
        method: 'manual',
        message: `SSH unavailable (${hint}). ${term49ManualInstallMessage(pubKeyFileName(publicKeyPath))}`
      }
    }
  }

  async testConnection(device: DeviceProfile): Promise<{ ok: boolean; message: string }> {
    try {
      const result = await this.runSshAsync(device, ['echo', 'berrybridge-ok'])
      if (result.stdout.includes('berrybridge-ok')) {
        return {
          ok: true,
          message: `Connected to ${device.sshHostAlias || `${device.host}:${device.sshPort}`} as ${device.sshUser || SSH_DEFAULTS.user}`
        }
      }
      return {
        ok: false,
        message: result.stderr || result.stdout || 'SSH test failed'
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('Connection refused')) {
        return {
          ok: false,
          message: `${msg} — SSH is not running on the phone yet. In Term49, run every command in ${TERM49_SSH_KEY_SCRIPT} (device ssh-keygen, authorized_keys, then sshd). BerryCore must be installed first. Check the device IP is ${device.host} and port ${device.sshPort || SSH_DEFAULTS.port}.`
        }
      }
      if (msg.includes('Permission denied')) {
        return {
          ok: false,
          message: `${msg} — check identity key and authorized_keys on device.`
        }
      }
      return { ok: false, message: msg }
    }
  }

  async readRemoteFile(device: DeviceProfile, remotePath: string): Promise<string> {
    const result = await this.runSshAsync(device, ['cat', remotePath])
    if (result.code !== 0) {
      throw new Error(result.stderr || `Failed to read ${remotePath}`)
    }
    return result.stdout
  }

  readClipboard(device: DeviceProfile): Promise<string> {
    return this.readRemoteFile(device, DEVICE_PATHS.clipboard.plain).catch(() =>
      this.readRemoteFile(device, DEVICE_PATHS.clipboard.html)
    )
  }

  async listPimFiles(device: DeviceProfile, kind: PimKind): Promise<RemotePimEntry[]> {
    const base =
      kind === 'messages' ? DEVICE_PATHS.pimdata.messages : DEVICE_PATHS.pimdata.notebooks
    const script = `find '${base}' -type f 2>/dev/null | sort -r | head -40`
    const result = await this.runSshAsync(device, ['sh', '-c', script])
    if (result.code !== 0 && !result.stdout.trim()) {
      throw new Error(result.stderr || `No ${kind} found`)
    }
    return result.stdout
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((path) => ({
        path,
        name: path.split('/').pop() || path
      }))
  }

  /** Paths of message files modified within the last N days (QNX find -mtime) */
  async findRecentMessagePaths(device: DeviceProfile, days = 2): Promise<string[]> {
    const base = DEVICE_PATHS.pimdata.messages
    const script = `find '${base}' -type f -name 'msg-*' -mtime -${days} 2>/dev/null`
    const result = await this.runSshAsync(device, ['sh', '-c', script], 20000)
    if (result.code !== 0 && !result.stdout.trim()) {
      return []
    }
    return result.stdout
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
  }

  async listRecentPimFiles(
    device: DeviceProfile,
    kind: PimKind,
    limit = 20
  ): Promise<RemotePimEntryMeta[]> {
    const base =
      kind === 'messages' ? DEVICE_PATHS.pimdata.messages : DEVICE_PATHS.pimdata.notebooks
    const pattern = kind === 'messages' ? '-name "msg-*"' : '-name "desc-*"'
    const script = `find '${base}' -type f ${pattern} 2>/dev/null | head -200 | xargs ls -lt 2>/dev/null | head -${limit}`
    const result = await this.runSshAsync(device, ['sh', '-c', script], 20000)
    if (result.code !== 0 && !result.stdout.trim()) {
      throw new Error(result.stderr || `No ${kind} found`)
    }
    return result.stdout
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.startsWith('-'))
      .map((line) => this.parseLsEntry(line))
      .filter((e): e is RemotePimEntryMeta => e !== null)
  }

  /** Parse `ls -lt` line: `-rw-r--r-- 1 user group SIZE Mon DD HH:MM /path` */
  private parseLsEntry(line: string): RemotePimEntryMeta | null {
    const match = line.match(
      /^-\S+\s+\d+\s+\S+\s+\S+\s+(\d+)\s+(\w{3}\s+\d{1,2}\s+[\d:]+)\s+(\/.+)$/
    )
    if (!match) return null
    const size = parseInt(match[1], 10)
    const path = match[3]
    const mtime =
      Date.parse(`${match[2]} ${new Date().getFullYear()}`) / 1000 || 0
    return {
      path,
      name: path.split('/').pop() || path,
      mtime,
      size: Number.isFinite(size) ? size : 0
    }
  }

  private async execRemote(device: DeviceProfile, command: string): Promise<string> {
    const result = await this.runSshAsync(device, [command])
    if (result.code !== 0) {
      throw new Error(result.stderr || result.stdout || `Exit ${result.code}`)
    }
    return result.stdout
  }

  /** Run a single remote shell command (used by APK install, etc.) */
  async runRemote(device: DeviceProfile, command: string): Promise<string> {
    return this.execRemote(device, command)
  }

  /** Non-blocking SSH for batch reads — keeps the UI responsive */
  private runSshAsync(
    device: DeviceProfile,
    remoteCommand: string[],
    timeoutMs = 15000
  ): Promise<{ stdout: string; stderr: string; code: number }> {
    return new Promise((resolve, reject) => {
      let args: string[]
      try {
        args = this.buildSshArgs(device, remoteCommand)
      } catch (err) {
        reject(err)
        return
      }

      const child = spawn('ssh', args)
      let stdout = ''
      let stderr = ''
      const timer = setTimeout(() => {
        child.kill('SIGTERM')
        reject(new Error('SSH command timed out'))
      }, timeoutMs)

      child.stdout.setEncoding('utf8')
      child.stderr.setEncoding('utf8')
      child.stdout.on('data', (chunk: string) => {
        stdout += chunk
      })
      child.stderr.on('data', (chunk: string) => {
        stderr += chunk
      })
      child.on('error', (err) => {
        clearTimeout(timer)
        reject(err)
      })
      child.on('close', (code) => {
        clearTimeout(timer)
        resolve({ stdout, stderr, code: code ?? 1 })
      })
    })
  }

  getInteractiveArgs(device: DeviceProfile): string[] {
    return ['-tt', ...this.buildSshArgs(device, [], true)]
  }

  private buildSshArgs(
    device: DeviceProfile,
    remoteCommand: string[],
    interactive = false
  ): string[] {
    const baseOpts = interactive ? SSH_INTERACTIVE_OPTS : SSH_BATCH_OPTS
    // Host alias → rely on ~/.ssh/config (same as `ssh passport`)
    if (device.sshHostAlias) {
      return [...baseOpts, device.sshHostAlias, ...remoteCommand]
    }

    const identity = this.resolveIdentityPath(device)
    if (!existsSync(identity)) {
      throw new Error(`Identity file not found: ${identity}`)
    }

    return [
      ...baseOpts,
      ...SSH_LEGACY_OPTS,
      '-i',
      identity,
      '-p',
      String(device.sshPort || SSH_DEFAULTS.port),
      `${device.sshUser || SSH_DEFAULTS.user}@${device.host}`,
      ...remoteCommand
    ]
  }

  private resolveIdentityPath(device: DeviceProfile): string {
    const raw = device.identityFile || join(SSH_DIR, 'id_rsa_bb10')
    return this.expandPath(raw)
  }

  expandPath(p: string): string {
    if (p.startsWith('~/')) return join(homedir(), p.slice(2))
    if (p === '~') return homedir()
    return p
  }

  private fingerprint(publicKey: string): string {
    try {
      const tmp = spawnSync('ssh-keygen', ['-lf', '-'], { input: publicKey, encoding: 'utf8' })
      return tmp.stdout.trim() || 'unknown'
    } catch {
      return 'unknown'
    }
  }
}
