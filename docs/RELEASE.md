# Berry Bridge — first release checklist

Tag **`v0.1.0`** (or current `package.json` version) to trigger [`.github/workflows/release.yml`](../.github/workflows/release.yml).

## Expected GitHub Release assets

| Platform | Files | Verified locally |
|----------|-------|------------------|
| **macOS Apple Silicon** | `Berry Bridge-0.1.0-arm64.dmg`, `Berry Bridge-0.1.0-arm64-mac.zip` | Yes (Jun 2026) |
| **macOS Intel** | `Berry Bridge-0.1.0.dmg`, `Berry Bridge-0.1.0-mac.zip` | CI (macos-latest) |
| **Windows** | `Berry Bridge-Setup-0.1.0.exe` (x64 NSIS) | CI (windows-latest) |
| **Linux** | `Berry Bridge-0.1.0.AppImage`, `berrybridge_0.1.0_amd64.deb` | CI (ubuntu-latest) |

Blockmap files (`.blockmap`) are included for auto-update support later.

## Before tagging

1. Bump `version` in `package.json`.
2. Regenerate icons if `icon-2.png` changed: `npm run icons`
3. Confirm production build: `npm run build`
4. Optional local mac smoke test: `npm run dist:mac`

## Publish

```bash
git tag v0.1.0
git push origin v0.1.0
```

GitHub Actions builds all three platforms and attaches installers to the release.

## Notes

- **macOS code signing** is not configured yet — Gatekeeper may show an “unidentified developer” warning on first open. Users can right-click → Open.
- **Windows SmartScreen** may warn similarly until the app is signed.
- WiFi Storage still requires `smbclient` (Samba) on the host machine — see [README](../README.md).
