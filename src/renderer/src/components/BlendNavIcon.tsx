import type { ReactNode } from 'react'
import type { AppSection } from '@shared/types'

const PATHS: Record<AppSection, ReactNode> = {
  dashboard: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z" />
    </svg>
  ),
  quickstart: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M12 3 14.5 8.5 20 9l-4 3.5 1.5 5.5L12 15.5 6.5 18 8 12.5 4 9l5.5-.5L12 3Z" />
      <path d="M8 21h8" strokeLinecap="round" />
    </svg>
  ),
  devices: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <rect x="7" y="2" width="10" height="20" rx="2" />
      <path d="M11 18h2" />
    </svg>
  ),
  terminal: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <rect x="3" y="4" width="18" height="14" rx="1.5" />
      <path d="M7 9 9.5 11.5 7 14M12 14h5" />
    </svg>
  ),
  ssh: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M7 11V8a5 5 0 0 1 10 0v3" />
      <rect x="5" y="11" width="14" height="10" rx="2" />
    </svg>
  ),
  smb: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M12 3v12M8 7l4-4 4 4" />
      <path d="M4 14v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" />
    </svg>
  ),
  backup: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M4 7h16v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7Z" />
      <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M12 11v5M9.5 13.5 12 16l2.5-2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  apps: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M12 3 14.5 8.5 20 9l-4 3.5 1.5 5.5L12 15.5 6.5 18 8 12.5 4 9l5.5-.5L12 3Z" />
    </svg>
  ),
  store: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M4 7h16l-1.5 12H5.5L4 7Z" />
      <path d="M9 7V5a3 3 0 0 1 6 0v2" />
    </svg>
  ),
  files: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <rect x="5" y="4" width="14" height="16" rx="1.5" />
      <path d="M9 8h6M9 12h6M9 16h4" />
    </svg>
  ),
  learning: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M4 19V5a1 1 0 0 1 1.4-.9L12 7l6.6-2.9A1 1 0 0 1 20 5v14a1 1 0 0 1-1.4.9L12 17l-6.6 2.9A1 1 0 0 1 4 19Z" />
      <path d="M12 7v10" />
    </svg>
  ),
  news: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M6 4h12a1 1 0 0 1 1 1v15l-3-2-3 2-3-2-3 2-3-2V5a1 1 0 0 1 1-1Z" />
    </svg>
  ),
  qnx: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M8 8h8M8 12h5M8 16h6" strokeLinecap="round" />
      <circle cx="17" cy="7" r="2" fill="currentColor" stroke="none" />
    </svg>
  )
}

interface Props {
  section: AppSection
}

export function BlendNavIcon({ section }: Props) {
  return <span className="blend-nav-icon">{PATHS[section]}</span>
}
