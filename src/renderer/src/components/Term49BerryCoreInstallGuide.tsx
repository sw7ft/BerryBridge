import { DEVICE_PATHS } from '@shared/types'
import {
  TERM49_BERRYCORE_SCRIPT,
  term49BerryCoreInstallCommands
} from '@shared/berrycore-install-commands'

interface Props {
  showCommands?: boolean
  /** Large callout after upload — steps and commands stay visible. */
  prominent?: boolean
  /** Omit the upload step (files already on the phone). */
  uploadComplete?: boolean
}

export function Term49BerryCoreInstallGuide({
  showCommands = true,
  prominent = false,
  uploadComplete = false
}: Props) {
  const commands = term49BerryCoreInstallCommands()
  const dir = DEVICE_PATHS.berrycore.transferDir
  const share = DEVICE_PATHS.berrycore.transferShare

  const steps = uploadComplete ? (
    <ol className="term49-install-steps">
      <li>
        On your BB10, open <code className="code-inline">{TERM49_BERRYCORE_SCRIPT}</code> in{' '}
        <code className="code-inline">{dir}</code> (WiFi Storage →{' '}
        <strong>{share}</strong> share). Select all and copy the commands.
      </li>
      <li>
        Open <strong>Term49</strong>. Tap the menu icon (top left) to enable{' '}
        <strong>meta mode</strong>, then press <strong>Ctrl+V</strong> to paste. Press Enter to
        run the installer.
      </li>
      <li>
        Close and reopen Term49 when finished. Run <code className="code-inline">bclist</code> or{' '}
        <code className="code-inline">git --version</code> to verify BerryCore is working.
      </li>
    </ol>
  ) : (
    <ol className="term49-install-steps">
      <li>
        Berry Bridge uploads <code className="code-inline">berrycore.zip</code>,{' '}
        <code className="code-inline">install.sh</code>, and{' '}
        <code className="code-inline">{TERM49_BERRYCORE_SCRIPT}</code> to your phone.
      </li>
      <li>
        On your BB10, open <code className="code-inline">{TERM49_BERRYCORE_SCRIPT}</code> in{' '}
        <code className="code-inline">{dir}</code> (WiFi Storage → <strong>{share}</strong> share).
        Select all and copy the commands.
      </li>
      <li>
        Open <strong>Term49</strong>. Tap the menu icon (top left) to enable{' '}
        <strong>meta mode</strong>, then press <strong>Ctrl+V</strong> to paste. Press Enter to
        run the installer.
      </li>
      <li>
        Close and reopen Term49 when finished. Run <code className="code-inline">bclist</code> or{' '}
        <code className="code-inline">git --version</code> to verify BerryCore is working.
      </li>
    </ol>
  )

  const commandBlock = showCommands && (
    prominent ? (
      <div className="install-phone-cmd-block">
        <p className="install-phone-cmd-label">Commands in {TERM49_BERRYCORE_SCRIPT}</p>
        <pre className="mono qs-term49-cmd">{commands}</pre>
      </div>
    ) : (
      <details className="term49-install-commands-details">
        <summary>What the commands do</summary>
        <pre className="mono qs-term49-cmd">{commands}</pre>
        <p className="field-hint">
          Runs the BerryCore installer from{' '}
          <code className="code-inline">{dir}</code>.
        </p>
      </details>
    )
  )

  if (prominent) {
    return (
      <div className="install-phone-callout">
        <div className="install-phone-callout-head">
          <span className="install-phone-callout-icon" aria-hidden="true">
            →
          </span>
          <div>
            <h3 className="install-phone-callout-title">Finish on your phone</h3>
            <p className="install-phone-callout-lead">
              Upload complete. Run the installer in Term49 on your BB10 before you continue.
            </p>
          </div>
        </div>
        {steps}
        {commandBlock}
      </div>
    )
  }

  return (
    <div className="term49-install-guide">
      {steps}
      {commandBlock}
    </div>
  )
}
