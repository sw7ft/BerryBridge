# RDP Presence Agent — server API

Contract for **`rdp-manager.sw7ft.com`** to receive presence reports from the standalone Windows agent ([`rdp-presence-agent/`](../rdp-presence-agent/)).

## Overview

Each installed laptop/desktop runs a Windows service that POSTs its **hostname** and **IPv4** so operators can **whitelist the client IP** on RDP servers. Berry Bridge is not required on the client.

---

## Endpoints

### `POST /api/presence`

Register or refresh a client machine.

**Request**

```http
POST /api/presence HTTP/1.1
Host: rdp-manager.sw7ft.com
Content-Type: application/json
User-Agent: SW7FT-RdpPresenceAgent/1.0

{
  "hostname": "DESKTOP-ABC12",
  "ipv4": "203.0.113.45",
  "local_ipv4": "192.168.1.50",
  "timestamp": "2026-07-06T15:54:00Z"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `hostname` | string | yes | Windows computer name (`os.Hostname()` / `%COMPUTERNAME%`) |
| `ipv4` | string | yes | Primary address for **whitelist** — public IP if `/api/my-ip` works, else best local outbound IPv4 |
| `local_ipv4` | string | no | LAN address when different from `ipv4` (omit when same) |
| `timestamp` | string | yes | ISO 8601 UTC time of report |

**Successful response**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{"ok": true}
```

**Error responses**

| Status | When |
|--------|------|
| `400` | Invalid JSON or missing `hostname` / `ipv4` |
| `405` | Method not POST |
| `429` | Rate limited (recommended: per source IP) |
| `500` | Server error |

**Suggested server behavior**

1. Validate `ipv4` is a valid IPv4 literal.
2. Upsert record keyed by **`ipv4`** (whitelist key) with `hostname`, `local_ipv4`, `last_seen = now()`.
3. Treat `hostname` as informational only (not authenticated).
4. Rate-limit: e.g. max 1 POST per IP per 30 seconds.

**Example storage row**

| ipv4 | hostname | local_ipv4 | last_seen |
|------|----------|------------|-----------|
| 203.0.113.45 | DESKTOP-ABC12 | 192.168.1.50 | 2026-07-06T15:54:00Z |

---

### `GET /api/my-ip` (recommended)

Returns the client’s **public IPv4 as seen by the server** (for NAT laptops).

**Request**

```http
GET /api/my-ip HTTP/1.1
Host: rdp-manager.sw7ft.com
User-Agent: SW7FT-RdpPresenceAgent/1.0
```

**Successful response**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{"ipv4": "203.0.113.45"}
```

**Implementation notes**

- Use the TCP connection source IP, or the leftmost valid IPv4 in `X-Forwarded-For` when behind a reverse proxy.
- Agent calls this on each report cycle; if unavailable, falls back to local outbound IPv4.

---

## Agent retry behavior

| Event | Behavior |
|-------|----------|
| POST failure | Exponential backoff: 30s → 1m → 5m → 15m (cap) |
| POST success | Reset backoff; wait **5 minutes** (configurable via `heartbeat_seconds`) |
| IP or hostname change | POST immediately on next loop iteration |

---

## Optional client config

Path: `%ProgramData%\SW7FT\RdpPresence\config.json`

```json
{
  "presence_url": "https://rdp-manager.sw7ft.com/api/presence",
  "my_ip_url": "https://rdp-manager.sw7ft.com/api/my-ip",
  "heartbeat_seconds": 300
}
```

Use staging URLs by deploying this file before starting the service.

---

## Security

- **HTTPS only** in production.
- No install tokens in v1 — whitelist by **`ipv4`** only.
- Log and monitor for abuse; reject private/reserved IPs in `ipv4` if you only expect public addresses (optional policy).
- Open-source agent: [`rdp-presence-agent/`](../rdp-presence-agent/) (~300 lines) for audit.

---

## Minimal reference handler (Node/Express sketch)

```javascript
app.post('/api/presence', express.json(), (req, res) => {
  const { hostname, ipv4, local_ipv4, timestamp } = req.body || {}
  if (!hostname || !ipv4) return res.status(400).json({ ok: false, error: 'hostname and ipv4 required' })
  // upsert into DB / Redis for whitelist job
  res.json({ ok: true })
})

app.get('/api/my-ip', (req, res) => {
  const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '')
    .split(',')[0].trim().replace(/^::ffff:/, '')
  res.json({ ipv4: ip })
})
```

---

## Related

- Windows agent README: [`rdp-presence-agent/README.md`](../rdp-presence-agent/README.md)
- Releases: Git tag `rdp-presence-v1.0.0` builds standalone `RdpPresenceAgent-x64.exe` / `-x86.exe` (no third-party installer required)
