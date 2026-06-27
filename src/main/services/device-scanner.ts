import { BB10_DEV_MODE, SSH_DEFAULTS, SMB_DEFAULTS } from '@shared/types'
import type { DeviceScanProgress, DiscoveredDevice, DeviceSignal } from '@shared/types'
import {
  BB10_PROBE_PORTS,
  detectSubnets,
  generateIpRange,
  probePorts,
  resolveHostname
} from './network-utils'

type ProgressCallback = (progress: DeviceScanProgress) => void

export class DeviceScanner {
  private aborted = false

  stop(): void {
    this.aborted = true
  }

  /**
   * Scan the LAN for BB10 / BerryCore devices.
   * Probes SMB (445), BerryCore SSH (2022), and dev-mode HTTPS (443/80).
   */
  async scan(
    options: {
      subnet?: string
      savedHosts?: string[]
      onProgress?: ProgressCallback
    } = {}
  ): Promise<DiscoveredDevice[]> {
    this.aborted = false
    const savedHosts = new Set(options.savedHosts ?? [])
    const subnets = options.subnet ? [options.subnet] : detectSubnets()
    const allIps = [...new Set(subnets.flatMap(generateIpRange))]
    const found: DiscoveredDevice[] = []
    const foundIps = new Set<string>()

    const emit = (partial: Partial<DeviceScanProgress>): void => {
      options.onProgress?.({
        phase: 'scanning',
        scanned: 0,
        total: allIps.length,
        subnet: subnets.join(', '),
        found: [...found],
        ...partial
      })
    }

    emit({ phase: 'scanning', scanned: 0, total: allIps.length })

    const batchSize = 40
    for (let i = 0; i < allIps.length; i += batchSize) {
      if (this.aborted) break

      const batch = allIps.slice(i, i + batchSize)
      const candidates = await Promise.all(
        batch.map(async (ip) => {
          const openPorts = await probePorts(ip, BB10_PROBE_PORTS)
          return openPorts.length > 0 ? { ip, openPorts } : null
        })
      )

      for (const candidate of candidates.filter(Boolean)) {
        if (this.aborted || !candidate) continue
        if (foundIps.has(candidate.ip)) continue

        emit({
          phase: 'identifying',
          scanned: Math.min(i + batchSize, allIps.length),
          total: allIps.length
        })

        const device = await this.identifyDevice(candidate.ip, candidate.openPorts, savedHosts)
        if (device) {
          found.push(device)
          foundIps.add(candidate.ip)
          emit({
            scanned: Math.min(i + batchSize, allIps.length),
            found: [...found]
          })
        }
      }

      emit({
        phase: 'scanning',
        scanned: Math.min(i + batchSize, allIps.length),
        total: allIps.length
      })
    }

    const result = found.sort((a, b) => {
      const rank = { high: 0, medium: 1, low: 2 }
      return rank[a.confidence] - rank[b.confidence] || a.ip.localeCompare(b.ip)
    })

    emit({ phase: 'done', scanned: allIps.length, found: result })
    return result
  }

  private async identifyDevice(
    ip: string,
    openPorts: number[],
    savedHosts: Set<string>
  ): Promise<DiscoveredDevice | null> {
    const signals: DeviceSignal[] = []
    let devModeVerified = false

    if (openPorts.includes(SMB_DEFAULTS.port)) signals.push('smb')
    if (openPorts.includes(SSH_DEFAULTS.port)) signals.push('ssh')

    if (openPorts.includes(443) || openPorts.includes(80)) {
      devModeVerified = await this.probeDevMode(ip)
      if (devModeVerified) signals.push('devMode')
    }

    // Filter out generic SMB-only hosts (likely not BB10)
    if (signals.length === 0) return null
    if (signals.length === 1 && signals[0] === 'smb' && !devModeVerified) {
      // SMB alone is weak signal — still include as low confidence for WiFi storage
    }

    const confidence = this.scoreConfidence(signals, devModeVerified, openPorts)
    if (confidence === 'low' && signals.length === 1 && signals[0] === 'smb') {
      // Skip random Windows/Linux SMB servers with no other BB10 indicators
      return null
    }

    const hostname = await resolveHostname(ip)

    return {
      ip,
      hostname,
      signals: [...new Set(signals)],
      confidence,
      smbOpen: openPorts.includes(SMB_DEFAULTS.port),
      sshOpen: openPorts.includes(SSH_DEFAULTS.port),
      devModeOpen: devModeVerified,
      sshPort: openPorts.includes(SSH_DEFAULTS.port) ? SSH_DEFAULTS.port : undefined,
      alreadySaved: savedHosts.has(ip)
    }
  }

  private scoreConfidence(
    signals: DeviceSignal[],
    devModeVerified: boolean,
    openPorts: number[]
  ): DiscoveredDevice['confidence'] {
    if (devModeVerified) return 'high'
    if (signals.includes('ssh') && signals.includes('smb')) return 'high'
    if (signals.includes('ssh') || openPorts.includes(443)) return 'medium'
    return 'low'
  }

  /** Verify BB10 development mode via login.cgi (same as bb10-app-manager) */
  private async probeDevMode(ip: string): Promise<boolean> {
    for (const scheme of ['https', 'http'] as const) {
      try {
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), 2500)
        const res = await fetch(
          `${scheme}://${ip}${BB10_DEV_MODE.loginPath}?request_version=1`,
          {
            headers: { 'User-Agent': BB10_DEV_MODE.userAgent },
            signal: controller.signal
          }
        )
        clearTimeout(timer)
        const body = await res.text()
        if (
          body.includes('<Status>') ||
          body.includes('PasswdChallenge') ||
          body.includes('<Success>')
        ) {
          return true
        }
      } catch {
        /* try next scheme */
      }
    }
    return false
  }
}
