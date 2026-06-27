import { useCallback, useEffect, useMemo, useState } from 'react'
import type { AppSection, DeviceProfile, DiscoveredDevice } from '@shared/types'
import { BerryMark } from './components/BerryMark'
import { BlendNavIcon } from './components/BlendNavIcon'
import { SidebarModeToggle } from './components/SidebarModeToggle'
import { SidebarSupport } from './components/SidebarSupport'
import { useDeviceScan } from './hooks/useDeviceScan'
import {
  isAdvancedSection,
  navItemsForMode,
  readStoredUiMode,
  storeUiMode,
  type UiMode
} from './navigation'
import { Dashboard } from './pages/Dashboard'
import { InstallPage } from './pages/Install'
import { DevicesPage } from './pages/Devices'
import { TerminalPage } from './pages/Terminal'
import { SshPage } from './pages/Ssh'
import { SmbPage } from './pages/Smb'
import { AppsPage } from './pages/Apps'
import { AppStorePage } from './pages/AppStore'
import { FilesPage } from './pages/Files'
import { LearningPage } from './pages/Learning'
import { NewsPage } from './pages/News'
import { QnxPage } from './pages/Qnx'

export default function App() {
  const [section, setSection] = useState<AppSection>('dashboard')
  const [uiMode, setUiMode] = useState<UiMode>(() => readStoredUiMode())
  const [devices, setDevices] = useState<DeviceProfile[]>([])
  const [newsCount, setNewsCount] = useState(0)
  const [pendingDiscovery, setPendingDiscovery] = useState<DiscoveredDevice | null>(null)
  const [terminalDeviceId, setTerminalDeviceId] = useState<string | null>(null)
  const scan = useDeviceScan()

  const refreshDevices = useCallback(async () => {
    const list = await window.berrybridge.devices.list()
    setDevices(list)
  }, [])

  const openTerminal = useCallback((deviceId: string) => {
    setTerminalDeviceId(deviceId)
    setSection('terminal')
  }, [])

  useEffect(() => {
    refreshDevices()
    window.berrybridge.berrycore.checkNew().then(({ hasNew }) => {
      if (hasNew) setNewsCount(1)
    })
  }, [refreshDevices])

  const primaryDevice = devices[0]

  const visibleNav = useMemo(() => navItemsForMode(uiMode), [uiMode])
  const simpleNav = useMemo(
    () => visibleNav.filter((item) => item.tier === 'simple'),
    [visibleNav]
  )
  const advancedNav = useMemo(
    () => (uiMode === 'advanced' ? visibleNav.filter((item) => item.tier === 'advanced') : []),
    [uiMode, visibleNav]
  )

  const setUiModeAndPersist = useCallback(
    (mode: UiMode) => {
      setUiMode(mode)
      storeUiMode(mode)
      if (mode === 'simple' && isAdvancedSection(section)) {
        setSection('dashboard')
      }
    },
    [section]
  )

  const renderNavItem = (item: (typeof visibleNav)[number]) => (
    <button
      key={item.id}
      type="button"
      className={`blend-sidebar-item ${section === item.id ? 'active' : ''}`}
      onClick={() => setSection(item.id)}
      title={item.label}
    >
      <BlendNavIcon section={item.id} />
      <span className="blend-sidebar-label">{item.label}</span>
      {item.id === 'news' && newsCount > 0 && <em className="blend-sidebar-badge">!</em>}
    </button>
  )

  const renderPage = () => {
    switch (section) {
      case 'dashboard':
        return <Dashboard devices={devices} onNavigate={setSection} />
      case 'quickstart':
        return (
          <InstallPage
            devices={devices}
            scan={scan}
            onRefresh={refreshDevices}
            onOpenTerminal={openTerminal}
            onNavigate={setSection}
          />
        )
      case 'devices':
        return (
          <DevicesPage
            devices={devices}
            scan={scan}
            pendingDiscovery={pendingDiscovery}
            onClearPending={() => setPendingDiscovery(null)}
            onRefresh={refreshDevices}
            onOpenTerminal={openTerminal}
          />
        )
      case 'terminal':
        return <TerminalPage devices={devices} selectedDeviceId={terminalDeviceId} />
      case 'ssh':
        return <SshPage devices={devices} />
      case 'smb':
        return <SmbPage devices={devices} onRefresh={refreshDevices} />
      case 'store':
        return <AppStorePage devices={devices} />
      case 'apps':
        return <AppsPage devices={devices} />
      case 'files':
        return <FilesPage devices={devices} />
      case 'learning':
        return <LearningPage />
      case 'news':
        return <NewsPage onSeen={() => setNewsCount(0)} />
      case 'qnx':
        return <QnxPage />
    }
  }

  return (
    <div className="blend-app">
      <header className="blend-titlebar">
        <div className="blend-titlebar-left">
          <BerryMark size="sm" className="blend-mark" />
          <div className="blend-titlebar-brand">
            <strong>BERRY BRIDGE</strong>
            <span>Desktop Management of BerryCore Devices</span>
          </div>
        </div>

        <div className="blend-titlebar-center">
          {primaryDevice ? (
            <>
              <span className="blend-status-dot connected" />
              <span className="blend-device-name">{primaryDevice.name}</span>
              <span className="blend-device-meta">
                {primaryDevice.sshHostAlias || primaryDevice.host}
              </span>
            </>
          ) : (
            <>
              <span className="blend-status-dot idle" />
              <span className="blend-device-name">No device selected</span>
            </>
          )}
        </div>

        <div className="blend-titlebar-right">
          <span className="blend-titlebar-chip">
            {devices.length} device{devices.length === 1 ? '' : 's'}
          </span>
        </div>
      </header>

      <div className="blend-body">
        <aside className="blend-sidebar">
          <nav className="blend-sidebar-nav" aria-label="Main navigation">
            {simpleNav.map(renderNavItem)}
            {advancedNav.length > 0 && (
              <>
                <div className="blend-sidebar-divider" aria-hidden="true">
                  Advanced
                </div>
                {advancedNav.map(renderNavItem)}
              </>
            )}
          </nav>
          <SidebarModeToggle mode={uiMode} onChange={setUiModeAndPersist} />
          <SidebarSupport />
        </aside>

        <main
          className={`blend-content ${section === 'terminal' ? 'blend-content-terminal' : ''}`}
        >
          {renderPage()}
        </main>
      </div>
    </div>
  )
}
