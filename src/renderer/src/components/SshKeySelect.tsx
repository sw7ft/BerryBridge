import { useEffect, useState } from 'react'
import type { SshKeyInfo } from '@shared/types'

interface Props {
  value: string
  onChange: (path: string) => void
}

export function SshKeySelect({ value, onChange }: Props) {
  const [keys, setKeys] = useState<SshKeyInfo[]>([])
  const [custom, setCustom] = useState(false)

  useEffect(() => {
    window.berrybridge.ssh.listKeys().then((k) => {
      setKeys(k)
      // Auto-select first bb10 key if none set
      if (!value && k.length > 0) {
        const preferred =
          k.find((key) => key.path.includes('bb10') || key.path.includes('blackberry')) || k[0]
        onChange(preferred.path)
      }
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const isKnownKey = keys.some((k) => k.path === value)

  return (
    <div className="field">
      <label>SSH Identity Key (~/.ssh/)</label>
      {!custom && keys.length > 0 ? (
        <select
          value={isKnownKey ? value : ''}
          onChange={(e) => {
            if (e.target.value === '__custom__') {
              setCustom(true)
            } else {
              onChange(e.target.value)
            }
          }}
        >
          <option value="">— select a key —</option>
          {keys.map((k) => (
            <option key={k.path} value={k.path}>
              {k.path.replace(/^.*\/\.ssh\//, '')} — {k.fingerprint}
            </option>
          ))}
          <option value="__custom__">Custom path…</option>
        </select>
      ) : (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="~/.ssh/id_rsa_bb10"
        />
      )}
      {!custom && keys.length > 0 && (
        <button
          type="button"
          className="btn-link"
          style={{ marginTop: 6, fontSize: 12, color: 'var(--berry)' }}
          onClick={() => setCustom(true)}
        >
          Enter custom path
        </button>
      )}
      {value && keys.find((k) => k.path === value) && (
        <div className="mono" style={{ marginTop: 8, fontSize: 11 }}>
          {keys.find((k) => k.path === value)?.publicKey}
        </div>
      )}
    </div>
  )
}
