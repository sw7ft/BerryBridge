import { BERRYCORE_REPO, QNX_HANDHELDS_REPO } from '@shared/types'

const PATREON_URL = 'https://www.patreon.com/c/Sw7ft'
const SW7FT_GITHUB = 'https://github.com/sw7ft'

function openExternal(url: string) {
  window.berrybridge.shell.openExternal(url)
}

export function SidebarSupport() {
  return (
    <footer className="blend-sidebar-support">
      <p className="blend-sidebar-support-title">Support Sw7ft</p>
      <p className="blend-sidebar-support-about">
        Berry Bridge &amp; BerryCore are community projects from Sw7ft — open tooling, docs, and
        QNX education for BB10 and beyond.
      </p>
      <ul className="blend-sidebar-support-list">
        <li>
          <button type="button" onClick={() => openExternal(PATREON_URL)}>
            Patreon
          </button>
        </li>
        <li>
          <button type="button" onClick={() => openExternal(`https://github.com/${BERRYCORE_REPO}`)}>
            BerryCore on GitHub
          </button>
        </li>
        <li>
          <button type="button" onClick={() => openExternal(`https://github.com/${QNX_HANDHELDS_REPO}`)}>
            QNX-Handhelds
          </button>
        </li>
        <li>
          <button type="button" onClick={() => openExternal(SW7FT_GITHUB)}>
            @sw7ft on GitHub
          </button>
        </li>
      </ul>
      <p className="blend-sidebar-support-note">
        Star repos, report issues, share docs, or join on Patreon — every bit helps.
      </p>
    </footer>
  )
}
