import type { AppSection } from '@shared/types'

export type UiMode = 'simple' | 'advanced'

export const UI_MODE_STORAGE_KEY = 'berrybridge-ui-mode'

export interface NavItem {
  id: AppSection
  label: string
  tier: UiMode
}

/** Simple: core setup & daily use. Advanced: adds power-user tools. */
export const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Overview', tier: 'simple' },
  { id: 'quickstart', label: 'Install', tier: 'simple' },
  { id: 'devices', label: 'Devices', tier: 'simple' },
  { id: 'smb', label: 'Storage', tier: 'simple' },
  { id: 'terminal', label: 'Terminal', tier: 'simple' },
  { id: 'store', label: 'App Store', tier: 'simple' },
  { id: 'ssh', label: 'SSH Keys', tier: 'advanced' },
  { id: 'apps', label: 'Applications', tier: 'advanced' },
  { id: 'files', label: 'Device Data', tier: 'advanced' },
  { id: 'learning', label: 'Learning', tier: 'advanced' },
  { id: 'news', label: 'News', tier: 'advanced' },
  { id: 'qnx', label: 'QNX', tier: 'advanced' }
]

export function navItemsForMode(mode: UiMode): NavItem[] {
  if (mode === 'advanced') return NAV_ITEMS
  return NAV_ITEMS.filter((item) => item.tier === 'simple')
}

export function isAdvancedSection(section: AppSection): boolean {
  const item = NAV_ITEMS.find((n) => n.id === section)
  return item?.tier === 'advanced'
}

export function readStoredUiMode(): UiMode {
  try {
    const stored = localStorage.getItem(UI_MODE_STORAGE_KEY)
    return stored === 'advanced' ? 'advanced' : 'simple'
  } catch {
    return 'simple'
  }
}

export function storeUiMode(mode: UiMode): void {
  try {
    localStorage.setItem(UI_MODE_STORAGE_KEY, mode)
  } catch {
    /* ignore */
  }
}
