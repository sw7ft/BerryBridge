import type { ReactNode } from 'react'

interface Props {
  title?: string
  children: ReactNode
  className?: string
  compact?: boolean
  id?: string
}

export function Panel({ title, children, className = '', compact = false, id }: Props) {
  return (
    <section id={id} className={`panel ${compact ? 'panel-compact' : ''} ${className}`.trim()}>
      {title && <h3 className="panel-title">{title}</h3>}
      {children}
    </section>
  )
}
