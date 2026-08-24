import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

afterEach(() => {
  cleanup()
})

// jsdom 未实现 matchMedia，组件按断点单实例挂载历史栏时需要。
if (!window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => {
      const listeners = new Set<(e: MediaQueryListEvent) => void>()
      const mql: MediaQueryList = {
        matches: false,
        media: query,
        onchange: null,
        addListener: (cb) => cb && listeners.add(cb as (e: MediaQueryListEvent) => void),
        removeListener: (cb) => cb && listeners.delete(cb as (e: MediaQueryListEvent) => void),
        addEventListener: (_type, cb) => cb && listeners.add(cb as (e: MediaQueryListEvent) => void),
        removeEventListener: (_type, cb) => cb && listeners.delete(cb as (e: MediaQueryListEvent) => void),
        dispatchEvent: () => false,
      }
      return mql
    },
  })
}
