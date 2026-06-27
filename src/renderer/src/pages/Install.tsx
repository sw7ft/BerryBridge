import { useState } from 'react'
import type { AppSection, DeviceProfile } from '@shared/types'
import type { useDeviceScan } from '../hooks/useDeviceScan'
import { InstallationWizard } from './InstallationWizard'
import { QuickStartPage } from './QuickStart'

type ScanState = ReturnType<typeof useDeviceScan>

interface Props {
  devices: DeviceProfile[]
  scan: ScanState
  onRefresh: () => void
  onOpenTerminal: (deviceId: string) => void
  onNavigate: (section: AppSection) => void
}

export function InstallPage(props: Props) {
  const [view, setView] = useState<'wizard' | 'detailed'>('wizard')

  if (view === 'detailed') {
    return (
      <>
        <div className="install-detailed-bar">
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setView('wizard')}>
            ← Back to guided install
          </button>
        </div>
        <QuickStartPage {...props} />
      </>
    )
  }

  return <InstallationWizard {...props} onShowDetailed={() => setView('detailed')} />
}
