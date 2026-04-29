import {describe, it, expect} from 'vitest'
import {sanitizeBoolean, sanitizeSortMode, sanitizeIdList} from '@/features/topics/hooks/useTopicSidebarPrefs'

describe('sanitizeBoolean', () => {
  it('keeps valid booleans', () => {
    expect(sanitizeBoolean(true, false)).toBe(true)
    expect(sanitizeBoolean(false, true)).toBe(false)
  })

  it('falls back for invalid values', () => {
    expect(sanitizeBoolean('true', false)).toBe(false)
    expect(sanitizeBoolean(null, true)).toBe(true)
    expect(sanitizeBoolean(1, false)).toBe(false)
    expect(sanitizeBoolean(undefined, true)).toBe(true)
  })
})

describe('sanitizeSortMode', () => {
  it('keeps valid sort modes', () => {
    expect(sanitizeSortMode('largest', 'weakest')).toBe('largest')
    expect(sanitizeSortMode('az', 'weakest')).toBe('az')
    expect(sanitizeSortMode('weakest', 'default')).toBe('weakest')
  })

  it('falls back for invalid sort modes', () => {
    expect(sanitizeSortMode('broken', 'weakest')).toBe('weakest')
    expect(sanitizeSortMode(123, 'weakest')).toBe('weakest')
    expect(sanitizeSortMode(null, 'weakest')).toBe('weakest')
    expect(sanitizeSortMode(undefined, 'weakest')).toBe('weakest')
  })
})

describe('sanitizeIdList', () => {
  it('keeps only unique positive integer ids', () => {
    expect(sanitizeIdList([1, 2, 3])).toEqual([1, 2, 3])
  })

  it('coerces numeric strings to numbers', () => {
    expect(sanitizeIdList([1, '2', 3])).toEqual([1, 2, 3])
  })

  it('removes duplicates', () => {
    expect(sanitizeIdList([2, 2, 3])).toEqual([2, 3])
  })

  it('removes non-positive values', () => {
    expect(sanitizeIdList([1, -1, 0, 3])).toEqual([1, 3])
  })

  it('removes non-numeric values', () => {
    expect(sanitizeIdList([1, 'x', null, 3])).toEqual([1, 3])
  })

  it('returns empty array for invalid payloads', () => {
    expect(sanitizeIdList(null)).toEqual([])
    expect(sanitizeIdList({})).toEqual([])
    expect(sanitizeIdList('abc')).toEqual([])
  })

  it('caps the list to the requested limit', () => {
    expect(sanitizeIdList([1, 2, 3, 4, 5, 6], 5)).toEqual([1, 2, 3, 4, 5])
  })
})
