import Store from 'electron-store'
import { app, dialog } from 'electron'
import { existsSync, mkdirSync, statSync } from 'fs'
import { dirname, join } from 'path'
import { randomUUID } from 'crypto'
import type {
  BackupPlan,
  BackupProgress,
  BackupRunRecord,
  BackupRunResult,
  DeviceProfile
} from '@shared/types'
import { BACKUP_FOLDER_PRESETS } from '@shared/backup-presets'
import { formatBytes, smbUploadTimeoutMs } from '@shared/smb-utils'
import type { SmbScanner } from './smb-scanner'
import { discoverSmbAccess } from './smb-upload-target'

interface BackupStoreSchema {
  plans: BackupPlan[]
  runs: BackupRunRecord[]
}

interface RemoteFile {
  remotePath: string
  size: number
}

const MAX_RUN_HISTORY = 40
const MAX_SCAN_DEPTH = 48

export class BackupService {
  private store = new Store<BackupStoreSchema>({
    name: 'berrybridge-backup',
    defaults: { plans: [], runs: [] }
  })

  constructor(private smb: SmbScanner) {}

  listPlans(deviceId?: string): BackupPlan[] {
    const plans = this.store.get('plans')
    return deviceId ? plans.filter((p) => p.deviceId === deviceId) : plans
  }

  savePlan(plan: BackupPlan): BackupPlan {
    const plans = this.store.get('plans')
    const idx = plans.findIndex((p) => p.id === plan.id)
    const now = new Date().toISOString()
    const entry: BackupPlan = {
      ...plan,
      updatedAt: now,
      createdAt: idx >= 0 ? plans[idx].createdAt : plan.createdAt || now
    }
    if (idx >= 0) plans[idx] = entry
    else plans.push(entry)
    this.store.set('plans', plans)
    return entry
  }

  deletePlan(planId: string): boolean {
    const plans = this.store.get('plans')
    const idx = plans.findIndex((p) => p.id === planId)
    if (idx < 0) return false
    plans.splice(idx, 1)
    this.store.set('plans', plans)
    return true
  }

  listRuns(deviceId?: string): BackupRunRecord[] {
    const runs = this.store.get('runs')
    const filtered = deviceId ? runs.filter((r) => r.deviceId === deviceId) : runs
    return filtered.sort((a, b) => b.startedAt.localeCompare(a.startedAt))
  }

  defaultBackupRoot(device: DeviceProfile): string {
    const safeName = device.name.replace(/[^\w.-]+/g, '_') || device.id.slice(0, 8)
    return join(app.getPath('documents'), 'BerryBridge Backups', safeName)
  }

  async chooseBackupRoot(current?: string): Promise<string | null> {
    const { filePaths, canceled } = await dialog.showOpenDialog({
      title: 'Choose backup folder on this computer',
      defaultPath: current || app.getPath('documents'),
      properties: ['openDirectory', 'createDirectory']
    })
    if (canceled || !filePaths[0]) return null
    return filePaths[0]
  }

  async resolvePresetFolders(sessionId: string, presetIds: string[]): Promise<string[]> {
    const resolved: string[] = []
    for (const presetId of presetIds) {
      const preset = BACKUP_FOLDER_PRESETS.find((p) => p.id === presetId)
      if (!preset) continue
      const path = await this.resolveFirstExistingDir(sessionId, preset.candidates)
      if (path) resolved.push(path)
    }
    return [...new Set(resolved)]
  }

  async runBackup(
    device: DeviceProfile,
    options: {
      share?: string
      folders: string[]
      localRoot: string
      planId?: string
      planName?: string
    },
    onProgress?: (p: BackupProgress) => void
  ): Promise<BackupRunResult> {
    const emit = (progress: BackupProgress) => onProgress?.(progress)
    const runId = randomUUID()
    const startedAt = new Date().toISOString()

    if (!device.smbPassword) {
      return this.failRun(device, options, runId, startedAt, 'WiFi Storage password required on device profile.', emit)
    }

    if (options.folders.length === 0) {
      return this.failRun(device, options, runId, startedAt, 'Select at least one folder to back up.', emit)
    }

    let sessionId: string | null = null

    try {
      emit({ phase: 'connecting', message: `Connecting to ${device.name}…`, percent: 0 })

      const access = await discoverSmbAccess(this.smb, device)
      const share = options.share || access.share
      sessionId = await this.smb.openSession(
        access.host,
        share,
        access.password,
        access.username
      )

      emit({ phase: 'scanning', message: 'Scanning folders for files…', percent: 0 })

      const allFiles: RemoteFile[] = []
      for (const folder of options.folders) {
        emit({ phase: 'scanning', message: `Scanning ${folder}…`, folder })
        allFiles.push(...(await this.collectFiles(sessionId, folder)))
      }

      if (allFiles.length === 0) {
        return this.failRun(
          device,
          options,
          runId,
          startedAt,
          'No files found in the selected folders — check paths or browse in Storage.',
          emit
        )
      }

      const stamp = startedAt.replace(/[:.]/g, '-').slice(0, 19)
      const destination = join(options.localRoot, stamp)
      mkdirSync(destination, { recursive: true })

      const bytesTotal = allFiles.reduce((sum, f) => sum + f.size, 0)
      let bytesDone = 0
      let skippedCount = 0
      let errorCount = 0
      let copiedCount = 0

      for (let i = 0; i < allFiles.length; i++) {
        const file = allFiles[i]
        const localPath = join(destination, file.remotePath.split('/').join(join.sep))
        mkdirSync(dirname(localPath), { recursive: true })

        const percent =
          bytesTotal > 0
            ? Math.round((bytesDone / bytesTotal) * 100)
            : Math.round(((i + 1) / allFiles.length) * 100)

        emit({
          phase: 'copying',
          message: `Copying ${file.remotePath} (${i + 1}/${allFiles.length})`,
          file: file.remotePath,
          fileIndex: i + 1,
          fileCount: allFiles.length,
          bytesDone,
          bytesTotal,
          percent
        })

        if (existsSync(localPath) && statSync(localPath).size === file.size && file.size > 0) {
          skippedCount++
          bytesDone += file.size
          continue
        }

        try {
          await this.smb.downloadFile(
            access.host,
            share,
            access.password,
            file.remotePath,
            localPath,
            access.username,
            smbUploadTimeoutMs(Math.max(file.size, 1024 * 1024))
          )
          copiedCount++
          bytesDone += file.size
        } catch (err) {
          errorCount++
          const hint = err instanceof Error ? err.message : String(err)
          emit({
            phase: 'copying',
            message: `Skipped ${file.remotePath}: ${hint}`,
            file: file.remotePath,
            fileIndex: i + 1,
            fileCount: allFiles.length,
            bytesDone,
            bytesTotal,
            percent
          })
        }
      }

      const ok = errorCount === 0
      const message = ok
        ? `Backed up ${copiedCount} file(s) (${formatBytes(bytesDone)})${skippedCount ? ` — ${skippedCount} unchanged skipped` : ''}.`
        : `Backup finished with ${errorCount} error(s). ${copiedCount} file(s) copied.`

      const run: BackupRunRecord = {
        id: runId,
        deviceId: device.id,
        planId: options.planId,
        planName: options.planName,
        share,
        folders: options.folders,
        destination,
        startedAt,
        finishedAt: new Date().toISOString(),
        ok,
        message,
        fileCount: copiedCount,
        bytesTotal: bytesDone,
        skippedCount,
        errorCount
      }

      this.pushRun(run)
      this.updatePlanAfterRun(options.planId, run)

      emit({
        phase: 'done',
        message,
        percent: 100,
        bytesDone,
        bytesTotal
      })

      return { ok, message, destination, run }
    } catch (err) {
      const hint = err instanceof Error ? err.message : String(err)
      return this.failRun(device, options, runId, startedAt, hint, emit)
    } finally {
      if (sessionId) this.smb.closeSession(sessionId)
    }
  }

  private updatePlanAfterRun(planId: string | undefined, run: BackupRunRecord): void {
    if (!planId) return
    const plans = this.store.get('plans')
    const plan = plans.find((p) => p.id === planId)
    if (!plan) return
    plan.lastRunAt = run.finishedAt
    plan.lastRunOk = run.ok
    plan.lastRunMessage = run.message
    this.store.set('plans', plans)
  }

  private failRun(
    device: DeviceProfile,
    options: {
      folders: string[]
      localRoot: string
      planId?: string
      planName?: string
      share?: string
    },
    runId: string,
    startedAt: string,
    message: string,
    emit?: (p: BackupProgress) => void
  ): BackupRunResult {
    emit?.({ phase: 'error', message, percent: 0 })
    const run: BackupRunRecord = {
      id: runId,
      deviceId: device.id,
      planId: options.planId,
      planName: options.planName,
      share: options.share || '',
      folders: options.folders,
      destination: options.localRoot,
      startedAt,
      finishedAt: new Date().toISOString(),
      ok: false,
      message,
      fileCount: 0,
      bytesTotal: 0,
      skippedCount: 0,
      errorCount: 0
    }
    this.pushRun(run)
    return { ok: false, message, destination: options.localRoot, run }
  }

  private pushRun(run: BackupRunRecord): void {
    const runs = this.store.get('runs')
    runs.unshift(run)
    if (runs.length > MAX_RUN_HISTORY) runs.length = MAX_RUN_HISTORY
    this.store.set('runs', runs)
  }

  private async resolveFirstExistingDir(
    sessionId: string,
    candidates: string[]
  ): Promise<string | null> {
    for (const path of candidates) {
      try {
        await this.smb.listDirSession(sessionId, path)
        return path
      } catch {
        /* try next candidate */
      }
    }
    return null
  }

  private async collectFiles(
    sessionId: string,
    remoteDir: string,
    depth = 0
  ): Promise<RemoteFile[]> {
    if (depth > MAX_SCAN_DEPTH) return []

    let entries
    try {
      entries = await this.smb.listDirSession(sessionId, remoteDir)
    } catch {
      return []
    }

    const files: RemoteFile[] = []
    for (const entry of entries) {
      const remotePath = remoteDir ? `${remoteDir}/${entry.name}` : entry.name
      if (entry.isDirectory) {
        files.push(...(await this.collectFiles(sessionId, remotePath, depth + 1)))
      } else {
        files.push({ remotePath, size: entry.size })
      }
    }
    return files
  }
}
