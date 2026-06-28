import { app, shell, BrowserWindow, ipcMain, session, dialog } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { DeviceStore } from './services/device-store'
import { SshManager } from './services/ssh-manager'
import { SmbScanner } from './services/smb-scanner'
import { DeviceScanner } from './services/device-scanner'
import { BerryCoreFeed } from './services/berrycore-feed'
import { BerryCoreSetupService } from './services/berrycore-setup'
import { Bb10AppInstaller } from './services/bb10-app-installer'
import { Bb10ApkInstaller } from './services/bb10-apk-installer'
import { AppStoreService } from './services/app-store-service'
import { TerminalManager } from './services/terminal-manager'
import { detectSubnets } from './services/network-utils'
import type { DeviceProfile } from '@shared/types'

const store = new DeviceStore()
const sshManager = new SshManager()
const smbScanner = new SmbScanner()
const deviceScanner = new DeviceScanner()
const berryCoreFeed = new BerryCoreFeed()
const berryCoreSetup = new BerryCoreSetupService(berryCoreFeed, smbScanner)
const bb10Installer = new Bb10AppInstaller()
const bb10ApkInstaller = new Bb10ApkInstaller(smbScanner, sshManager)
const appStore = new AppStoreService(bb10Installer, bb10ApkInstaller)
const terminalManager = new TerminalManager(() => mainWindow, sshManager)

let mainWindow: BrowserWindow | null = null

function createWindow(): BrowserWindow {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 780,
    minWidth: 900,
    minHeight: 600,
    show: false,
    title: 'Berry Bridge',
    autoHideMenuBar: true,
    backgroundColor: '#d8d8d8',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => mainWindow?.show())

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
}

function broadcastScanProgress(progress: unknown): void {
  mainWindow?.webContents.send('scan:progress', progress)
}

function broadcastBerryCoreUploadProgress(
  progress: import('@shared/types').BerryCoreUploadProgress
): void {
  mainWindow?.webContents.send('berrycore:uploadProgress', progress)
}

async function runDeviceScan(subnet?: string) {
  const savedHosts = store.listDevices().map((d) => d.host)
  return deviceScanner.scan({
    subnet,
    savedHosts,
    onProgress: broadcastScanProgress
  })
}

function registerIpc(): void {
  // Devices
  ipcMain.handle('devices:list', () => store.listDevices())
  ipcMain.handle('devices:save', (_e, device: DeviceProfile) => store.saveDevice(device))
  ipcMain.handle('devices:delete', (_e, id: string) => store.deleteDevice(id))
  ipcMain.handle('devices:get', (_e, id: string) => store.getDevice(id))

  // Device LAN scan
  ipcMain.handle('scan:start', (_e, subnet?: string) => runDeviceScan(subnet))
  ipcMain.handle('scan:stop', () => deviceScanner.stop())
  ipcMain.handle('scan:subnets', () => detectSubnets())

  // SSH
  ipcMain.handle('ssh:listKeys', () => sshManager.listLocalKeys())
  ipcMain.handle('ssh:listConfigHosts', () => sshManager.listConfigHosts())
  ipcMain.handle('ssh:importConfigHost', (_e, alias: string) =>
    sshManager.importConfigHost(alias)
  )
  ipcMain.handle('ssh:generateKey', (_e, name: string) => sshManager.generateKey(name))
  ipcMain.handle('ssh:readConfig', () => sshManager.readSshConfig())
  ipcMain.handle('ssh:writeConfigEntry', (_e, device: DeviceProfile) =>
    sshManager.writeConfigEntry(device)
  )
  ipcMain.handle('ssh:provisionKey', async (_e, device: DeviceProfile, publicKeyPath: string) => {
    if (!device.smbPassword) {
      return {
        method: 'error',
        message:
          'WiFi Storage password required — add it on the device profile (Settings → Storage and Access on BB10).'
      }
    }

    const upload = await smbScanner.provisionSshKey(device, publicKeyPath)

    try {
      const sshMsg = await sshManager.installKeyFromMisc(device, upload.keyFileName)
      return {
        method: 'smb+ssh',
        message: `${upload.message.split('\n\nOn your BB10')[0]}\n\n${sshMsg} Test SSH connection.`
      }
    } catch {
      return upload
    }
  })
  ipcMain.handle('ssh:testConnection', (_e, device: DeviceProfile) =>
    sshManager.testConnection(device)
  )
  ipcMain.handle('ssh:readRemoteFile', (_e, device: DeviceProfile, remotePath: string) =>
    sshManager.readRemoteFile(device, remotePath)
  )
  ipcMain.handle('ssh:readClipboard', (_e, device: DeviceProfile) =>
    sshManager.readClipboard(device)
  )
  ipcMain.handle('ssh:listPimFiles', (_e, device: DeviceProfile, kind: import('@shared/types').PimKind) =>
    sshManager.listPimFiles(device, kind)
  )
  ipcMain.handle('ssh:readClipboardHint', (_e, device: DeviceProfile) =>
    sshManager.readClipboard(device)
  )

  // SSH terminal (node-pty + system ssh)
  ipcMain.handle('terminal:spawn', (_e, device: DeviceProfile) => terminalManager.spawn(device))
  ipcMain.handle('terminal:write', (_e, id: string, data: string) => {
    terminalManager.write(id, data)
  })
  ipcMain.handle('terminal:resize', (_e, id: string, cols: number, rows: number) => {
    terminalManager.resize(id, cols, rows)
  })
  ipcMain.handle('terminal:kill', (_e, id: string) => terminalManager.kill(id))

  // SMB — BB10 WiFi Storage (SMB1 via smbclient)
  ipcMain.handle('smb:info', () => smbScanner.getClientInfo())
  ipcMain.handle('smb:scan', (_e, subnet?: string) => smbScanner.scan(subnet))
  ipcMain.handle('smb:test', (_e, host: string, password: string, username?: string) =>
    smbScanner.testConnection(host, password, username)
  )
  ipcMain.handle('smb:testDevice', (_e, device: DeviceProfile) =>
    smbScanner.testDeviceConnection(device)
  )
  ipcMain.handle(
    'smb:openSession',
    (_e, host: string, share: string, password: string, username?: string) =>
      smbScanner.openSession(host, share, password, username)
  )
  ipcMain.handle('smb:listDirSession', (_e, sessionId: string, path?: string) =>
    smbScanner.listDirSession(sessionId, path || '')
  )
  ipcMain.handle('smb:closeSession', (_e, sessionId: string) =>
    smbScanner.closeSession(sessionId)
  )
  ipcMain.handle('smb:listShares', (_e, host: string, password: string) =>
    smbScanner.listShares(host, password)
  )
  ipcMain.handle(
    'smb:listDir',
    (_e, host: string, share: string, password: string, path?: string) =>
      smbScanner.listDirectory(host, share, password, path)
  )
  ipcMain.handle(
    'smb:download',
    async (_e, host: string, share: string, password: string, remotePath: string) => {
      const { filePath, canceled } = await dialog.showSaveDialog({
        defaultPath: remotePath.split('/').pop() || 'download'
      })
      if (canceled || !filePath) return { ok: false, message: 'Cancelled' }
      await smbScanner.downloadFile(host, share, password, remotePath, filePath)
      return { ok: true, message: `Saved to ${filePath}`, path: filePath }
    }
  )
  ipcMain.handle(
    'smb:upload',
    async (_e, host: string, share: string, password: string, remoteDir: string) => {
      const { filePaths, canceled } = await dialog.showOpenDialog({
        properties: ['openFile']
      })
      if (canceled || !filePaths[0]) return { ok: false, message: 'Cancelled' }
      const name = filePaths[0].split(/[/\\]/).pop() || 'upload'
      const remotePath = remoteDir ? `${remoteDir}/${name}` : name
      await smbScanner.uploadFile(host, share, password, filePaths[0], remotePath)
      return { ok: true, message: `Uploaded ${name} to ${share}/${remotePath}` }
    }
  )

  // BerryCore feed
  ipcMain.handle('berrycore:releases', () => berryCoreFeed.fetchReleases())
  ipcMain.handle('berrycore:latest', () => berryCoreFeed.fetchLatest())
  ipcMain.handle('berrycore:checkNew', () => berryCoreFeed.checkForNew())
  ipcMain.handle('berrycore:markSeen', (_e, tag: string) => berryCoreFeed.markSeen(tag))
  ipcMain.handle('berrycore:downloadLatest', () => berryCoreSetup.downloadLatest())
  ipcMain.handle('berrycore:getCached', () => berryCoreSetup.getCachedLatest())
  ipcMain.handle('berrycore:uploadToDevice', async (_e, deviceId: string) => {
    const device = store.getDevice(deviceId)
    if (!device) return { ok: false, message: 'Device not found' }
    return berryCoreSetup.uploadToDevice(device, broadcastBerryCoreUploadProgress)
  })

  // BB10 app install (bb10-app-manager protocol)
  ipcMain.handle('apps:openManager', (_e, deviceIp: string, devPassword?: string) =>
    bb10Installer.openAppManager(deviceIp, devPassword)
  )
  ipcMain.handle('apps:installBar', (_e, deviceIp: string, barPath: string, devPassword?: string) =>
    bb10Installer.installBar(deviceIp, barPath, devPassword)
  )
  ipcMain.handle('apps:managerInfo', () => bb10Installer.getManagerInfo())

  // App Store
  ipcMain.handle('store:list', () => appStore.listCatalog())
  ipcMain.handle('store:import', () => appStore.importPackage())
  ipcMain.handle('store:remove', (_e, id: string) => appStore.removeCustomPackage(id))
  ipcMain.handle('store:addRepo', (_e, input: string) => appStore.addGitHubRepo(input))
  ipcMain.handle('store:refreshRepo', (_e, repoId: string) => appStore.refreshGitHubRepo(repoId))
  ipcMain.handle('store:removeRepo', (_e, repoId: string) => appStore.removeGitHubRepo(repoId))
  ipcMain.handle('store:install', async (_e, deviceId: string, entryId: string) => {
    const device = store.getDevice(deviceId)
    if (!device) return { ok: false, message: 'Device not found' }
    const entry = appStore.listCatalog().apps.find((a) => a.id === entryId)
    if (!entry) return { ok: false, message: 'Package not found in catalog' }
    return appStore.installPackage(device, entry)
  })

  // Shell
  ipcMain.handle('shell:openExternal', (_e, url: string) => shell.openExternal(url))
  ipcMain.handle('shell:openPath', (_e, filePath: string) => shell.openPath(filePath))
}

app.commandLine.appendSwitch('ignore-certificate-errors')

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.berrycore.berrybridge')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // BB10 dev mode requires QNXWebClient User-Agent (same as bb10-app-manager)
  session.defaultSession.webRequest.onBeforeSendHeaders(
    { urls: ['https://*/cgi-bin/*', 'http://*/cgi-bin/*'] },
    (details, callback) => {
      details.requestHeaders['User-Agent'] = 'QNXWebClient/1.0'
      callback({ requestHeaders: details.requestHeaders })
    }
  )

  registerIpc()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  terminalManager.killAll()
  if (process.platform !== 'darwin') app.quit()
})
