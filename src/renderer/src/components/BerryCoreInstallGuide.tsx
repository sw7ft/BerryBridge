import { DEVICE_PATHS } from '@shared/types'
import { term49BerryCoreInstallCommands } from '@shared/berrycore-install-commands'
import { BerryCoreReleaseDownloads } from './BerryCoreReleaseDownloads'

interface Props {
  /** Hide Term49 / SSH prerequisite steps (shown earlier in Quick Start). */
  hidePrerequisites?: boolean
  onOpenAppStore?: () => void
  onOpenStorage?: () => void
}

export function BerryCoreInstallGuide({
  hidePrerequisites = false,
  onOpenAppStore,
  onOpenStorage
}: Props) {
  return (
    <div className="berrycore-guide">
      <p className="panel-desc">
        Berry Bridge helps you <strong>install BerryCore</strong> on a stock BlackBerry 10 — no
        BerryCore required beforehand. Download the release, upload to Documents, and run the
        installer in Term49.
      </p>

      {!hidePrerequisites && (
        <ol className="bb-steps bb-steps-loose berrycore-guide-steps">
          <li>
            <strong>Enable Development Mode &amp; WiFi Storage</strong>
            <span>
              On the BB10 first: Settings → Security → Development Mode, then Settings → Storage
              and Access → WiFi Storage. Both must be on before sideloading apps or transferring
              files. Save the passwords in Berry Bridge when you add the device.
            </span>
          </li>
          <li>
            <strong>Install Term49</strong>
            <span>
              After Development Mode is on, open the App Store and install <em>Term49</em> (all
              permissions). You need Term49 to run shell commands and complete the BerryCore
              installer.
            </span>
            {onOpenAppStore && (
              <div className="btn-row" style={{ marginTop: 8 }}>
                <button type="button" className="btn btn-secondary btn-sm" onClick={onOpenAppStore}>
                  Open App Store →
                </button>
              </div>
            )}
          </li>
          <li>
            <strong>Set up SSH</strong>
            <span>
              Generate an SSH key, upload it via WiFi Storage, and append it in Term49 (Quick Start
              steps 7–10). SSH lets Berry Bridge use Terminal and automate future setup.
            </span>
          </li>
        </ol>
      )}

      <div className="berrycore-guide-releases">
        <h4 className="berrycore-guide-heading">Download BerryCore</h4>
        <BerryCoreReleaseDownloads />
      </div>

      <div className="berrycore-guide-upload">
        <h4 className="berrycore-guide-heading">Upload &amp; install on device</h4>
        <ol className="bb-steps bb-steps-loose berrycore-guide-steps">
          <li>
            <strong>Transfer files over WiFi Storage</strong>
            <span>
              Use Quick Start step 6 or Storage in Berry Bridge. Files upload to the{' '}
              <code className="code-inline">{DEVICE_PATHS.berrycore.transferShare}</code> share at{' '}
              <code className="code-inline">{DEVICE_PATHS.berrycore.transferDir}/</code> (
              <code className="code-inline">berrycore.zip</code>,{' '}
              <code className="code-inline">install.sh</code>, and{' '}
              <code className="code-inline">term49-berrycore-install.txt</code>).
            </span>
            {onOpenStorage && (
              <div className="btn-row" style={{ marginTop: 8 }}>
                <button type="button" className="btn btn-secondary btn-sm" onClick={onOpenStorage}>
                  Open Storage →
                </button>
              </div>
            )}
          </li>
          <li>
            <strong>Run the installer in Term49</strong>
            <span>
              Open Term49, paste the commands from <code className="code-inline">term49-berrycore-install.txt</code>{' '}
              (meta mode + Ctrl+V). By default, BerryCore installs to{' '}
              <code className="code-inline">{DEVICE_PATHS.berrycore.defaultInstall}</code>.
            </span>
          </li>
        </ol>
        <pre className="mono qs-term49-cmd">{term49BerryCoreInstallCommands()}</pre>
        <p className="field-hint">
          For upgrades later, upload new release files to Documents again and run{' '}
          <code className="code-inline">sh install.sh --upgrade</code> from the same folder.
        </p>
      </div>
    </div>
  )
}
