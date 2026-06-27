# Berry Bridge Agent — BerryCore Port Specification

**Version:** 0.1 (draft)  
**Audience:** BerryCore / QNX porting agent  
**Consumer:** [Berry Bridge](https://github.com/sw7ft/BerryCore) desktop app (Electron, macOS/Windows/Linux)  
**Goal:** After the user installs BerryCore + Term49 on a stock BB10, Berry Bridge should automate SSH key install and post-install setup **without Term49 copy-paste**, using WiFi Storage (SMB) as the control plane until SSH is live.

---

## 1. Problem statement

Today Berry Bridge:

1. Uploads setup files over **WiFi Storage** (SMB1, port 445, `media` share).
2. Asks the user to **manually paste commands into Term49** for:
   - BerryCore install (`cd /accounts/1000/shared/documents` → `sh install.sh`)
   - SSH setup (`ssh-keygen`, append `authorized_keys`, start `sshd`)
3. Polls SSH (port **2022**, user **`blackberry`**, RSA + legacy algorithms) once the daemon is up.

Pain points:

- Users skip Term49 steps after long SMB uploads.
- SSH fails with **connection refused** when `sshd` was never started — `authorized_keys` alone is insufficient.
- Device-side `ssh-keygen` is required before SSH works reliably.
- Files were split across `misc/` and `documents/`; **everything should live under `documents/`**.

The port should eliminate manual Term49 steps for Bridge-driven setup.

---

## 2. Target user flow (happy path)

| Step | Actor | Action |
|------|--------|--------|
| 1 | User (on phone) | Enable Development Mode + WiFi Storage |
| 2 | Berry Bridge | Scan network, save device + passwords |
| 3 | Berry Bridge | Install Term49 (.bar sideload) |
| 4 | Berry Bridge | SMB upload: `berrycore.zip`, `install.sh`, agent bootstrap (optional) |
| 5 | **BerryCore agent** | Detect inbox job → run `install.sh` → report `status.json` |
| 6 | User | **One-time** Term49 action only if agent cannot self-trigger (see §7) — ideally zero |
| 7 | Berry Bridge | SMB upload: SSH public key job |
| 8 | **BerryCore agent** | `ssh-keygen` (if needed), merge key → `authorized_keys`, start `sshd` |
| 9 | Berry Bridge | SSH test → write `~/.ssh/config` → terminal / automation |

**Success criterion:** Bridge reaches `ssh blackberry@<ip> -p 2022` with key auth and `echo berrybridge-ok` returning `berrybridge-ok`.

---

## 3. Canonical paths on BB10

All paths are absolute. **Do not use `~` in agent scripts** — Term49 and SMB staging require full paths.

| Purpose | Path |
|---------|------|
| WiFi Storage staging (all Bridge uploads) | `/accounts/1000/shared/documents` |
| BerryCore install (zip + install.sh) | `/accounts/1000/shared/documents` |
| BerryCore runtime (after install.sh) | `/accounts/1000/shared/misc/berrycore` |
| Agent root | `/accounts/1000/shared/documents/berrybridge` |
| Job inbox (Bridge writes) | `/accounts/1000/shared/documents/berrybridge/inbox` |
| Job archive (agent moves completed/failed) | `/accounts/1000/shared/documents/berrybridge/processed` |
| Live status (agent writes, Bridge reads) | `/accounts/1000/shared/documents/berrybridge/status.json` |
| Agent log | `/accounts/1000/shared/documents/berrybridge/agent.log` |
| SSH directory | `/accounts/1000/.ssh` |
| authorized_keys | `/accounts/1000/.ssh/authorized_keys` |
| SSH daemon port | **2022** |
| SSH login user (Bridge default) | **`blackberry`** |

SMB relative path on `media` share: `accounts/1000/shared/documents/berrybridge/...`

Berry Bridge constants (for cross-reference):

```typescript
DEVICE_PATHS.berrycore.transferDir      // /accounts/1000/shared/documents
DEVICE_PATHS.berrycore.defaultInstall   // /accounts/1000/shared/misc/berrycore
DEVICE_PATHS.berrybridge.setupRoot      // /accounts/1000/shared/documents/berrybridge
DEVICE_PATHS.berrybridge.inbox          // .../berrybridge/inbox
DEVICE_PATHS.berrybridge.statusFile     // .../berrybridge/status.json
SSH_DEFAULTS.port                       // 2022
SSH_DEFAULTS.user                       // blackberry
```

---

## 4. Package deliverable

### 4.1 Name

Suggested QNX package id: **`berrybridge-agent`** (or integrate into BerryCore meta-package as `packages/berrybridge-agent.zip`).

### 4.2 Contents

| File | Role |
|------|------|
| `bin/berrybridge-agent` | Long-running or cron-invoked watcher (poll inbox every N seconds) |
| `bin/berrybridge-run-job` | One-shot job executor (for Term49 / manual invoke) |
| `lib/berrybridge/*.sh` | Job handlers (install, ssh-key, ping) |
| `etc/berrybridge/agent.conf` | Defaults (poll interval, paths, ssh port) |
| Hook in BerryCore `install.sh` or `env.sh` | Register agent startup (see §7) |

Install target: `$NATIVE_TOOLS/berrybridge-agent/` (standard BerryCore package layout), with **symlinks or copies** under `documents/berrybridge/` as needed.

### 4.3 Dependencies

- BerryCore OpenSSH (`ssh-keygen`, `sshd`) on PATH after `source .../berrycore/env.sh`
- Term49 (all permissions) — only for bootstrap if daemon cannot start unattended
- Writable `documents` and `.ssh` for account 1000

---

## 5. Control plane: inbox job protocol

Bridge and agent communicate **only via files** (no TCP API before SSH exists). Bridge uploads JSON job files to `inbox/` via SMB. Agent atomically processes and updates `status.json`.

### 5.1 Job file naming

```
inbox/<timestamp>-<uuid>-<type>.json
```

Example: `inbox/20260618T120000Z-a1b2c3d4-install-berrycore.json`

Bridge creates files with SMB `put`. Agent should:

1. Read JSON
2. Validate schema + version
3. Execute
4. Move to `processed/` with result suffix
5. Update `status.json`

Use **write temp + rename** for status updates to avoid partial reads.

### 5.2 Common job envelope

```json
{
  "schema": "berrybridge.job.v1",
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "type": "install_ssh_key",
  "created_at": "2026-06-18T12:00:00Z",
  "bridge_version": "0.1.0",
  "device_hint": {
    "name": "z10",
    "host": "192.168.1.157"
  }
}
```

### 5.3 Job types (v1 — required)

#### `ping`

Health check. Agent writes status only.

**Payload:** none  

**Agent actions:**
- Ensure directories exist
- `source $BERRYCORE/env.sh`
- Set `status.agent = "ok"`, `status.berrycore_installed = [test -f env.sh]`

---

#### `install_berrycore`

Run BerryCore installer from documents.

**Payload:**

```json
{
  "type": "install_berrycore",
  "workdir": "/accounts/1000/shared/documents",
  "zip": "berrycore.zip",
  "installer": "install.sh",
  "mode": "fresh"
}
```

**Agent actions:**
1. `cd workdir`
2. Verify `berrycore.zip` + `install.sh` exist
3. Run `sh install.sh` (or `sh install.sh --upgrade` if `mode=upgrade`, support `-y` non-interactive)
4. Capture exit code + tail of log to `agent.log`
5. Set `status.berrycore.installed = true`, `status.berrycore.path`, `status.berrycore.version`

**Bridge precondition:** Already uploaded zip + install.sh to documents.

---

#### `install_ssh_key`

Full SSH bootstrap — **this replaces Term49 paste for SSH**.

**Payload:**

```json
{
  "type": "install_ssh_key",
  "public_key_file": "id_rsa_bb10.pub",
  "public_key_path": "/accounts/1000/shared/documents/id_rsa_bb10.pub",
  "authorized_keys_path": "/accounts/1000/.ssh/authorized_keys",
  "ssh_user": "blackberry",
  "ssh_port": 2022,
  "start_sshd": true
}
```

**Agent actions (in order):**

```sh
source /accounts/1000/shared/misc/berrycore/env.sh

mkdir -p /accounts/1000/.ssh
chmod 700 /accounts/1000/.ssh

# Device host/user key — skip if present
if [ ! -f /accounts/1000/.ssh/id_rsa ]; then
  ssh-keygen -t rsa -b 2048 -f /accounts/1000/.ssh/id_rsa -N ""
fi

# Merge Bridge key (dedupe by key blob / fingerprint)
# Read public_key_path, append to authorized_keys if not already present
chmod 600 /accounts/1000/.ssh/authorized_keys

# Start SSH daemon if not listening on 2022
# Prefer: berrybridge-ensure-sshd (see §6)
```

**Status fields after success:**

```json
{
  "ssh": {
    "sshd_running": true,
    "port": 2022,
    "authorized_keys_count": 1,
    "last_key_fingerprint": "SHA256:..."
  }
}
```

**Failure cases to report clearly:**
- BerryCore not installed (`env.sh` missing)
- `public_key_path` missing
- `sshd` failed to bind port 2022
- Permission errors on `.ssh`

---

#### `ensure_sshd`

Idempotent — start sshd if not running.

**Payload:**

```json
{
  "type": "ensure_sshd",
  "port": 2022
}
```

---

### 5.4 `status.json` schema (agent → Bridge)

Bridge polls by SMB-downloading this file after upload jobs.

```json
{
  "schema": "berrybridge.status.v1",
  "updated_at": "2026-06-18T12:05:00Z",
  "agent": {
    "version": "0.1.0",
    "state": "idle",
    "last_job_id": "a1b2c3d4-...",
    "last_error": null
  },
  "berrycore": {
    "installed": true,
    "path": "/accounts/1000/shared/misc/berrycore",
    "version": "0.72"
  },
  "ssh": {
    "sshd_running": true,
    "port": 2022,
    "user": "blackberry",
    "ready_for_bridge": true
  },
  "last_job": {
    "id": "...",
    "type": "install_ssh_key",
    "state": "completed",
    "message": "sshd listening on 2022",
    "exit_code": 0
  }
}
```

`ready_for_bridge: true` means Bridge should attempt SSH test immediately.

---

## 6. SSH daemon requirements

### 6.1 Port and user

- Listen on **2022** (BB10 convention; Bridge hardcodes this).
- Accept user **`blackberry`** (Bridge default; configurable later).

### 6.2 Algorithms (client compatibility)

Bridge OpenSSH client uses legacy BB10 options:

```
PubkeyAcceptedAlgorithms +ssh-rsa
HostKeyAlgorithms +ssh-rsa
KexAlgorithms +diffie-hellman-group1-sha1
Ciphers aes128-ctr,aes128-cbc,3des-cbc
MACs hmac-sha1
```

Agent must ship or generate **RSA host keys** compatible with `ssh-rsa`.

### 6.3 `berrybridge-ensure-sshd` behavior

Provide a helper invoked by the agent:

1. If `sshd` already listening on 2022 → exit 0
2. Else start `sshd` (background daemon — **not** foreground `-Dd` for production)
3. Write pid file under `/accounts/1000/shared/documents/berrybridge/sshd.pid` (optional)
4. Verify with local `connect` test or `netstat` equivalent on QNX

**Important:** Starting `sshd` must survive Term49 session close. Document if BB10 requires a persistent service hook.

### 6.4 Verification command (Bridge uses post-setup)

From desktop:

```bash
ssh -o BatchMode=yes -o ConnectTimeout=15 \
  -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null \
  -o KexAlgorithms=diffie-hellman-group1-sha1 \
  -o HostKeyAlgorithms=ssh-rsa -o PubkeyAcceptedAlgorithms=ssh-rsa \
  -p 2022 -i ~/.ssh/id_rsa_bb10 \
  blackberry@<device-ip> echo berrybridge-ok
```

Expected stdout: `berrybridge-ok`

---

## 7. Agent lifecycle & bootstrap

### 7.1 First install

When BerryCore `install.sh` completes, optionally:

```sh
# Post-install hook (in BerryCore or agent package)
mkdir -p /accounts/1000/shared/documents/berrybridge/inbox
mkdir -p /accounts/1000/shared/documents/berrybridge/processed
# Install agent binary into berrycore tree
# Start watcher (see below)
```

### 7.2 Watcher modes (pick at least one)

| Mode | Description |
|------|-------------|
| **A. Poll loop** | `berrybridge-agent` sleeps 5s, scans `inbox/*.json` |
| **B. Cron** | BerryCore cron entry every minute |
| **C. Manual** | `berrybridge-run-job inbox/<file>.json` — Bridge uploads job + trigger file |

**Recommendation:** A + C (poll for automation, one-shot for debugging).

### 7.3 Term49 fallback (minimal)

If BB10 **cannot** run background agents without Term49:

1. Agent installs a **`documents/berrybridge/RUNME.txt`** with a **single command**:
   ```
   berrybridge-run-job --watch
   ```
2. Bridge shows one prompt: “Open RUNME.txt in Term49 once” — still better than multi-step paste.

**Target:** Zero Term49 after BerryCore is installed.

---

## 8. Berry Bridge side (future integration — not in this port)

After the agent exists, Berry Bridge will:

1. Upload all setup files to `/accounts/1000/shared/documents/`
2. Upload `inbox/<job>.json` for `install_berrycore` / `install_ssh_key`
3. Poll `status.json` over SMB (with timeout, e.g. 10 min for BerryCore install)
4. On `ssh.ready_for_bridge`, call existing `ssh:testConnection`
5. Deprecate `term49-berrycore-install.txt` and `term49-ssh-key-install.txt` when agent is detected (version probe in `status.json`)

Bridge probe for agent capability:

```json
{ "agent": { "version": ">=0.1.0" } }
```

---

## 9. Security considerations

- Inbox jobs are **trusted only on local WiFi** — same threat model as WiFi Storage password.
- Agent must **reject** jobs requesting paths outside allowlist:
  - `/accounts/1000/shared/documents`
  - `/accounts/1000/.ssh`
  - `/accounts/1000/shared/misc/berrycore`
- Deduplicate SSH public keys by fingerprint; never overwrite `authorized_keys` wholesale.
- Log actions to `agent.log`; no private keys in logs.
- Optional: HMAC field in job JSON keyed by device-specific secret (v2 — not required for v1).

---

## 10. Files Berry Bridge uploads today (v0 — before agent)

All under **`/accounts/1000/shared/documents`**:

| File | Purpose |
|------|---------|
| `berrycore.zip` | BerryCore release |
| `install.sh` | Installer |
| `term49-berrycore-install.txt` | Manual fallback (deprecated when agent ships) |
| `id_rsa_bb10.pub` | Mac SSH public key |
| `term49-ssh-key-install.txt` | Manual SSH fallback (deprecated when agent ships) |

After agent ships, Bridge adds:

| File | Purpose |
|------|---------|
| `berrybridge/inbox/<job>.json` | Commands |
| `berrybridge/status.json` | Read by Bridge (agent-owned) |

---

## 11. Acceptance tests

Port is done when all pass on **Z10** (and ideally one other BB10 model):

### 11.1 Agent unit tests (on device, Term49)

1. `berrybridge-run-job ping` → `status.json` shows `agent.state=idle`
2. With zip + install.sh in documents, `install_berrycore` job → BerryCore at `misc/berrycore`, `env.sh` works
3. With `.pub` in documents, `install_ssh_key` job → `authorized_keys` contains key, `sshd` on 2022
4. Re-run `install_ssh_key` → idempotent (no duplicate keys)
5. Reboot phone → document whether `sshd` auto-starts; if not, document `ensure_sshd` + boot hook

### 11.2 Integration with Berry Bridge (manual)

1. Fresh Quick Start / Install wizard through BerryCore step
2. Bridge uploads key → agent job → **Test SSH** succeeds without user opening Term49
3. Bridge opens embedded terminal session

### 11.3 Failure injection

- Missing `berrycore.zip` → job fails with clear `last_error` in status
- Missing `.pub` → job fails, `sshd_running=false`
- BerryCore not installed before SSH job → actionable error message

---

## 12. Versioning

| Component | Version field |
|-----------|----------------|
| Job schema | `berrybridge.job.v1` |
| Status schema | `berrybridge.status.v1` |
| Agent package | Semver in `status.agent.version` |

Breaking changes increment `v2`. Agent should accept unknown job fields gracefully.

---

## 13. Reference: manual Term49 commands (v0 baseline)

These are what Bridge uses **today** when the agent is absent. The port should automate equivalent behavior.

**BerryCore install:**

```sh
cd /accounts/1000/shared/documents
sh install.sh
```

**SSH setup:**

```sh
source /accounts/1000/shared/misc/berrycore/env.sh
mkdir -p /accounts/1000/.ssh
chmod 700 /accounts/1000/.ssh
test -f /accounts/1000/.ssh/id_rsa || ssh-keygen -t rsa -b 2048 -f /accounts/1000/.ssh/id_rsa -N ""
cat /accounts/1000/shared/documents/id_rsa_bb10.pub >> /accounts/1000/.ssh/authorized_keys
chmod 600 /accounts/1000/.ssh/authorized_keys
sshd
```

---

## 14. Open questions for implementer

1. **BB10 background process policy:** Can a watcher run outside Term49 indefinitely, or only while Term49 is open?
2. **sshd persistence:** Boot hook vs user must re-run `ensure_sshd` after reboot?
3. **SSH user:** Is `blackberry` always correct, or should agent read BB10 account name?
4. **Package delivery:** Separate `berrybridge-agent.zip` vs bundled in main BerryCore release?
5. **Non-interactive install.sh:** Confirm `-y` / env flags for fully unattended BerryCore install.

---

## 15. Summary for implementing agent

Build a **BerryCore package** that:

1. Watches `/accounts/1000/shared/documents/berrybridge/inbox/` for JSON jobs
2. Can run **`install.sh`** from documents non-interactively
3. Can run **device `ssh-keygen`**, merge Bridge **`.pub`** from documents, and **start `sshd` on 2022**
4. Writes **`status.json`** for Berry Bridge to poll over SMB
5. Makes **SSH connectivity** the handoff signal (`ready_for_bridge: true`)

Berry Bridge already speaks SMB, generates RSA keys, and tests SSH on port 2022 — it only needs a **reliable on-device executor** for the commands users currently paste into Term49.

---

## 16. Berry Bridge team answers (integration Q&A)

*Answers from the Berry Bridge desktop app team — current code + planned v1 integration. “Today” = shipped in repo; “Planned” = will implement when agent ≥ 0.1.0 exists.*

### Bootstrap (before anything runs)

| Question | Answer |
|----------|--------|
| **How does the agent get on the phone with zero Term49?** | **Today:** It doesn’t — agent integration is **not built yet** (spec + path constants only). **Recommended for v1:** Bundle `berrybridge-agent` inside **`berrycore.zip`** (or as a `packages/berrybridge-agent.zip` installed by `install.sh` post-hook). Bridge will **not** rely on a separate manual tgz upload unless bundling fails. |
| **Separate SMB upload of agent tgz?** | Fallback only. Preferred: agent installed when user/agent runs `install.sh` from documents. Bridge may SMB-upload `berrybridge-agent-bb10-0.1.0.tgz` **only if** not in zip — not the primary path. |
| **Who starts the watcher first time?** | **`install.sh` post-install hook** should start watcher or register cron. **If BB10 cannot keep `nohup berrybridge-agent` alive after Term49 closes:** Bridge accepts **one** Term49 step: open `documents/berrybridge/RUNME.txt` and run `berrybridge-run-job --watch`. Target v1: **zero Term49 paste**; acceptable interim: **one** RUNME line until SSH works. |
| **Trigger without running watcher?** | **Yes, acceptable for v1.** Bridge can upload `inbox/<job>.json` + optional `inbox/TRIGGER` (or rely on agent cron every 60s). Bridge will implement **either** poll-only **or** job+trigger; agent should support **one-shot** `berrybridge-run-job <path>` for both. |

### Desktop app (Berry Bridge)

| Question | Answer |
|----------|--------|
| **Upload only to documents (not misc)?** | **Yes, today.** All setup uploads use `uploadFileToDocuments()` → SMB path `accounts/1000/shared/documents/<file>` on the `media` share. Device path: `/accounts/1000/shared/documents/`. SSH `.pub` and `term49-*.txt` are in **documents**, not misc. |
| **Exact job schema?** | **Planned, not implemented today.** Bridge will emit exactly: `schema: berrybridge.job.v1`, filenames `inbox/<ISO8601>-<uuid>-<type>.json`, sequence: `install_berrycore` → `install_ssh_key` → poll until `ssh.ready_for_bridge === true`. Constants already in `DEVICE_PATHS.berrybridge.*`. |
| **How Bridge polls status.json?** | **Planned:** SMB download every **3s** during active job; overall timeout **45 min** for `install_berrycore` (large zip install), **5 min** for `install_ssh_key`. On `agent.state=error` or `last_error` set → show error in Install wizard and stop polling. Today: no polling (Term49 fallback only). |
| **When stop term49-*.txt?** | When Bridge reads `status.json` and `agent.version >= 0.1.0` **and** last job succeeded. Until then, keep Term49 fallbacks. |
| **Upload id_rsa_bb10.pub before SSH job?** | **Yes.** Bridge uploads `id_rsa_bb10.pub` (or whatever key is selected) to documents **before** SSH job. Job payload will use `public_key_path: /accounts/1000/shared/documents/id_rsa_bb10.pub` (basename from selected key). |

### SSH (must match device agent)

| Question | Answer |
|----------|--------|
| **Client flags same as spec?** | **Yes.** Batch test uses port **2022**, user from device profile (default **`blackberry`**), `StrictHostKeyChecking=no`, `UserKnownHostsFile=/dev/null`, plus legacy: `KexAlgorithms=diffie-hellman-group1-sha1`, `HostKeyAlgorithms=ssh-rsa`, `PubkeyAcceptedAlgorithms=ssh-rsa`, ciphers/MACs as in spec. `~/.ssh/config` entry written with `+ssh-rsa` / `+diffie-hellman-group1-sha1`. |
| **Is `blackberry` always correct?** | **Default, not guaranteed.** Device profile has editable `sshUser` (default `blackberry`). WiFi Storage username may differ (`smbUser`). Agent should use **`ssh_user` from job payload**; Bridge sends `device.sshUser`. Agent may verify against account 1000 home. |
| **Host key on desktop?** | **Accept unknown host** on first connect (`StrictHostKeyChecking=no`); Bridge does **not** persist device host keys today. |
| **SSH-only after bootstrap?** | **Mostly.** Terminal, Device Data (clipboard/PIM), APK install helper use **SSH**. **SMB remains** for Storage browser, device scan/port 445, and **bootstrap** until agent+SSH work. Term49 sideload (`.bar` via dev-mode browser) is separate — not via agent in v1. |

### BerryCore / device deps

| Question | Answer |
|----------|--------|
| **OpenSSH guaranteed after install.sh?** | **Expected but not verified by Bridge.** BerryCore ships OpenSSH via `packages/*.zip` + `pbpkgadd`. Agent should **check** `which sshd ssh-keygen` after `source .../env.sh` and set `status.last_error` if missing. Bridge treats missing OpenSSH as hard failure. |
| **install.sh -y fully unattended on Z10?** | **Upstream supports `-y` and `--dir`.** Bridge will pass non-interactive flags in `install_berrycore` job. **Please confirm** on fresh Z10: no prompts, unzip/pbpkgadd present. |
| **Post-reboot ensure_sshd?** | **Both.** BerryCore **should** ship boot hook or `@reboot` cron (preferred). Bridge **will** auto-send `ensure_sshd` job when SSH test returns **connection refused** on reconnect. |

### “Full automatic” scope (v1)

| Question | Answer |
|----------|--------|
| **v1 scope?** | **Bootstrap only:** BerryCore install + SSH key + sshd. **No** `run_command` / Term49 home / `.profile` jobs in v1. |
| **Term49 ~ paths pre-SSH?** | **Out of scope v1.** Agent uses `/accounts/1000/.ssh`, `/accounts/1000/shared/documents`, `/accounts/1000/shared/misc/berrycore` — not Term49 app data dirs. |
| **Success criterion?** | **No Term49 paste** for BerryCore install or SSH setup. **Term49 app** still installed once via Bridge sideload (dev mode). Ideal acceptance: wizard completes with **`echo berrybridge-ok`** over SSH and **no manual paste**. Interim: one RUNME watcher line acceptable until background agent works. |

### Acceptance (Bridge confirms test plan)

| Test | Bridge position |
|------|-----------------|
| **Fresh Z10, no Term49 paste, SSH ok** | **Pass = target.** Bridge will run this as primary acceptance when agent ships. |
| **Failure UI** | Bridge **will** surface: missing zip, BerryCore install failed (`last_error`), missing `.pub`, sshd not listening (connection refused), wrong SMB password / share. Partially implemented today for SMB/SSH errors. |
| **Idempotency** | **Required.** Re-run wizard must not duplicate `authorized_keys` entries (agent dedupes by fingerprint); BerryCore upgrade via `mode: upgrade` without breaking install path. |

### Recommended agent delivery (Bridge preference)

1. **`berrybridge-agent` inside BerryCore release** (extracted by `install.sh` hook into `$NATIVE_TOOLS` + creates `documents/berrybridge/inbox`).
2. **Post-install hook** runs `berrybridge-agent --watch` or installs cron.
3. **Fallback:** `documents/berrybridge/RUNME.txt` with single command for first boot.

### Bridge implementation timeline

| Milestone | State |
|-----------|--------|
| Path constants + spec | **Done** |
| All uploads to documents | **Done** |
| Term49 txt fallbacks | **Done** (interim) |
| Job upload + status poll | **Not started** — blocked on agent ≥ 0.1.0 |
| Agent detection + disable Term49 txt | **Not started** |

