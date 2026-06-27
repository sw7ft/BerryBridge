/** Guided install wizard — collapses Quick Start into five automated phases. */
export const INSTALL_PHASES = [
  {
    id: 'phone',
    title: 'Phone setup',
    summary: 'Development Mode and WiFi Storage on the BB10'
  },
  {
    id: 'device',
    title: 'Connect',
    summary: 'Find your phone and save its passwords'
  },
  {
    id: 'term49',
    title: 'Term49',
    summary: 'Install the terminal app'
  },
  {
    id: 'berrycore',
    title: 'BerryCore',
    summary: 'Download, transfer, and run the installer'
  },
  {
    id: 'ssh',
    title: 'SSH',
    summary: 'Key, config, and connection test'
  }
] as const

export type InstallPhaseId = (typeof INSTALL_PHASES)[number]['id']

export const INSTALL_PHASE_STORAGE_KEY = 'berrybridge-install-phase'

export function readStoredInstallPhase(): InstallPhaseId {
  try {
    const stored = localStorage.getItem(INSTALL_PHASE_STORAGE_KEY)
    if (INSTALL_PHASES.some((p) => p.id === stored)) return stored as InstallPhaseId
  } catch {
    /* ignore */
  }
  return 'phone'
}

export function storeInstallPhase(id: InstallPhaseId): void {
  try {
    localStorage.setItem(INSTALL_PHASE_STORAGE_KEY, id)
  } catch {
    /* ignore */
  }
}
