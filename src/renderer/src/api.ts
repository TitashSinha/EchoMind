import type { EchoBridge } from '@shared/bridge'

declare global {
  interface Window {
    echomind: EchoBridge
  }
}

export const api = window.echomind
