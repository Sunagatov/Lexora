import {describe, expect, it, beforeEach, afterEach, vi} from 'vitest'
import type {DailyActivity} from '@/features/stats/types/statsTypes'
import {
  buildActivityChartData,
  buildUsageChartData,
  dayLabel,
  filterByDays,
  filterByMonths,
  monthLabel,
  toLocalDateKey,
} from '@/features/stats/model/statsPageModel'

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

  it('fills daily gaps once tracking has started', () => {
    const days = makeDays('2024-03-07', 5).filter((day) => ['2024-03-09', '2024-03-11'].includes(day.date))

    expect(buildActivityChartData(days, '7', '2024-03-07')).toEqual([
      {label: dayLabel('2024-03-07'), value: 0},
      {label: dayLabel('2024-03-08'), value: 0},
      {label: dayLabel('2024-03-09'), value: 2},
      {label: dayLabel('2024-03-10'), value: 0},
    ])
    expect(filterByDays(days, '7').map((day) => day.date)).toEqual(['2024-03-09'])
  })

  it('preserves all 90 days of activity when grouping by week', () => {
    const days = makeDays('2023-12-01', 102).reverse()
    const chart = buildActivityChartData(days, '90', '2023-12-01')
    const selectedTotal = filterByDays(days, '90').reduce((sum, day) => sum + day.net, 0)

    expect(chart).toHaveLength(13)
    expect(chart[0]).toEqual({label: dayLabel('2023-12-12'), value: 81})
    expect(chart.reduce((sum, point) => sum + point.value, 0)).toBe(selectedTotal)
  })

  it('groups year and all-time app usage by month with inactive months included', () => {
    const days = [
      {date: '2024-03-11', active_seconds: 80},
      {date: '2024-03-10', active_seconds: 40},
      {date: '2023-05-10', active_seconds: 20},
      {date: '2023-03-12', active_seconds: 10},
      {date: '2023-03-11', active_seconds: 5},
    ]
    const year = buildUsageChartData(days, '365', '2023-01-01')
    const all = buildUsageChartData(days, 'all', '2023-01-01')

    expect(year).toHaveLength(13)
    expect(year.slice(0, 3)).toEqual([
      {label: monthLabel('2023-03'), value: 10},
      {label: monthLabel('2023-04'), value: 0},
      {label: monthLabel('2023-05'), value: 20},
    ])
    expect(year[year.length - 1]).toEqual({label: monthLabel('2024-03'), value: 40})
    expect(all).toHaveLength(15)
    expect(all[2]).toEqual({label: monthLabel('2023-03'), value: 15})
    expect(all[all.length - 1]).toEqual({label: monthLabel('2024-03'), value: 40})
  })

  it('formats local calendar dates with zero-padded month and day', () => {
    expect(toLocalDateKey(new Date(2024, 2, 5, 23, 7, 0))).toBe('2024-03-05')
  })

  it.each([
    ['2026-03-31T12:00:00Z', '2025-04'],
    ['2026-05-31T12:00:00Z', '2025-06'],
    ['2026-10-31T12:00:00Z', '2025-11'],
  ])('includes the first month of a one-year window on %s', (today, firstMonth) => {
    vi.setSystemTime(new Date(today))
    expect(filterByMonths([[firstMonth, 3]], '12')).toEqual([[firstMonth, 3]])
  })
})
