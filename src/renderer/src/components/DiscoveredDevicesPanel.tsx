import type { DiscoveredDevice } from '@shared/types'

const SIGNAL_LABELS: Record<string, string> = {
  smb: 'WiFi Storage',
  ssh: 'SSH',
  devMode: 'Dev Mode'
}

interface Props {
  discovered: DiscoveredDevice[]
  scanning: boolean
  progress: { scanned: number; total: number; phase: string; subnet: string } | null
  onAdd: (device: DiscoveredDevice) => void
  /** Pick an already-saved device from scan results (Quick Start). */
  onSelect?: (device: DiscoveredDevice) => void
  /** Highlight the row matching the active saved device (by IP). */
  activeHost?: string
  onRescan: () => void
  onStop?: () => void
  compact?: boolean
  /** Shown when idle (e.g. Quick Start step 2) */
  subnets?: string[]
}

export function DiscoveredDevicesPanel({
  discovered,
  scanning,
  progress,
  onAdd,
  onSelect,
  activeHost,
  onRescan,
  onStop,
  compact = false,
  subnets = []
}: Props) {
  const pct =
    progress && progress.total > 0
      ? Math.round((progress.scanned / progress.total) * 100)
      : 0

  const newCount = discovered.filter((d) => !d.alreadySaved).length

  return (
    <div className="card scan-panel">
      <div className="scan-header">
        <div>
          <h3>{compact ? 'Nearby devices' : 'Network discovery'}</h3>
          {!compact && (
            <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
              Scans the local network for BerryCore SSH, WiFi Storage, and development-mode
              services.
              {progress?.subnet && ` Subnet: ${progress.subnet}`}
              {!progress?.subnet && subnets.length > 0 && ` Scanning: ${subnets.join(', ')}`}
            </p>
          )}
        </div>
        <div className="btn-row" style={{ margin: 0 }}>
          {scanning ? (
            <button className="btn btn-secondary" onClick={onStop}>
              Stop
            </button>
          ) : (
            <button className="btn btn-primary" onClick={onRescan}>
              {discovered.length ? 'Rescan' : 'Scan LAN'}
            </button>
          )}
        </div>
      </div>

      {scanning && progress && (
        <div className="scan-progress">
          <div className="scan-progress-bar">
            <div className="scan-progress-fill" style={{ width: `${pct}%` }} />
          </div>
          <span className="scan-progress-label">
            {progress.phase === 'identifying'
              ? `Identifying device… (${progress.scanned}/${progress.total})`
              : `Scanning ${progress.scanned} / ${progress.total} addresses`}
          </span>
        </div>
      )}

      {!scanning && discovered.length === 0 && (
        <div className="empty" style={{ padding: '24px 0' }}>
          No BB10 devices found on the network. Make sure your device is on the same WiFi with
          Development Mode or WiFi Storage enabled.
        </div>
      )}

      {discovered.length > 0 && (
        <div className="discovered-list">
          {discovered.map((d) => {
            const isActive = Boolean(activeHost && activeHost === d.ip)
            return (
              <div
                key={d.ip}
                className={`discovered-row confidence-${d.confidence}${isActive ? ' is-active' : ''}`}
              >
                <div className="discovered-info">
                  <strong>
                    {d.hostname || d.ip}
                    {d.alreadySaved && <span className="tag-saved">Saved</span>}
                    {!d.alreadySaved && newCount > 0 && <span className="tag-new">NEW</span>}
                    {isActive && <span className="tag-active">Active</span>}
                  </strong>
                  <span>
                    {d.ip}
                    {d.hostname ? ` · ${d.hostname}` : ''}
                  </span>
                  <div className="signal-tags">
                    {d.signals.map((s) => (
                      <span key={s} className="signal-tag">
                        {SIGNAL_LABELS[s] || s}
                      </span>
                    ))}
                    <span className={`confidence-tag ${d.confidence}`}>{d.confidence}</span>
                  </div>
                </div>
                {d.alreadySaved && onSelect ? (
                  <button
                    className={`btn btn-sm ${isActive ? 'btn-secondary' : 'btn-primary'}`}
                    disabled={isActive}
                    onClick={() => onSelect(d)}
                  >
                    {isActive ? 'Selected' : 'Select'}
                  </button>
                ) : (
                  <button className="btn btn-primary btn-sm" onClick={() => onAdd(d)}>
                    Use
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
