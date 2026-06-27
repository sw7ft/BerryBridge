import { useCallback, useEffect, useRef, useState } from 'react'
import type { DeviceScanProgress, DiscoveredDevice } from '@shared/types'

export function useDeviceScan() {
  const [progress, setProgress] = useState<DeviceScanProgress | null>(null)
  const [discovered, setDiscovered] = useState<DiscoveredDevice[]>([])
  const [scanning, setScanning] = useState(false)
  const [subnets, setSubnets] = useState<string[]>([])
  const scanRef = useRef(0)

  useEffect(() => {
    window.berrybridge.scan.subnets().then(setSubnets)
    const unsub = window.berrybridge.scan.onProgress((p) => {
      setProgress(p)
      setDiscovered(p.found)
      if (p.phase === 'done') setScanning(false)
      else setScanning(true)
    })
    return unsub
  }, [])

  const startScan = useCallback(async (subnet?: string) => {
    window.berrybridge.scan.stop()
    const id = ++scanRef.current
    setScanning(true)
    setProgress(null)
    try {
      const found = await window.berrybridge.scan.start(subnet)
      if (scanRef.current === id) {
        setDiscovered(found)
        setScanning(false)
      }
    } catch {
      if (scanRef.current === id) setScanning(false)
    }
  }, [])

  const stopScan = useCallback(() => {
    window.berrybridge.scan.stop()
    setScanning(false)
  }, [])

  const newDevices = discovered.filter((d) => !d.alreadySaved)

  return {
    progress,
    discovered,
    newDevices,
    scanning,
    subnets,
    startScan,
    stopScan
  }
}
