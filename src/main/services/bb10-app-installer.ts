import { spawn, type ChildProcess } from 'child_process'
import { existsSync, readFileSync, mkdirSync } from 'fs'
import { join, resolve, dirname } from 'path'
import { tmpdir } from 'os'
import { randomUUID } from 'crypto'
import { app, dialog } from 'electron'
import { BB10_DEV_MODE } from '@shared/types'

interface ManagerPaths {
  mainScript: string
  autoInstallScript: string
  resourcesDir: string
  pbApps: string
}

/** Spawns Electron 16 for BB10 dev-mode app install (TLS 1.0). */
export class Bb10AppInstaller {
  private legacyProc: ChildProcess | null = null

  private resolveManagerPaths(): ManagerPaths | null {
    const dirs = [
      process.resourcesPath,
      join(app.getAppPath(), 'resources'),
      join(__dirname, '../../resources')
    ]

    for (const dir of dirs) {
      const mainScript = join(dir, 'bb10-manager-main.js')
      const autoInstallScript = join(dir, 'bb10-auto-install.js')
      const pbApps = join(dir, 'pb-apps.js')
      if (existsSync(mainScript) && existsSync(autoInstallScript) && existsSync(pbApps)) {
        return {
          mainScript: resolve(mainScript),
          autoInstallScript: resolve(autoInstallScript),
          resourcesDir: resolve(dir),
          pbApps: resolve(pbApps)
        }
      }
    }
    return null
  }

  private resolveLegacyElectron(): string | null {
    const roots = [
      join(process.resourcesPath, 'app.asar.unpacked/node_modules/electron-legacy'),
      join(process.cwd(), 'node_modules/electron-legacy'),
      join(app.getAppPath(), 'node_modules/electron-legacy'),
      join(__dirname, '../../node_modules/electron-legacy')
    ]

    for (const root of roots) {
      const pathTxt = join(root, 'path.txt')
      if (!existsSync(pathTxt)) continue

      const rel = readFileSync(pathTxt, 'utf8').trim()
      const unpackedRoot = root.includes('app.asar')
        ? root.replace('app.asar', 'app.asar.unpacked')
        : root

      for (const base of [unpackedRoot, root]) {
        const bin = resolve(base, 'dist', rel)
        if (existsSync(bin)) return bin
      }
    }
    return null
  }

  getManagerInfo() {
    const legacy = this.resolveLegacyElectron()
    const paths = this.resolveManagerPaths()
    return {
      ready: Boolean(legacy && paths),
      legacyElectron: legacy || 'not installed',
      managerScript: paths?.mainScript || 'not found',
      pbApps: paths?.pbApps || 'not found',
      userAgent: BB10_DEV_MODE.userAgent
    }
  }

  openAppManager(deviceIp: string, _devPassword?: string): void {
    const electronBin = this.resolveLegacyElectron()
    const paths = this.resolveManagerPaths()

    if (!electronBin) {
      this.openInstallHint(deviceIp, 'App manager runtime is not installed.')
      return
    }

    if (!paths) {
      this.openInstallHint(
        deviceIp,
        'Manager scripts missing — reinstall Berry Bridge or run npm install.'
      )
      return
    }

    if (this.legacyProc && !this.legacyProc.killed) {
      try {
        this.legacyProc.kill()
      } catch {
        /* ignore */
      }
    }

    const userDataDir = join(tmpdir(), `berrybridge-bb10-${randomUUID()}`)
    mkdirSync(userDataDir, { recursive: true })

    const env: Record<string, string> = {
      PATH: process.env.PATH || '',
      HOME: process.env.HOME || '',
      USER: process.env.USER || '',
      LANG: process.env.LANG || 'en_US.UTF-8',
      BB10_DEVICE_IP: deviceIp,
      BB10_RESOURCES_DIR: paths.resourcesDir,
      BB10_PB_APPS: paths.pbApps
    }

    const args = [
      `--user-data-dir=${userDataDir}`,
      paths.mainScript,
      `--device-ip=${deviceIp}`,
      `--resources-dir=${paths.resourcesDir}`,
      `--pb-apps=${paths.pbApps}`
    ]

    try {
      this.legacyProc = spawn(electronBin, args, {
        env,
        detached: true,
        stdio: ['ignore', 'ignore', 'pipe'],
        cwd: dirname(paths.mainScript)
      })

      let stderr = ''
      this.legacyProc.stderr?.on('data', (chunk: Buffer) => {
        stderr += chunk.toString()
        console.error('[bb10-manager]', chunk.toString())
      })

      this.legacyProc.on('error', (err) => {
        console.error('[bb10-manager] spawn error:', err)
        void dialog.showErrorBox('App Manager', err.message)
      })

      this.legacyProc.on('exit', (code) => {
        if (code !== 0 && code !== null) {
          console.error('[bb10-manager] exited', code, stderr)
        }
        this.legacyProc = null
      })

      this.legacyProc.unref()
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      this.openInstallHint(deviceIp, `Failed to launch app manager: ${msg}`)
    }
  }

  installBar(deviceIp: string, barPath: string, devPassword?: string): void {
    if (!existsSync(barPath)) {
      throw new Error(`BAR file not found: ${barPath}`)
    }
    if (devPassword) {
      void this.installPackages(deviceIp, [barPath], devPassword)
      return
    }
    this.openAppManager(deviceIp, devPassword)
  }

  installPackages(
    deviceIp: string,
    filePaths: string[],
    devPassword: string
  ): Promise<{ ok: boolean; message: string }> {
    const electronBin = this.resolveLegacyElectron()
    const paths = this.resolveManagerPaths()

    if (!electronBin || !paths) {
      return Promise.resolve({
        ok: false,
        message: 'Install runtime not available — run npm install and restart Berry Bridge.'
      })
    }

    for (const f of filePaths) {
      if (!existsSync(f)) {
        return Promise.resolve({ ok: false, message: `Package not found: ${f}` })
      }
    }

    const args = [
      `--user-data-dir=${join(tmpdir(), `berrybridge-install-${randomUUID()}`)}`,
      paths.autoInstallScript,
      `--device-ip=${deviceIp}`,
      `--password=${devPassword}`,
      `--pb-apps=${paths.pbApps}`,
      ...filePaths.map((f) => `--file=${f}`)
    ]

    return new Promise((resolve) => {
      const proc = spawn(electronBin, args, {
        env: {
          PATH: process.env.PATH || '',
          HOME: process.env.HOME || '',
          USER: process.env.USER || ''
        },
        stdio: ['ignore', 'pipe', 'pipe'],
        cwd: dirname(paths.autoInstallScript)
      })

      let stdout = ''
      let stderr = ''
      const killTimer = setTimeout(() => {
        try {
          proc.kill('SIGTERM')
        } catch {
          /* ignore */
        }
        resolve({
          ok: false,
          message: 'Install timed out after 8 minutes — check Development Mode and device IP.'
        })
      }, 8 * 60 * 1000)

      proc.stdout?.on('data', (chunk: Buffer) => {
        stdout += chunk.toString()
      })
      proc.stderr?.on('data', (chunk: Buffer) => {
        stderr += chunk.toString()
      })

      proc.on('close', (code) => {
        clearTimeout(killTimer)
        const lines = stdout.split('\n').map((l) => l.trim())
        const jsonLine = [...lines].reverse().find((l) => l.startsWith('{') && l.includes('"ok"'))
        if (jsonLine) {
          try {
            const parsed = JSON.parse(jsonLine) as {
              ok: boolean
              error?: string
              results?: { ok: boolean; file: string; output: string }[]
            }
            if (parsed.ok) {
              const names =
                parsed.results
                  ?.filter((r) => r.ok)
                  .map((r) => r.file)
                  .join(', ') || 'package'
              resolve({
                ok: true,
                message: `Installed ${names}. Check your BB10 app list — it may take a few seconds to appear.`
              })
              return
            }
            const fail = parsed.results?.find((r) => !r.ok)
            resolve({
              ok: false,
              message:
                parsed.error ||
                (fail ? `${fail.file}: ${fail.output?.slice(0, 200) || 'Install failed'}` : 'Install failed')
            })
            return
          } catch {
            /* fall through */
          }
        }
        const errLine = lines.find((l) => l.startsWith('{') && l.includes('"error"'))
        if (errLine) {
          try {
            const parsed = JSON.parse(errLine) as { error?: string }
            resolve({ ok: false, message: parsed.error || 'Install failed' })
            return
          } catch {
            /* fall through */
          }
        }
        resolve({
          ok: code === 0,
          message: code === 0 ? 'Installed successfully.' : stderr || stdout || `Install exited ${code}`
        })
      })

      proc.on('error', (err) => {
        clearTimeout(killTimer)
        resolve({ ok: false, message: err.message })
      })
    })
  }

  private openInstallHint(deviceIp: string, reason: string): void {
    void dialog
      .showMessageBox({
        type: 'warning',
        title: 'App Manager',
        message: 'Could not open app manager',
        detail: `${reason}\n\nDevice: ${deviceIp}\n\nRun npm install in the Berry Bridge folder, then restart the application.`,
        buttons: ['OK'],
        defaultId: 0
      })
  }
}
