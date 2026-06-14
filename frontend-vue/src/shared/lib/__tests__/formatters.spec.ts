import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  formatCount,
  formatDate,
  formatTimeHMS,
  formatTimeHM,
  formatDuration,
  formatRelativeTime,
  formatDateRu
} from '@/shared/lib/formatters'

describe('formatCount', () => it.each([
  [0, '0'],
  [999, '999'],
  [1000, '1.0K'],
  [1500, '1.5K'],
  [999999, '1000.0K'],
  [1_000_000, '1.0M'],
  [2_500_000, '2.5M']
])('formatCount(%i) === %s', (input, expected) => expect(formatCount(input)).toBe(expected)))

describe('formatDate', () => {
  it('возвращает пустую строку для пустого значения', () => expect(formatDate('')).toBe(''))

  it('форматирует ISO дату по-русски', () => {
    const result = formatDate('2026-01-15T00:00:00Z')
    expect(result).toContain('2026')
    expect(result).toMatch(/январ/i)
  })
})

describe('formatTimeHMS', () => {
  it('форматирует ISO время как HH:MM:SS', () => {
    const result = formatTimeHMS('2026-01-15T10:30:45Z')
    expect(result).toMatch(/\d{2}:\d{2}:\d{2}/)
  })

  it('возвращает "Invalid Date" на невалидном входе (Intl не бросает)', () =>
    expect(formatTimeHMS('invalid-date')).toBe('Invalid Date'))
})

describe('formatTimeHM', () => {
  it('возвращает null для null', () => expect(formatTimeHM(null)).toBeNull())

  it('форматирует ISO время как HH:MM', () => {
    const result = formatTimeHM('2026-01-15T10:30:00Z')
    expect(result).toMatch(/\d{2}:\d{2}/)
  })
})

describe('formatDuration', () => it.each([
  [null, { text: '—', color: '' }],
  [500, { text: '500ms', color: '' }],
  [1500, { text: '1.5s', color: 'warning' }],
  [3000, { text: '3.0s', color: 'negative' }]
])('formatDuration(%s)', (input, expected) => expect(formatDuration(input)).toEqual(expected)))

describe('formatRelativeTime', () => {
  afterEach(() => vi.useRealTimers())

  it.each([
    ['2026-01-15T10:00:30Z', '2026-01-15T10:00:00Z', 'только что'],
    ['2026-01-15T10:05:00Z', '2026-01-15T10:00:00Z', '5 мин.'],
    ['2026-01-15T12:00:00Z', '2026-01-15T10:00:00Z', '2 ч.'],
    ['2026-01-18T10:00:00Z', '2026-01-15T10:00:00Z', '3 д.'],
    ['2026-01-29T10:00:00Z', '2026-01-15T10:00:00Z', '2 нед.']
  ])('now=%s iso=%s → %s', (now, iso, expected) => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(now))
    expect(formatRelativeTime(iso)).toBe(expected)
  })

  it('возвращает дату для >= 5 недель', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-15T10:00:00Z'))
    expect(formatRelativeTime('2026-01-15T10:00:00Z')).toBe(formatDate('2026-01-15T10:00:00Z'))
  })
})

describe('formatDateRu', () => {
  it('возвращает пустую строку для пустого значения', () => expect(formatDateRu('')).toBe(''))

  it('форматирует ISO дату как DD.MM.YYYY', () => expect(formatDateRu('2026-01-15')).toBe('15.01.2026'))
})
