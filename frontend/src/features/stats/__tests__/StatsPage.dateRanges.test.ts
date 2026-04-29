import {describe, expect, it, beforeEach, afterEach, vi} from 'vitest'
import type {DailyActivity} from '@/features/stats/api/statsApi'
import {filterByDays, toLocalDateKey} from '@/features/stats/routes/StatsPage'

function makeDays(startIsoDate: string, count: number): DailyActivity[] {
  const start = new Date(`${startIsoDate}T00:00:00Z`)
  return Array.from({length: count}, (_, index) => {
    const date = new Date(start)
    date.setUTCDate(start.getUTCDate() + index)
    return {
      date: date.toISOString().slice(0, 10),
      reviewed: index + 1,
      improved: index,
      downgraded: 0,
      net: index,
    }
  })
}

describe('StatsPage date windows', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-03-10T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('keeps exactly 7 days in the 7-day window', () => {
    const days = makeDays('2024-03-03', 8)

    const filtered = filterByDays(days, '7')

    expect(filtered).toHaveLength(7)
    expect(filtered[0]?.date).toBe('2024-03-04')
    expect(filtered[6]?.date).toBe('2024-03-10')
  })

  it('keeps exactly 30 days in the 30-day window', () => {
    const days = makeDays('2024-02-09', 31)

    const filtered = filterByDays(days, '30')

    expect(filtered).toHaveLength(30)
    expect(filtered[0]?.date).toBe('2024-02-10')
    expect(filtered[29]?.date).toBe('2024-03-10')
  })

  it('returns the full input for all time', () => {
    const days = makeDays('2024-03-01', 5)

    expect(filterByDays(days, 'all')).toEqual(days)
  })

  it('formats local calendar dates with zero-padded month and day', () => {
    expect(toLocalDateKey(new Date(2024, 2, 5, 23, 7, 0))).toBe('2024-03-05')
  })
})
