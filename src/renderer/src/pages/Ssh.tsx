import { useEffect, useState } from 'react'
import type { DeviceProfile, SshKeyInfo } from '@shared/types'
import { pubKeyFileName } from '@shared/ssh-install-commands'
import { Term49SshKeyInstallGuide } from '../components/Term49SshKeyInstallGuide'
import { PageHeader } from '../components/PageHeader'
import { Panel } from '../components/Panel'

interface Props {
  devices: DeviceProfile[]
}

export function SshPage({ devices }: Props) {
  const [keys, setKeys] = useState<SshKeyInfo[]>([])
  const [selectedDevice, setSelectedDevice] = useState('')
  const [selectedKey, setSelectedKey] = useState('')
  const [newKeyName, setNewKeyName] = useState('rsa_bb10')
  const [message, setMessage] = useState('')
  const [configPreview, setConfigPreview] = useState('')
  const [provisioning, setProvisioning] = useState(false)

  const loadKeys = () => window.berrybridge.ssh.listKeys().then(setKeys)

  useEffect(() => {
    loadKeys()
  }, [])

  const device = devices.find((d) => d.id === selectedDevice)
  const pubFile = pubKeyFileName(selectedKey || newKeyName)

  const generate = async () => {
    try {
      const key = await window.berrybridge.ssh.generateKey(newKeyName)
      setMessage(`Generated ${key.path}`)
      loadKeys()
      setSelectedKey(key.path)
    } catch (e) {
      setMessage(String(e))
    }
  }

  const writeConfig = async () => {
    if (!device) return
    const alias = await window.berrybridge.ssh.writeConfigEntry(device)
    setConfigPreview(`Host ${alias}\n  HostName ${device.host}\n  User ${device.sshUser}\n  Port ${device.sshPort}\n  IdentityFile ${device.identityFile || '~/.ssh/id_rsa_bb10'}\n  PubkeyAcceptedAlgorithms +ssh-rsa\n  HostKeyAlgorithms +ssh-rsa\n  KexAlgorithms +diffie-hellman-group1-sha1`)
    setMessage(`Wrote ~/.ssh/config entry for Host ${alias}`)
  }

  const provision = async () => {
    if (!device || !selectedKey) return
    if (!device.smbPassword) {
      setMessage('Add the WiFi Storage password on this device first (Devices → Edit). Key install uses SMB port 445.')
      return
    }
    setProvisioning(true)
    setMessage('Uploading public key via WiFi Storage…')
    try {
      const result = await window.berrybridge.ssh.provisionKey(device, selectedKey)
      setMessage(`[${result.method}] ${result.message}`)
    } catch (e) {
      setMessage(String(e))
    } finally {
      setProvisioning(false)
    }
  }

  const test = async () => {
    if (!device) return
    const result = await window.berrybridge.ssh.testConnection(device)
    setMessage(result.message)
  }

  return (
    <>
      <PageHeader
        title="SSH keys"
        subtitle="Generate and install SSH keys to BerryCore devices through Berry Bridge."
      />

      {message && (
        <div className="alert alert-info">
          <pre className="alert-pre">{message}</pre>
        </div>
      )}

      <div className="grid-2">
        <Panel title="Local keys">
          {keys.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>No keys found in ~/.ssh</p>
          ) : (
            <div className="field">
              <label>Select key</label>
              <select value={selectedKey} onChange={(e) => setSelectedKey(e.target.value)}>
                <option value="">— choose —</option>
                {keys.map((k) => (
                  <option key={k.path} value={k.path}>
                    {k.path} ({k.fingerprint})
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="field">
            <label>Generate new key</label>
            <input value={newKeyName} onChange={(e) => setNewKeyName(e.target.value)} />
          </div>
          <div className="btn-row">
            <button className="btn btn-primary" onClick={generate}>
              Generate RSA key
            </button>
          </div>
          {selectedKey && keys.find((k) => k.path === selectedKey) && (
            <div className="mono" style={{ marginTop: 12 }}>
              {keys.find((k) => k.path === selectedKey)?.publicKey}
            </div>
          )}
        </Panel>

        <Panel title="Target device">
          <div className="field">
            <label>Device</label>
            <select value={selectedDevice} onChange={(e) => setSelectedDevice(e.target.value)}>
              <option value="">— choose —</option>
              {devices.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.host})
                </option>
              ))}
            </select>
          </div>
          {device && (
            <p className="field-hint" style={{ marginBottom: 12 }}>
              WiFi Storage password:{' '}
              {device.smbPassword ? (
                <span style={{ color: 'var(--bb-green)' }}>configured</span>
              ) : (
                <span style={{ color: 'var(--warning)' }}>missing — edit device to add</span>
              )}
            </p>
          )}
          <div className="btn-row">
            <button
              className="btn btn-primary"
              disabled={!device || !selectedKey || provisioning}
              onClick={provision}
            >
              {provisioning ? 'Installing…' : 'Install key via WiFi Storage'}
            </button>
            <button className="btn btn-secondary" disabled={!device} onClick={writeConfig}>
              Write ~/.ssh/config
            </button>
            <button className="btn btn-secondary" disabled={!device} onClick={test}>
              Test SSH
            </button>
          </div>
          <Term49SshKeyInstallGuide pubFile={pubFile} showCommands />
        </Panel>
      </div>

      {configPreview && (
        <Panel title="SSH config preview">
          <div className="mono">{configPreview}</div>
        </Panel>
      )}
    </>
  )
}
