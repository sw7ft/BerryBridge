export interface ParsedGitHubRepo {
  owner: string
  repo: string
  branch: string
  /** Subfolder within the repo (no leading/trailing slashes). */
  path: string
}

export interface GitHubPackageFile {
  path: string
  name: string
  type: 'bar' | 'apk'
  size: number
  downloadUrl: string
}

const GH_HEADERS = {
  Accept: 'application/vnd.github+json',
  'User-Agent': 'BerryBridge'
}

export function parseGitHubRepoInput(raw: string): ParsedGitHubRepo | null {
  const input = raw.trim()
  if (!input) return null

  try {
    if (input.startsWith('http://') || input.startsWith('https://')) {
      const url = new URL(input)
      if (!url.hostname.replace(/^www\./, '').endsWith('github.com')) return null
      const parts = url.pathname.split('/').filter(Boolean)
      if (parts.length < 2) return null
      const owner = parts[0]
      const repo = parts[1].replace(/\.git$/i, '')
      if (parts[2] === 'tree' && parts.length >= 4) {
        const branch = parts[3]
        const path = parts.slice(4).join('/')
        return { owner, repo, branch, path }
      }
      return { owner, repo, branch: 'main', path: '' }
    }
  } catch {
    return null
  }

  const slash = input.split('/').filter(Boolean)
  if (slash.length >= 2 && slash.length <= 4 && !input.includes('://')) {
    const [owner, repo, maybeBranch, ...rest] = slash
    if (maybeBranch && maybeBranch !== 'tree') {
      return {
        owner,
        repo: repo.replace(/\.git$/i, ''),
        branch: maybeBranch,
        path: rest.join('/')
      }
    }
    return { owner, repo: repo.replace(/\.git$/i, ''), branch: 'main', path: '' }
  }

  return null
}

async function ghFetch<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: GH_HEADERS })
  if (!res.ok) {
    const hint =
      res.status === 404
        ? ' — check the repo URL, branch, and folder path'
        : res.status === 403
          ? ' — GitHub API rate limit (try again in a few minutes)'
          : ''
    throw new Error(`GitHub API ${res.status}${hint}`)
  }
  return res.json() as Promise<T>
}

async function resolveBranch(owner: string, repo: string, branch: string): Promise<string> {
  const info = await ghFetch<{ default_branch: string }>(
    `https://api.github.com/repos/${owner}/${repo}`
  )
  if (branch && branch !== 'main') {
    try {
      await ghFetch(
        `https://api.github.com/repos/${owner}/${repo}/branches/${encodeURIComponent(branch)}`
      )
      return branch
    } catch {
      return info.default_branch
    }
  }
  return info.default_branch
}

export async function scanGitHubRepo(
  parsed: ParsedGitHubRepo,
  options?: { packageType?: 'bar' | 'apk' }
): Promise<{
  branch: string
  packages: GitHubPackageFile[]
}> {
  const branch = await resolveBranch(parsed.owner, parsed.repo, parsed.branch)
  const tree = await ghFetch<{
    tree: { path: string; type: string; size?: number }[]
  }>(
    `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`
  )

  const prefix = parsed.path ? `${parsed.path.replace(/\/+$/, '')}/` : ''
  const packages: GitHubPackageFile[] = []

  for (const node of tree.tree) {
    if (node.type !== 'blob') continue
    if (prefix && !node.path.startsWith(prefix)) continue
    const lower = node.path.toLowerCase()
    if (!lower.endsWith('.bar') && !lower.endsWith('.apk')) continue
    const type: 'bar' | 'apk' = lower.endsWith('.apk') ? 'apk' : 'bar'
    if (options?.packageType && type !== options.packageType) continue

    const name = node.path.split('/').pop() || node.path
    packages.push({
      path: node.path,
      name: name.replace(/\.(bar|apk)$/i, ''),
      type,
      size: node.size || 0,
      downloadUrl: `https://github.com/${parsed.owner}/${parsed.repo}/raw/${branch}/${node.path}`
    })
  }

  packages.sort((a, b) => a.name.localeCompare(b.name))
  return { branch, packages }
}

export function repoLabel(parsed: ParsedGitHubRepo): string {
  return parsed.path
    ? `${parsed.owner}/${parsed.repo}/${parsed.path}`
    : `${parsed.owner}/${parsed.repo}`
}

export function repoHtmlUrl(parsed: ParsedGitHubRepo, branch: string): string {
  const base = `https://github.com/${parsed.owner}/${parsed.repo}`
  if (parsed.path) {
    return `${base}/tree/${branch}/${parsed.path}`
  }
  return base
}
