#!/usr/bin/env node
/**
 * Bundle smbclient + runtime libraries for the current OS/arch into resources/samba/.
 * Used in CI before electron-builder so WiFi Storage works without manual Samba install.
 */
const { execSync } = require('child_process')
const { cpSync, rmSync, mkdirSync, existsSync, readdirSync } = require('fs')
const { join, dirname, basename, resolve } = require('path')
const { platform, arch } = require('os')

const ROOT = join(__dirname, '..')
const SAMBA_ROOT = join(ROOT, 'resources/samba')

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
  const candidates = [
    process.env.MSYSTEM_PREFIX ? join(process.env.MSYSTEM_PREFIX, 'bin/smbclient.exe') : '',
    'C:\\msys64\\ucrt64\\bin\\smbclient.exe',
    'C:\\msys64\\mingw64\\bin\\smbclient.exe'
  ].filter(Boolean)

  const client = candidates.find((p) => existsSync(p))
  if (!client) {
    throw new Error(
      'smbclient.exe not found — install MSYS2 UCRT64 samba (mingw-w64-ucrt-x86_64-samba)'
    )
  }

  const binDir = dirname(client)
  const dest = outDir()
  rmSync(dest, { recursive: true, force: true })
  mkdirSync(dest, { recursive: true })

  copyBinary(client, dest)

  let lddOut = ''
  try {
    const bash = existsSync('C:\\msys64\\usr\\bin\\bash.exe')
      ? 'C:\\msys64\\usr\\bin\\bash.exe'
      : 'bash'
    const msysPath = client.replace(/\\/g, '/').replace(/^C:/, '/c')
    lddOut = execSync(`"${bash}" -lc "ldd '${msysPath}'"`, { encoding: 'utf8' })
  } catch {
    /* fall back to copying common deps */
  }

  const copied = new Set([basename(client)])

  if (lddOut) {
    for (const line of lddOut.split('\n')) {
      const m = line.match(/=>\s(\S+)/)
      if (!m) continue
      let lib = m[1]
      if (lib.startsWith('/')) {
        lib = lib
          .replace(/^\/ucrt64\//, 'C:\\msys64\\ucrt64\\')
          .replace(/^\/mingw64\//, 'C:\\msys64\\mingw64\\')
          .replace(/\//g, '\\')
      }
      if (!existsSync(lib)) continue
      const name = basename(lib)
      if (copied.has(name)) continue
      copied.add(name)
      cpSync(lib, join(dest, name), { force: true })
    }
  } else {
    for (const file of readdirSync(binDir)) {
      if (!file.endsWith('.dll')) continue
      if (/^(smb|libsmb|libwbclient|libtdb|libtevent|libtalloc|libldb|libnetapi|libreplace|libmsrpc|libcli|libndr|libdcerpc|libgensec|libutil|libcrypto|libssl|libz|libpopt|libjansson|libarchive|libgnutls|libhogweed|libnettle|libgmp|libunistring|libiconv|libintl|libreadline|libncurses|libwinpthread|libgcc|libstdc|zlib)/i.test(file)) {
        cpSync(join(binDir, file), join(dest, file), { force: true })
      }
    }
  }

  console.log(`berrybridge: bundled Windows smbclient → ${dest}`)
}

function main() {
  const dest = join(outDir(), smbclientName())
  if (existsSync(dest) && process.env.BERRYBRIDGE_FORCE_SMB_BUNDLE !== '1') {
    console.log(`berrybridge: WiFi Storage tools already bundled at ${dest}`)
    return
  }

  if (platform() === 'darwin') bundleDarwin()
  else if (platform() === 'win32') bundleWindows()
  else if (platform() === 'linux') bundleLinux()
  else throw new Error(`Unsupported platform: ${platform()}`)

  if (!existsSync(dest)) {
    throw new Error(`Bundle failed — ${dest} was not created`)
  }
}

try {
  main()
} catch (err) {
  console.error(`berrybridge: ${err.message}`)
  process.exit(1)
}
