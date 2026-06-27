import { useEffect, useState, type ReactNode } from 'react'
import type { DeviceProfile } from '@shared/types'
import { QS_TERM49_PACKAGE_ID, qsTerm49InstalledKey } from '@shared/quick-start-flow'

interface Props {
  device?: DeviceProfile
  devicePicker?: ReactNode
  onDoneChange?: (done: boolean) => void
}

function StepStatus({ ok, message }: { ok?: boolean | null; message: string }) {
  if (!message) return null
  return (
    <div className={`alert ${ok === false ? 'alert-warn' : 'alert-info'}`} style={{ marginTop: 12 }}>
      <pre className="alert-pre">{message}</pre>
    </div>
  )
}

export function QsStepTerm49Install({ device, devicePicker, onDoneChange }: Props) {
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<{ ok: boolean | null; message: string }>({ ok: null, message: '' })
  const [confirmed, setConfirmed] = useState(false)

  useEffect(() => {
    if (!device?.id) {
      setConfirmed(false)
      onDoneChange?.(false)
      return
    }
    try {
      const saved = localStorage.getItem(qsTerm49InstalledKey(device.id)) === '1'
      setConfirmed(saved)
      onDoneChange?.(saved)
    } catch {
      setConfirmed(false)
      onDoneChange?.(false)
    }
  }, [device?.id, onDoneChange])

  const setDone = (done: boolean) => {
    setConfirmed(done)
    onDoneChange?.(done)
    if (!device?.id) return
    try {
      localStorage.setItem(qsTerm49InstalledKey(device.id), done ? '1' : '0')
    } catch {
      /* ignore */
    }
  }

  const install = async () => {
    if (!device) return
    if (!device.devModePassword) {
      setStatus({
        ok: false,
        message: 'Save your Development Mode password in step 3 first.'
      })
      return
    }
    setBusy(true)
    setStatus({
      ok: null,
      message:
        'Installing Term49 on your phone… A progress window may open. This can take 1–3 minutes.'
    })
    try {
      const result = await window.berrybridge.store.install(device.id, QS_TERM49_PACKAGE_ID)
      setStatus({ ok: result.ok, message: result.message })
      if (result.ok) setDone(true)
    } catch (e) {
      setStatus({ ok: false, message: String(e) })
    } finally {
      setBusy(false)
    }
  }

  if (!device) {
    return <p className="field-hint">Complete step 2 first — add your BB10 device.</p>
  }

  if (!device.devModePassword) {
    return (
      <>
        {devicePicker}
        <p className="field-hint" style={{ color: 'var(--warning)' }}>
          Save your Development Mode password in step 3 first — Berry Bridge needs it to install
          Term49 on your phone.
        </p>
      </>
    )
  }

  return (
    <>
      {devicePicker}
      <p className="panel-desc">
        Installs Term49 on <strong>{device.name}</strong> — no App Store required.
      </p>
      <div className="btn-row">
        <button type="button" className="btn btn-primary" disabled={busy} onClick={install}>
          {busy ? 'Installing Term49…' : `Install Term49 on ${device.name}`}
        </button>
      </div>
      <StepStatus ok={status.ok} message={status.message} />
      <label className="qs-setup-confirm" style={{ marginTop: 16 }}>
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setDone(e.target.checked)}
        />
        <span>Term49 is installed</span>
      </label>
      <p className="field-hint" style={{ marginTop: 8 }}>
        Check after the install finishes, or if Term49 was already on the device.
      </p>
    </>
  )
}
