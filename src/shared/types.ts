/** BerryBridge shared constants — BB10 / BerryCore device paths and defaults */

export const BERRYCORE_REPO = 'sw7ft/BerryCore'
export const QNX_HANDHELDS_REPO = 'sw7ft/QNX-Handhelds'
export const BB10_APP_MANAGER_REPO = 'zhetengbiji/bb10-app-manager'

export const DEVICE_PATHS = {
  clipboard: {
    plain: '/accounts/1000/clipboard/text.plain',
    html: '/accounts/1000/clipboard/text.html'
  },
  pimdata: {
    startup: '/accounts/1000/pimdata/_startup_data',
    messages: '/accounts/1000/pimdata/_startup_data/messages',
    notebooks: '/accounts/1000/pimdata/_startup_data/notebooks',
    contacts: '/accounts/1000/pimdata/_startup_data/contacts'
  },
  berrycore: {
    /** Default install target after running install.sh */
    defaultInstall: '/accounts/1000/shared/misc/berrycore',
    sharedMisc: '/accounts/1000/shared/misc',
    /** All Berry Bridge setup files (BerryCore zip, install.sh, Term49 scripts, SSH .pub) */
    transferDir: '/accounts/1000/shared/documents',
    /** Typical WiFi Storage disk share (Z10 and most BB10 devices) */
    transferShare: 'media'
  },
  /** Berry Bridge ↔ BerryCore agent staging (future package — see docs spec) */
  berrybridge: {
    setupRoot: '/accounts/1000/shared/documents/berrybridge',
    inbox: '/accounts/1000/shared/documents/berrybridge/inbox',
    statusFile: '/accounts/1000/shared/documents/berrybridge/status.json'
  },
  ssh: {
    authorizedKeys: '/accounts/1000/.ssh/authorized_keys',
    sshDir: '/accounts/1000/.ssh'
  }
} as const

export const SSH_DEFAULTS = {
  user: 'blackberry',
  port: 2022,
  algorithms: {
    pubkeyAccepted: ['ssh-rsa'],
    hostKey: ['ssh-rsa'],
    kex: ['diffie-hellman-group1-sha1']
  }
} as const

export const SMB_DEFAULTS = {
  username: 'blackberry',
  port: 445,
  shareName: 'media' // typical BB10 WiFi storage share
} as const

/** Paths on the `media` share (WiFi Storage) */
export const SMB_PATHS = {
  sharedMisc: 'misc',
  /** Relative on media share → DEVICE_PATHS.berrycore.transferDir on device */
  sharedDocumentsOnMedia: 'accounts/1000/shared/documents',
  /** Alternate relative path on some shares */
  sharedDocuments: 'documents',
  clipboardPlain: 'accounts/1000/clipboard/text.plain'
} as const

export const BB10_DEV_MODE = {
  userAgent: 'QNXWebClient/1.0',
  loginPath: '/cgi-bin/login.cgi',
  installerPath: '/cgi-bin/appInstaller.cgi',
  defaultPort: 443
} as const

export interface DeviceProfile {
  id: string
  name: string
  host: string
  sshPort: number
  sshUser: string
  identityFile?: string
  sshHostAlias?: string
  devModePassword?: string
  smbPassword?: string
  /** WiFi Storage username — BB10 Settings → Storage and Access → Identification on Network (default blackberry). */
  smbUser?: string
  smbShare?: string
  notes?: string
  createdAt: string
  updatedAt: string
}

export interface SmbFileEntry {
  name: string
  isDirectory: boolean
  size: number
  modified?: string
}

export interface SmbMediaPreview {
  url: string
  kind: 'image' | 'video'
  mimeType: string
  name: string
  size: number
  cached: boolean
}

export interface SmbShareInfo {
  name: string
  type: string
  comment: string
}

export interface SmbHost {
  ip: string
  hostname?: string
  port: number
  reachable: boolean
}

export type DeviceSignal = 'smb' | 'ssh' | 'devMode'

export interface DiscoveredDevice {
  ip: string
  hostname?: string
  signals: DeviceSignal[]
  confidence: 'high' | 'medium' | 'low'
  smbOpen: boolean
  sshOpen: boolean
  devModeOpen: boolean
  sshPort?: number
  alreadySaved: boolean
}

export interface DeviceScanProgress {
  phase: 'scanning' | 'identifying' | 'done'
  scanned: number
  total: number
  subnet: string
  found: DiscoveredDevice[]
}

export interface BerryCoreUploadProgress {
  phase: 'connecting' | 'uploading' | 'agent-polling' | 'agent-running' | 'done' | 'error'
  message: string
  file?: string
  fileIndex?: number
  fileCount?: number
  percent?: number
  /** Pulse animation while a large file is in flight (no byte-level SMB progress). */
  indeterminate?: boolean
}

export interface BerryBridgeAgentStatus {
  schema?: string
  updated_at?: string
  agent?: {
    version?: string
    state?: string
    last_job_id?: string
    last_error?: string | null
  }
  berrycore?: {
    installed?: boolean
    path?: string
    version?: string
  }
  ssh?: {
    sshd_running?: boolean
    port?: number
    user?: string
    ready_for_bridge?: boolean
  }
  last_job?: {
    id?: string
    type?: string
    state?: string
    message?: string
    exit_code?: number
  }
}

export interface BerryCoreDeviceUploadResult {
  ok: boolean
  message: string
  method?: 'agent' | 'term49'
  berrycoreInstalled?: boolean
}

export interface BerryCoreReleaseAsset {
  name: string
  downloadUrl: string
  size: number
}

export interface BerryCoreRelease {
  tag: string
  name: string
  publishedAt: string
  htmlUrl: string
  body: string
  assets: BerryCoreReleaseAsset[]
  isNew?: boolean
}

export interface ScanProgress {
  scanned: number
  total: number
  found: SmbHost[]
}

export interface SshKeyInfo {
  path: string
  publicKey: string
  fingerprint: string
  exists: boolean
}

export interface SshConfigEntry {
  host: string
  hostName: string
  user: string
  port: number
  identityFile: string
}

export interface RemotePimEntry {
  path: string
  name: string
}

export interface RemotePimEntryMeta extends RemotePimEntry {
  mtime: number
  size: number
}

export type PimKind = 'messages' | 'notebooks'

export interface AppStoreEntry {
  id: string
  name: string
  description?: string
  version?: string
  type: 'bar' | 'apk'
  filename: string
  source: 'builtin' | 'custom' | 'repo'
  author?: string
  /** GitHub repo id when source is repo. */
  repoId?: string
  /** Path within the GitHub repo. */
  githubPath?: string
  downloadUrl?: string
}

export interface AppStoreRepo {
  id: string
  owner: string
  repo: string
  branch: string
  path: string
  label: string
  htmlUrl: string
  addedAt: string
  lastSyncedAt?: string
}

export interface AppStoreRepoManifest {
  repoId: string
  branch: string
  packages: {
    path: string
    name: string
    type: 'bar' | 'apk'
    size: number
    downloadUrl: string
  }[]
  syncedAt: string
}

export interface AppStoreCatalogItem extends AppStoreEntry {
  packagePath: string
  /** False when the .bar/.apk file is not on disk (run npm run fetch-app-store). */
  packageAvailable: boolean
  repoLabel?: string
}

export interface AppStoreCatalog {
  version: number
  apps: AppStoreCatalogItem[]
  repos: AppStoreRepo[]
}

export type AppSection =
  | 'dashboard'
  | 'quickstart'
  | 'devices'
  | 'terminal'
  | 'ssh'
  | 'smb'
  | 'apps'
  | 'store'
  | 'files'
  | 'learning'
  | 'news'
  | 'qnx'
