import { spawn } from 'child_process'
import { execSync } from 'child_process'
import { existsSync, writeFileSync, unlinkSync, mkdtempSync } from 'fs'
import { join, basename } from 'path'
import { tmpdir } from 'os'
import { app } from 'electron'
import { randomUUID } from 'crypto'
import { SMB_DEFAULTS, SMB_PATHS, type SmbFileEntry, type SmbShareInfo } from '@shared/types'
import { parseDirListing } from '@shared/smb-dir-parser'
import {
  bundledSambaDir,
  resolveBundledSmbclient,
  smbUnavailableMessage,
  spawnEnvForBundledSamba
} from './smb-tool-paths'
import {
  TERM49_SSH_KEY_SCRIPT,
  term49ManualInstallMessage,
  term49SshKeyInstallScriptContent
} from '@shared/ssh-install-commands'

export interface SmbAuthResult {
  ok: boolean
  message: string
  shares?: SmbShareInfo[]
}

interface SessionMeta {
  id: string
  host: string
  share: string
  username: string
  password: string
  lastUsed: number
}

const SMB_COMMAND_MS = 60_000
const SMB_RETRIES = 2

function writeAuthFile(path: string, username: string, password: string): void {
  const quoted =
    /[\s=#"]/.test(password) ? `"${password.replace(/"/g, '""')}"` : password
  writeFileSync(path, `username = ${username}\npassword = ${quoted}\n`, { mode: 0o600 })
}

function friendlySmbError(raw: string): string {
  const text = raw.trim()
  if (/NT_STATUS_LOGON_FAILURE|LOGON_FAILURE/i.test(text)) {
    return 'WiFi Storage login failed — check the password (Settings → Storage and Access on BB10).'
  }
  if (/NT_STATUS_ACCESS_DENIED|ACCESS_DENIED/i.test(text)) {
    return 'SMB access denied — verify WiFi Storage is enabled and the password is correct.'
  }
  if (/Connection refused|timed out|timeout/i.test(text)) {
    return 'Could not reach WiFi Storage on port 445 — is the device on the same network?'
  }
  if (/BAD_NETWORK_NAME/i.test(text)) {
    return 'SMB share not found on the phone — use the media share (not documents). Check WiFi Storage username under Settings → Storage and Access → Identification on Network.'
  }
  return text.split('\n').filter(Boolean).pop() || text || 'SMB error'
}

async function withRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
  let last: unknown
  for (let i = 0; i < SMB_RETRIES; i++) {
    try {
      return await fn()
    } catch (err) {
      last = err
      if (i < SMB_RETRIES - 1) {
        await new Promise((r) => setTimeout(r, 800))
      }
    }
  }
  throw last instanceof Error ? last : new Error(`${label} failed`)
}

/** Session pool — stateless `-c` commands (Samba 4.x smbclient needs no interactive PTY) */
export class SmbSessionPool {
  private meta = new Map<string, SessionMeta>()

  constructor(private readonly client: Bb10SmbClient) {}

  async open(
    host: string,
    share: string,
    password: string,
    username = SMB_DEFAULTS.username
  ): Promise<string> {
    await withRetry(
      () => this.client.listDirectory(host, share, password, '', username),
      'SMB connect'
    )

    const id = randomUUID()
    this.meta.set(id, { id, host, share, username, password, lastUsed: Date.now() })
    return id
  }

  async listDir(sessionId: string, path: string): Promise<SmbFileEntry[]> {
    const m = this.meta.get(sessionId)
    if (!m) throw new Error('SMB session expired — reconnect')

    m.lastUsed = Date.now()
    return withRetry(
      () => this.client.listDirectory(m.host, m.share, m.password, path, m.username),
      'SMB list'
    )
  }

  close(sessionId: string): void {
    this.meta.delete(sessionId)
  }

  getSession(sessionId: string): SessionMeta | undefined {
    const m = this.meta.get(sessionId)
    if (!m) return undefined
    m.lastUsed = Date.now()
    return m
  }

  closeAll(): void {
    this.meta.clear()
  }
}

export class Bb10SmbClient {
  private smbConfPath: string
  private smbclientPath: string

  constructor() {
    this.smbConfPath = this.resolveSmbConf()
    this.smbclientPath = this.resolveSmbclient()
  }

  getSmbConfPath(): string {
    return this.smbConfPath
  }

  isAvailable(): boolean {
    return existsSync(this.smbclientPath)
  }

  getSmbclientPath(): string {
    return this.smbclientPath
  }

  async testConnection(
    host: string,
    password: string,
    username = SMB_DEFAULTS.username
  ): Promise<SmbAuthResult> {
    if (!this.isAvailable()) {
      return {
        ok: false,
        message: smbUnavailableMessage()
      }
    }

    try {
      const shares = await withRetry(
        () => this.listShares(host, password, username),
        'SMB connect'
      )
      return {
        ok: true,
        message: `Connected to ${host} via SMB1 — ${shares.length} share(s).`,
        shares
      }
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : String(err) }
    }
  }

  async listShares(
    host: string,
    password: string,
    username = SMB_DEFAULTS.username
  ): Promise<SmbShareInfo[]> {
    const output = await this.runOnce(host, '', username, password, '', true)
    return parseShareList(output)
  }

  async listDirectory(
    host: string,
    share: string,
    password: string,
    path = '',
    username = SMB_DEFAULTS.username
  ): Promise<SmbFileEntry[]> {
    const cd = path ? `cd "${path.replace(/"/g, '')}"; ` : ''
    let output = await this.runOnce(host, share, username, password, `${cd}ls`)
    let entries = parseDirListing(output)

    if (entries.length === 0 && looksLikeUnparsedListing(output)) {
      output = await this.runOnce(host, share, username, password, `${cd}dir`)
      entries = parseDirListing(output)
    }

    return entries
  }

  async downloadFile(
    host: string,
    share: string,
    password: string,
    remotePath: string,
    localPath: string,
    username = SMB_DEFAULTS.username,
    timeoutMs = SMB_COMMAND_MS
  ): Promise<void> {
    const normalized = remotePath.replace(/\\/g, '/').replace(/^\/+/, '')
    const parts = normalized.split('/').filter(Boolean)
    const file = parts.pop() || normalized
    const dir = parts.join('/')
    const quotedLocal = localPath.replace(/"/g, '')
    const quotedFile = file.replace(/"/g, '')

    const cmd = dir
      ? `cd "${dir.replace(/"/g, '')}"; get "${quotedFile}" "${quotedLocal}"`
      : `get "${quotedFile}" "${quotedLocal}"`

    await this.runOnce(host, share, username, password, cmd, false, timeoutMs)
  }

  async uploadFile(
    host: string,
    share: string,
    password: string,
    localPath: string,
    remotePath: string,
    username = SMB_DEFAULTS.username,
    timeoutMs = SMB_COMMAND_MS
  ): Promise<void> {
    const cmd = `put "${localPath.replace(/"/g, '')}" "${remotePath.replace(/"/g, '')}"`
    await this.runOnce(host, share, username, password, cmd, false, timeoutMs)
  }

  /** Upload public key + install script to documents via WiFi Storage */
  async provisionSshKey(
    host: string,
    share: string,
    password: string,
    publicKeyPath: string,
    username = SMB_DEFAULTS.username
  ): Promise<{ method: string; message: string; keyFileName: string }> {
    const pubPath = publicKeyPath.endsWith('.pub') ? publicKeyPath : `${publicKeyPath}.pub`
    if (!existsSync(pubPath)) {
      throw new Error(`Public key not found: ${pubPath}`)
    }

    const keyFileName = basename(pubPath)
    const documentsDir = SMB_PATHS.sharedDocumentsOnMedia
    const smbRemotePath = `${documentsDir}/${keyFileName}`

    await this.uploadFile(host, share, password, pubPath, smbRemotePath, username)

    const scriptLocal = join(tmpdir(), `berrybridge-${randomUUID()}-${TERM49_SSH_KEY_SCRIPT}`)
    writeFileSync(scriptLocal, term49SshKeyInstallScriptContent(keyFileName), 'utf8')
    try {
      await this.uploadFile(
        host,
        share,
        password,
        scriptLocal,
        `${documentsDir}/${TERM49_SSH_KEY_SCRIPT}`,
        username
      )
    } finally {
      try {
        unlinkSync(scriptLocal)
      } catch {
        /* ignore */
      }
    }

    return {
      method: 'smb',
      keyFileName,
      message: term49ManualInstallMessage(keyFileName)
    }
  }

  private async runOnce(
    host: string,
    share: string,
    username: string,
    password: string,
    command: string,
    listShares = false,
    timeoutMs = SMB_COMMAND_MS
  ): Promise<string> {
    const dir = mkdtempSync(join(tmpdir(), 'berrybridge-smb-'))
    const authFile = join(dir, 'auth')
    writeAuthFile(authFile, username, password)

    try {
      const socketSec = Math.min(3600, Math.max(120, Math.ceil(timeoutMs / 1000)))
      const args = [
        '-m',
        'NT1',
        '-s',
        this.smbConfPath,
        '-p',
        String(SMB_DEFAULTS.port),
        '-t',
        String(socketSec),
        '-A',
        authFile
      ]

      if (listShares) args.push('-L', `//${host}`)
      else args.push(`//${host}/${share}`, '-c', command)

      return await withRetry(() => this.execSmbclient(args, timeoutMs), 'SMB')
    } finally {
      try {
        unlinkSync(authFile)
      } catch {
        /* ignore */
      }
    }
  }

  private execSmbclient(args: string[], timeoutMs = SMB_COMMAND_MS): Promise<string> {
    return new Promise((resolve, reject) => {
      const proc = spawn(this.smbclientPath, args, {
        env: spawnEnvForBundledSamba()
      })
      let stdout = ''
      let stderr = ''
      let settled = false

      const timer = setTimeout(() => {
        if (settled) return
        settled = true
        proc.kill()
        const minutes = Math.max(1, Math.round(timeoutMs / 60_000))
        reject(
          new Error(
            `SMB upload timed out after ${minutes} minute${minutes === 1 ? '' : 's'} — check WiFi Storage is enabled and the phone stays on the same network`
          )
        )
      }, timeoutMs)

      const done = (fn: () => void) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        fn()
      }

      proc.stdout.on('data', (d: Buffer) => {
        stdout += d.toString()
      })
      proc.stderr.on('data', (d: Buffer) => {
        stderr += d.toString()
      })

      proc.on('close', (code) => {
        const combined = `${stdout}\n${stderr}`.trim()
        if (/NT_STATUS_|LOGON_FAILURE|session setup failed|denied/i.test(combined)) {
          done(() => reject(new Error(friendlySmbError(combined))))
          return
        }
        if (code === 0) done(() => resolve(stdout))
        else done(() => reject(new Error(friendlySmbError(stderr || stdout || `exit ${code}`))))
      })

      proc.on('error', (err) => done(() => reject(err)))
    })
  }

  private resolveSmbConf(): string {
    const candidates = [
      join(process.resourcesPath, 'smb.conf'),
      join(app.getAppPath(), 'resources/smb.conf'),
      join(__dirname, '../../resources/smb.conf')
    ]
    return candidates.find((p) => existsSync(p)) || candidates[0]
  }

  private resolveSmbclient(): string {
    const bundled = resolveBundledSmbclient()
    if (bundled) return bundled

    const candidates = [
      process.env.SMBCLIENT_PATH,
      '/opt/homebrew/bin/smbclient',
      '/usr/local/bin/smbclient',
      '/usr/bin/smbclient',
      'C:\\msys64\\ucrt64\\bin\\smbclient.exe',
      'C:\\Program Files\\Samba\\bin\\smbclient.exe'
    ].filter(Boolean) as string[]

    for (const p of candidates) {
      if (existsSync(p)) return p
    }

    if (process.platform === 'win32') {
      try {
        const where = execSync('where smbclient 2>nul', { encoding: 'utf8' }).trim().split('\n')[0]
        if (where && existsSync(where)) return where
      } catch {
        /* ignore */
      }
    } else {
      try {
        const which = execSync('which smbclient 2>/dev/null || command -v smbclient', {
          encoding: 'utf8'
        }).trim()
        if (which && existsSync(which)) return which
      } catch {
        /* ignore */
      }
    }

    return bundledSambaDir()
      ? join(bundledSambaDir()!, process.platform === 'win32' ? 'smbclient.exe' : 'smbclient')
      : process.platform === 'win32'
        ? 'smbclient.exe'
        : '/usr/bin/smbclient'
  }
}

function parseShareList(output: string): SmbShareInfo[] {
  const shares: SmbShareInfo[] = []
  for (const line of output.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('---') || /^Sharename/i.test(trimmed)) continue

    const cols = trimmed.split(/\s{2,}|\t+/).map((c) => c.trim()).filter(Boolean)
    if (cols.length < 2) continue

    const name = cols[0]
    const type = cols[1]
    const comment = cols.slice(2).join(' ').trim()

    if (name === 'IPC$' || name.endsWith('$')) continue
    if (type.toLowerCase() !== 'disk') continue

    shares.push({ name, type, comment })
  }
  return shares
}

function looksLikeUnparsedListing(output: string): boolean {
  return output
    .split('\n')
    .some((line) => /^\s{2}\S/.test(line.replace(/\r$/, '')) && !/^\s{2}\.\.?(\s|$)/.test(line))
}
