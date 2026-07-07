# SW7FT RDP Presence Agent

Standalone Windows background service that reports **computer name** and **IPv4 address** to [rdp-manager.sw7ft.com](https://rdp-manager.sw7ft.com) so your RDP servers can whitelist client IPs.

**Single `.exe` — no Inno Setup, no .NET, no Java, no separate installer.**

## What it does

- Runs as a Windows service (`RdpPresenceAgent`) at boot — no user login required
- POSTs JSON to `https://rdp-manager.sw7ft.com/api/presence`
- Re-checks every 5 minutes; re-posts when hostname or IP changes
- Retries with exponential backoff on network errors

## Install (end users)

1. Download **`RdpPresenceAgent-x64.exe`** from GitHub Releases (tag `rdp-presence-v*`).
2. **Double-click** the file and accept the UAC (Administrator) prompt.

   Or from an elevated Command Prompt:

   ```text
   RdpPresenceAgent-x64.exe -install
   ```

3. Done — the service installs to `C:\Program Files\SW7FT\RdpPresence\` and starts automatically.

32-bit Windows: use **`RdpPresenceAgent-x86.exe`**.

## Uninstall

- **Settings → Apps → Installed apps → SW7FT RDP Presence Agent → Uninstall**

Or elevated:

```text
"C:\Program Files\SW7FT\RdpPresence\rdp-presence-agent.exe" -uninstall
```

## Files after install

| Path | Purpose |
|------|---------|
| `C:\Program Files\SW7FT\RdpPresence\rdp-presence-agent.exe` | Service binary |
| `C:\ProgramData\SW7FT\RdpPresence\agent.log` | Rotating log |
| `C:\ProgramData\SW7FT\RdpPresence\config.json` | Optional overrides (see `config.json.example`) |

## Commands

| Command | Description |
|---------|-------------|
| *(double-click)* | First-time install (UAC prompt) |
| `-install` or `-setup` | Install service (Administrator) |
| `-uninstall` | Remove service and registry entry |
| `-start` / `-stop` / `-restart` | Service control |
| `-console` | Run in foreground for debugging |
| `-version` | Print version |

## Build from source

Requires Go 1.22+ only.

```bash
cd rdp-presence-agent
go mod tidy

GOOS=windows GOARCH=amd64 CGO_ENABLED=0 go build -ldflags="-s -w" -o RdpPresenceAgent-x64.exe .
GOOS=windows GOARCH=386 CGO_ENABLED=0 go build -ldflags="-s -w" -o RdpPresenceAgent-x86.exe .
```

CI builds both on tag `rdp-presence-v*`.

## Server API

See [docs/RDP-PRESENCE-API.md](../docs/RDP-PRESENCE-API.md).

## Privacy

Sends only hostname, IPv4, and timestamp. No filesystem access, keystrokes, or user data.

## License

MIT (same as Berry Bridge)
