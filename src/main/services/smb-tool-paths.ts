import { existsSync } from 'fs'
import { join, dirname } from 'path'
import { app } from 'electron'

export function smbPlatformKey(): string {
  if (process.platform === 'darwin') return `darwin-${process.arch}`
  if (process.platform === 'win32') return 'win32-x64'
  return `linux-${process.arch}`
}

export function smbclientBinaryName(): string {
  return process.platform === 'win32' ? 'smbclient.exe' : 'smbclient'
}

export function resolveBundledSmbclient(): string | null {
  const key = smbPlatformKey()
  const name = smbclientBinaryName()
  const candidates = [
    join(process.resourcesPath, 'samba', key, name),
    join(app.getAppPath(), 'resources/samba', key, name),
    join(__dirname, '../../resources/samba', key, name)
  ]
  return candidates.find((p) => existsSync(p)) ?? null
}

export function bundledSambaDir(): string | null {
  const client = resolveBundledSmbclient()
  return client ? dirname(client) : null
}

export function spawnEnvForBundledSamba(base: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const dir = bundledSambaDir()
  if (!dir) return base

  const env = { ...base }
  if (process.platform === 'win32') {
    env.PATH = `${dir};${env.PATH || ''}`
  } else if (process.platform === 'darwin') {
    env.DYLD_LIBRARY_PATH = [dir, env.DYLD_LIBRARY_PATH].filter(Boolean).join(':')
  } else {
    env.LD_LIBRARY_PATH = [dir, env.LD_LIBRARY_PATH].filter(Boolean).join(':')
  }
  return env
}

export function smbUnavailableMessage(): string {
  return 'WiFi Storage tools are missing from this Berry Bridge install. Reinstall from the latest release, or contact support.'
}
