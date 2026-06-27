#!/usr/bin/env node
/**
 * Download .bar / .apk files listed in resources/app-store/catalog.json
 * from sw7ft/BerryCore bar-files (required for one-click App Store install).
 */
const fs = require('fs')
const path = require('path')
const https = require('https')

const ROOT = path.join(__dirname, '..')
const CATALOG = path.join(ROOT, 'resources/app-store/catalog.json')
const PACKAGES = path.join(ROOT, 'resources/app-store/packages')
const BASE =
  'https://github.com/sw7ft/BerryCore/raw/main/bar-files/'

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest)
    https
      .get(url, { headers: { 'User-Agent': 'BerryBridge-fetch' } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          file.close()
          fs.unlinkSync(dest)
          download(res.headers.location, dest).then(resolve).catch(reject)
          return
        }
        if (res.statusCode !== 200) {
          file.close()
          fs.unlinkSync(dest)
          reject(new Error(`HTTP ${res.statusCode} for ${url}`))
          return
        }
        res.pipe(file)
        file.on('finish', () => file.close(() => resolve()))
      })
      .on('error', (err) => {
        file.close()
        if (fs.existsSync(dest)) fs.unlinkSync(dest)
        reject(err)
      })
  })
}

async function main() {
  if (!fs.existsSync(CATALOG)) {
    console.error('Missing catalog:', CATALOG)
    process.exit(1)
  }
  const catalog = JSON.parse(fs.readFileSync(CATALOG, 'utf8'))
  fs.mkdirSync(PACKAGES, { recursive: true })

  let ok = 0
  let skipped = 0
  let failed = 0

  for (const app of catalog.apps || []) {
    const dest = path.join(PACKAGES, app.filename)
    if (fs.existsSync(dest) && fs.statSync(dest).size > 0) {
      console.log(`skip ${app.filename} (already present)`)
      skipped++
      continue
    }
    const url = BASE + encodeURIComponent(app.filename)
    process.stdout.write(`fetch ${app.filename}… `)
    try {
      await download(url, dest)
      const size = fs.statSync(dest).size
      console.log(`OK (${(size / 1024).toFixed(0)} KB)`)
      ok++
    } catch (err) {
      console.log('FAILED')
      console.error(`  ${err.message}`)
      failed++
    }
  }

  console.log(`\nDone: ${ok} downloaded, ${skipped} skipped, ${failed} failed`)
  if (failed > 0) process.exit(1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
