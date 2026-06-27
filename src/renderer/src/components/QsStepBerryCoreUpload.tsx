import { useEffect, useRef, useState, type ReactNode } from 'react'
import { DEVICE_PATHS, type BerryCoreUploadProgress, type DeviceProfile } from '@shared/types'
import { qsBerryCoreInstalledKey, qsBerryCoreUploadedKey } from '@shared/quick-start-flow'
import { Term49BerryCoreInstallGuide } from './Term49BerryCoreInstallGuide'

interface Props {
  device?: DeviceProfile
  devicePicker?: ReactNode
  downloadDone?: boolean
  term49Ready?: boolean
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

export function QsStepBerryCoreUpload({
  device,
  devicePicker,
  downloadDone,
  term49Ready = false,
  onDoneChange
}: Props) {
  const [busy, setBusy] = useState(false)
  const [uploaded, setUploaded] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [progress, setProgress] = useState<BerryCoreUploadProgress | null>(null)
  const [status, setStatus] = useState<{ ok: boolean | null; message: string }>({ ok: null, message: '' })
  const phoneStepsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const unsub = window.berrybridge.berrycore.onUploadProgress(setProgress)
    return unsub
  }, [])

  useEffect(() => {
    if (!uploaded && status.ok !== true) return
    phoneStepsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [uploaded, status.ok])

  useEffect(() => {
    if (!device?.id) {
      setUploaded(false)
      setConfirmed(false)
      onDoneChange?.(false)
      return
    }
    try {
      const wasUploaded = localStorage.getItem(qsBerryCoreUploadedKey(device.id)) === '1'
      const wasInstalled = localStorage.getItem(qsBerryCoreInstalledKey(device.id)) === '1'
      setUploaded(wasUploaded)
      setConfirmed(wasInstalled)
      onDoneChange?.(wasInstalled)
    } catch {
      setUploaded(false)
      setConfirmed(false)
      onDoneChange?.(false)
    }
  }, [device?.id, onDoneChange])

  const setInstalled = (done: boolean) => {
    setConfirmed(done)
    onDoneChange?.(done)
    if (!device?.id) return
    try {
      localStorage.setItem(qsBerryCoreInstalledKey(device.id), done ? '1' : '0')
    } catch {
      /* ignore */
    }
  }

  const upload = async () => {
    if (!device) return
    if (!downloadDone) {
      setStatus({ ok: false, message: 'Complete step 5 first — download BerryCore to this computer.' })
      return
    }
    if (!device.smbPassword) {
      setStatus({
        ok: false,
        message: 'Save your WiFi Storage password in step 3 first.'
      })
      return
    }
    setBusy(true)
    setProgress(null)
    setStatus({ ok: null, message: '' })
    try {
      const result = await window.berrybridge.berrycore.uploadToDevice(device.id)
      setStatus({ ok: result.ok, message: result.message })
      if (result.ok) {
        setUploaded(true)
        if (device.id) {
          try {
            localStorage.setItem(qsBerryCoreUploadedKey(device.id), '1')
          } catch {
            /* ignore */
          }
        }
      }
    } catch (e) {
      setStatus({ ok: false, message: String(e) })
    } finally {
      setBusy(false)
      setProgress(null)
    }
  }

  if (!device) {
    return <p className="field-hint">Complete step 2 first — add your BB10 device.</p>
  }

  if (!downloadDone) {
    return (
      <>
        {devicePicker}
        <p className="field-hint" style={{ color: 'var(--warning)' }}>
          Complete step 5 first — download BerryCore to this computer.
        </p>
      </>
    )
  }

  return (
    <>
      {devicePicker}
      {!term49Ready && (
        <p className="field-hint" style={{ color: 'var(--warning)', marginBottom: 12 }}>
          Term49 is needed to run the installer on your phone — complete step 4 or check{' '}
          <strong>Term49 is installed on my phone</strong> if you already have it.
        </p>
      )}
      <p className="panel-desc">
        Berry Bridge sends the release to <strong>{device.name}</strong> at{' '}
        <code className="code-inline">{DEVICE_PATHS.berrycore.transferDir}</code> and creates a
        small text file with the Term49 commands — same copy-and-paste flow as the SSH key step
        later. The zip is large; transfer usually takes 5–10 minutes over WiFi.
      </p>
      <div className="btn-row">
        <button
          type="button"
          className="btn btn-primary"
          disabled={busy || !device.smbPassword}
          onClick={upload}
        >
          {busy ? 'Sending to phone…' : `Send BerryCore to ${device.name}`}
        </button>
      </div>
      {!device.smbPassword && (
        <p className="field-hint" style={{ color: 'var(--warning)', marginTop: 10 }}>
          WiFi Storage password required — complete step 3 first.
        </p>
      )}
      {busy && progress && (
        <div className="scan-progress" style={{ marginTop: 12 }}>
          <div className="scan-progress-bar">
            <div
              className={`scan-progress-fill${progress.indeterminate ? ' smb-indeterminate' : ''}`}
              style={progress.indeterminate ? undefined : { width: `${progress.percent ?? 0}%` }}
            />
          </div>
          <span className="scan-progress-label">{progress.message}</span>
          {progress.fileCount != null && progress.fileIndex != null && (
            <span className="scan-progress-label" style={{ display: 'block', marginTop: 4 }}>
              File {progress.fileIndex} of {progress.fileCount}
              {!progress.indeterminate && progress.percent != null ? ` · ${progress.percent}%` : ''}
            </span>
          )}
        </div>
      )}
      {status.ok === false && <StepStatus ok={status.ok} message={status.message} />}
      {(uploaded || status.ok) && (
        <div ref={phoneStepsRef}>
          <Term49BerryCoreInstallGuide prominent uploadComplete />
          <label className="qs-setup-confirm install-phone-confirm" style={{ marginTop: 16 }}>
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setInstalled(e.target.checked)}
            />
            <span>I ran the installer in Term49</span>
          </label>
        </div>
      )}
    </>
  )
}
