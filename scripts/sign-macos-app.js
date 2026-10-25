const { execFileSync } = require('child_process')
const { join } = require('path')

// electron-builder 25 skips signing when no Apple certificate is available.
// Seal the app with its own bundle identity instead of Electron's linker signature.
exports.sign = async function sign(options) {
  if (options.identity) {
    await require('@electron/osx-sign').signAsync(options)
  } else {
    const identifier = execFileSync('/usr/libexec/PlistBuddy', [
      '-c', 'Print :CFBundleIdentifier', join(options.app, 'Contents/Info.plist')
    ], { encoding: 'utf8' }).trim()
    execFileSync('/usr/bin/codesign', [
      '--force', '--deep', '--sign', '-', '--identifier', identifier, options.app
    ], { stdio: 'inherit' })
  }
  execFileSync('/usr/bin/codesign', ['--verify', '--deep', '--strict', options.app], {
    stdio: 'inherit'
  })
}
