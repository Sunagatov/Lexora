import {afterEach, vi} from 'vitest'
import {cleanup} from '@testing-library/react'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  if (typeof localStorage?.clear === 'function') localStorage.clear()
  if (typeof sessionStorage?.clear === 'function') sessionStorage.clear()
})
