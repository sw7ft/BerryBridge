/** Local HTTP API for automation — localhost only. */

export const LOCAL_API_DEFAULT_PORT = 47891

export interface LocalApiDeviceSummary {
  id: string
  name: string
  host: string
  hasDevPassword: boolean
}

export interface LocalApiHealth {
  ok: true
  service: 'berrybridge-local-api'
  version: string
  managerReady: boolean
}

export interface LocalApiInfo {
  enabled: boolean
  port: number
  baseUrl: string
  tokenRequired: boolean
  endpoints: Record<string, string>
}

export interface BarInstallRequest {
  deviceId?: string
  deviceIp?: string
  barPath?: string
  barPaths?: string[]
  devPassword?: string
  /** When true and no password, opens the interactive app manager instead of headless install. */
  openManager?: boolean
}

export interface CatalogInstallRequest {
  deviceId: string
  entryId: string
}

export interface InstallResponse {
  ok: boolean
  message: string
}
