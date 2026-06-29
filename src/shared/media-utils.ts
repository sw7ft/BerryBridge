export type MediaKind = 'image' | 'video'

const IMAGE_EXTENSIONS = new Set([
  '.jpg',
  '.jpeg',
  '.jpe',
  '.jfif',
  '.pjpeg',
  '.png',
  '.gif',
  '.webp',
  '.bmp',
  '.heic',
  '.heif',
  '.tif',
  '.tiff',
  /** BB10 camera thumbnail sidecar — usually JPEG data. */
  '.thm'
])

const VIDEO_EXTENSIONS = new Set([
  '.mp4',
  '.mov',
  '.m4v',
  '.3gp',
  '.3g2',
  '.avi',
  '.mkv',
  '.wmv',
  '.webm',
  '.mpg',
  '.mpeg',
  '.3gpp'
])

/** BB10 camera / gallery naming when extension is missing or nonstandard. */
const BB10_IMAGE_NAME =
  /^(IMG[-_]?\d{8}[-_]|IMG_\d+|DSC\d+|PIC[-_]?\d+|Screenshot|photo_\d)/i

const BB10_VIDEO_NAME = /^(VID[-_]?\d{8}[-_]|VID_\d+|MVI_\d+)/i

export function fileExtension(name: string): string {
  const dot = name.lastIndexOf('.')
  if (dot < 0) return ''
  return name.slice(dot).toLowerCase()
}

export function getMediaKind(name: string): MediaKind | null {
  const ext = fileExtension(name)
  if (IMAGE_EXTENSIONS.has(ext)) return 'image'
  if (VIDEO_EXTENSIONS.has(ext)) return 'video'
  if (BB10_IMAGE_NAME.test(name)) return 'image'
  if (BB10_VIDEO_NAME.test(name)) return 'video'
  return null
}

export function isMediaFile(name: string): boolean {
  return getMediaKind(name) !== null
}

export function mimeTypeForMedia(name: string): string {
  const ext = fileExtension(name)
  switch (ext) {
    case '.jpg':
    case '.jpeg':
    case '.jpe':
    case '.jfif':
    case '.pjpeg':
    case '.thm':
      return 'image/jpeg'
    case '.png':
      return 'image/png'
    case '.gif':
      return 'image/gif'
    case '.webp':
      return 'image/webp'
    case '.bmp':
      return 'image/bmp'
    case '.heic':
    case '.heif':
      return 'image/heic'
    case '.tif':
    case '.tiff':
      return 'image/tiff'
    case '.mp4':
    case '.m4v':
      return 'video/mp4'
    case '.mov':
      return 'video/quicktime'
    case '.3gp':
    case '.3g2':
    case '.3gpp':
      return 'video/3gpp'
    case '.avi':
      return 'video/x-msvideo'
    case '.mkv':
      return 'video/x-matroska'
    case '.wmv':
      return 'video/x-ms-wmv'
    case '.webm':
      return 'video/webm'
    case '.mpg':
    case '.mpeg':
      return 'video/mpeg'
    default:
      if (BB10_IMAGE_NAME.test(name)) return 'image/jpeg'
      if (BB10_VIDEO_NAME.test(name)) return 'video/3gpp'
      return 'application/octet-stream'
  }
}

/** Max file size to pull over SMB for in-app preview. */
export function maxPreviewBytes(kind: MediaKind): number {
  return kind === 'video' ? 250 * 1024 * 1024 : 50 * 1024 * 1024
}
