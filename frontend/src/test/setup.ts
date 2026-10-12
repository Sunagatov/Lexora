import {afterEach, vi} from 'vitest'
import {cleanup} from '@testing-library/react'

Object.defineProperty(window, 'matchMedia', {
  configurable: true,
  writable: true,
  value: vi.fn((query: string) => ({
    matches: false, media: query, onchange: null,
    addListener: vi.fn(), removeListener: vi.fn(),
    addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
  })),
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  if (typeof localStorage?.clear === 'function') localStorage.clear()
  if (typeof sessionStorage?.clear === 'function') sessionStorage.clear()
})
