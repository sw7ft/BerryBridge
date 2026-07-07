/** Default GitHub app archives bundled into Berry Bridge on first launch. */

export const BLACKBERRY10_APPS_REPO = 'sw7ft/blackberry10-apps'

export const DEFAULT_APP_STORE_REPOS_VERSION = 1

export interface DefaultAppStoreRepoSpec {
  owner: string
  repo: string
  branch: string
  path: string
  packageType: 'bar' | 'apk'
  title: string
}

export const DEFAULT_APP_STORE_REPOS: DefaultAppStoreRepoSpec[] = [
  {
    owner: 'sw7ft',
    repo: 'blackberry10-apps',
    branch: 'main',
    path: 'bars',
    packageType: 'bar',
    title: 'BlackBerry 10 Apps · native (.bar)'
  },
  {
    owner: 'sw7ft',
    repo: 'blackberry10-apps',
    branch: 'main',
    path: 'apks',
    packageType: 'apk',
    title: 'BlackBerry 10 Apps · Android (.apk)'
  }
]

export const BLACKBERRY10_APPS_URL = 'https://github.com/sw7ft/blackberry10-apps'
