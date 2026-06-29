import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { randomUUID } from '../utils/id'
import {
  SSH_DEFAULTS,
  type BerryCoreRelease,
  type BerryCoreUploadProgress,
  type DeviceProfile,
  type DiscoveredDevice,
  type SshKeyInfo
} from '@shared/types'
import { formatBytes } from '@shared/smb-utils'
import { pubKeyFileName } from '@shared/ssh-install-commands'
import {
  INSTALL_PHASES,
  type InstallPhaseId,
  readStoredInstallPhase,
  storeInstallPhase
} from '@shared/installation-flow'
import {
  QS_PHONE_SETUP_KEY,
  qsBerryCoreInstalledKey,
  qsBerryCoreUploadedKey,
  qsKeyTerm49DoneKey,
  qsTerm49InstalledKey
} from '@shared/quick-start-flow'
import { readStoredActiveDeviceId, storeActiveDeviceId } from '../utils/active-device'
import { DiscoveredDevicesPanel } from '../components/DiscoveredDevicesPanel'
import { PageHeader } from '../components/PageHeader'
import { Panel } from '../components/Panel'
import { QsStepTerm49Install } from '../components/QsStepTerm49Install'
import { Term49BerryCoreInstallGuide } from '../components/Term49BerryCoreInstallGuide'
import { Term49SshKeyInstallGuide } from '../components/Term49SshKeyInstallGuide'
import type { useDeviceScan } from '../hooks/useDeviceScan'

type ScanState = ReturnType<typeof useDeviceScan>

interface Props {
  devices: DeviceProfile[]
  scan: ScanState
  onRefresh: () => void
  onOpenTerminal: (deviceId: string) => void
  onShowDetailed: () => void
}

const emptyDevice = (): DeviceProfile => ({
  id: randomUUID(),
  name: '',
  host: '',
  sshPort: SSH_DEFAULTS.port,
  sshUser: SSH_DEFAULTS.user,
  identityFile: '',
  devModePassword: '',
  smbPassword: '',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
})

function deviceFromDiscovery(d: DiscoveredDevice): DeviceProfile {
  const base = d.hostname?.split('.')[0] || `bb10-${d.ip.split('.').pop()}`
  return {
    ...emptyDevice(),
    name: base.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase(),
    host: d.ip,
    sshPort: d.sshPort || SSH_DEFAULTS.port,
    sshUser: SSH_DEFAULTS.user
  }
}

function phaseIndex(id: InstallPhaseId): number {
  return INSTALL_PHASES.findIndex((p) => p.id === id)
}

function nextPhase(id: InstallPhaseId): InstallPhaseId | null {
  const i = phaseIndex(id)
  return i >= 0 && i < INSTALL_PHASES.length - 1 ? INSTALL_PHASES[i + 1].id : null
}

function prevPhase(id: InstallPhaseId): InstallPhaseId | null {
  const i = phaseIndex(id)
  return i > 0 ? INSTALL_PHASES[i - 1].id : null
}

export function InstallationWizard({
  devices,
  scan,
  onRefresh,
  onOpenTerminal,
  onShowDetailed
}: Props) {
  const [phase, setPhase] = useState<InstallPhaseId>(() => readStoredInstallPhase())
  const [selectedDeviceId, setSelectedDeviceId] = useState('')
  const [draft, setDraft] = useState<DeviceProfile>(() => emptyDevice())
  const [profileDraft, setProfileDraft] = useState<DeviceProfile | null>(null)
  const [showAddForm, setShowAddForm] = useState(true)

  const [phoneSetupDone, setPhoneSetupDone] = useState(() => {
    try {
      return localStorage.getItem(QS_PHONE_SETUP_KEY) === '1'
    } catch {
      return false
    }
  })
  const [term49Done, setTerm49Done] = useState(false)
  const [berryCoreUploaded, setBerryCoreUploaded] = useState(false)
  const [berryCoreViaAgent, setBerryCoreViaAgent] = useState(false)
  const [berryCoreConfirmed, setBerryCoreConfirmed] = useState(false)

  const [keys, setKeys] = useState<SshKeyInfo[]>([])
  const [selectedKey, setSelectedKey] = useState('')
  const [newKeyName, setNewKeyName] = useState('rsa_bb10')
  const [term49KeyDone, setTerm49KeyDone] = useState(false)
  const [keyInstalled, setKeyInstalled] = useState(false)
  const [sshKeyUploaded, setSshKeyUploaded] = useState(false)
  const [sshViaAgent, setSshViaAgent] = useState(false)
  const [sshOk, setSshOk] = useState<boolean | null>(null)

  const [status, setStatus] = useState('')
  const [statusOk, setStatusOk] = useState<boolean | null>(null)
  const [pipelineBusy, setPipelineBusy] = useState(false)
  const [berrycoreLatest, setBerrycoreLatest] = useState<BerryCoreRelease | null>(null)
  const [berrycoreReleaseLoading, setBerrycoreReleaseLoading] = useState(false)
  const [berrycoreCached, setBerrycoreCached] = useState<{ tag: string; name: string } | null>(
    null
  )
  const [berrycorePipelinePhase, setBerrycorePipelinePhase] = useState<
    'checking' | 'downloading' | 'uploading' | null
  >(null)
  const [uploadProgress, setUploadProgress] = useState<BerryCoreUploadProgress | null>(null)
  const phoneStepsRef = useRef<HTMLDivElement>(null)
  const sshStepsRef = useRef<HTMLDivElement>(null)

  const goToPhase = useCallback((id: InstallPhaseId) => {
    setPhase(id)
    storeInstallPhase(id)
    setStatus('')
    setStatusOk(null)
  }, [])

  useEffect(() => {
    const unsub = window.berrybridge.berrycore.onUploadProgress(setUploadProgress)
    return unsub
  }, [])

  useEffect(() => {
    if (phase !== 'berrycore') return
    let cancelled = false
    setBerrycoreReleaseLoading(true)
    Promise.all([
      window.berrybridge.berrycore.latest(),
      window.berrybridge.berrycore.getCached()
    ])
      .then(([latest, cached]) => {
        if (cancelled) return
        setBerrycoreLatest(latest)
        setBerrycoreCached(cached ? { tag: cached.tag, name: cached.name } : null)
      })
      .finally(() => {
        if (!cancelled) setBerrycoreReleaseLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [phase])

  useEffect(() => {
    if (phase !== 'berrycore' || (!statusOk && !berryCoreUploaded)) return
    phoneStepsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [phase, statusOk, berryCoreUploaded])

  useEffect(() => {
    if (phase !== 'ssh' || !sshKeyUploaded || sshOk) return
    sshStepsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [phase, sshKeyUploaded, sshOk])

  useEffect(() => {
    window.berrybridge.ssh.listKeys().then(setKeys)
  }, [])

  useEffect(() => {
    if (devices.length === 0) return
    if (selectedDeviceId && devices.some((d) => d.id === selectedDeviceId)) return
    setSelectedDeviceId(readStoredActiveDeviceId(devices))
  }, [devices, selectedDeviceId])

  const device = devices.find((d) => d.id === selectedDeviceId)

  useEffect(() => {
    if (device) {
      setProfileDraft({ ...device })
      if (devices.some((d) => d.id === device.id)) setShowAddForm(false)
    } else {
      setProfileDraft(null)
      setShowAddForm(true)
    }
  }, [device?.id, device?.updatedAt, devices.length]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!device?.id) {
      setTerm49Done(false)
      setBerryCoreUploaded(false)
      setBerryCoreConfirmed(false)
      setTerm49KeyDone(false)
      return
    }
    try {
      setTerm49Done(localStorage.getItem(qsTerm49InstalledKey(device.id)) === '1')
      setBerryCoreUploaded(localStorage.getItem(qsBerryCoreUploadedKey(device.id)) === '1')
      setBerryCoreConfirmed(localStorage.getItem(qsBerryCoreInstalledKey(device.id)) === '1')
      setTerm49KeyDone(localStorage.getItem(qsKeyTerm49DoneKey(device.id)) === '1')
    } catch {
      /* ignore */
    }
  }, [device?.id])

  useEffect(() => {
    if (!selectedKey && keys.length > 0) {
      const preferred =
        keys.find((k) => k.path.includes('bb10') || k.path.includes('blackberry')) || keys[0]
      setSelectedKey(preferred.path)
    }
  }, [keys, selectedKey])

  const phaseComplete = useMemo(
    () => ({
      phone: phoneSetupDone,
      device: Boolean(device?.host && device?.smbPassword && device?.devModePassword),
      term49: term49Done,
      berrycore: berryCoreConfirmed,
      ssh: sshOk === true
    }),
    [phoneSetupDone, device, term49Done, berryCoreConfirmed, sshOk]
  )

  const completedCount = INSTALL_PHASES.filter((p) => phaseComplete[p.id]).length
  const allDone = completedCount === INSTALL_PHASES.length

  const confirmPhoneSetup = (checked: boolean) => {
    setPhoneSetupDone(checked)
    try {
      localStorage.setItem(QS_PHONE_SETUP_KEY, checked ? '1' : '0')
    } catch {
      /* ignore */
    }
  }

  const saveNewDevice = async () => {
    if (!draft.name || !draft.host) {
      setStatus('Name and IP address are required.')
      setStatusOk(false)
      return
    }
    await window.berrybridge.devices.save(draft)
    setSelectedDeviceId(draft.id)
    storeActiveDeviceId(draft.id)
    setShowAddForm(false)
    setStatus(`Saved ${draft.name}. Add your passwords below.`)
    setStatusOk(true)
    onRefresh()
  }

  const savePasswords = async () => {
    if (!profileDraft?.name || !profileDraft?.host) return
    await window.berrybridge.devices.save(profileDraft)
    storeActiveDeviceId(profileDraft.id)
    setStatus(`Passwords saved for ${profileDraft.name}.`)
    setStatusOk(true)
    onRefresh()
  }

  const addDiscovered = (d: DiscoveredDevice) => {
    setDraft(deviceFromDiscovery(d))
    setShowAddForm(true)
    setStatus(`Found ${d.ip} — review the details and save.`)
    setStatusOk(null)
  }

  const selectDiscovered = (d: DiscoveredDevice) => {
    const existing = devices.find((dev) => dev.host === d.ip)
    if (existing) {
      setSelectedDeviceId(existing.id)
      storeActiveDeviceId(existing.id)
      setShowAddForm(false)
      setStatus(`Using ${existing.name} (${d.ip}).`)
      setStatusOk(true)
      return
    }
    addDiscovered(d)
  }

  const runBerryCorePipeline = async () => {
    if (!device) return
    setPipelineBusy(true)
    setStatusOk(null)
    setUploadProgress(null)
    setBerrycorePipelinePhase('checking')
    try {
      setStatus('Checking GitHub for the latest BerryCore release…')
      const latest = await window.berrybridge.berrycore.latest()
      if (latest) {
        setBerrycoreLatest(latest)
      }

      const releaseLabel = latest
        ? `${latest.name} (${latest.tag})`
        : 'latest BerryCore release'

      setBerrycorePipelinePhase('downloading')
      setStatus(`Ensuring ${releaseLabel} is downloaded…`)
      const dl = await window.berrybridge.berrycore.downloadLatest()
      if (!dl.ok) {
        setStatusOk(false)
        setStatus(dl.message)
        return
      }

      const cached = dl.cache ?? (await window.berrybridge.berrycore.getCached())
      if (cached) {
        setBerrycoreCached({ tag: cached.tag, name: cached.name })
      }
      if (!cached) {
        setStatusOk(false)
        setStatus('Download failed — try again.')
        return
      }

      setBerrycorePipelinePhase('uploading')
      setStatus(
        `Sending ${cached.name} (${cached.tag}) to ${device.name} — usually 5–10 minutes…`
      )
      const up = await window.berrybridge.berrycore.uploadToDevice(device.id)
      setStatusOk(up.ok)
      setStatus(up.message)
      if (up.ok && device.id) {
        setBerryCoreUploaded(true)
        setBerryCoreViaAgent(up.method === 'agent' && up.berrycoreInstalled === true)
        if (up.method === 'agent' && up.berrycoreInstalled) {
          setBerryCoreConfirmed(true)
          try {
            localStorage.setItem(qsBerryCoreInstalledKey(device.id), '1')
          } catch {
            /* ignore */
          }
        }
        try {
          localStorage.setItem(qsBerryCoreUploadedKey(device.id), '1')
        } catch {
          /* ignore */
        }
      }
    } catch (e) {
      setStatusOk(false)
      setStatus(String(e))
    } finally {
      setPipelineBusy(false)
      setBerrycorePipelinePhase(null)
      setUploadProgress(null)
    }
  }

  const runSshPipeline = async () => {
    if (!device) return
    setPipelineBusy(true)
    setStatusOk(null)
    try {
      let keyPath = selectedKey || device.identityFile
      if (!keyPath) {
        setStatus('Generating SSH key…')
        const key = await window.berrybridge.ssh.generateKey(newKeyName)
        keyPath = key.path
        setSelectedKey(key.path)
        const list = await window.berrybridge.ssh.listKeys()
        setKeys(list)
      }

      setStatus('Uploading public key via WiFi Storage…')
      const result = await window.berrybridge.ssh.provisionKey(device, keyPath)
      if (result.method === 'error') {
        setStatusOk(false)
        setStatus(result.message)
        return
      }

      setSshKeyUploaded(true)
      setSshViaAgent(result.method === 'agent')
      if (result.method === 'agent' || result.method === 'ssh' || result.method === 'smb+ssh') {
        setKeyInstalled(true)
        setTerm49KeyDone(result.method === 'agent')
      } else {
        setKeyInstalled(false)
        setTerm49KeyDone(false)
      }

      const saved = { ...device, identityFile: keyPath }
      await window.berrybridge.devices.save(saved)
      onRefresh()
      await window.berrybridge.ssh.writeConfigEntry(saved)

      if (result.method === 'agent' && 'sshOk' in result && typeof result.sshOk === 'boolean') {
        setSshOk(result.sshOk)
        setStatusOk(result.sshOk)
        setStatus(result.message)
        if (result.sshOk) setTerm49KeyDone(true)
        return
      }

      setStatus('Testing SSH connection…')
      const test = await window.berrybridge.ssh.testConnection(saved)
      setSshOk(test.ok === true)
      setStatusOk(test.ok === true)
      setStatus(test.message)
      if (test.ok) setTerm49KeyDone(true)
    } catch (e) {
      setStatusOk(false)
      setStatus(String(e))
    } finally {
      setPipelineBusy(false)
    }
  }

  const testSshOnly = async () => {
    if (!device) return
    const keyPath = selectedKey || device.identityFile
    if (!keyPath) {
      setStatusOk(false)
      setStatus('Generate or select an SSH key first.')
      return
    }
    setPipelineBusy(true)
    setStatusOk(null)
    setStatus('Testing SSH connection…')
    try {
      const saved = { ...device, identityFile: keyPath }
      const test = await window.berrybridge.ssh.testConnection(saved)
      setSshOk(test.ok === true)
      setStatusOk(test.ok === true)
      setStatus(test.message)
      if (test.ok) setTerm49KeyDone(true)
    } catch (e) {
      setStatusOk(false)
      setStatus(String(e))
    } finally {
      setPipelineBusy(false)
    }
  }

  const confirmBerryCore = (done: boolean) => {
    setBerryCoreConfirmed(done)
    if (!device?.id) return
    try {
      localStorage.setItem(qsBerryCoreInstalledKey(device.id), done ? '1' : '0')
    } catch {
      /* ignore */
    }
  }

  const confirmTerm49Key = (done: boolean) => {
    setTerm49KeyDone(done)
    if (!device?.id) return
    try {
      localStorage.setItem(qsKeyTerm49DoneKey(device.id), done ? '1' : '0')
    } catch {
      /* ignore */
    }
  }

  const devicePicker =
    devices.length > 1 ? (
      <div className="field install-device-picker">
        <label>Active device</label>
        <select
          className="select-compact"
          value={selectedDeviceId}
          onChange={(e) => {
            setSelectedDeviceId(e.target.value)
            storeActiveDeviceId(e.target.value)
          }}
        >
          {devices.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name} ({d.host})
            </option>
          ))}
        </select>
      </div>
    ) : null

  const statusAlert =
    status ? (
      <div
        className={`alert ${statusOk === false ? 'alert-warn' : 'alert-info'}`}
        style={{ marginTop: 12 }}
      >
        <pre className="alert-pre">{status}</pre>
      </div>
    ) : null

  const renderPhaseContent = () => {
    switch (phase) {
      case 'phone':
        return (
          <>
            <p className="panel-desc">
              Do this on the phone first. Both settings must be on before Berry Bridge can install
              apps or transfer files.
            </p>
            <div className="install-checklist">
              <div className="install-checklist-item">
                <strong>Development Mode</strong>
                <span>
                  Settings → Security and Privacy → Development Mode. Turn it on and set a password.
                </span>
              </div>
              <div className="install-checklist-item">
                <strong>WiFi Storage</strong>
                <span>
                  Settings → Storage and Access → WiFi Storage. Turn it on and note the password
                  and network username.
                </span>
              </div>
            </div>
            <label className="qs-setup-confirm">
              <input
                type="checkbox"
                checked={phoneSetupDone}
                onChange={(e) => confirmPhoneSetup(e.target.checked)}
              />
              <span>Development Mode and WiFi Storage are enabled</span>
            </label>
          </>
        )

      case 'device':
        return (
          <>
            <p className="panel-desc">
              Scan for your phone on the same Wi‑Fi network, save it, then enter the passwords from
              step 1.
            </p>
            {devicePicker}
            <DiscoveredDevicesPanel
              discovered={scan.discovered}
              scanning={scan.scanning}
              progress={scan.progress}
              subnets={scan.subnets}
              activeHost={device?.host}
              onAdd={addDiscovered}
              onSelect={selectDiscovered}
              onRescan={() => scan.startScan()}
              onStop={scan.stopScan}
            />
            {(!device || showAddForm) && (
              <div className="install-device-form">
                <h4 className="berrycore-guide-heading">Device details</h4>
                <div className="grid-2">
                  <div className="field">
                    <label>Name</label>
                    <input
                      value={draft.name}
                      onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                      placeholder="passport"
                    />
                  </div>
                  <div className="field">
                    <label>IP address</label>
                    <input
                      value={draft.host}
                      onChange={(e) => setDraft({ ...draft, host: e.target.value })}
                      placeholder="192.168.1.108"
                    />
                  </div>
                </div>
                <div className="btn-row">
                  <button type="button" className="btn btn-primary btn-sm" onClick={saveNewDevice}>
                    Save device
                  </button>
                </div>
              </div>
            )}
            {device && profileDraft && (
              <div className="install-password-block">
                <h4 className="berrycore-guide-heading">
                  Passwords for {device.name}
                </h4>
                <div className="grid-2">
                  <div className="field">
                    <label>WiFi Storage username</label>
                    <input
                      value={profileDraft.smbUser || ''}
                      onChange={(e) =>
                        setProfileDraft({ ...profileDraft, smbUser: e.target.value })
                      }
                      placeholder="blackberry"
                    />
                  </div>
                  <div className="field">
                    <label>WiFi Storage password</label>
                    <input
                      type="password"
                      value={profileDraft.smbPassword || ''}
                      onChange={(e) =>
                        setProfileDraft({ ...profileDraft, smbPassword: e.target.value })
                      }
                    />
                  </div>
                  <div className="field">
                    <label>Development Mode password</label>
                    <input
                      type="password"
                      value={profileDraft.devModePassword || ''}
                      onChange={(e) =>
                        setProfileDraft({ ...profileDraft, devModePassword: e.target.value })
                      }
                    />
                  </div>
                </div>
                <div className="btn-row">
                  <button type="button" className="btn btn-primary" onClick={savePasswords}>
                    Save passwords
                  </button>
                </div>
              </div>
            )}
            {statusAlert}
          </>
        )

      case 'term49':
        return (
          <>
            {devicePicker}
            <QsStepTerm49Install
              device={device}
              onDoneChange={setTerm49Done}
            />
          </>
        )

      case 'berrycore': {
        const berrycoreZip = berrycoreLatest?.assets.find((a) => a.name === 'berrycore.zip')
        const pipelineBusyLabel =
          berrycorePipelinePhase === 'checking'
            ? 'Checking…'
            : berrycorePipelinePhase === 'downloading'
              ? 'Downloading…'
              : berrycorePipelinePhase === 'uploading'
                ? 'Sending to phone…'
                : 'Working…'
        const pipelineProgressIndeterminate =
          berrycorePipelinePhase === 'checking' ||
          berrycorePipelinePhase === 'downloading' ||
          uploadProgress?.phase === 'agent-polling' ||
          uploadProgress?.phase === 'agent-running' ||
          uploadProgress?.indeterminate
        const pipelineProgressLabel =
          uploadProgress?.message ??
          (berrycorePipelinePhase === 'checking'
            ? 'Checking GitHub for the latest BerryCore release…'
            : berrycorePipelinePhase === 'downloading'
              ? berrycoreLatest
                ? `Ensuring ${berrycoreLatest.name} (${berrycoreLatest.tag}) is downloaded…`
                : 'Ensuring the latest BerryCore release is downloaded…'
              : status)
        return (
          <>
            {devicePicker}
            {!device ? (
              <p className="field-hint">Complete Connect first.</p>
            ) : (
              <>
                <p className="panel-desc">
                  Berry Bridge downloads the latest release to this Mac, then sends it to your
                  phone. Afterward, paste the commands into Term49. The zip is large — allow 5–10
                  minutes.
                </p>
                {berrycoreReleaseLoading ? (
                  <p className="field-hint">Checking latest release…</p>
                ) : berrycoreLatest ? (
                  <div className="install-berrycore-release">
                    <p className="field-hint qs-step-ready" style={{ marginBottom: 0 }}>
                      Latest release · <strong>{berrycoreLatest.name}</strong> ({berrycoreLatest.tag})
                      {berrycoreZip ? ` · berrycore.zip ${formatBytes(berrycoreZip.size)}` : ''}
                      {berrycoreCached?.tag === berrycoreLatest.tag ? ' · ✓ on this Mac' : ''}
                    </p>
                    {berrycoreCached && berrycoreCached.tag !== berrycoreLatest.tag && (
                      <p className="field-hint" style={{ color: 'var(--warning)', marginTop: 8 }}>
                        Cached {berrycoreCached.name} ({berrycoreCached.tag}) — a newer release is
                        available.
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="field-hint">Could not load the latest release from GitHub.</p>
                )}
                <div className="btn-row">
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={pipelineBusy || !device.smbPassword || !term49Done}
                    onClick={runBerryCorePipeline}
                  >
                    {pipelineBusy ? pipelineBusyLabel : 'Download & send to phone'}
                  </button>
                </div>
                {!term49Done && (
                  <p className="field-hint" style={{ color: 'var(--warning)', marginTop: 10 }}>
                    Install Term49 first.
                  </p>
                )}
                {pipelineBusy && (
                  <div className="scan-progress" style={{ marginTop: 12 }}>
                    <div className="scan-progress-bar">
                      <div
                        className={`scan-progress-fill${pipelineProgressIndeterminate ? ' smb-indeterminate' : ''}`}
                        style={
                          pipelineProgressIndeterminate
                            ? undefined
                            : { width: `${uploadProgress?.percent ?? 0}%` }
                        }
                      />
                    </div>
                    <span className="scan-progress-label">{pipelineProgressLabel}</span>
                  </div>
                )}
                {statusOk === false && statusAlert}
                {(statusOk || berryCoreUploaded) && !berryCoreViaAgent && (
                  <div ref={phoneStepsRef}>
                    <Term49BerryCoreInstallGuide prominent uploadComplete />
                    <div className="btn-row" style={{ marginTop: 12 }}>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        disabled={pipelineBusy || !device}
                        onClick={async () => {
                          if (!device) return
                          setPipelineBusy(true)
                          try {
                            const probe = await window.berrybridge.agent.probe(device.id)
                            if (probe.status?.berrycore?.installed) {
                              setBerryCoreViaAgent(probe.ready)
                              confirmBerryCore(true)
                              setStatusOk(true)
                              setStatus(
                                probe.ready
                                  ? `Agent v${probe.status.agent?.version} reports BerryCore installed.`
                                  : 'BerryCore installed — agent will be available after install.sh completes.'
                              )
                            } else {
                              setStatusOk(false)
                              setStatus(
                                probe.ready
                                  ? 'Agent is running but BerryCore is not installed yet.'
                                  : 'Agent not detected — run install.sh in Term49 first.'
                              )
                            }
                          } finally {
                            setPipelineBusy(false)
                          }
                        }}
                      >
                        Check agent status
                      </button>
                    </div>
                    <label className="qs-setup-confirm install-phone-confirm" style={{ marginTop: 16 }}>
                      <input
                        type="checkbox"
                        checked={berryCoreConfirmed}
                        onChange={(e) => confirmBerryCore(e.target.checked)}
                      />
                      <span>I ran the installer in Term49</span>
                    </label>
                  </div>
                )}
                {(statusOk || berryCoreUploaded) && berryCoreViaAgent && (
                  <div className="alert alert-ok" style={{ marginTop: 12 }}>
                    BerryCore was installed by the Berry Bridge agent — no Term49 paste needed.
                  </div>
                )}
              </>
            )}
          </>
        )
      }

      case 'ssh':
        return (
          <>
            {devicePicker}
            {!device ? (
              <p className="field-hint">Complete Connect first.</p>
            ) : (
              <>
                <p className="panel-desc">
                  Berry Bridge uploads your key over WiFi Storage. When the Berry Bridge agent is
                  installed (via BerryCore install.sh), SSH setup runs automatically — otherwise use
                  the Term49 script fallback.
                </p>
                <div className="btn-row">
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={pipelineBusy || !device.smbPassword}
                    onClick={runSshPipeline}
                  >
                    {pipelineBusy ? 'Working…' : 'Upload key & test SSH'}
                  </button>
                  {sshKeyUploaded && (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      disabled={pipelineBusy}
                      onClick={testSshOnly}
                    >
                      Test SSH
                    </button>
                  )}
                  {sshOk && (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => onOpenTerminal(device.id)}
                    >
                      Open Terminal
                    </button>
                  )}
                </div>
                {statusOk === false && statusAlert}
                {sshKeyUploaded && !sshOk && !sshViaAgent && (
                  <div ref={sshStepsRef}>
                    <Term49SshKeyInstallGuide
                      pubFile={pubKeyFileName(selectedKey || newKeyName)}
                      prominent
                      uploadComplete
                      showCommands
                    />
                    <label className="qs-setup-confirm install-phone-confirm" style={{ marginTop: 16 }}>
                      <input
                        type="checkbox"
                        checked={term49KeyDone}
                        onChange={(e) => confirmTerm49Key(e.target.checked)}
                      />
                      <span>I ran every command in term49-ssh-key-install.txt in Term49</span>
                    </label>
                  </div>
                )}
                {sshOk && (
                  <p className="field-hint qs-step-ready" style={{ marginTop: 12 }}>
                    ✓ SSH is working. You are all set — open Terminal from the sidebar anytime.
                  </p>
                )}
              </>
            )}
          </>
        )
    }
  }

  const canContinue =
    phase === 'phone'
      ? phoneSetupDone
      : phase === 'device'
        ? phaseComplete.device
        : phase === 'term49'
          ? term49Done
          : phase === 'berrycore'
            ? berryCoreConfirmed
            : true

  return (
    <>
      <PageHeader
        title="Install BerryCore"
        subtitle="Five steps from a stock BB10 to BerryCore and SSH."
      />

      {allDone && (
        <div className="alert alert-info install-complete-banner">
          <strong>All done.</strong> BerryCore is installed and SSH is ready.
        </div>
      )}

      <nav className="install-stepper" aria-label="Installation progress">
        {INSTALL_PHASES.map((p, i) => {
          const done = phaseComplete[p.id]
          const active = p.id === phase
          const reachable = i === 0 || INSTALL_PHASES.slice(0, i).every((prev) => phaseComplete[prev.id])
          return (
            <button
              key={p.id}
              type="button"
              className={`install-stepper-item ${active ? 'is-active' : ''} ${done ? 'is-done' : ''}`}
              disabled={!reachable && !done && !active}
              onClick={() => reachable || done ? goToPhase(p.id) : undefined}
              title={p.summary}
            >
              <span className="install-stepper-num">{done ? '✓' : i + 1}</span>
              <span className="install-stepper-label">{p.title}</span>
            </button>
          )
        })}
      </nav>

      <div className="install-progress-meta">
        <span>
          {completedCount} of {INSTALL_PHASES.length} complete
        </span>
        <button type="button" className="install-detailed-link" onClick={onShowDetailed}>
          Full walkthrough →
        </button>
      </div>

      <Panel className="install-phase-panel">
        <div className="install-phase-head">
          <h2 className="install-phase-title">
            {INSTALL_PHASES.find((p) => p.id === phase)?.title}
          </h2>
          <p className="install-phase-summary">
            {INSTALL_PHASES.find((p) => p.id === phase)?.summary}
          </p>
        </div>
        <div className="install-phase-body">{renderPhaseContent()}</div>
        <div className="install-phase-nav">
          <button
            type="button"
            className="btn btn-secondary"
            disabled={!prevPhase(phase)}
            onClick={() => {
              const prev = prevPhase(phase)
              if (prev) goToPhase(prev)
            }}
          >
            Back
          </button>
          {nextPhase(phase) ? (
            <button
              type="button"
              className="btn btn-primary"
              disabled={!canContinue}
              onClick={() => {
                const next = nextPhase(phase)
                if (next) goToPhase(next)
              }}
            >
              Continue
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-primary"
              disabled={!sshOk}
              onClick={() => device && onOpenTerminal(device.id)}
            >
              Open Terminal
            </button>
          )}
        </div>
      </Panel>
    </>
  )
}
