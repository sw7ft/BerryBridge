/**
 * Generates electron-builder icons from icon-2.png (mac .icns, win .ico, linux PNG set).
 */
const { execSync } = require('child_process')
const { existsSync, mkdirSync, copyFileSync, writeFileSync } = require('fs')
const { join } = require('path')

const root = join(__dirname, '..')
const source = join(root, 'icon-2.png')
const buildDir = join(root, 'build')

async function main() {
  if (!existsSync(source)) {
    console.error('Missing icon-2.png at repo root')
    process.exit(1)
  }

  mkdirSync(buildDir, { recursive: true })
  mkdirSync(join(buildDir, 'icons'), { recursive: true })

  copyFileSync(source, join(buildDir, 'icon.png'))

  const iconset = join(buildDir, 'icon.iconset')
  mkdirSync(iconset, { recursive: true })

  const sizes = [16, 32, 128, 256, 512]
  for (const size of sizes) {
    const base = join(iconset, `icon_${size}x${size}.png`)
    const retina = join(iconset, `icon_${size}x${size}@2x.png`)
    execSync(`sips -z ${size} ${size} "${source}" --out "${base}"`, { stdio: 'inherit' })
    execSync(`sips -z ${size * 2} ${size * 2} "${source}" --out "${retina}"`, { stdio: 'inherit' })
  }

  execSync(`iconutil -c icns "${iconset}" -o "${join(buildDir, 'icon.icns')}"`, {
    stdio: 'inherit'
  })

  for (const size of [16, 32, 48, 64, 128, 256, 512]) {
    const out = join(buildDir, 'icons', `${size}x${size}.png`)
    execSync(`sips -z ${size} ${size} "${source}" --out "${out}"`, { stdio: 'inherit' })
  }

  const pngToIco = (await import('png-to-ico')).default
  const ico = await pngToIco(source)
  writeFileSync(join(buildDir, 'icon.ico'), ico)
  console.log('Build icons ready in build/')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
