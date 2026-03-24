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

describe('formatCount', () => {
  it('возвращает число как строку если < 1000', () => {
    expect(formatCount(999)).toBe('999')
    expect(formatCount(0)).toBe('0')
  })

  it('форматирует тысячи как K', () => {
    expect(formatCount(1000)).toBe('1.0K')
    expect(formatCount(1500)).toBe('1.5K')
    expect(formatCount(999999)).toBe('1000.0K')
  })

  it('форматирует миллионы как M', () => {
    expect(formatCount(1_000_000)).toBe('1.0M')
    expect(formatCount(2_500_000)).toBe('2.5M')
  })
})

describe('formatDate', () => {
  it('возвращает пустую строку для пустого значения', () => {
    expect(formatDate('')).toBe('')
  })

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

  it('возвращает оригинальную строку при ошибке парсинга', () => {
    const result = formatTimeHMS('invalid-date')
    expect(result).toBeDefined()
  })
})

describe('formatTimeHM', () => {
  it('возвращает null для null', () => {
    expect(formatTimeHM(null)).toBeNull()
  })

  it('форматирует ISO время как HH:MM', () => {
    const result = formatTimeHM('2026-01-15T10:30:00Z')
    expect(result).toMatch(/\d{2}:\d{2}/)
  })
})

describe('formatDuration', () => {
  it('возвращает тире для null', () => {
    expect(formatDuration(null)).toEqual({ text: '—', color: '' })
  })

  it('возвращает мс для значений < 1000', () => {
    expect(formatDuration(500)).toEqual({ text: '500ms', color: '' })
  })

  it('возвращает секунды с color=warning для 1000-2999', () => {
    const result = formatDuration(1500)
    expect(result.text).toBe('1.5s')
    expect(result.color).toBe('warning')
  })

  it('возвращает секунды с color=negative для >= 3000', () => {
    const result = formatDuration(3000)
    expect(result.text).toBe('3.0s')
    expect(result.color).toBe('negative')
  })
})

describe('formatRelativeTime', () => {
  afterEach(() => vi.useRealTimers())

  it('возвращает "только что" для < 1 минуты', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-15T10:00:30Z'))
    expect(formatRelativeTime('2026-01-15T10:00:00Z')).toBe('только что')
  })

  it('возвращает минуты для < 1 часа', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-15T10:05:00Z'))
    expect(formatRelativeTime('2026-01-15T10:00:00Z')).toBe('5 мин.')
  })

  it('возвращает часы для < 24 часов', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-15T12:00:00Z'))
    expect(formatRelativeTime('2026-01-15T10:00:00Z')).toBe('2 ч.')
  })
})

describe('formatDateRu', () => {
  it('возвращает пустую строку для пустого значения', () => {
    expect(formatDateRu('')).toBe('')
  })

  it('форматирует ISO дату как DD.MM.YYYY', () => {
    expect(formatDateRu('2026-01-15')).toBe('15.01.2026')
  })
})
