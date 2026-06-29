import { app } from 'electron'
import { randomUUID } from 'crypto'
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import {
  DEVICE_PATHS,
  type BerryBridgeAgentStatus,
  type DeviceProfile
} from '@shared/types'
import {
  AGENT_MIN_VERSION,
  AGENT_POLL_INTERVAL_MS,
  AGENT_TIMEOUT_BERRYCORE_MS,
  AGENT_TIMEOUT_SSH_MS,
  agentJobFileName,
  agentReady,
  berrycoreJobPayload,
  ensureSshKeyJobPayload,
  pingJobPayload
} from '@shared/agent-jobs'
import type { SmbScanner } from './smb-scanner'
import {
  discoverSmbAccess,
  probeDocumentsDir,
  remoteUploadPath,
  uploadFileToDocuments,
  type SmbDeviceAccess
} from './smb-upload-target'

export const AGENT_TGZ_FILENAME = 'berrybridge-agent-bb10-0.1.0.tgz'

export interface AgentPollProgress {
  phase: 'agent-polling' | 'agent-running' | 'agent-done' | 'agent-error'
  message: string
  status?: BerryBridgeAgentStatus
}

export class BerryBridgeAgentService {
  constructor(private smb: SmbScanner) {}

  resolveAgentTgzPath(): string | null {
    const candidates = [
      join(process.resourcesPath, 'berrybridge-agent', AGENT_TGZ_FILENAME),
      join(app.getAppPath(), 'resources/berrybridge-agent', AGENT_TGZ_FILENAME),
      join(__dirname, '../../resources/berrybridge-agent', AGENT_TGZ_FILENAME),
      join(process.cwd(), 'berrybridge-agent-bb10-0.1.0.tgz')
    ]
    return candidates.find((p) => existsSync(p)) || null
  }

  async readStatus(device: DeviceProfile, access?: SmbDeviceAccess): Promise<BerryBridgeAgentStatus | null> {
    try {
      const conn = access ?? (await discoverSmbAccess(this.smb, device))
      const documentsDir = await probeDocumentsDir(this.smb, conn)
      const remotePath = this.agentRemotePath(documentsDir, 'status.json')
      const localPath = join(tmpdir(), `berrybridge-status-${randomUUID()}.json`)
      try {
        await this.smb.downloadFile(
          conn.host,
          conn.share,
          conn.password,
          remotePath,
          localPath,
          conn.username
        )
        return JSON.parse(readFileSync(localPath, 'utf8')) as BerryBridgeAgentStatus
      } finally {
        try {
          unlinkSync(localPath)
        } catch {
          /* ignore */
        }
      }
    } catch {
      return null
    }
  }

  isAgentReady(status: BerryBridgeAgentStatus | null): boolean {
    return agentReady(status, AGENT_MIN_VERSION)
  }

  async uploadAgentPackage(
    device: DeviceProfile,
    access?: SmbDeviceAccess,
    timeoutMs?: number
  ): Promise<{ uploaded: boolean; message: string }> {
    const tgz = this.resolveAgentTgzPath()
    if (!tgz) {
      return {
        uploaded: false,
        message: 'Agent package not bundled with Berry Bridge — BerryCore install.sh should install it from berrycore.zip.'
      }
    }

    await uploadFileToDocuments(this.smb, device, tgz, AGENT_TGZ_FILENAME, access, timeoutMs)
    return {
      uploaded: true,
      message: `Uploaded ${AGENT_TGZ_FILENAME} to documents (fallback bootstrap).`
    }
  }

  async submitJob(
    device: DeviceProfile,
    job: Record<string, unknown>,
    access?: SmbDeviceAccess
  ): Promise<{ jobId: string; jobFile: string; remotePath: string }> {
    const conn = access ?? (await discoverSmbAccess(this.smb, device))
    const documentsDir = await probeDocumentsDir(this.smb, conn)
    const jobId = String(job.id || randomUUID())
    const type = String(job.type || 'ping')
    const jobFile = agentJobFileName(type)
    const remotePath = this.agentRemotePath(documentsDir, `inbox/${jobFile}`)

    const localPath = join(tmpdir(), `berrybridge-job-${randomUUID()}.json`)
    writeFileSync(localPath, JSON.stringify({ ...job, id: jobId }, null, 2), 'utf8')
    try {
      await this.smb.uploadFile(
        conn.host,
        conn.share,
        conn.password,
        localPath,
        remotePath,
        conn.username
      )
      await this.touchTrigger(conn, documentsDir)
    } finally {
      try {
        unlinkSync(localPath)
      } catch {
        /* ignore */
      }
    }

    return { jobId, jobFile, remotePath }
  }

  async runPing(device: DeviceProfile, access?: SmbDeviceAccess): Promise<BerryBridgeAgentStatus | null> {
    await this.submitJob(device, pingJobPayload(), access)
    return this.pollStatus(device, (status) => Boolean(status.agent?.state), AGENT_TIMEOUT_SSH_MS, access)
  }

  async runInstallBerryCore(
    device: DeviceProfile,
    access?: SmbDeviceAccess,
    onProgress?: (progress: AgentPollProgress) => void
  ): Promise<{ ok: boolean; message: string; status?: BerryBridgeAgentStatus }> {
    const statusBefore = await this.readStatus(device, access)
    if (!this.isAgentReady(statusBefore)) {
      return {
        ok: false,
        message:
          'Berry Bridge agent not detected on device yet. Run install.sh in Term49 first — it installs the agent from berrycore.zip.'
      }
    }

    await this.submitJob(device, berrycoreJobPayload(), access)
    onProgress?.({
      phase: 'agent-running',
      message: 'Agent is installing BerryCore from documents…',
      status: statusBefore
    })

    const status = await this.pollStatus(
      device,
      (s) => s.berrycore?.installed === true || s.last_job?.state === 'completed',
      AGENT_TIMEOUT_BERRYCORE_MS,
      access,
      onProgress,
      (s) => s.last_job?.type === 'install_berrycore'
    )

    if (status?.berrycore?.installed) {
      return {
        ok: true,
        message: `BerryCore installed by agent${status.berrycore.version ? ` (v${status.berrycore.version})` : ''}.`,
        status
      }
    }

    const err = status?.agent?.last_error || status?.last_job?.message || 'BerryCore install timed out'
    return { ok: false, message: String(err), status: status || undefined }
  }

  async runInstallSshKey(
    device: DeviceProfile,
    pubFileName: string,
    access?: SmbDeviceAccess,
    onProgress?: (progress: AgentPollProgress) => void
  ): Promise<{ ok: boolean; message: string; status?: BerryBridgeAgentStatus }> {
    const statusBefore = await this.readStatus(device, access)
    if (!this.isAgentReady(statusBefore)) {
      return {
        ok: false,
        message:
          'Berry Bridge agent not detected — finish BerryCore install in Term49 first, or run the SSH commands manually.'
      }
    }

    const pubPath = `${DEVICE_PATHS.berrycore.transferDir}/${pubFileName}`
    await this.submitJob(device, ensureSshKeyJobPayload(pubFileName, pubPath), access)
    onProgress?.({
      phase: 'agent-running',
      message: 'Agent is configuring SSH (ssh-keygen, authorized_keys, sshd)…',
      status: statusBefore
    })

    const status = await this.pollStatus(
      device,
      (s) => s.ssh?.ready_for_bridge === true || s.ssh?.sshd_running === true,
      AGENT_TIMEOUT_SSH_MS,
      access,
      onProgress,
      (s) => s.last_job?.type === 'install_ssh_key'
    )

    if (status?.ssh?.ready_for_bridge || status?.ssh?.sshd_running) {
      return {
        ok: true,
        message: `SSH ready on port ${status.ssh?.port || 2022}. Test connection in Berry Bridge.`,
        status
      }
    }

    const err = status?.agent?.last_error || status?.last_job?.message || 'SSH setup timed out'
    return { ok: false, message: String(err), status: status || undefined }
  }

  private agentRemotePath(documentsDir: string, relative: string): string {
    const base = remoteUploadPath(documentsDir, 'berrybridge')
    return remoteUploadPath(base, relative)
  }

  private async touchTrigger(conn: SmbDeviceAccess, documentsDir: string): Promise<void> {
    const localPath = join(tmpdir(), `berrybridge-trigger-${randomUUID()}`)
    writeFileSync(localPath, `${new Date().toISOString()}\n`, 'utf8')
    const remotePath = this.agentRemotePath(documentsDir, 'inbox/TRIGGER')
    try {
      await this.smb.uploadFile(
        conn.host,
        conn.share,
        conn.password,
        localPath,
        remotePath,
        conn.username
      )
    } finally {
      try {
        unlinkSync(localPath)
      } catch {
        /* ignore */
      }
    }
  }

  private async pollStatus(
    device: DeviceProfile,
    isDone: (status: BerryBridgeAgentStatus) => boolean,
    timeoutMs: number,
    access?: SmbDeviceAccess,
    onProgress?: (progress: AgentPollProgress) => void,
    matchesJob?: (status: BerryBridgeAgentStatus) => boolean
  ): Promise<BerryBridgeAgentStatus | null> {
    const started = Date.now()
    let last: BerryBridgeAgentStatus | null = null

    while (Date.now() - started < timeoutMs) {
      last = await this.readStatus(device, access)
      if (last) {
        onProgress?.({
          phase: 'agent-polling',
          message: last.last_job?.message || last.agent?.state || 'Waiting for agent…',
          status: last
        })

        if (last.agent?.state === 'error' || last.agent?.last_error) {
          onProgress?.({
            phase: 'agent-error',
            message: String(last.agent.last_error || last.last_job?.message || 'Agent error'),
            status: last
          })
          return last
        }

        if (isDone(last) && (!matchesJob || matchesJob(last) || last.last_job?.state === 'completed')) {
          onProgress?.({
            phase: 'agent-done',
            message: last.last_job?.message || 'Agent finished.',
            status: last
          })
          return last
        }
      }

      await new Promise((r) => setTimeout(r, AGENT_POLL_INTERVAL_MS))
    }

    return last
  }
}
