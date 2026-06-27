import {
  TERM49_SSH_KEY_SCRIPT,
  term49AuthorizedKeysCommands
} from '@shared/ssh-install-commands'
import { DEVICE_PATHS, SSH_DEFAULTS } from '@shared/types'

interface Props {
  pubFile: string
  showCommands?: boolean
  /** Large callout after key upload — steps stay visible until SSH works. */
  prominent?: boolean
  /** Key already uploaded via WiFi Storage. */
  uploadComplete?: boolean
}

export function Term49SshKeyInstallGuide({
  pubFile,
  showCommands = false,
  prominent = false,
  uploadComplete = false
}: Props) {
  const commands = term49AuthorizedKeysCommands(pubFile)
  const misc = DEVICE_PATHS.berrycore.sharedMisc
  const share = DEVICE_PATHS.berrycore.transferShare

  const steps = uploadComplete ? (
    <ol className="term49-install-steps">
      <li>
        On your BB10, open <code className="code-inline">{TERM49_SSH_KEY_SCRIPT}</code> in{' '}
        <code className="code-inline">{misc}</code> (WiFi Storage → <strong>{share}</strong>{' '}
        share). Select all and copy the commands.
      </li>
      <li>
        Open <strong>Term49</strong>. Tap the menu icon (top left) for <strong>meta mode</strong>,
        then press <strong>Ctrl+V</strong> to paste. Press Enter to run every line.
      </li>
      <li>
        The script sources BerryCore, runs <code className="code-inline">ssh-keygen</code> on the
        device (if needed), adds your Mac&apos;s <code className="code-inline">{pubFile}</code> to{' '}
        <code className="code-inline">{DEVICE_PATHS.ssh.authorizedKeys}</code>, and starts{' '}
        <code className="code-inline">sshd</code>.
      </li>
      <li>
        Back in Berry Bridge, click <strong>Test SSH</strong>. Connection refused usually means{' '}
        <code className="code-inline">sshd</code> did not start — re-run the script in Term49.
      </li>
    </ol>
  ) : (
    <ol className="term49-install-steps">
      <li>
        Berry Bridge uploads <code className="code-inline">{pubFile}</code> and{' '}
        <code className="code-inline">{TERM49_SSH_KEY_SCRIPT}</code> to your phone.
      </li>
      <li>
        On your BB10, open <code className="code-inline">{TERM49_SSH_KEY_SCRIPT}</code> in{' '}
        <code className="code-inline">{misc}</code> (WiFi Storage → <strong>{share}</strong>{' '}
        share). Select all and copy the commands.
      </li>
      <li>
        Open <strong>Term49</strong>. Meta mode (menu, top left) → <strong>Ctrl+V</strong> → Enter.
        Run every line — including device <code className="code-inline">ssh-keygen</code> and{' '}
        <code className="code-inline">sshd</code>.
      </li>
    </ol>
  )

  const commandBlock =
    showCommands || prominent ? (
      prominent ? (
        <div className="install-phone-cmd-block">
          <p className="install-phone-cmd-label">Commands in {TERM49_SSH_KEY_SCRIPT}</p>
          <pre className="mono qs-term49-cmd">{commands}</pre>
        </div>
      ) : (
        <details className="term49-install-commands-details" open={prominent}>
          <summary>What the commands do</summary>
          <pre className="mono qs-term49-cmd">{commands}</pre>
          <p className="field-hint">
            Creates <code className="code-inline">{DEVICE_PATHS.ssh.sshDir}</code>, generates a
            device key with <code className="code-inline">ssh-keygen</code>, appends your uploaded
            public key, and starts <code className="code-inline">sshd</code> on port{' '}
            {SSH_DEFAULTS.port}.
          </p>
        </details>
      )
    ) : null

  if (prominent) {
    return (
      <div className="install-phone-callout">
        <div className="install-phone-callout-head">
          <span className="install-phone-callout-icon" aria-hidden="true">
            →
          </span>
          <div>
            <h3 className="install-phone-callout-title">Finish SSH on your phone</h3>
            <p className="install-phone-callout-lead">
              Adding a key to authorized_keys is not enough — BerryCore SSH must be running. Run
              every command below in Term49, then test again.
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
