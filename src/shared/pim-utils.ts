/** Strip BB10 PIM HTML to plain text for previews */
export function stripPimHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** Best-effort subject/title from BB10 message or Remember HTML */
export function extractPimTitle(html: string, fallback = 'Message'): string {
  const titleMatch =
    html.match(/<title[^>]*>([^<]+)<\/title>/i) ||
    html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i) ||
    html.match(/<meta[^>]+name="twitter:title"[^>]+content="([^"]+)"/i) ||
    html.match(/<h1[^>]*>([^<]+)<\/h1>/i)

  const raw = titleMatch?.[1]?.trim()
  if (raw && raw.length > 0 && raw !== '(no subject)') return decodeEntities(raw)

  const plain = stripPimHtml(html)
  const firstLine = plain.split('\n').find((line) => line.trim().length > 0)?.trim()
  if (firstLine && firstLine.length > 3) {
    return firstLine.length > 80 ? `${firstLine.slice(0, 77)}…` : firstLine
  }

  return fallback
}

export function previewText(text: string, max = 120): string {
  const oneLine = text.replace(/\s+/g, ' ').trim()
  if (oneLine.length <= max) return oneLine
  return `${oneLine.slice(0, max - 1)}…`
}

function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
}
