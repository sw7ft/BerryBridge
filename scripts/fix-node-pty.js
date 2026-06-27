#!/usr/bin/env node
/**
 * node-pty prebuilds sometimes install spawn-helper without execute bit.
 * Without +x, pty.spawn fails with "posix_spawnp failed".
 */
const { chmodSync, existsSync, readdirSync } = require('fs')
const { join } = require('path')

const prebuilds = join(__dirname, '../node_modules/node-pty/prebuilds')

if (!existsSync(prebuilds)) {
  process.exit(0)
}

for (const dir of readdirSync(prebuilds)) {
  const helper = join(prebuilds, dir, 'spawn-helper')
  if (existsSync(helper)) {
    try {
      chmodSync(helper, 0o755)
      console.log('berrybridge: fixed node-pty spawn-helper permissions for', dir)
    } catch (e) {
      console.warn('berrybridge: could not chmod spawn-helper:', e.message)
    }
  }
}

const legacyTxt = join(__dirname, '../node_modules/electron-legacy/path.txt')
if (existsSync(legacyTxt)) {
  console.log('berrybridge: electron-legacy (BB10 App Manager TLS 1.0) is installed')
} else {
  console.warn(
    'berrybridge: electron-legacy missing — BB10 App Manager will not work until you run npm install'
  )
}
