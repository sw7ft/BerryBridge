import type { ReactNode } from 'react'

interface Props {
  title: string
  subtitle?: string
  action?: ReactNode
  children: ReactNode
  className?: string
  onClick?: () => void
}

export function BlendWidget({ title, subtitle, action, children, className = '', onClick }: Props) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      className={`blend-widget ${onClick ? 'blend-widget-clickable' : ''} ${className}`.trim()}
      onClick={onClick}
    >
      <header className="blend-widget-header">
        <div>
          <h3>{title}</h3>
          {subtitle && <span>{subtitle}</span>}
        </div>
        {action}
      </header>
      <div className="blend-widget-body">{children}</div>
    </Tag>
  )
}
