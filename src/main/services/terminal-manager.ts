import { chmodSync, existsSync } from 'fs'
import { createRequire } from 'module'
import { join, dirname } from 'path'
import type { IPty } from 'node-pty'
import pty from 'node-pty'
import { homedir } from 'os'
import { randomUUID } from 'crypto'
import type { BrowserWindow } from 'electron'
import type { DeviceProfile } from '@shared/types'
import type { SshManager } from './ssh-manager'

const require = createRequire(__filename)

const SSH_PATHS = ['/usr/bin/ssh', '/opt/homebrew/bin/ssh', '/usr/local/bin/ssh']

let spawnHelperReady = false

function ensureSpawnHelper(): void {
  if (spawnHelperReady || process.platform === 'win32') return

  try {
    const pkgDir = dirname(require.resolve('node-pty/package.json'))
    const helper = join(pkgDir, 'prebuilds', `${process.platform}-${process.arch}`, 'spawn-helper')
    if (existsSync(helper)) {
      chmodSync(helper, 0o755)
    }
  } catch {
    /* prebuild layout may differ */
  }

  spawnHelperReady = true
}

function resolveSshPath(): string {
  for (const p of SSH_PATHS) {
    if (existsSync(p)) return p
  }
  return 'ssh'
}

function cleanEnv(env: NodeJS.ProcessEnv): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(env)) {
    if (value !== undefined) out[key] = value
  }
  out.TERM = 'xterm-256color'
  out.COLORTERM = 'truecolor'
  out.LANG = out.LANG || 'en_US.UTF-8'
  return out
}

/** BerryCore / BB10 often lacks xterm-256color terminfo — use plain xterm for SSH shells */
function interactiveSshEnv(env: NodeJS.ProcessEnv): Record<string, string> {
  const out = cleanEnv(env)
  out.TERM = 'xterm'
  delete out.COLORTERM
  return out
}

export class TerminalManager {
  private sessions = new Map<string, IPty>()
  private sessionDevice = new Map<string, string>()
  private sshPath = resolveSshPath()

  constructor(
    private getWindow: () => BrowserWindow | null,
    private ssh: SshManager
  ) {}

  spawn(device: DeviceProfile): string {
    ensureSpawnHelper()

    // BB10 sshd often allows only one session — drop stale sessions for this device
    for (const [sid, deviceId] of this.sessionDevice) {
      if (deviceId === device.id) this.kill(sid)
    }

    let args: string[]
    try {
      args = this.ssh.getInteractiveArgs(device)
    } catch (e) {
      throw new Error(String(e))
    }

    const label = device.sshHostAlias || `${device.sshUser}@${device.host}`

    let proc: IPty
    try {
      proc = pty.spawn(this.sshPath, args, {
        name: 'xterm',
        cols: 100,
        rows: 30,
        cwd: homedir(),
        env: interactiveSshEnv(process.env)
      })
    } catch (e) {
      const hint =
        process.platform === 'darwin'
          ? ' Try: npm run postinstall (node-pty spawn-helper needs execute permission)'
          : ''
      throw new Error(`Failed to start ssh at ${this.sshPath}: ${String(e)}.${hint}`)
    }

    const id = randomUUID()
    this.sessions.set(id, proc)
    this.sessionDevice.set(id, device.id)

    proc.onData((data) => {
      this.getWindow()?.webContents.send('terminal:data', { id, data, label })
    })

    proc.onExit(({ exitCode }) => {
      this.getWindow()?.webContents.send('terminal:exit', { id, exitCode, label })
      this.sessions.delete(id)
      this.sessionDevice.delete(id)
    })

    return id
  }

  write(id: string, data: string): void {
    this.sessions.get(id)?.write(data)
  }

  resize(id: string, cols: number, rows: number): void {
    if (cols < 2 || rows < 2) return
    this.sessions.get(id)?.resize(cols, rows)
  }

  kill(id: string): void {
    const proc = this.sessions.get(id)
    if (!proc) return
    try {
      proc.kill()
    } catch {
      /* already dead */
    }
    this.sessions.delete(id)
    this.sessionDevice.delete(id)
  }

  killAll(): void {
    for (const id of [...this.sessions.keys()]) this.kill(id)
  }
}
