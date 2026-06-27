/**
 * BB10 package installer — Electron 16 (TLS 1.0).
 * Logs in via pb-apps.js, then uploads .bar / .apk files through the Electron session.
 */
const { app, BrowserWindow, session } = require('electron')
const fs = require('fs')
const http = require('http')
const path = require('path')

function parseArg(name) {
  const prefix = `--${name}=`
  const hits = []
  for (const arg of process.argv) {
    if (arg.startsWith(prefix)) hits.push(arg.slice(prefix.length))
  }
  return hits.length === 1 ? hits[0] : hits.length ? hits : undefined
}

const deviceIp = parseArg('device-ip') || process.env.BB10_DEVICE_IP
const password = parseArg('password') || process.env.BB10_DEV_PASSWORD
const fileArgs = [].concat(parseArg('file') || []).filter(Boolean)
const pbAppsPath =
  parseArg('pb-apps') ||
  process.env.BB10_PB_APPS ||
  path.join(__dirname, 'pb-apps.js')

const MAX_RUNTIME_MS = 8 * 60 * 1000

app.commandLine.appendSwitch('ignore-certificate-errors')
app.commandLine.appendSwitch('disable-renderer-backgrounding')
app.commandLine.appendSwitch('disable-background-timer-throttling')

function logStage(stage, detail) {
  console.log(JSON.stringify({ stage, detail: detail || '' }))
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function showProgress(win, title, body) {
  if (!win || win.isDestroyed()) return
  const safeTitle = escapeHtml(title || 'Installing…')
  const safeBody = escapeHtml(body || '').replace(/\n/g, '<br>')
  win.setTitle(title ? `Berry Bridge — ${title}` : 'Berry Bridge — Installing…')
  win.loadURL(
    `data:text/html;charset=utf-8,${encodeURIComponent(
      `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
        body{font:14px system-ui,-apple-system,sans-serif;padding:28px 24px;margin:0;background:#f4f6f8;color:#1a1a1a;line-height:1.5}
        h1{font-size:17px;font-weight:600;margin:0 0 10px}
        p{margin:0;color:#444}
        .hint{margin-top:16px;font-size:13px;color:#666}
      </style></head><body>
        <h1>${safeTitle}</h1>
        <p>${safeBody}</p>
        <p class="hint">Keep this window open until install finishes.</p>
      </body></html>`
    )}`
  )
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function headerValue(headers, name) {
  const raw = headers[name] || headers[name.toLowerCase()]
  if (Array.isArray(raw)) return raw[0]
  return raw
}

function configureSession(ip) {
  const filter = { urls: [`https://${ip}/cgi-bin/*`, `http://${ip}/cgi-bin/*`] }
  session.defaultSession.webRequest.onBeforeSendHeaders(filter, (details, callback) => {
    details.requestHeaders['User-Agent'] = 'QNXWebClient/1.0'
    callback({ requestHeaders: details.requestHeaders })
  })
  session.defaultSession.webRequest.onHeadersReceived(filter, (details, callback) => {
    const responseHeaders = details.responseHeaders || {}
    if (details.resourceType === 'mainFrame' && details.url.includes('login.cgi')) {
      responseHeaders['content-type'] = ['text/html; charset=utf-8']
      delete responseHeaders['content-disposition']
      delete responseHeaders['Content-Disposition']
      callback({ responseHeaders })
      return
    }
    if (details.resourceType === 'xmlhttprequest') {
      const ct = headerValue(responseHeaders, 'content-type') || ''
      if (!ct.startsWith('text/xml')) {
        responseHeaders['content-type'] = ['application/octet-stream']
      }
    }
    callback({ responseHeaders })
  })
}

function formatDevModeError(kind) {
  return (
    'Development Mode login failed. The install password is NOT your WiFi/storage password — ' +
    'it is the separate password you set when enabling Development Mode (Settings → Security → Development Mode). ' +
    (kind === 'SysErr'
      ? 'The device may be locked after too many wrong attempts: turn Development Mode OFF, wait a few seconds, turn it ON again, then update the Dev mode password on your device profile in Berry Bridge and retry.'
      : 'Check the Dev mode password on your device profile and try again.')
  )
}

function humanizeInstallError(err) {
  const text = String(err).replace(/^Error:\s*/, '')
  if (/SysErr/i.test(text)) return formatDevModeError('SysErr')
  if (/Denied|Incorrect Development Mode password/i.test(text)) {
    return formatDevModeError('Denied')
  }
  return text
}

async function clearBadLoginCookies(ip) {
  const url = `https://${ip}`
  const cookies = await session.defaultSession.cookies.get({ url })
  for (const c of cookies) {
    if (c.name === 'loginsession' && (!c.value || c.value === 'deleted')) {
      await session.defaultSession.cookies.remove(url, 'loginsession')
    }
  }
}

async function pageState(win) {
  return win.webContents.executeJavaScript(`
    (function () {
      var body = document.body ? document.body.innerText || '' : ''
      if (document.getElementById('apptbl')) return { state: 'ready', body: body.slice(0, 200) }
      if (document.getElementById('passwd')) return { state: 'form', body: '' }
      if (/SysErr|ErrorDescription|Invalid HTTP|HTTP Error/i.test(body)) {
        return { state: 'error', body: body.slice(0, 400) }
      }
      if (/Logging in|Loading/i.test(body)) return { state: 'busy', body: body.slice(0, 100) }
      if (document.getElementById('prog')) return { state: 'busy', body: 'progress' }
      return { state: 'wait', body: body.slice(0, 200) }
    })()
  `)
}

async function waitForLoginForm(win, timeoutMs = 60000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const { state, body } = await pageState(win)
    if (state === 'ready') return 'ready'
    if (state === 'form') return 'form'
    if (state === 'error') throw new Error(humanizeInstallError(body || 'Login failed'))
    await sleep(300)
  }
  throw new Error('Timed out waiting for login form — check Development Mode and device IP')
}

async function submitLogin(win, pass) {
  await win.webContents.executeJavaScript(`
    (function () {
      var el = document.getElementById('passwd')
      if (!el) throw new Error('Password field not found')
      el.value = ${JSON.stringify(pass)}
      if (typeof la === 'function') return la()
      document.forms[0].requestSubmit()
      return true
    })()
  `)
}

async function waitForInstallUi(win, progressWin, timeoutMs = 180000) {
  logStage('login', 'Computing challenge response (may take 1–2 minutes)…')
  showProgress(
    progressWin,
    'Authenticating',
    'Computing challenge response — this can take 1–2 minutes. Your phone may look idle; that is normal.'
  )
  const start = Date.now()
  let sawBusy = false
  while (Date.now() - start < timeoutMs) {
    const { state, body } = await pageState(win)
    if (state === 'ready') return
    if (state === 'error') throw new Error(humanizeInstallError(body || 'Login failed'))
    if (state === 'busy') sawBusy = true
    if (state === 'form' && sawBusy) {
      throw new Error(formatDevModeError('Denied'))
    }
    await sleep(500)
  }
  throw new Error('Login timed out — check Development Mode password and device IP')
}

/** Match pb-apps.js ya() — only result::success (or equivalent) counts as installed. */
function parseInstallResponse(text, status) {
  if (status && status !== 200) {
    return { ok: false, error: `HTTP ${status} from device` }
  }
  const body = (text || '').trim()
  if (!body) {
    return { ok: null, incomplete: true, error: 'Empty response from device' }
  }
  if (/^<!DOCTYPE|^<html/i.test(body)) {
    return { ok: false, error: 'Session expired — got login page instead of install result' }
  }

  const lines = body.split('\n')
  const first = lines[0] || ''
  if (first.slice(0, 6) === 'Error:') {
    return { ok: false, error: first }
  }

  let result = null
  for (const line of lines) {
    if (line.slice(0, 8) === 'result::') {
      result = line.slice(8)
      break
    }
  }

  if (!result) {
    return { ok: null, incomplete: true, error: 'Install still in progress (no result yet)' }
  }

  if (result === 'success') return { ok: true }

  const prefix = result.slice(0, 4).toLowerCase()
  if (prefix === 'true' || prefix === 'succ' || prefix === 'term') return { ok: true }
  if (prefix === 'erro' || prefix === 'fals' || prefix === 'fail' || prefix === 'inva') {
    return { ok: false, error: result }
  }
  if (prefix === 'no r') return { ok: false, error: result }
  if (result | 0) return { ok: true }

  return { ok: false, error: result || 'Install failed' }
}

function startPackageServer(filePath) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      if (req.url !== '/package') {
        res.writeHead(404)
        res.end()
        return
      }
      res.writeHead(200, { 'Content-Type': 'application/octet-stream' })
      fs.createReadStream(filePath).pipe(res)
    })
    server.on('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port
      resolve({ server, url: `http://127.0.0.1:${port}/package` })
    })
  })
}

async function postInstallOnce(win, command, name, packageUrl) {
  return win.webContents.executeJavaScript(`
    new Promise((resolve) => {
      fetch(${JSON.stringify(packageUrl)})
        .then(function(r) {
          if (!r.ok) throw new Error('Could not read package (' + r.status + ')');
          return r.blob();
        })
        .then(function(blob) {
          var file = new File([blob], ${JSON.stringify(name)});
          var fd = new FormData();
          fd.append('command', ${JSON.stringify(command)});
          fd.append('file', file);
          var xhr = new XMLHttpRequest();
          xhr.onload = function() {
            resolve({ status: xhr.status, body: xhr.responseText || '' });
          };
          xhr.onerror = function() {
            resolve({ status: 0, body: 'Upload failed (network error)' });
          };
          xhr.ontimeout = function() {
            resolve({ status: 0, body: 'Upload timed out' });
          };
          xhr.timeout = 600000;
          xhr.open('POST', '/cgi-bin/appInstaller.cgi', true);
          xhr.send(fd);
        })
        .catch(function(e) {
          resolve({ status: 0, body: String(e) });
        });
    })
  `)
}

async function verifyOnDevice(win, searchTerms, timeoutMs = 30000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const listText = await win.webContents.executeJavaScript(`
      new Promise(function(resolve) {
        var fd = new FormData();
        fd.append('command', 'List');
        var xhr = new XMLHttpRequest();
        xhr.onload = function() { resolve(xhr.responseText || ''); };
        xhr.onerror = function() { resolve(''); };
        xhr.open('POST', '/cgi-bin/appInstaller.cgi', true);
        xhr.send(fd);
      })
    `)
    const lower = listText.toLowerCase()
    if (searchTerms.some((term) => term && lower.includes(term.toLowerCase()))) {
      return true
    }
    await sleep(2000)
  }
  return false
}

async function installFileInPage(win, progressWin, filePath) {
  const ext = path.extname(filePath).toLowerCase()
  if (ext === '.apk') {
    return {
      ok: false,
      output:
        'APK files cannot use Development Mode BAR upload — use Berry Bridge App Store (WiFi Storage path) instead.',
      file: path.basename(filePath)
    }
  }

  const buf = fs.readFileSync(filePath)
  const name = path.basename(filePath)
  const command = buf.length <= 4096 ? 'Install Debug Token' : 'Install'
  const verifyTerms = [
    name.replace(/\.(bar|apk)$/i, ''),
    name.split(/[-_.]/)[0],
    'term49',
    'term48',
    'bgshell'
  ].filter(Boolean)

  logStage('upload', name)
  showProgress(progressWin, 'Uploading', `Installing ${name} to your device…`)

  const { server, url } = await startPackageServer(filePath)
  let lastError = 'Install failed'

  try {
    const ready = await pageState(win)
    if (ready.state !== 'ready') {
      return {
        ok: false,
        output: 'App manager session not ready — login may have failed',
        file: name
      }
    }

    for (let attempt = 0; attempt <= 10; attempt++) {
      if (attempt > 0) {
        logStage('retry', `${name} attempt ${attempt + 1}`)
        showProgress(
          progressWin,
          'Uploading',
          `Waiting for device… retry ${attempt}/10 for ${name}`
        )
        await sleep(2000)
      }

      const raw = await postInstallOnce(win, command, name, url)
      const parsed = parseInstallResponse(raw.body, raw.status)

      if (parsed.ok === true) {
        showProgress(progressWin, 'Verifying', `Checking ${name} appears on device…`)
        logStage('verify', name)
        const verified = await verifyOnDevice(win, verifyTerms)
        if (verified) {
          return { ok: true, output: `result::success (${name} verified on device)`, file: name }
        }
        lastError = `${name}: device reported success but app not found in installed list — reboot the phone and retry`
        return { ok: false, output: lastError, file: name }
      }

      if (parsed.ok === false) {
        lastError = parsed.error || raw.body.slice(0, 200) || 'Install failed'
        logStage('install-error', lastError)
        break
      }

      lastError = parsed.error || 'Install incomplete — no result from device'
      logStage('install-incomplete', `${name} attempt ${attempt + 1}: ${lastError}`)
    }

    return { ok: false, output: lastError, file: name }
  } finally {
    server.close()
  }
}

async function run() {
  if (!deviceIp || !password || fileArgs.length === 0) {
    console.error(
      JSON.stringify({
        ok: false,
        error: 'Usage: --device-ip= --password= --file=/path/pkg.bar'
      })
    )
    app.exit(1)
    return
  }

  for (const f of fileArgs) {
    if (!fs.existsSync(f)) {
      console.error(JSON.stringify({ ok: false, error: `File not found: ${f}` }))
      app.exit(1)
      return
    }
  }

  if (!fs.existsSync(pbAppsPath)) {
    console.error(JSON.stringify({ ok: false, error: `Missing pb-apps.js at ${pbAppsPath}` }))
    app.exit(1)
    return
  }

  const deadline = setTimeout(() => {
    console.error(JSON.stringify({ ok: false, error: 'Install timed out after 8 minutes' }))
    app.exit(1)
  }, MAX_RUNTIME_MS)

  let progressWin = null
  let installWin = null

  try {
    configureSession(deviceIp)
    await clearBadLoginCookies(deviceIp)

    progressWin = new BrowserWindow({
      width: 440,
      height: 220,
      show: true,
      title: 'Berry Bridge — Installing…',
      autoHideMenuBar: true,
      resizable: false,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false
      }
    })

    installWin = new BrowserWindow({
      width: 800,
      height: 600,
      show: false,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        webSecurity: false,
        backgroundThrottling: false
      }
    })

    const win = installWin

    win.webContents.setUserAgent('QNXWebClient/1.0')
    showProgress(progressWin, 'Connecting', `Opening Development Mode on ${deviceIp}…`)

    logStage('connect', deviceIp)
    await session.defaultSession.clearStorageData({ storages: ['cookies'] })

    const loginUrl = `https://${deviceIp}/cgi-bin/login.cgi?request_version=1`
    await win.loadURL(loginUrl, { userAgent: 'QNXWebClient/1.0' })
    await clearBadLoginCookies(deviceIp)

    logStage('login', 'Starting authentication…')
    showProgress(progressWin, 'Logging in', 'Entering Development Mode password on device…')
    const script = fs.readFileSync(pbAppsPath, 'utf8')
    await win.webContents.executeJavaScript(script)

    const phase = await waitForLoginForm(win)
    if (phase === 'form') {
      await submitLogin(win, password)
      await waitForInstallUi(win, progressWin)
    } else {
      // Already logged in — confirm app manager UI is really ready
      const ready = await pageState(win)
      if (ready.state !== 'ready') {
        throw new Error('Development Mode session not ready — try again')
      }
    }

    const results = []
    for (const f of fileArgs) {
      results.push(await installFileInPage(win, progressWin, f))
    }

    const failed = results.filter((r) => !r.ok)
    if (failed.length === 0) {
      const names = results.map((r) => r.file).join(', ')
      showProgress(progressWin, 'Done', `Installed ${names}. Check your BB10 app list.`)
      await sleep(2500)
    } else {
      showProgress(
        progressWin,
        'Install failed',
        failed.map((r) => `${r.file}: ${(r.output || 'failed').slice(0, 120)}`).join('\n')
      )
      await sleep(4000)
    }
    progressWin.close()
    installWin.close()

    console.log(JSON.stringify({ ok: failed.length === 0, results }))
    clearTimeout(deadline)
    app.exit(failed.length === 0 ? 0 : 2)
  } catch (err) {
    clearTimeout(deadline)
    const msg = humanizeInstallError(err)
    if (progressWin && !progressWin.isDestroyed()) {
      showProgress(progressWin, 'Install failed', msg)
      await sleep(5000)
      progressWin.close()
    }
    if (installWin && !installWin.isDestroyed()) installWin.close()
    console.error(JSON.stringify({ ok: false, error: msg }))
    app.exit(1)
  }
}

app.whenReady().then(run)

app.on('window-all-closed', () => {
  /* run() calls app.exit */
})
