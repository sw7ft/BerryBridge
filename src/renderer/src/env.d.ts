/// <reference types="vite/client" />

declare module '*.png' {
  const src: string
  export default src
}

import type { BerryBridgeApi } from '../../preload/index'

declare global {
  interface Window {
    berrybridge: BerryBridgeApi
  }
}

export {}
