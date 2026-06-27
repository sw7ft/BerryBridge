import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { randomUUID } from '../utils/id'
import {
  DEVICE_PATHS,
  SSH_DEFAULTS,
  type AppSection,
  type DeviceProfile,
  type DiscoveredDevice,
  type SshKeyInfo
} from '@shared/types'
import { pubKeyFileName } from '@shared/ssh-install-commands'
import { QUICK_START_FLOW, QS_PHONE_SETUP_KEY, qsKeyTerm49DoneKey, qsTerm49InstalledKey } from '@shared/quick-start-flow'
import { readStoredActiveDeviceId, storeActiveDeviceId } from '../utils/active-device'
import { Term49SshKeyInstallGuide } from '../components/Term49SshKeyInstallGuide'
import { QsStepTerm49Install } from '../components/QsStepTerm49Install'
import { QsStepBerryCoreDownload } from '../components/QsStepBerryCoreDownload'
import { QsStepBerryCoreUpload } from '../components/QsStepBerryCoreUpload'
import { DiscoveredDevicesPanel } from '../components/DiscoveredDevicesPanel'
import { QsDeviceLine } from '../components/QsDeviceLine'
import { PageHeader } from '../components/PageHeader'
import { Panel } from '../components/Panel'
import { SshKeySelect } from '../components/SshKeySelect'
import type { useDeviceScan } from '../hooks/useDeviceScan'

type ScanState = ReturnType<typeof useDeviceScan>

interface Props {
  devices: DeviceProfile[]
  scan: ScanState
  onRefresh: () => void
  onOpenTerminal: (deviceId: string) => void
  onNavigate: (section: AppSection) => void
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

function StepPanel({
  step,
  title,
  done,
  anchorId,
  children
}: {
  step: number
  title: string
  done: boolean
  anchorId?: string
  children: ReactNode
}) {
  return (
    <Panel className={`qs-step ${done ? 'qs-step-done' : ''}`} id={anchorId}>
      <div className="qs-step-head">
        <span className="qs-step-num">{done ? '✓' : step}</span>
        <h3 className="qs-step-title">{title}</h3>
        {done && <span className="qs-step-badge">Done</span>}
      </div>
      <div className="qs-step-body">{children}</div>
    </Panel>
  )
}

export function QuickStartPage({ devices, scan, onRefresh, onOpenTerminal, onNavigate }: Props) {
  const [selectedDeviceId, setSelectedDeviceId] = useState('')
  const [draft, setDraft] = useState<DeviceProfile>(() => emptyDevice())
  const [profileDraft, setProfileDraft] = useState<DeviceProfile | null>(null)
  const [keys, setKeys] = useState<SshKeyInfo[]>([])
  const [selectedKey, setSelectedKey] = useState('')
  const [newKeyName, setNewKeyName] = useState('rsa_bb10')
  const [message, setMessage] = useState('')
  const [configPreview, setConfigPreview] = useState('')
  const [provisioning, setProvisioning] = useState(false)
  const [testing, setTesting] = useState(false)
  const [sshOk, setSshOk] = useState<boolean | null>(null)
  const [keyInstalled, setKeyInstalled] = useState(false)
  const [term49KeyDone, setTerm49KeyDone] = useState(false)
  const [term49Done, setTerm49Done] = useState(false)
  const [berryCoreDownloadDone, setBerryCoreDownloadDone] = useState(false)
  const [berryCoreInstallDone, setBerryCoreInstallDone] = useState(false)
  const [showAddDeviceForm, setShowAddDeviceForm] = useState(true)
  const [phoneSetupDone, setPhoneSetupDone] = useState(() => {
    try {
      return localStorage.getItem(QS_PHONE_SETUP_KEY) === '1'
    } catch {
      return false
    }
  })

  const loadKeys = () => window.berrybridge.ssh.listKeys().then(setKeys)

  useEffect(() => {
    loadKeys()
  }, [])

  useEffect(() => {
    if (devices.length === 0) return
    if (selectedDeviceId && devices.some((d) => d.id === selectedDeviceId)) return
    setSelectedDeviceId(readStoredActiveDeviceId(devices))
  }, [devices, selectedDeviceId])

  const persistActiveDevice = storeActiveDeviceId

  const device = devices.find((d) => d.id === selectedDeviceId)

  useEffect(() => {
    if (!device?.id) {
      setTerm49Done(false)
      return
    }
    try {
      setTerm49Done(localStorage.getItem(qsTerm49InstalledKey(device.id)) === '1')
    } catch {
      setTerm49Done(false)
    }
  }, [device?.id])

  useEffect(() => {
    window.berrybridge.berrycore.getCached().then((info) => {
      if (info) setBerryCoreDownloadDone(true)
    })
  }, [])

  useEffect(() => {
    if (device) {
      setProfileDraft({ ...device })
      if (devices.some((d) => d.id === device.id)) {
        setShowAddDeviceForm(false)
      }
    } else {
      setProfileDraft(null)
      setShowAddDeviceForm(true)
    }
  }, [device?.id, device?.updatedAt, devices.length]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!selectedKey && keys.length > 0) {
      const preferred =
        keys.find((k) => k.path.includes('bb10') || k.path.includes('blackberry')) || keys[0]
      setSelectedKey(preferred.path)
    }
  }, [keys, selectedKey])

  useEffect(() => {
    if (!device?.id) {
      setTerm49KeyDone(false)
      return
    }
    try {
      setTerm49KeyDone(localStorage.getItem(qsKeyTerm49DoneKey(device.id)) === '1')
    } catch {
      setTerm49KeyDone(false)
    }
  }, [device?.id])

  const stepDone = useMemo(
    () => ({
      phoneSetup: phoneSetupDone,
      device: Boolean(device?.name && device?.host),
      storage: Boolean(device?.smbPassword && device?.devModePassword),
      keyGenerated: keys.length > 0,
      keyInstalled: keyInstalled || term49KeyDone || sshOk === true,
      profile: Boolean(device?.identityFile),
      tested: sshOk === true
    }),
    [device, keys.length, keyInstalled, phoneSetupDone, sshOk, term49KeyDone]
  )

  const confirmPhoneSetup = (checked: boolean) => {
    setPhoneSetupDone(checked)
    try {
      localStorage.setItem(QS_PHONE_SETUP_KEY, checked ? '1' : '0')
    } catch {
      /* ignore */
    }
  }

  const confirmTerm49KeyInstall = (checked: boolean) => {
    setTerm49KeyDone(checked)
    if (!device?.id) return
    try {
      localStorage.setItem(qsKeyTerm49DoneKey(device.id), checked ? '1' : '0')
    } catch {
      /* ignore */
    }
  }

  const pubFile = pubKeyFileName(selectedKey || newKeyName)

  const saveNewDevice = async () => {
    if (!draft.name || !draft.host) {
      setMessage('Name and IP address are required.')
      return
    }
    await window.berrybridge.devices.save(draft)
    setSelectedDeviceId(draft.id)
    persistActiveDevice(draft.id)
    setDraft(emptyDevice())
    setShowAddDeviceForm(false)
    setMessage(
      `Saved ${draft.name} (${draft.host}). Continue to step 3 — enter the WiFi Storage and Development Mode passwords from step 1.`
    )
    onRefresh()
    requestAnimationFrame(() => {
      document.getElementById('qs-step-3')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  const saveProfile = async () => {
    if (!profileDraft?.name || !profileDraft?.host) return
    await window.berrybridge.devices.save(profileDraft)
    persistActiveDevice(profileDraft.id)
    setMessage(`Passwords saved for ${profileDraft.name} (${profileDraft.host}).`)
    onRefresh()
  }

  const addDiscovered = (d: DiscoveredDevice) => {
    setDraft(deviceFromDiscovery(d))
    setShowAddDeviceForm(true)
    setMessage(`Pre-filled from scan: ${d.ip} — review name and click Save device.`)
  }

  const selectDiscovered = (d: DiscoveredDevice) => {
    const existing = devices.find((dev) => dev.host === d.ip)
    if (existing) {
      setSelectedDeviceId(existing.id)
      persistActiveDevice(existing.id)
      setShowAddDeviceForm(false)
      setMessage(`Selected ${existing.name} (${d.ip}) for Quick Start.`)
      return
    }
    addDiscovered(d)
  }

  const generate = async () => {
    try {
      const key = await window.berrybridge.ssh.generateKey(newKeyName)
      setMessage(`Generated ${key.path}`)
      await loadKeys()
      setSelectedKey(key.path)
    } catch (e) {
      setMessage(String(e))
    }
  }

  const provision = async () => {
    if (!device || !selectedKey) return
    if (!device.smbPassword) {
      setMessage('Save the WiFi Storage password in step 3 first.')
      return
    }
    setProvisioning(true)
    setMessage('Uploading public key via WiFi Storage…')
    try {
      const result = await window.berrybridge.ssh.provisionKey(device, selectedKey)
      setMessage(`[${result.method}] ${result.message}`)
      if (result.method === 'ssh' || result.method === 'smb+ssh') {
        setKeyInstalled(true)
        confirmTerm49KeyInstall(true)
      } else {
        setMessage(
          `[${result.method}] ${result.message}\n\nFollow the Term49 steps in step 8, then continue to step 10 to test SSH.`
        )
      }
    } catch (e) {
      setMessage(String(e))
    } finally {
      setProvisioning(false)
    }
  }

  const writeConfig = async () => {
    if (!profileDraft) return
    const saved = { ...profileDraft, identityFile: profileDraft.identityFile || selectedKey }
    if (!saved.identityFile && selectedKey) {
      await window.berrybridge.devices.save(saved)
      onRefresh()
    }
    const alias = await window.berrybridge.ssh.writeConfigEntry(saved)
    setConfigPreview(
      `Host ${alias}\n  HostName ${saved.host}\n  User ${saved.sshUser}\n  Port ${saved.sshPort}\n  IdentityFile ${saved.identityFile || selectedKey}\n  PubkeyAcceptedAlgorithms +ssh-rsa\n  HostKeyAlgorithms +ssh-rsa\n  KexAlgorithms +diffie-hellman-group1-sha1`
    )
    setMessage(`Wrote ~/.ssh/config entry for Host ${alias}`)
  }

  const testSsh = async () => {
    if (!device) return
    setTesting(true)
    setMessage('Testing SSH…')
    try {
      const result = await window.berrybridge.ssh.testConnection(device)
      setMessage(result.message)
      setSshOk(result.ok === true)
    } finally {
      setTesting(false)
    }
  }

  const linkKeyAndSave = async () => {
    if (!profileDraft) return
    const next = { ...profileDraft, identityFile: profileDraft.identityFile || selectedKey }
    await window.berrybridge.devices.save(next)
    setMessage('SSH identity key linked to device profile.')
    onRefresh()
  }

  const workingDevicePicker =
    devices.length > 0 ? (
      <div className="field qs-device-picker-inline">
        <label>Which device?</label>
        <select
          className="select-compact"
          value={selectedDeviceId}
          onChange={(e) => {
            setSelectedDeviceId(e.target.value)
            persistActiveDevice(e.target.value)
          }}
        >
          {devices.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name} ({d.host})
              {d.smbPassword && d.devModePassword ? ' · passwords saved' : ''}
            </option>
          ))}
        </select>
      </div>
    ) : null

  return (
    <>
      <PageHeader
        title="Quick start"
        subtitle="Follow the steps in order: phone setup → find device → passwords → Term49 → BerryCore → SSH."
      />

      {message && (
        <div className={`alert ${sshOk === false && message.includes('fail') ? 'alert-warn' : 'alert-info'}`}>
          <pre className="alert-pre">{message}</pre>
        </div>
      )}

      <Panel title="Overview" className="qs-roadmap">
        <p className="panel-desc">
          Start on the <strong>BB10 itself</strong> — enable Development Mode and WiFi Storage before
          anything in Berry Bridge. Both are required to sideload Term49, transfer files, and install
          BerryCore.
        </p>
        <ol className="qs-roadmap-list">
          {QUICK_START_FLOW.map((step, i) => (
            <li key={step}>
              <span className="qs-roadmap-num">{i + 1}</span>
              {step}
            </li>
          ))}
        </ol>
      </Panel>

      <StepPanel step={1} title="Development Mode & WiFi Storage" done={stepDone.phoneSetup}>
        <p className="panel-desc">
          Do this on your BlackBerry 10 <strong>before</strong> adding the device here. You cannot
          install apps from the App Store or upload files until both are enabled.
        </p>

        <h4 className="berrycore-guide-heading">Development Mode</h4>
        <ol className="bb-req-list qs-setup-steps">
          <li>Open <strong>Settings → Security and Privacy → Development Mode</strong></li>
          <li>Turn Development Mode <strong>On</strong></li>
          <li>Set a password you will remember — Berry Bridge needs it to install .bar apps</li>
          <li>
            If you enter the wrong password too many times, Development Mode locks — wait or reboot
            before retrying
          </li>
        </ol>

        <h4 className="berrycore-guide-heading">WiFi Storage</h4>
        <ol className="bb-req-list qs-setup-steps">
          <li>Open <strong>Settings → Storage and Access → WiFi Storage</strong></li>
          <li>Turn WiFi Storage <strong>On</strong></li>
          <li>Set a storage password (often the same as your device unlock PIN — your choice)</li>
          <li>Keep the phone on the same Wi‑Fi network as this computer</li>
        </ol>

        <p className="learn-tip" style={{ marginTop: 12 }}>
          Write both passwords down. In <strong>step 3</strong> you will save them on your Berry
          Bridge device profile (same values — not new passwords). Step 2 only saves name, IP, and
          SSH connection settings.
        </p>

        <label className="qs-setup-confirm">
          <input
            type="checkbox"
            checked={phoneSetupDone}
            onChange={(e) => confirmPhoneSetup(e.target.checked)}
          />
          <span>I have enabled Development Mode and WiFi Storage on my BB10</span>
        </label>
      </StepPanel>

      <StepPanel step={2} title="Find & save your device" done={stepDone.device} anchorId="qs-step-2">
        <p className="panel-desc">
          {!stepDone.phoneSetup ? (
            <>
              Complete <strong>step 1</strong> on the phone first. Then scan your Wi‑Fi network and
              add the BB10 you find — or type the IP manually if scan does not list it.
            </>
          ) : (
            <>
              Scan for your phone on the local network. Click <strong>Use</strong> on a new device
              (then save below), or <strong>Select</strong> on one you already saved. Same Wi‑Fi as
              this computer (or USB networking).
            </>
          )}
        </p>

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

        {(!device || showAddDeviceForm) && (
          <>
            <h4 className="berrycore-guide-heading" style={{ marginTop: 20 }}>
              {device && showAddDeviceForm && draft.id === device.id
                ? 'Edit this device'
                : 'Device details'}
            </h4>
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
                  placeholder="192.168.1.226"
                />
              </div>
              <div className="field">
                <label>SSH port</label>
                <input
                  type="number"
                  value={draft.sshPort}
                  onChange={(e) => setDraft({ ...draft, sshPort: parseInt(e.target.value) || 2022 })}
                />
              </div>
              <div className="field">
                <label>SSH user</label>
                <input
                  value={draft.sshUser}
                  onChange={(e) => setDraft({ ...draft, sshUser: e.target.value })}
                />
              </div>
            </div>
            <p className="field-hint" style={{ marginTop: 8 }}>
              Name, IP, and SSH only — phone passwords go in <strong>step 3</strong>.
            </p>
            <div className="btn-row">
              <button className="btn btn-primary" onClick={saveNewDevice}>
                Save device
              </button>
              {device && showAddDeviceForm && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setShowAddDeviceForm(false)
                    setDraft(emptyDevice())
                  }}
                >
                  Cancel
                </button>
              )}
            </div>
          </>
        )}

        {device && !showAddDeviceForm && (
          <div className="qs-saved-block">
            <p className="qs-saved-line">
              ✓ Saved <strong>{device.name}</strong> · {device.host}:{device.sshPort}
            </p>
            <div className="btn-row">
              {!stepDone.storage && (
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() =>
                    document
                      .getElementById('qs-step-3')
                      ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                  }
                >
                  Continue to step 3 →
                </button>
              )}
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setShowAddDeviceForm(true)
                  setDraft({ ...device })
                }}
              >
                Edit
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setShowAddDeviceForm(true)
                  setDraft(emptyDevice())
                }}
              >
                Add another
              </button>
            </div>
          </div>
        )}
      </StepPanel>

      <StepPanel
        step={3}
        title="Save passwords in Berry Bridge"
        done={stepDone.storage}
        anchorId="qs-step-3"
      >
        {!device ? (
          <p className="field-hint">Complete step 2 first — scan or enter your device, then Save.</p>
        ) : (
          <>
            {workingDevicePicker}

            <QsDeviceLine device={device} />

            <p className="panel-desc">
              Copy the two passwords you created on the phone in <strong>step 1</strong> into Berry
              Bridge. They are stored locally for this device only.
            </p>

            {stepDone.storage && (
              <p className="field-hint qs-password-saved-hint">
                Passwords are saved for <strong>{device.name}</strong>. Use the device picker above
                to enter passwords for a different phone.
              </p>
            )}

            <div className="qs-password-grid">
              <div className="qs-password-card">
                <h4 className="qs-password-card-title">WiFi Storage</h4>
                <p className="qs-password-card-from">
                  From phone: Settings → Storage and Access → WiFi Storage & Identification on
                  Network
                </p>
                <div className="field">
                  <label>Username</label>
                  <input
                    value={profileDraft?.smbUser || ''}
                    onChange={(e) =>
                      profileDraft && setProfileDraft({ ...profileDraft, smbUser: e.target.value })
                    }
                    placeholder="blackberry"
                  />
                </div>
                <div className="field">
                  <label>Password</label>
                  <input
                    type="password"
                    value={profileDraft?.smbPassword || ''}
                    onChange={(e) =>
                      profileDraft && setProfileDraft({ ...profileDraft, smbPassword: e.target.value })
                    }
                    placeholder="Same as WiFi Storage on BB10"
                  />
                </div>
                <p className="field-hint">
                  Username is from Identification on Network (often{' '}
                  <code className="code-inline">blackberry</code>). Used for BerryCore send, SSH key
                  upload, and file transfer.
                </p>
              </div>

              <div className="qs-password-card">
                <h4 className="qs-password-card-title">Development Mode password</h4>
                <p className="qs-password-card-from">
                  From phone: Settings → Security and Privacy → Development Mode
                </p>
                <div className="field">
                  <label>Save in Berry Bridge</label>
                  <input
                    type="password"
                    value={profileDraft?.devModePassword || ''}
                    onChange={(e) =>
                      profileDraft &&
                      setProfileDraft({ ...profileDraft, devModePassword: e.target.value })
                    }
                    placeholder="Same as Development Mode on BB10"
                  />
                </div>
                <p className="field-hint">Used for: App Store .bar installs (e.g. Term49)</p>
              </div>
            </div>

            <div className="btn-row">
              <button className="btn btn-primary" disabled={!profileDraft} onClick={saveProfile}>
                Save passwords for {device.name}
              </button>
            </div>
          </>
        )}
      </StepPanel>

      <StepPanel step={4} title="Install Term49" done={term49Done} anchorId="qs-step-4">
        {!stepDone.phoneSetup ? (
          <p className="field-hint" style={{ color: 'var(--warning)' }}>
            Confirm step 1 — Development Mode must be enabled on the phone before installing Term49.
          </p>
        ) : (
          <QsStepTerm49Install
            device={device}
            devicePicker={workingDevicePicker}
            onDoneChange={setTerm49Done}
          />
        )}
      </StepPanel>

      <StepPanel step={5} title="Download BerryCore" done={berryCoreDownloadDone}>
        <QsStepBerryCoreDownload onDoneChange={setBerryCoreDownloadDone} />
      </StepPanel>

      <StepPanel step={6} title="Install BerryCore on phone" done={berryCoreInstallDone} anchorId="qs-step-6">
        <QsStepBerryCoreUpload
          device={device}
          devicePicker={workingDevicePicker}
          downloadDone={berryCoreDownloadDone}
          term49Ready={term49Done}
          onDoneChange={setBerryCoreInstallDone}
        />
      </StepPanel>

      <StepPanel step={7} title="Generate an SSH key" done={stepDone.keyGenerated}>
        <p className="panel-desc">
          After BerryCore is installed, create an RSA key pair in{' '}
          <code className="code-inline">~/.ssh/</code> on this Mac. Use a descriptive name such as{' '}
          <code className="code-inline">rsa_bb10</code>.
        </p>
        {keys.length > 0 && (
          <div className="field">
            <label>Existing keys</label>
            <select value={selectedKey} onChange={(e) => setSelectedKey(e.target.value)}>
              {keys.map((k) => (
                <option key={k.path} value={k.path}>
                  {k.path.replace(/^.*\/\.ssh\//, '')} ({k.fingerprint})
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="field">
          <label>{keys.length ? 'Or generate a new key' : 'Key name'}</label>
          <input value={newKeyName} onChange={(e) => setNewKeyName(e.target.value)} />
        </div>
        <div className="btn-row">
          <button className="btn btn-primary" onClick={generate}>
            Generate RSA key
          </button>
        </div>
        {selectedKey && keys.find((k) => k.path === selectedKey) && (
          <div className="mono" style={{ marginTop: 12, fontSize: 11 }}>
            {keys.find((k) => k.path === selectedKey)?.publicKey}
          </div>
        )}
      </StepPanel>

      <StepPanel step={8} title="Install key on the device" done={stepDone.keyInstalled}>
        {!device ? (
          <p className="field-hint">Complete step 2 first.</p>
        ) : (
          <>
            <p className="field-hint" style={{ marginBottom: 12 }}>
              Device: <strong>{device.name}</strong> ({device.host}) · Key:{' '}
              {selectedKey ? selectedKey.split('/').pop() : pubFile.replace(/\.pub$/, '')}
            </p>
            <div className="btn-row" style={{ marginBottom: 16 }}>
              <button
                className="btn btn-primary"
                disabled={!selectedKey || !device.smbPassword || provisioning}
                onClick={provision}
              >
                {provisioning ? 'Installing…' : 'Install key via WiFi Storage'}
              </button>
            </div>
            {!device.smbPassword && (
              <p className="field-hint" style={{ marginBottom: 12, color: 'var(--warning)' }}>
                WiFi Storage password required — complete step 3 first.
              </p>
            )}
            <Term49SshKeyInstallGuide pubFile={pubFile} showCommands />
            <label className="qs-setup-confirm" style={{ marginTop: 16 }}>
              <input
                type="checkbox"
                checked={term49KeyDone || keyInstalled}
                disabled={keyInstalled}
                onChange={(e) => confirmTerm49KeyInstall(e.target.checked)}
              />
              <span>
                {keyInstalled
                  ? 'SSH key installed on the device (Berry Bridge did this automatically)'
                  : 'I copied the commands from term49-ssh-key-install.txt and ran them in Term49'}
              </span>
            </label>
            <p className="field-hint" style={{ marginTop: 12 }}>
              If SSH is already working, Berry Bridge may install the key automatically when you
              click Install — you can skip the Term49 steps and go to step 10 to test.
            </p>
          </>
        )}
      </StepPanel>

      <StepPanel step={9} title="Link key & SSH config" done={stepDone.profile}>
        <p className="panel-desc">
          Attach the key to your device profile and optionally write a{' '}
          <code className="code-inline">~/.ssh/config</code> entry so you can run{' '}
          <code className="code-inline">ssh your-alias</code> from Terminal.
        </p>
        {!device || !profileDraft ? (
          <p className="field-hint">Complete step 2 first.</p>
        ) : (
          <>
            <SshKeySelect
              value={profileDraft.identityFile || selectedKey}
              onChange={(path) => setProfileDraft({ ...profileDraft, identityFile: path })}
            />
            <div className="btn-row">
              <button className="btn btn-primary" onClick={linkKeyAndSave}>
                Save identity key
              </button>
              <button className="btn btn-secondary" onClick={writeConfig}>
                Write ~/.ssh/config
              </button>
            </div>
          </>
        )}
        {configPreview && (
          <div className="mono" style={{ marginTop: 12, fontSize: 12 }}>
            {configPreview}
          </div>
        )}
      </StepPanel>

      <StepPanel step={10} title="Test & connect" done={stepDone.tested}>
        <p className="panel-desc">
          Verify SSH works, then open the built-in terminal.
        </p>
        {!device ? (
          <p className="field-hint">Complete step 2 first.</p>
        ) : (
          <div className="btn-row">
            <button className="btn btn-primary" disabled={testing} onClick={testSsh}>
              {testing ? 'Testing…' : 'Test SSH connection'}
            </button>
            <button
              className="btn btn-secondary"
              disabled={!device.identityFile && !selectedKey}
              onClick={() => onOpenTerminal(device.id)}
            >
              Open Terminal
            </button>
          </div>
        )}
      </StepPanel>
    </>
  )
}
