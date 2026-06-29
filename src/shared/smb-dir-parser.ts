import type { SmbFileEntry } from './types'

/** smbclient pads filenames to 36 columns after two leading spaces. */
const SMB_NAME_FIELD_WIDTH = 36

const SKIP_LINE =
  /^(blocks of size|domain:|server:|Sharename|----|\s*$|\.\.\.\.)/i

export function parseDirListing(output: string): SmbFileEntry[] {
  const entries: SmbFileEntry[] = []

  for (const rawLine of output.split('\n')) {
    const line = rawLine.replace(/\r$/, '')
    if (!line.trim() || SKIP_LINE.test(line.trim())) continue

    const entry = parseDirLine(line)
    if (!entry) continue
    if (entry.name === '.' || entry.name === '..') continue
    entries.push(entry)
  }

  return entries.sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
    return a.name.localeCompare(b.name)
  })
}

function parseDirLine(line: string): SmbFileEntry | null {
  if (!line.startsWith('  ')) return null

  const fixed = parseFixedWidthLine(line)
  if (fixed) return fixed

  const regex = parseRegexLine(line)
  if (regex) return regex

  if (line.includes('\t')) {
    return parseTabLine(line)
  }

  return null
}

function parseFixedWidthLine(line: string): SmbFileEntry | null {
  if (line.length < SMB_NAME_FIELD_WIDTH + 2) return null

  const name = line.slice(2, 2 + SMB_NAME_FIELD_WIDTH).trim()
  if (!name) return null

  const rest = line.slice(2 + SMB_NAME_FIELD_WIDTH).trim()
  if (!rest) return null

  const withAttrs = rest.match(/^([A-Za-z]+)\s+(\d+)\s+(.+)$/)
  if (withAttrs) {
    const flags = withAttrs[1].toUpperCase()
    return {
      name,
      isDirectory: flags.includes('D'),
      size: parseInt(withAttrs[2], 10) || 0,
      modified: withAttrs[3].trim()
    }
  }

  const noAttrs = rest.match(/^(\d+)\s+(.+)$/)
  if (noAttrs) {
    return {
      name,
      isDirectory: parseInt(noAttrs[1], 10) === 0 && !fileExtension(name),
      size: parseInt(noAttrs[1], 10) || 0,
      modified: noAttrs[2].trim()
    }
  }

  return null
}

function parseRegexLine(line: string): SmbFileEntry | null {
  const withAttrs = line.match(/^\s{2}(.+?)\s{2,}([A-Za-z]+)\s+(\d+)\s+(.+)$/)
  if (withAttrs) {
    const flags = withAttrs[2].toUpperCase()
    return {
      name: withAttrs[1].trim(),
      isDirectory: flags.includes('D'),
      size: parseInt(withAttrs[3], 10) || 0,
      modified: withAttrs[4].trim()
    }
  }

  const noAttrs = line.match(/^\s{2}(.+?)\s{2,}(\d+)\s+([A-Za-z]{3}\s.+\d{4})$/)
  if (noAttrs) {
    return {
      name: noAttrs[1].trim(),
      isDirectory: false,
      size: parseInt(noAttrs[2], 10) || 0,
      modified: noAttrs[3].trim()
    }
  }

  return null
}

function parseTabLine(line: string): SmbFileEntry | null {
  const cols = line.trim().split('\t').map((c) => c.trim())
  if (cols.length < 2) return null

  const name = cols[0]
  const maybeFlags = cols[1]?.toUpperCase() || ''
  if (/^[A-Z]+$/.test(maybeFlags) && cols.length >= 3) {
    return {
      name,
      isDirectory: maybeFlags.includes('D'),
      size: parseInt(cols[2], 10) || 0,
      modified: cols.slice(3).join(' ').trim() || undefined
    }
  }

  const size = parseInt(cols[1], 10)
  if (!Number.isFinite(size)) return null
  return {
    name,
    isDirectory: size === 0 && !fileExtension(name),
    size,
    modified: cols.slice(2).join(' ').trim() || undefined
  }
}

function fileExtension(name: string): string {
  const dot = name.lastIndexOf('.')
  if (dot < 0) return ''
  return name.slice(dot).toLowerCase()
}
