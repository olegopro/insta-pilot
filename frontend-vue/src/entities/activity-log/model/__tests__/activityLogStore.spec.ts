import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import type { ActivityLogApi, ActivityLogsResponseApi, ActivityStatsApi, AccountActivitySummaryApi } from '@/entities/activity-log/model/apiTypes'

vi.mock('@/boot/axios', () => ({
  api: {
    get: vi.fn()
  }
}))

import { api } from '@/boot/axios'
import { useActivityLogStore } from '@/entities/activity-log/model/activityLogStore'

const makeLogApi = (overrides: Partial<ActivityLogApi> = {}): ActivityLogApi => ({
  id:                    1,
  instagram_account_id:  10,
  instagram_login:       'user1',
  user_id:               1,
  action:                'like',
  status:                'success',
  http_code:             200,
  endpoint:              '/like',
  request_payload:       null,
  response_summary:      null,
  error_message:         null,
  error_code:            null,
  duration_ms:           150,
  created_at:            '2026-01-01T10:00:00Z',
  ...overrides
})

const makeLogsResponse = (overrides: Partial<ActivityLogsResponseApi> = {}): ActivityLogsResponseApi => ({
  items:           [makeLogApi()],
  has_more_before: true,
  has_more_after:  false,
  total:           100,
  focused_id:      null,
  ...overrides
})

const wrapResponse = <T>(data: T) => ({
  data: { success: true, data, message: 'OK' }
})

describe('activityLogStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('fetchLogs загружает логи в ref', async () => {
    vi.mocked(api.get).mockResolvedValueOnce(wrapResponse(makeLogsResponse()))

    const store = useActivityLogStore()
    await store.fetchLogs(10)

    expect(store.logs).toHaveLength(1)
    expect(store.logs[0].action).toBe('like')
    expect(store.logs[0].instagramLogin).toBe('user1')
  })

  it('fetchLogs устанавливает hasMoreBefore и total', async () => {
    vi.mocked(api.get).mockResolvedValueOnce(
      wrapResponse(makeLogsResponse({ has_more_before: true, total: 42 }))
    )

    const store = useActivityLogStore()
    await store.fetchLogs(10)

    expect(store.hasMoreBefore).toBe(true)
    expect(store.totalCount).toBe(42)
  })

  it('fetchLogs применяет фильтры в параметрах запроса', async () => {
    vi.mocked(api.get).mockResolvedValueOnce(wrapResponse(makeLogsResponse()))

    const store = useActivityLogStore()
    await store.fetchLogs(10, { action: 'like', status: 'success', dateFrom: '2026-01-01' })

    expect(api.get).toHaveBeenCalledWith(
      '/accounts/10/activity',
      expect.objectContaining({
        params: expect.objectContaining({
          action:    'like',
          status:    'success',
          date_from: '2026-01-01'
        })
      })
    )
  })

  it('loadOlderLogs дозагружает более старые записи', async () => {
    vi.mocked(api.get)
      .mockResolvedValueOnce(wrapResponse(makeLogsResponse({ has_more_before: true })))
      .mockResolvedValueOnce(wrapResponse(makeLogsResponse({ items: [makeLogApi({ id: 2 })] })))

    const store = useActivityLogStore()
    await store.fetchLogs(10)
    await store.loadOlderLogs(10)

    expect(store.logs).toHaveLength(2)
  })

  it('loadOlderLogs не загружает если hasMoreBefore = false', async () => {
    vi.mocked(api.get).mockResolvedValueOnce(
      wrapResponse(makeLogsResponse({ has_more_before: false }))
    )

    const store = useActivityLogStore()
    await store.fetchLogs(10)

    const callsBefore = vi.mocked(api.get).mock.calls.length
    await store.loadOlderLogs(10)

    expect(vi.mocked(api.get).mock.calls.length).toBe(callsBefore)
  })

  it('loadAroundId загружает и центрирует вокруг ID', async () => {
    const items = [makeLogApi({ id: 5 }), makeLogApi({ id: 3 }), makeLogApi({ id: 1 })]
    vi.mocked(api.get).mockResolvedValueOnce(
      wrapResponse(makeLogsResponse({ items, focused_id: 3 }))
    )

    const store = useActivityLogStore()
    await store.loadAroundId(10, 3)

    expect(store.focusedId).toBe(3)
    // reverse() разворачивает порядок
    expect(store.logs[0].id).toBe(1)
    expect(store.logs[2].id).toBe(5)
  })

  it('appendNewLog добавляет запись в начало и увеличивает счётчик', () => {
    const store = useActivityLogStore()
    store.totalCount = 5

    store.appendNewLog(makeLogApi({ id: 99 }))

    expect(store.logs).toHaveLength(1)
    expect(store.logs[0].id).toBe(99)
    expect(store.totalCount).toBe(6)
  })

  it('resetLogs очищает все поля состояния', async () => {
    vi.mocked(api.get).mockResolvedValueOnce(
      wrapResponse(makeLogsResponse({ total: 50, focused_id: 7 }))
    )

    const store = useActivityLogStore()
    await store.fetchLogs(10)
    store.resetLogs()

    expect(store.logs).toHaveLength(0)
    expect(store.totalCount).toBe(0)
    expect(store.hasMoreBefore).toBe(false)
    expect(store.hasMoreAfter).toBe(false)
    expect(store.focusedId).toBeNull()
  })

  it('fetchStats загружает статистику', async () => {
    const mockStats: ActivityStatsApi = {
      total:          100,
      today:          10,
      success_rate:   0.9,
      by_action:      { like: { total: 50, success: 45, error: 5 } },
      by_status:      { success: 90, error: 10 },
      avg_duration_ms: 200,
      last_error:     null
    }
    vi.mocked(api.get).mockResolvedValueOnce(wrapResponse(mockStats))

    const store = useActivityLogStore()
    await store.fetchStats(10)

    expect(store.stats?.total).toBe(100)
    expect(store.stats?.successRate).toBe(0.9)
    expect(store.stats?.avgDurationMs).toBe(200)
  })

  it('fetchSummary загружает сводку', async () => {
    const mockSummary: AccountActivitySummaryApi[] = [
      {
        account_id:        10,
        instagram_login:   'user1',
        total_actions:     200,
        today_actions:     5,
        error_count_today: 1,
        success_rate:      0.95,
        last_activity_at:  '2026-01-01T10:00:00Z',
        last_error:        null,
        last_error_at:     null
      }
    ]
    vi.mocked(api.get).mockResolvedValueOnce(wrapResponse(mockSummary))

    const store = useActivityLogStore()
    await store.fetchSummary()

    expect(store.summary).toHaveLength(1)
    expect(store.summary[0].instagramLogin).toBe('user1')
    expect(store.summary[0].successRate).toBe(0.95)
  })

  it('fetchLogsLoading изначально false', () => {
    const store = useActivityLogStore()
    expect(store.fetchLogsLoading).toBe(false)
  })

  it('fetchStatsLoading изначально false', () => {
    const store = useActivityLogStore()
    expect(store.fetchStatsLoading).toBe(false)
  })

  it('fetchSummaryLoading изначально false', () => {
    const store = useActivityLogStore()
    expect(store.fetchSummaryLoading).toBe(false)
  })
})
