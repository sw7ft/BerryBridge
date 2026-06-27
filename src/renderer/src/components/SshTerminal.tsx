import { useCallback, useEffect, useRef, useState } from 'react'
import { Terminal } from 'xterm'
import { FitAddon } from '@xterm/addon-fit'
import 'xterm/css/xterm.css'
import type { DeviceProfile } from '@shared/types'

interface Props {
  device: DeviceProfile | null
  reconnectKey?: number
  onStatus?: (msg: string) => void
  onConnectedChange?: (connected: boolean) => void
}

function endpointLabel(device: DeviceProfile): string {
  return device.sshHostAlias || `${device.sshUser}@${device.host}:${device.sshPort}`
}

export function SshTerminal({
  device,
  reconnectKey = 0,
  onStatus,
  onConnectedChange
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)
  const fitRef = useRef<FitAddon | null>(null)
  const sessionRef = useRef<string | null>(null)
  const resizeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onStatusRef = useRef(onStatus)
  const onConnectedRef = useRef(onConnectedChange)
  const [ready, setReady] = useState(false)

  onStatusRef.current = onStatus
  onConnectedRef.current = onConnectedChange

  const fitTerminal = useCallback((): boolean => {
    const container = containerRef.current
    const fit = fitRef.current
    const term = termRef.current
    if (!container || !fit || !term) return false
    if (container.clientWidth < 24 || container.clientHeight < 24) return false

    fit.fit()
    if (term.cols < 2 || term.rows < 2) return false

    if (sessionRef.current) {
      const sid = sessionRef.current
      const cols = term.cols
      const rows = term.rows
      if (resizeTimerRef.current) clearTimeout(resizeTimerRef.current)
      resizeTimerRef.current = setTimeout(() => {
        resizeTimerRef.current = null
        if (sessionRef.current === sid) {
          window.berrybridge.terminal.resize(sid, cols, rows)
        }
      }, 120)
    }
    return true
  }, [])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      lineHeight: 1.3,
      fontFamily: '"SF Mono", Menlo, Monaco, "Cascadia Code", monospace',
      theme: {
        background: '#050505',
        foreground: '#e8e8e8',
        cursor: '#25e960',
        cursorAccent: '#050505',
        selectionBackground: '#25e96055',
        black: '#050505',
        red: '#ff6b6b',
        green: '#25e960',
        yellow: '#f0c040',
        blue: '#00a2e8',
        magenta: '#c678dd',
        cyan: '#56d4dd',
        white: '#e8e8e8',
        brightBlack: '#666666',
        brightGreen: '#25e960',
        brightCyan: '#00a2e8'
      },
      scrollback: 8000
    })

    const fit = new FitAddon()
    term.loadAddon(fit)
    term.open(container)

    termRef.current = term
    fitRef.current = fit
    setReady(true)

    const ro = new ResizeObserver(() => fitTerminal())
    ro.observe(container)

    const onWindowResize = () => fitTerminal()
    window.addEventListener('resize', onWindowResize)

    const unsubData = window.berrybridge.terminal.onData(({ id, data }) => {
      if (id === sessionRef.current) term.write(data)
    })

    const unsubExit = window.berrybridge.terminal.onExit(({ id, exitCode, label }) => {
      if (id !== sessionRef.current) return
      term.writeln(`\r\n\x1b[38;2;240;192;64m[session ended · ${label} · exit ${exitCode}]\x1b[0m`)
      sessionRef.current = null
      onConnectedRef.current?.(false)
      onStatusRef.current?.(`Disconnected (${exitCode})`)
    })

    term.onData((data) => {
      if (sessionRef.current) window.berrybridge.terminal.write(sessionRef.current, data)
    })

    const focusTerm = () => term.focus()
    container.addEventListener('mousedown', focusTerm)

    requestAnimationFrame(() => fitTerminal())

    return () => {
      if (resizeTimerRef.current) clearTimeout(resizeTimerRef.current)
      ro.disconnect()
      window.removeEventListener('resize', onWindowResize)
      container.removeEventListener('mousedown', focusTerm)
      unsubData()
      unsubExit()
      const session = sessionRef.current
      sessionRef.current = null
      if (session) void window.berrybridge.terminal.kill(session)
      term.dispose()
      termRef.current = null
      fitRef.current = null
      setReady(false)
    }
  }, [fitTerminal])

  useEffect(() => {
    if (!ready || !device) return

    let cancelled = false
    const term = termRef.current
    if (!term) return

    const connect = async () => {
      const session = sessionRef.current
      if (session) {
        await window.berrybridge.terminal.kill(session)
        sessionRef.current = null
      }
      if (cancelled) return

      term.clear()
      const label = endpointLabel(device)
      term.writeln(`\x1b[38;2;0;162;232m▸\x1b[0m connecting \x1b[1m${label}\x1b[0m`)
      onStatusRef.current?.('Connecting…')
      onConnectedRef.current?.(false)

      let sized = false
      for (let i = 0; i < 8 && !sized; i++) {
        sized = fitTerminal()
        if (!sized) await new Promise((r) => requestAnimationFrame(r))
      }
      if (cancelled) return

      if (!sized) {
        term.writeln('\x1b[38;2;255;107;107mTerminal area too small — resize the window.\x1b[0m')
        onStatusRef.current?.('Resize window to connect')
        return
      }

      try {
        const id = await window.berrybridge.terminal.spawn(device)
        if (cancelled) {
          await window.berrybridge.terminal.kill(id)
          return
        }
        sessionRef.current = id
        // Initial size only — further resizes are debounced to avoid SIGWINCH storms on BB10
        window.berrybridge.terminal.resize(id, term.cols, term.rows)
        term.focus()
        onConnectedRef.current?.(true)
        onStatusRef.current?.(`Connected · ${label}`)
      } catch (e) {
        term.writeln(`\x1b[38;2;255;107;107m${String(e)}\x1b[0m`)
        onStatusRef.current?.(String(e))
        onConnectedRef.current?.(false)
      }
    }

    void connect()

    return () => {
      cancelled = true
      const session = sessionRef.current
      sessionRef.current = null
      if (session) void window.berrybridge.terminal.kill(session)
    }
  }, [device?.id, reconnectKey, ready, fitTerminal])

  return (
    <div className="terminal-wrap">
      <div className="terminal-chrome">
        <div className="terminal-chrome-left">
          <span className="terminal-led" data-state={device ? 'live' : 'idle'} />
          <span className="terminal-title">
            {device ? endpointLabel(device) : 'select a device'}
          </span>
        </div>
        <span className="terminal-hint">click to focus · system ssh</span>
      </div>
      <div ref={containerRef} className="terminal-body" tabIndex={-1} />
    </div>
  )
}
