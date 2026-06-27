/**
 * BB10 App Manager — runs under Electron 16 (TLS 1.0).
 * Launched by Berry Bridge with --device-ip on the command line.
 */
const { app, BrowserWindow, session } = require('electron')
const fs = require('fs')
const path = require('path')

function parseArg(name) {
  const prefix = `--${name}=`
  for (const arg of process.argv) {
    if (arg.startsWith(prefix)) return arg.slice(prefix.length)
  }
  return undefined
}

const deviceIp = parseArg('device-ip') || process.env.BB10_DEVICE_IP
const resourcesDir = parseArg('resources-dir') || process.env.BB10_RESOURCES_DIR || __dirname
const pbAppsPath = parseArg('pb-apps') || process.env.BB10_PB_APPS || path.join(resourcesDir, 'pb-apps.js')

app.commandLine.appendSwitch('ignore-certificate-errors')

function headerValue(headers, name) {
  const raw = headers[name] || headers[name.toLowerCase()]
  if (Array.isArray(raw)) return raw[0]
  return raw
}

function configureSession(ip) {
  const filter = {
    urls: [`https://${ip}/cgi-bin/*`, `http://${ip}/cgi-bin/*`]
  }

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

function showErrorPage(title, body) {
  const win = new BrowserWindow({
    width: 520,
    height: 320,
    title: 'Berry Bridge — App Manager',
    webPreferences: { nodeIntegration: false, contextIsolation: true }
  })
  win.loadURL(
    `data:text/html,${encodeURIComponent(`<h2>${title}</h2><p>${body}</p>`)}`
  )
}

async function clearBadLoginCookies(ip) {
  const url = `https://${ip}`
  try {
    const cookies = await session.defaultSession.cookies.get({ url })
    for (const c of cookies) {
      if (c.name === 'loginsession' && (!c.value || c.value === 'deleted')) {
        await session.defaultSession.cookies.remove(url, 'loginsession')
      }
    }
  } catch (err) {
    console.error('cookie cleanup failed:', err)
  }
}

function injectPbApps(win, ip) {
  if (!fs.existsSync(pbAppsPath)) {
    showErrorPage(
      'Missing pb-apps.js',
      `Expected at ${pbAppsPath}. Reinstall Berry Bridge or run npm install.`
    )
    win.close()
    return
  }

  const script = fs.readFileSync(pbAppsPath, { encoding: 'utf8' })
  win.webContents.executeJavaScript(script).catch((err) => {
    console.error('pb-apps inject failed:', err)
    showErrorPage('Injection failed', String(err))
  })
}

function openManagerWindow(ip) {
  configureSession(ip)

  const loginUrl = `https://${ip}/cgi-bin/login.cgi?request_version=1`
  const win = new BrowserWindow({
    width: 960,
    height: 720,
    show: true,
    title: `App Manager — ${ip}`,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false
    }
  })

  win.webContents.setUserAgent('QNXWebClient/1.0')

  let injected = false
  const tryInject = async () => {
    if (injected) return
    injected = true
    await clearBadLoginCookies(ip)
    injectPbApps(win, ip)
  }

  win.webContents.on('did-finish-load', () => {
    void tryInject()
  })

  win.webContents.on('did-fail-load', (_event, code, description, url) => {
    if (!url.includes('login.cgi')) return
    win.loadURL(
      `data:text/html,${encodeURIComponent(
        `<h2>Could not connect to ${ip}</h2>
         <p><strong>${description}</strong> (${code})</p>
         <ul>
           <li>Development Mode enabled? (Settings → Security)</li>
           <li>Device on the same network?</li>
           <li>IP correct? (${ip})</li>
         </ul>`
      )}`
    )
  })

  win.webContents.session.on('will-download', (event, item) => {
    if (item.getURL().includes('login.cgi')) {
      event.preventDefault()
      void tryInject()
    }
  })

  win.loadURL(loginUrl, { userAgent: 'QNXWebClient/1.0' })
}

app.whenReady().then(() => {
  if (!deviceIp) {
    showErrorPage(
      'No device address',
      'Berry Bridge did not pass a device IP. Close this window and try again from Applications.'
    )
    return
  }
  openManagerWindow(deviceIp)
})

app.on('window-all-closed', () => {
  app.quit()
})
