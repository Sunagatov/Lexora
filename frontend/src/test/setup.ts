import {afterEach, vi} from 'vitest'
import {cleanup} from '@testing-library/react'

// jsdom has the dialog element but does not implement its open/close methods.
if (!HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function () { this.open = true }
  HTMLDialogElement.prototype.close = function () { this.open = false }
}

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
