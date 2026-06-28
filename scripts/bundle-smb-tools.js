#!/usr/bin/env node
/**
 * Bundle smbclient + runtime libraries for the current OS/arch into resources/samba/.
 * Used in CI before electron-builder so WiFi Storage works without manual Samba install.
 */
const { execSync } = require('child_process')
const { cpSync, rmSync, mkdirSync, existsSync, readdirSync, createWriteStream, readFileSync } = require('fs')
const { join, dirname, basename } = require('path')
const { platform, arch } = require('os')
const https = require('https')
const http = require('http')
const { tmpdir } = require('os')

const ROOT = join(__dirname, '..')
const SAMBA_ROOT = join(ROOT, 'resources/samba')

const SMBCLIENT_WIN_ZIP =
  'https://allandynes.com/wp-content/uploads/2016/05/smbclient.zip'

function toCygwinPath(winPath) {
  const normalized = winPath.replace(/\\/g, '/')
  const m = normalized.match(/^([A-Za-z]):\/*(.*)$/)
  if (!m) return normalized
  return `/cygdrive/${m[1].toLowerCase()}/${m[2]}`
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http
    const file = createWriteStream(dest)
    lib
      .get(url, { headers: { 'User-Agent': 'BerryBridge' } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          file.close()
          rmSync(dest, { force: true })
          downloadFile(res.headers.location, dest).then(resolve).catch(reject)
          return
        }
        if (res.statusCode !== 200) {
          file.close()
          rmSync(dest, { force: true })
          reject(new Error(`HTTP ${res.statusCode} downloading ${url}`))
          return
        }
        res.pipe(file)
        file.on('finish', () => file.close(() => resolve()))
      })
      .on('error', reject)
  })
}

function copyWindowsDepsWithLdd(bash, clientPath, dest) {
  const cygPath = toCygwinPath(clientPath)
  const lddOut = execSync(`"${bash}" -lc "ldd '${cygPath}'"`, { encoding: 'utf8' })
  const copied = new Set([basename(clientPath)])

  for (const line of lddOut.split('\n')) {
    const m = line.match(/=>\s(\S+)/)
    if (!m) continue
    let lib = m[1]
    if (lib === 'not' || lib.includes('not')) continue

    if (lib.startsWith('/cygdrive/')) {
      lib = lib.replace(/^\/cygdrive\/([a-z])\/(.*)$/i, (_, drive, rest) => {
        return `${drive.toUpperCase()}:\\${rest.replace(/\//g, '\\')}`
      })
    } else if (lib.startsWith('/usr/') || lib.startsWith('/bin/')) {
      const cygwinRoot = process.env.BERRYBRIDGE_CYGWIN_ROOT || 'C:\\cygwin64'
      lib = join(cygwinRoot, lib.replace(/^\//, '').replace(/\//g, '\\'))
    }

    if (!existsSync(lib)) continue
    const name = basename(lib)
    if (copied.has(name)) continue
    copied.add(name)
    cpSync(lib, join(dest, name), { force: true })
  }
}

function platformKey() {
  if (platform() === 'darwin') return `darwin-${arch()}`
  if (platform() === 'win32') return 'win32-x64'
  return `linux-${arch()}`
}

function smbclientName() {
  return platform() === 'win32' ? 'smbclient.exe' : 'smbclient'
}

function outDir() {
  return join(SAMBA_ROOT, platformKey())
}

function run(cmd, opts = {}) {
  return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...opts })
}

function copyBinary(src, destDir) {
  mkdirSync(destDir, { recursive: true })
  const dest = join(destDir, basename(src))
  cpSync(src, dest, { force: true })
  try {
    if (platform() !== 'win32') {
      execSync(`chmod +x "${dest}"`)
    }
  } catch {
    /* ignore */
  }
  return dest
}

function resolveReal(path) {
  try {
    return execSync(`readlink -f "${path}"`, { encoding: 'utf8' }).trim()
  } catch {
    return path
  }
}

function bundleDarwin() {
  let prefix = ''
  try {
    prefix = run('brew --prefix samba').trim()
  } catch {
    throw new Error('Samba not found — install with: brew install samba')
  }

  const client = join(prefix, 'bin/smbclient')
  if (!existsSync(client)) {
    throw new Error(`smbclient missing at ${client}`)
  }

  const dest = outDir()
  rmSync(dest, { recursive: true, force: true })
  mkdirSync(dest, { recursive: true })

  const realClient = resolveReal(client)
  copyBinary(realClient, dest)

  const deps = run(`otool -L "${realClient}"`).split('\n')
  const copied = new Set([basename(realClient)])
  const queue = []

  for (const line of deps) {
    const m = line.match(/^\s+(\S+)/)
    if (!m) continue
    const lib = m[1]
    if (lib.startsWith('/usr/lib') || lib.startsWith('/System/')) continue
    queue.push(lib)
  }

  while (queue.length) {
    const lib = queue.shift()
    const name = basename(lib)
    if (copied.has(name) || !existsSync(lib)) continue
    copied.add(name)
    cpSync(lib, join(dest, name), { force: true })
    const subDeps = run(`otool -L "${lib}"`).split('\n')
    for (const line of subDeps) {
      const m = line.match(/^\s+(\S+)/)
      if (!m) continue
      const sub = m[1]
      if (sub.startsWith('/usr/lib') || sub.startsWith('/System/')) continue
      if (!copied.has(basename(sub))) queue.push(sub)
    }
  }

  console.log(`berrybridge: bundled macOS smbclient → ${dest}`)
}

function bundleLinux() {
  let client = ''
  try {
    client = run('command -v smbclient').trim()
  } catch {
    throw new Error('smbclient not found — install with: sudo apt-get install smbclient')
  }

  const dest = outDir()
  rmSync(dest, { recursive: true, force: true })
  mkdirSync(dest, { recursive: true })

  const realClient = resolveReal(client)
  copyBinary(realClient, dest)

  const ldd = run(`ldd "${realClient}"`)
  for (const line of ldd.split('\n')) {
    const m = line.match(/\s=>\s(\S+)/)
    if (!m) continue
    const lib = m[1]
    if (!lib.startsWith('/') || lib.includes('not found')) continue
    if (lib.startsWith('/lib') || lib.startsWith('/usr/lib')) {
      const name = basename(lib)
      if (['libc.so.6', 'libm.so.6', 'libdl.so.2', 'libpthread.so.0', 'libresolv.so.2', 'librt.so.1'].includes(name)) {
        continue
      }
    }
    cpSync(lib, join(dest, basename(lib)), { force: true })
  }

  console.log(`berrybridge: bundled Linux smbclient → ${dest}`)
}

function bundleWindows() {
  const dest = outDir()
  rmSync(dest, { recursive: true, force: true })
  mkdirSync(dest, { recursive: true })

  const systemCandidates = [
    process.env.MSYSTEM_PREFIX ? join(process.env.MSYSTEM_PREFIX, 'bin/smbclient.exe') : '',
    process.env.BERRYBRIDGE_CYGWIN_ROOT
      ? join(process.env.BERRYBRIDGE_CYGWIN_ROOT, 'usr/bin/smbclient.exe')
      : '',
    'C:\\cygwin64\\usr\\bin\\smbclient.exe',
    'C:\\msys64\\ucrt64\\bin\\smbclient.exe',
    'C:\\msys64\\mingw64\\bin\\smbclient.exe'
  ].filter(Boolean)

  const bashCandidates = [
    process.env.BERRYBRIDGE_CYGWIN_ROOT
      ? join(process.env.BERRYBRIDGE_CYGWIN_ROOT, 'bin/bash.exe')
      : '',
    'C:\\cygwin64\\bin\\bash.exe',
    'C:\\msys64\\usr\\bin\\bash.exe'
  ].filter(Boolean)

  const systemClient = systemCandidates.find((p) => existsSync(p))
  const bash = bashCandidates.find((p) => existsSync(p))

  if (systemClient && bash) {
    copyBinary(systemClient, dest)
    copyWindowsDepsWithLdd(bash, join(dest, 'smbclient.exe'), dest)
    console.log(`berrybridge: bundled Windows smbclient from ${systemClient} → ${dest}`)
    return Promise.resolve()
  }

  if (!bash) {
    throw new Error(
      'Cygwin is required to bundle WiFi Storage tools on Windows (install Cygwin or run CI release build)'
    )
  }

  const tmpZip = join(tmpdir(), 'berrybridge-smbclient.zip')
  const tmpDir = join(tmpdir(), 'berrybridge-smb-staging')
  rmSync(tmpDir, { recursive: true, force: true })
  mkdirSync(tmpDir, { recursive: true })

  return downloadFile(SMBCLIENT_WIN_ZIP, tmpZip).then(() => {
    const header = readFileSync(tmpZip).subarray(0, 4)
    if (header[0] !== 0x50 || header[1] !== 0x4b) {
      throw new Error('Downloaded smbclient archive is invalid — expected a zip file')
    }

    execSync(
      `powershell -NoProfile -Command "Expand-Archive -Force -LiteralPath '${tmpZip.replace(/'/g, "''")}' -DestinationPath '${tmpDir.replace(/'/g, "''")}'"`,
      { stdio: 'inherit' }
    )

    const staged = join(tmpDir, 'smbclient.exe')
    if (!existsSync(staged)) {
      throw new Error('Downloaded smbclient.zip did not contain smbclient.exe')
    }

    cpSync(staged, join(dest, 'smbclient.exe'), { force: true })
    copyWindowsDepsWithLdd(bash, join(dest, 'smbclient.exe'), dest)
    console.log(`berrybridge: bundled Windows smbclient (Cygwin build) → ${dest}`)
  })
}

function main() {
  const dest = join(outDir(), smbclientName())
  if (existsSync(dest) && process.env.BERRYBRIDGE_FORCE_SMB_BUNDLE !== '1') {
    console.log(`berrybridge: WiFi Storage tools already bundled at ${dest}`)
    return Promise.resolve()
  }

  if (platform() === 'darwin') {
    bundleDarwin()
    return Promise.resolve()
  }
  if (platform() === 'win32') return bundleWindows()
  if (platform() === 'linux') {
    bundleLinux()
    return Promise.resolve()
  }
  return Promise.reject(new Error(`Unsupported platform: ${platform()}`))
}

try {
  main()
    .then(() => {
      const dest = join(outDir(), smbclientName())
      if (!existsSync(dest)) {
        throw new Error(`Bundle failed — ${dest} was not created`)
      }
    })
    .catch((err) => {
      console.error(`berrybridge: ${err.message}`)
      process.exit(1)
    })
} catch (err) {
  console.error(`berrybridge: ${err.message}`)
  process.exit(1)
}
