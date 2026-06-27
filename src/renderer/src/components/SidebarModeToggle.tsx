import type { UiMode } from '../navigation'

interface Props {
  mode: UiMode
  onChange: (mode: UiMode) => void
}

export function SidebarModeToggle({ mode, onChange }: Props) {
  return (
    <div className="blend-sidebar-mode">
      <span className="blend-sidebar-mode-label">Experience</span>
      <div className="blend-mode-toggle" role="group" aria-label="User experience mode">
        <button
          type="button"
          className={`blend-mode-btn ${mode === 'simple' ? 'active' : ''}`}
          onClick={() => onChange('simple')}
          aria-pressed={mode === 'simple'}
        >
          Simple
        </button>
        <button
          type="button"
          className={`blend-mode-btn ${mode === 'advanced' ? 'active' : ''}`}
          onClick={() => onChange('advanced')}
          aria-pressed={mode === 'advanced'}
        >
          Advanced
        </button>
      </div>
      <p className="blend-sidebar-mode-hint">
        {mode === 'simple'
          ? 'Essential tools for setup and daily use.'
          : 'Full toolset including SSH, storage, and device data.'}
      </p>
    </div>
  )
}
