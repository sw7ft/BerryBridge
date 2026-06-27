import berryIcon from '../assets/berry-icon.png'

interface Props {
  size?: 'sm' | 'lg'
  className?: string
}

export function BerryMark({ size = 'sm', className = '' }: Props) {
  return (
    <img
      src={berryIcon}
      alt=""
      aria-hidden="true"
      className={`berry-mark berry-mark-${size} ${className}`.trim()}
    />
  )
}
