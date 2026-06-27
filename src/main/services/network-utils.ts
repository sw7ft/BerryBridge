import { execSync } from 'child_process'
import { createConnection } from 'net'
import { reverse } from 'dns/promises'

/** Ports commonly open on BB10 / BerryCore devices */
export const BB10_PROBE_PORTS = [445, 2022, 443, 80, 4455] as const

export function detectSubnets(): string[] {
  const subnets = new Set<string>()

  try {
    if (process.platform === 'darwin' || process.platform === 'linux') {
      const out = execSync('ifconfig 2>/dev/null || ip -4 addr show 2>/dev/null', {
        encoding: 'utf8'
      })
      for (const line of out.split('\n')) {
        const match = line.match(/inet(?: addr)?:?\s*(\d+\.\d+\.\d+\.\d+)/)
        if (match && !match[1].startsWith('127.')) {
          subnets.add(match[1].split('.').slice(0, 3).join('.') + '.')
        }
      }
    } else if (process.platform === 'win32') {
      const out = execSync('ipconfig', { encoding: 'utf8' })
      for (const line of out.split('\n')) {
        const match = line.match(/IPv4 Address[.\s]*:\s*(\d+\.\d+\.\d+\.\d+)/)
        if (match && !match[1].startsWith('127.')) {
          subnets.add(match[1].split('.').slice(0, 3).join('.') + '.')
        }
      }
    }
  } catch {
    /* fall through */
  }

  if (subnets.size === 0) subnets.add('192.168.1.')
  return [...subnets]
}

export function generateIpRange(subnet: string): string[] {
  const prefix = subnet.endsWith('.') ? subnet : `${subnet}.`
  const ips: string[] = []
  for (let i = 1; i <= 254; i++) ips.push(`${prefix}${i}`)
  return ips
}

export function probePort(ip: string, port: number, timeoutMs = 600): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = createConnection({ host: ip, port, timeout: timeoutMs }, () => {
      socket.destroy()
      resolve(true)
    })
    socket.on('error', () => resolve(false))
    socket.on('timeout', () => {
      socket.destroy()
      resolve(false)
    })
  })
}

export async function probePorts(
  ip: string,
  ports: readonly number[],
  timeoutMs = 600
): Promise<number[]> {
  const results = await Promise.all(
    ports.map(async (port) => ((await probePort(ip, port, timeoutMs)) ? port : null))
  )
  return results.filter((p): p is number => p !== null)
}

export async function resolveHostname(ip: string): Promise<string | undefined> {
  try {
    const names = await reverse(ip)
    return names[0]
  } catch {
    return undefined
  }
}
