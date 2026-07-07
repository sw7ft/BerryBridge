import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'http'
import {
  LOCAL_API_DEFAULT_PORT,
  type LocalApiHealth,
  type LocalApiInfo
} from '@shared/local-api'
import type { BarInstallApi } from './bar-install-api'

const MAX_BODY_BYTES = 256 * 1024

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload)
  })
  res.end(payload)
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += buf.length
    if (size > MAX_BODY_BYTES) {
      throw new Error('Request body too large')
    }
    chunks.push(buf)
  }
  if (chunks.length === 0) return {}
  const text = Buffer.concat(chunks).toString('utf8').trim()
  if (!text) return {}
  return JSON.parse(text) as unknown
}

export class LocalApiServer {
  private server: Server | null = null
  private port = LOCAL_API_DEFAULT_PORT

  constructor(
    private barInstall: BarInstallApi,
    private version: string
  ) {}

  start(): LocalApiInfo {
    const enabled = process.env.BERRYBRIDGE_API_ENABLED !== '0'
    const token = process.env.BERRYBRIDGE_API_TOKEN?.trim() || ''
    const port = Number(process.env.BERRYBRIDGE_API_PORT || LOCAL_API_DEFAULT_PORT)
    this.port = Number.isFinite(port) && port > 0 ? port : LOCAL_API_DEFAULT_PORT

    if (!enabled) {
      return this.buildInfo(false, token)
    }

    if (this.server) {
      return this.buildInfo(true, token)
    }

    this.server = createServer((req, res) => {
      void this.handleRequest(req, res, token)
    })

    this.server.listen(this.port, '127.0.0.1')
    return this.buildInfo(true, token)
  }

  stop(): void {
    if (!this.server) return
    this.server.close()
    this.server = null
  }

  getInfo(): LocalApiInfo {
    const enabled = process.env.BERRYBRIDGE_API_ENABLED !== '0' && Boolean(this.server)
    const token = process.env.BERRYBRIDGE_API_TOKEN?.trim() || ''
    return this.buildInfo(enabled, token)
  }

  private buildInfo(enabled: boolean, token: string): LocalApiInfo {
    const baseUrl = `http://127.0.0.1:${this.port}`
    return {
      enabled,
      port: this.port,
      baseUrl,
      tokenRequired: Boolean(token),
      endpoints: {
        health: `GET ${baseUrl}/v1/health`,
        devices: `GET ${baseUrl}/v1/devices`,
        manager: `GET ${baseUrl}/v1/install/manager`,
        installBar: `POST ${baseUrl}/v1/install/bar`,
        installCatalog: `POST ${baseUrl}/v1/install/catalog`
      }
    }
  }

  private authorize(req: IncomingMessage, token: string): boolean {
    if (!token) return true
    const header = req.headers.authorization || ''
    if (header === `Bearer ${token}`) return true
    const query = new URL(req.url || '/', `http://${req.headers.host || '127.0.0.1'}`).searchParams
    return query.get('token') === token
  }

  private async handleRequest(
    req: IncomingMessage,
    res: ServerResponse,
    token: string
  ): Promise<void> {
    const url = new URL(req.url || '/', `http://${req.headers.host || '127.0.0.1'}`)
    const path = url.pathname.replace(/\/+$/, '') || '/'

    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': 'http://127.0.0.1',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      })
      res.end()
      return
    }

    if (!this.authorize(req, token)) {
      sendJson(res, 401, { ok: false, error: 'Unauthorized — set Authorization: Bearer <token>.' })
      return
    }

    try {
      if (req.method === 'GET' && path === '/v1/health') {
        const manager = this.barInstall.getManagerInfo()
        const health: LocalApiHealth = {
          ok: true,
          service: 'berrybridge-local-api',
          version: this.version,
          managerReady: manager.ready === true
        }
        sendJson(res, 200, health)
        return
      }

      if (req.method === 'GET' && path === '/v1/devices') {
        sendJson(res, 200, { ok: true, devices: this.barInstall.listDevices() })
        return
      }

      if (req.method === 'GET' && path === '/v1/install/manager') {
        sendJson(res, 200, { ok: true, manager: this.barInstall.getManagerInfo() })
        return
      }

      if (req.method === 'POST' && path === '/v1/install/bar') {
        const body = (await readJsonBody(req)) as Record<string, unknown>
        const result = await this.barInstall.installBar({
          deviceId: typeof body.deviceId === 'string' ? body.deviceId : undefined,
          deviceIp: typeof body.deviceIp === 'string' ? body.deviceIp : undefined,
          barPath: typeof body.barPath === 'string' ? body.barPath : undefined,
          barPaths: Array.isArray(body.barPaths)
            ? body.barPaths.filter((p): p is string => typeof p === 'string')
            : undefined,
          devPassword: typeof body.devPassword === 'string' ? body.devPassword : undefined,
          openManager: body.openManager === true
        })
        sendJson(res, result.ok ? 200 : 400, result)
        return
      }

      if (req.method === 'POST' && path === '/v1/install/catalog') {
        const body = (await readJsonBody(req)) as Record<string, unknown>
        const deviceId = typeof body.deviceId === 'string' ? body.deviceId : ''
        const entryId = typeof body.entryId === 'string' ? body.entryId : ''
        if (!deviceId || !entryId) {
          sendJson(res, 400, { ok: false, message: 'deviceId and entryId are required.' })
          return
        }
        const result = await this.barInstall.installCatalog(deviceId, entryId)
        sendJson(res, result.ok ? 200 : 400, result)
        return
      }

      sendJson(res, 404, { ok: false, error: 'Not found' })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      sendJson(res, 400, { ok: false, message })
    }
  }
}
