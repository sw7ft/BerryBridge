import { contextBridge, ipcRenderer } from 'electron'
import type { DeviceProfile } from '@shared/types'

const api = {
  devices: {
    list: (): Promise<DeviceProfile[]> => ipcRenderer.invoke('devices:list'),
    get: (id: string): Promise<DeviceProfile | undefined> => ipcRenderer.invoke('devices:get', id),
    save: (device: DeviceProfile): Promise<DeviceProfile> =>
      ipcRenderer.invoke('devices:save', device),
    delete: (id: string): Promise<void> => ipcRenderer.invoke('devices:delete', id)
  },
  scan: {
    start: (subnet?: string) => ipcRenderer.invoke('scan:start', subnet),
    stop: () => ipcRenderer.invoke('scan:stop'),
    subnets: () => ipcRenderer.invoke('scan:subnets') as Promise<string[]>,
    onProgress: (callback: (progress: import('@shared/types').DeviceScanProgress) => void) => {
      const listener = (_: Electron.IpcRendererEvent, progress: import('@shared/types').DeviceScanProgress) =>
        callback(progress)
      ipcRenderer.on('scan:progress', listener)
      return () => ipcRenderer.removeListener('scan:progress', listener)
    }
  },
  ssh: {
    listKeys: () => ipcRenderer.invoke('ssh:listKeys'),
    listConfigHosts: () => ipcRenderer.invoke('ssh:listConfigHosts'),
    importConfigHost: (alias: string) => ipcRenderer.invoke('ssh:importConfigHost', alias),
    generateKey: (name: string) => ipcRenderer.invoke('ssh:generateKey', name),
    readConfig: () => ipcRenderer.invoke('ssh:readConfig'),
    writeConfigEntry: (device: DeviceProfile) => ipcRenderer.invoke('ssh:writeConfigEntry', device),
    provisionKey: (device: DeviceProfile, publicKeyPath: string) =>
      ipcRenderer.invoke('ssh:provisionKey', device, publicKeyPath),
    testConnection: (device: DeviceProfile) => ipcRenderer.invoke('ssh:testConnection', device),
    readRemoteFile: (device: DeviceProfile, remotePath: string) =>
      ipcRenderer.invoke('ssh:readRemoteFile', device, remotePath),
    readClipboard: (device: DeviceProfile) => ipcRenderer.invoke('ssh:readClipboard', device),
    listPimFiles: (device: DeviceProfile, kind: import('@shared/types').PimKind) =>
      ipcRenderer.invoke('ssh:listPimFiles', device, kind),
    readClipboardHint: (device: DeviceProfile) => ipcRenderer.invoke('ssh:readClipboard', device)
  },
  store: {
    list: () =>
      ipcRenderer.invoke('store:list') as Promise<import('@shared/types').AppStoreCatalog>,
    importPackage: () =>
      ipcRenderer.invoke('store:import') as Promise<import('@shared/types').AppStoreCatalogItem | null>,
    remove: (id: string) => ipcRenderer.invoke('store:remove', id) as Promise<boolean>,
    addRepo: (input: string) =>
      ipcRenderer.invoke('store:addRepo', input) as Promise<import('@shared/types').AppStoreRepo>,
    refreshRepo: (repoId: string) =>
      ipcRenderer.invoke('store:refreshRepo', repoId) as Promise<import('@shared/types').AppStoreRepo>,
    removeRepo: (repoId: string) =>
      ipcRenderer.invoke('store:removeRepo', repoId) as Promise<boolean>,
    install: (deviceId: string, entryId: string) =>
      ipcRenderer.invoke('store:install', deviceId, entryId) as Promise<{ ok: boolean; message: string }>
  },
  terminal: {
    spawn: (device: DeviceProfile) => ipcRenderer.invoke('terminal:spawn', device) as Promise<string>,
    write: (id: string, data: string) => ipcRenderer.invoke('terminal:write', id, data),
    resize: (id: string, cols: number, rows: number) =>
      ipcRenderer.invoke('terminal:resize', id, cols, rows),
    kill: (id: string) => ipcRenderer.invoke('terminal:kill', id),
    onData: (cb: (payload: { id: string; data: string; label: string }) => void) => {
      const listener = (_: Electron.IpcRendererEvent, payload: { id: string; data: string; label: string }) =>
        cb(payload)
      ipcRenderer.on('terminal:data', listener)
      return () => ipcRenderer.removeListener('terminal:data', listener)
    },
    onExit: (cb: (payload: { id: string; exitCode: number; label: string }) => void) => {
      const listener = (_: Electron.IpcRendererEvent, payload: { id: string; exitCode: number; label: string }) =>
        cb(payload)
      ipcRenderer.on('terminal:exit', listener)
      return () => ipcRenderer.removeListener('terminal:exit', listener)
    }
  },
  smb: {
    info: () => ipcRenderer.invoke('smb:info'),
    scan: (subnet?: string) => ipcRenderer.invoke('smb:scan', subnet),
    test: (host: string, password: string, username?: string) =>
      ipcRenderer.invoke('smb:test', host, password, username),
    testDevice: (device: DeviceProfile) =>
      ipcRenderer.invoke('smb:testDevice', device) as Promise<{
        ok: boolean
        message: string
        shares?: import('@shared/types').SmbShareInfo[]
        username?: string
        share?: string
      }>,
    listShares: (host: string, password: string) =>
      ipcRenderer.invoke('smb:listShares', host, password),
    openSession: (host: string, share: string, password: string, username?: string) =>
      ipcRenderer.invoke('smb:openSession', host, share, password, username) as Promise<string>,
    listDirSession: (sessionId: string, path?: string) =>
      ipcRenderer.invoke('smb:listDirSession', sessionId, path),
    closeSession: (sessionId: string) => ipcRenderer.invoke('smb:closeSession', sessionId),
    listDir: (host: string, share: string, password: string, path?: string) =>
      ipcRenderer.invoke('smb:listDir', host, share, password, path),
    download: (host: string, share: string, password: string, remotePath: string) =>
      ipcRenderer.invoke('smb:download', host, share, password, remotePath),
    upload: (host: string, share: string, password: string, remoteDir: string) =>
      ipcRenderer.invoke('smb:upload', host, share, password, remoteDir)
  },
  berrycore: {
    releases: () => ipcRenderer.invoke('berrycore:releases'),
    latest: () => ipcRenderer.invoke('berrycore:latest'),
    checkNew: () => ipcRenderer.invoke('berrycore:checkNew'),
    markSeen: (tag: string) => ipcRenderer.invoke('berrycore:markSeen', tag),
    downloadLatest: () =>
      ipcRenderer.invoke('berrycore:downloadLatest') as Promise<{
        ok: boolean
        message: string
        cache?: {
          tag: string
          name: string
          berrycoreZip: string
          installSh: string
        }
      }>,
    getCached: () =>
      ipcRenderer.invoke('berrycore:getCached') as Promise<{
        tag: string
        name: string
        berrycoreZip: string
        installSh: string
      } | null>,
    uploadToDevice: (deviceId: string) =>
      ipcRenderer.invoke('berrycore:uploadToDevice', deviceId) as Promise<{
        ok: boolean
        message: string
      }>,
    onUploadProgress: (
      callback: (progress: import('@shared/types').BerryCoreUploadProgress) => void
    ) => {
      const listener = (
        _: Electron.IpcRendererEvent,
        progress: import('@shared/types').BerryCoreUploadProgress
      ) => callback(progress)
      ipcRenderer.on('berrycore:uploadProgress', listener)
      return () => ipcRenderer.removeListener('berrycore:uploadProgress', listener)
    }
  },
  apps: {
    openManager: (deviceIp: string, devPassword?: string) =>
      ipcRenderer.invoke('apps:openManager', deviceIp, devPassword),
    installBar: (deviceIp: string, barPath: string, devPassword?: string) =>
      ipcRenderer.invoke('apps:installBar', deviceIp, barPath, devPassword),
    managerInfo: () => ipcRenderer.invoke('apps:managerInfo')
  },
  shell: {
    openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url),
    openPath: (filePath: string) => ipcRenderer.invoke('shell:openPath', filePath)
  }
}

export type BerryBridgeApi = typeof api

contextBridge.exposeInMainWorld('berrybridge', api)

declare global {
  interface Window {
    berrybridge: BerryBridgeApi
  }
}
