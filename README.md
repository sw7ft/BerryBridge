# BerryBridge

Desktop device manager for [BerryCore](https://github.com/sw7ft/BerryCore) / BlackBerry 10 — SSH provisioning, WiFi Storage (SMB), BAR installation, and BerryCore release tracking.

Built with **Electron** for macOS, Linux, and Windows.

## Features

- **Auto device scan** — discovers BB10 devices on your LAN (dev mode, SSH 2022, WiFi Storage)
- **Device profiles** — IP, SSH port (2022), dev mode password, SMB credentials
- **SSH key provisioning** — generate keys, write `~/.ssh/config` (legacy RSA algorithms for BB10), install to device or via clipboard path
- **WiFi Storage / SMB** — SMB1 browser via smbclient (like Owl Files), browse `media`/`documents`, upload/download
- **BAR installation** — embedded [BB10 App Manager](https://github.com/zhetengbiji/bb10-app-manager/releases) protocol
- **BerryCore news** — watches GitHub releases for updates
- **Device paths** — clipboard, pimdata, BerryCore install locations

## Requirements

**WiFi Storage** uses a bundled `smbclient` (SMB1) inside Berry Bridge — no separate Samba install needed for the released app. Developers building from source can run `node scripts/bundle-smb-tools.js` after installing Samba, or rely on system `smbclient` if present.

## Development (macOS Apple Silicon)

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run dist:mac    # macOS (.dmg + .zip, arm64 + Intel)
npm run dist:linux  # Linux (.AppImage + .deb)
npm run dist:win    # Windows (.exe NSIS installer)
```

**GitHub releases:** push a tag like `v0.1.0` — CI builds all platforms and uploads installers. See [docs/RELEASE.md](docs/RELEASE.md).

## BerryCore Workflow

1. Download `berrycore.zip` + `install.sh`, upload to **Documents** (`/accounts/1000/shared/documents/`) via WiFi Storage, then run `sh install.sh` in Term49
2. Add device in BerryBridge with IP address
3. Provision SSH key → write config → `ssh passport` (or your host alias)
4. Use App Install for `.bar` sideloading with Development Mode enabled

## License

MIT
