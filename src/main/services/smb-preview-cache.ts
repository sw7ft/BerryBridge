import { app, net, protocol } from 'electron'
import { createHash } from 'crypto'
import { existsSync, mkdirSync, readFileSync, statSync, unlinkSync } from 'fs'
import { basename, extname, join, resolve, sep } from 'path'
import { pathToFileURL } from 'url'
import { formatBytes, smbUploadTimeoutMs } from '@shared/smb-utils'
import { getMediaKind, maxPreviewBytes, mimeTypeForMedia, type MediaKind } from '@shared/media-utils'

const SCHEME = 'berrybridge-media'
const SMB_PREVIEW_MIN_TIMEOUT_MS = 60_000

export function registerSmbPreviewProtocol(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: SCHEME,
      privileges: {
        standard: true,
        secure: true,
        bypassCSP: true,
        supportFetchAPI: true,
        stream: true,
        corsEnabled: true
      }
    }
  ])
}

export function setupSmbPreviewProtocolHandler(): void {
  protocol.handle(SCHEME, async (request) => {
    const filePath = resolvePreviewFilePath(request.url)
    if (!filePath) {
      return new Response('Bad request', { status: 400 })
    }
    if (!existsSync(filePath)) {
      return new Response('Not found', { status: 404 })
    }

    const fileName = basename(filePath)
    const mimeType = mimeTypeForMedia(fileName)

    try {
      const fileResponse = await net.fetch(pathToFileURL(filePath).toString())
      const buffer = Buffer.from(await fileResponse.arrayBuffer())
      return new Response(new Uint8Array(buffer), {
        headers: {
          'Content-Type': mimeType,
          'Content-Length': String(buffer.length),
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'private, max-age=3600'
        }
      })
    } catch {
      const buffer = readFileSync(filePath)
      return new Response(new Uint8Array(buffer), {
        headers: {
          'Content-Type': mimeType,
          'Content-Length': String(buffer.length),
          'Access-Control-Allow-Origin': '*'
        }
      })
    }
  })
}

function resolvePreviewFilePath(requestUrl: string): string | null {
  try {
    const url = new URL(requestUrl)
    const fileName = decodeURIComponent(url.pathname.replace(/^\/+/, ''))
    if (!fileName || fileName.includes('/') || fileName.includes('\\')) {
      return null
    }

    const filePath = resolve(previewCacheDir(), fileName)
    const cacheRoot = resolve(previewCacheDir())
    if (filePath !== cacheRoot && !filePath.startsWith(cacheRoot + sep)) {
      return null
    }
    return filePath
  } catch {
    return null
  }
}

export function previewCacheDir(): string {
  const dir = join(app.getPath('userData'), 'smb-preview-cache')
  mkdirSync(dir, { recursive: true })
  return dir
}

function cacheFileName(host: string, share: string, remotePath: string): string {
  const hash = createHash('sha256').update(`${host}|${share}|${remotePath}`).digest('hex').slice(0, 24)
  return `${hash}${extname(remotePath).toLowerCase()}`
}

export function previewMediaUrl(fileName: string): string {
  return `${SCHEME}://local/${encodeURIComponent(fileName)}`
}

function looksLikeImageBuffer(data: Buffer): boolean {
  if (data.length < 4) return false
  if (data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return true
  if (data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4e && data[3] === 0x47) return true
  if (data[0] === 0x47 && data[1] === 0x49 && data[2] === 0x46) return true
  if (data[0] === 0x42 && data[1] === 0x4d) return true
  return false
}

function looksLikeVideoBuffer(data: Buffer): boolean {
  if (data.length < 12) return false
  if (data[4] === 0x66 && data[5] === 0x74 && data[6] === 0x79 && data[7] === 0x70) return true
  if (data[0] === 0x1a && data[1] === 0x45 && data[2] === 0xdf && data[3] === 0xa3) return true
  return false
}

function validatePreviewBuffer(data: Buffer, kind: MediaKind): void {
  if (kind === 'image' && !looksLikeImageBuffer(data)) {
    throw new Error(
      'Downloaded file is not a readable image — try Download, or reconnect and preview again.'
    )
  }
  if (kind === 'video' && !looksLikeVideoBuffer(data) && !looksLikeImageBuffer(data)) {
    throw new Error(
      'Downloaded file does not look like a video — try Download instead.'
    )
  }
}

function buildPreviewUrl(localPath: string, kind: MediaKind, mimeType: string, cacheName: string): string {
  const data = readFileSync(localPath)
  validatePreviewBuffer(data, kind)

  if (kind === 'image') {
    return `data:${mimeType};base64,${data.toString('base64')}`
  }

  return previewMediaUrl(cacheName)
}

export interface SmbMediaPreviewResult {
  url: string
  kind: 'image' | 'video'
  mimeType: string
  name: string
  size: number
  cached: boolean
}

export async function ensureSmbMediaPreview(
  download: (localPath: string, timeoutMs: number) => Promise<void>,
  host: string,
  share: string,
  remotePath: string,
  expectedSize = 0
): Promise<SmbMediaPreviewResult> {
  const name = basename(remotePath)
  const kind = getMediaKind(name)
  if (!kind) {
    throw new Error('Not a supported photo or video file')
  }

  const limit = maxPreviewBytes(kind)
  if (expectedSize > limit) {
    throw new Error(
      `File too large to preview (${formatBytes(expectedSize)}). Use Download for files over ${formatBytes(limit)}.`
    )
  }

  const cacheName = cacheFileName(host, share, remotePath)
  const localPath = join(previewCacheDir(), cacheName)
  let cached = false

  if (existsSync(localPath)) {
    const size = statSync(localPath).size
    if (size > 0 && (!expectedSize || size === expectedSize)) {
      try {
        validatePreviewBuffer(readFileSync(localPath), kind)
        cached = true
      } catch {
        try {
          unlinkSync(localPath)
        } catch {
          /* ignore */
        }
      }
    }
  }

  if (!cached) {
    const timeoutMs = Math.max(SMB_PREVIEW_MIN_TIMEOUT_MS, smbUploadTimeoutMs(expectedSize || limit))
    await download(localPath, timeoutMs)
    if (!existsSync(localPath) || statSync(localPath).size === 0) {
      throw new Error('Preview download failed — file is empty or missing')
    }
    const downloaded = statSync(localPath).size
    if (downloaded > limit) {
      throw new Error(
        `File too large to preview (${formatBytes(downloaded)}). Use Download instead.`
      )
    }
  }

  const mimeType = mimeTypeForMedia(name)
  const url = buildPreviewUrl(localPath, kind, mimeType, cacheName)

  return {
    url,
    kind,
    mimeType,
    name,
    size: statSync(localPath).size,
    cached
  }
}
