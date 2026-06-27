import type { AppSection, DeviceProfile } from '@shared/types'
import { DEVICE_PATHS } from '@shared/types'
import { term49BerryCoreInstallCommands } from '@shared/berrycore-install-commands'
import { QUICK_START_FLOW } from '@shared/quick-start-flow'
import { BerryMark } from '../components/BerryMark'
import { BerryCoreReleaseDownloads } from '../components/BerryCoreReleaseDownloads'
import { Panel } from '../components/Panel'

const BERRYCORE_REPO_URL = 'https://github.com/sw7ft/BerryCore'
const PATREON_URL = 'https://www.patreon.com/c/Sw7ft'

interface Props {
  devices: DeviceProfile[]
  onNavigate: (s: AppSection) => void
}

const CAPABILITIES: {
  section: AppSection
  title: string
  description: string
}[] = [
  {
    section: 'quickstart',
    title: 'Install BerryCore',
    description:
      'Guided wizard — connect, install Term49 & BerryCore, set up SSH.'
  },
  {
    section: 'devices',
    title: 'Device profiles',
    description: 'Save connection details, credentials, and SSH keys per BerryCore device.'
  },
  {
    section: 'smb',
    title: 'WiFi Storage',
    description: 'Browse and transfer files on your device WiFi Storage shares.'
  },
  {
    section: 'terminal',
    title: 'SSH terminal',
    description: 'Interactive shell over OpenSSH with legacy algorithm support for BB10.'
  },
  {
    section: 'store',
    title: 'App Store',
    description: 'Install Term49 and other bundled .bar / .apk packages to your device.'
  },
  {
    section: 'ssh',
    title: 'SSH key management',
    description: 'Generate keys, install to the device via WiFi Storage, and manage ~/.ssh/config.'
  },
  {
    section: 'apps',
    title: 'Application install',
    description: 'Install .bar packages through the built-in development-mode app manager.'
  },
  {
    section: 'files',
    title: 'Device data',
    description: 'Read clipboard, messages, and notebook files from the device over SSH.'
  },
  {
    section: 'news',
    title: 'BerryCore releases',
    description: 'Stay current with BerryCore updates from the official GitHub feed.'
  },
  {
    section: 'qnx',
    title: 'QNX & the future',
    description: 'QNX beyond BB10 — automotive, robotics, new hardware, and the QNX-Handhelds initiative.'
  }
]

function openExternal(url: string) {
  window.berrybridge.shell.openExternal(url)
}

export function Dashboard({ devices, onNavigate }: Props) {
  const primary = devices[0]

  return (
    <div className="bb-home">
      <section className="bb-home-hero">
        <BerryMark size="lg" className="bb-home-hero-mark" />
        <div>
          <h1>Berry Bridge</h1>
          <p className="bb-home-tagline">Install &amp; manage BerryCore on BlackBerry 10</p>
          <p className="bb-home-lead">
            Berry Bridge is a self-contained <strong>desktop application</strong> for macOS, Windows,
            and Linux. Its primary job is helping you take a <strong>stock BB10</strong> and install{' '}
            <strong>BerryCore</strong> — then manage that device day to day.
          </p>
          <p className="bb-home-lead">
            From one window: install Term49, download the latest BerryCore release, upload and
            install it, then set up SSH — open a terminal, and sideload apps. No cloud account, no
            manual toolchain wiring — everything runs locally on your computer.
          </p>
          <p className="bb-home-credit">
            Built by{' '}
            <button type="button" className="bb-home-link" onClick={() => openExternal(PATREON_URL)}>
              Sw7ft
            </button>{' '}
            for the{' '}
            <button
              type="button"
              className="bb-home-link"
              onClick={() => openExternal(BERRYCORE_REPO_URL)}
            >
              BerryCore
            </button>{' '}
            community.
          </p>
        </div>
      </section>

      <Panel title="BerryCore installation" className="bb-home-install-panel">
        <p className="panel-desc">
          You do <strong>not</strong> need BerryCore already on the device. Berry Bridge guides you
          through the official install path — the same flow documented on the{' '}
          <button
            type="button"
            className="bb-home-link"
            onClick={() =>
              openExternal('https://github.com/sw7ft/BerryCore/wiki/Install-BerryCore-on-BlackBerry-10')
            }
          >
            BerryCore wiki
          </button>
          .
        </p>
        <div className="bb-home-install-grid">
          <div>
            <h3 className="bb-home-install-subhead">The 10-step path</h3>
            <ol className="qs-roadmap-list qs-roadmap-list-compact">
              {QUICK_START_FLOW.map((step, i) => (
                <li key={step}>
                  <span className="qs-roadmap-num">{i + 1}</span>
                  {step}
                </li>
              ))}
            </ol>
            <button type="button" className="btn btn-primary" onClick={() => onNavigate('quickstart')}>
              Start guided install →
            </button>
          </div>
          <div>
            <h3 className="bb-home-install-subhead">Latest release</h3>
            <BerryCoreReleaseDownloads />
            <p className="field-hint" style={{ marginTop: 12 }}>
              Upload via Quick Start or the <strong>{DEVICE_PATHS.berrycore.transferShare}</strong>{' '}
              share to{' '}
              <code className="code-inline">{DEVICE_PATHS.berrycore.transferDir}/</code>, then in
              Term49:
            </p>
            <pre className="mono qs-term49-cmd">{term49BerryCoreInstallCommands()}</pre>
          </div>
        </div>
      </Panel>

      <div className="bb-home-grid">
        <section className="bb-home-panel">
          <h2>What you can do here</h2>
          <p className="bb-home-panel-desc">
            Everything below runs inside Berry Bridge. Use <strong>Simple</strong> mode in the
            sidebar for the BerryCore install path, or <strong>Advanced</strong> for the full
            toolset.
          </p>
          <ul className="bb-cap-list">
            {CAPABILITIES.map((cap) => (
              <li key={cap.section}>
                <button type="button" className="bb-cap-item" onClick={() => onNavigate(cap.section)}>
                  <strong>{cap.title}</strong>
                  <span>{cap.description}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <aside className="bb-home-aside">
          <section className="bb-home-panel bb-home-panel-accent">
            <h2>Getting started</h2>
            <ol className="bb-steps">
              <li>
                <strong>On the phone first</strong>
                <span>
                  Enable Development Mode and WiFi Storage in Settings before anything else — both
                  are required for app installs and file transfer.
                </span>
              </li>
              <li>
                <strong>Start quick start</strong>
                <span>
                  Add the device, save passwords, install Term49, download and install BerryCore,
                  then set up SSH.
                </span>
              </li>
              <li>
                <strong>Install Term49</strong>
                <span>App Store → Term49 (all permissions). Requires Development Mode from step 1.</span>
              </li>
              <li>
                <strong>Install BerryCore</strong>
                <span>
                  Download release files, upload to Documents, run{' '}
                  <code className="code-inline">sh install.sh</code> in Term49.
                </span>
              </li>
            </ol>
            <button type="button" className="btn btn-primary" onClick={() => onNavigate('quickstart')}>
              {devices.length ? 'Continue install' : 'Install BerryCore — start here'}
            </button>
          </section>

          <section className="bb-home-panel bb-home-status">
            <h2>Workspace</h2>
            <dl className="bb-status-dl">
              <div>
                <dt>Saved devices</dt>
                <dd>{devices.length}</dd>
              </div>
              {primary && (
                <div>
                  <dt>Primary device</dt>
                  <dd>
                    {primary.name}
                    <span className="bb-status-sub">
                      {primary.sshHostAlias || `${primary.host}:${primary.sshPort}`}
                    </span>
                  </dd>
                </div>
              )}
            </dl>
            {devices.length === 0 && (
              <p className="bb-home-note">
                No devices configured yet. Quick Start will help you add a BB10 and install BerryCore.
              </p>
            )}
          </section>

          <section className="bb-home-panel bb-home-requirements">
            <h2>What you need</h2>
            <ul className="bb-req-list">
              <li>A stock BlackBerry 10 on the same network (Wi‑Fi or USB)</li>
              <li>Development Mode enabled (install Term49 via App Store)</li>
              <li>WiFi Storage enabled (upload to Documents)</li>
              <li>
                BerryCore is <strong>not</strong> pre-installed — Berry Bridge installs it for you
              </li>
            </ul>
          </section>

          <section className="bb-home-panel bb-home-community">
            <h2>BerryCore &amp; the SW7FT QNX Initiative</h2>
            <p className="bb-home-panel-desc">
              BerryCore and the broader SW7FT QNX Initiative are community-driven projects built out
              of passion for open systems, education, and the preservation of embedded computing.
            </p>
            <p className="bb-home-panel-desc">
              If you&apos;d like to help sustain ongoing development, testing, and device support,
              consider supporting the project through Patreon:
            </p>
            <button type="button" className="btn btn-primary bb-patreon-btn" onClick={() => openExternal(PATREON_URL)}>
              Support on Patreon — Sw7ft Developer
            </button>
            <p className="bb-home-note">
              Every contribution directly supports continued development of QNX ports, documentation,
              and new open-source tooling for the next generation of embedded devices.
            </p>
          </section>
        </aside>
      </div>
    </div>
  )
}
