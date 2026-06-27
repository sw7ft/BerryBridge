import Store from 'electron-store'
import { BERRYCORE_REPO, type BerryCoreRelease } from '@shared/types'

interface FeedStore {
  lastSeenBerryCoreRelease: string | null
}

export class BerryCoreFeed {
  private store = new Store<FeedStore>({
    name: 'berrybridge-feed',
    defaults: { lastSeenBerryCoreRelease: null }
  })

  async fetchLatest(): Promise<BerryCoreRelease | null> {
    const res = await fetch(`https://api.github.com/repos/${BERRYCORE_REPO}/releases/latest`, {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'BerryBridge' }
    })
    if (!res.ok) return null
    const data = await res.json()
    return this.mapRelease(data)
  }

  async fetchReleases(limit = 10): Promise<BerryCoreRelease[]> {
    const res = await fetch(
      `https://api.github.com/repos/${BERRYCORE_REPO}/releases?per_page=${limit}`,
      { headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'BerryBridge' } }
    )
    if (!res.ok) return []
    const data = await res.json()
    const lastSeen = this.store.get('lastSeenBerryCoreRelease')
    return (data as Record<string, unknown>[]).map((r) => ({
      ...this.mapRelease(r),
      isNew: lastSeen ? r.tag_name !== lastSeen && !lastSeen.includes(r.tag_name) : false
    }))
  }

  async checkForNew(): Promise<{ hasNew: boolean; release: BerryCoreRelease | null }> {
    const latest = await this.fetchLatest()
    if (!latest) return { hasNew: false, release: null }

    const lastSeen = this.store.get('lastSeenBerryCoreRelease')
    const hasNew = !lastSeen || latest.tag !== lastSeen

    if (hasNew) {
      latest.isNew = true
    }

    return { hasNew, release: latest }
  }

  markSeen(tag: string): void {
    this.store.set('lastSeenBerryCoreRelease', tag)
  }

  private mapRelease(data: Record<string, unknown>): BerryCoreRelease {
    const assetsRaw = data.assets
    const assets = Array.isArray(assetsRaw)
      ? assetsRaw.map((a) => {
          const asset = a as Record<string, unknown>
          return {
            name: String(asset.name || ''),
            downloadUrl: String(asset.browser_download_url || ''),
            size: Number(asset.size || 0)
          }
        })
      : []

    return {
      tag: String(data.tag_name || ''),
      name: String(data.name || data.tag_name || ''),
      publishedAt: String(data.published_at || ''),
      htmlUrl: String(data.html_url || ''),
      body: String(data.body || ''),
      assets
    }
  }
}
