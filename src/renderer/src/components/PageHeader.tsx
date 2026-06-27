import type { ReactNode } from 'react'

interface Props {
  title: string
  subtitle?: string
  meta?: string
  actions?: ReactNode
}

export function PageHeader({ title, subtitle, meta, actions }: Props) {
  return (
    <header className="blend-page-header">
      <div className="blend-page-header-text">
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
        {meta && <p className="blend-page-meta">{meta}</p>}
      </div>
      {actions && <div className="blend-page-header-actions">{actions}</div>}
    </header>
  )
}
