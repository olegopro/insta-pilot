import { describe, it, expect } from 'vitest'
import activityLogDTO from '@/entities/activity-log/model/activityLogDTO'
import type { ActivityLogApi, ActivityStatsApi, AccountActivitySummaryApi, ActivityLogsResponseApi } from '@/entities/activity-log/model/apiTypes'

const makeLogApi = (overrides: Partial<ActivityLogApi> = {}): ActivityLogApi => ({
  id:                   1,
  instagram_account_id: 10,
  instagram_login:      'user1',
  user_id:              2,
  action:               'comment',
  status:               'success',
  http_code:            200,
  endpoint:             '/api/comment',
  request_payload:      { text: 'Hello' },
  response_summary:     { comment_pk: 'pk-1' },
  error_message:        null,
  error_code:           null,
  duration_ms:          300,
  created_at:           '2026-01-15T12:00:00Z',
  ...overrides
})

describe('activityLogDTO.toLocal', () => {
  it('маппит snake_case поля в camelCase', () => {
    const result = activityLogDTO.toLocal(makeLogApi())

    expect(result).toMatchObject({
      id:                    1,
      instagramAccountId:    10,
      instagramLogin:        'user1',
      userId:                2,
      action:                'comment',
      status:                'success',
      httpCode:              200,
      endpoint:              '/api/comment',
      requestPayload:        { text: 'Hello' },
      responseSummary:       { comment_pk: 'pk-1' },
      errorMessage:          null,
      durationMs:            300,
      createdAt:             '2026-01-15T12:00:00Z'
    })
  })

  it('сохраняет null-поля', () => {
    const result = activityLogDTO.toLocal(makeLogApi({
      instagram_login: null,
      http_code:       null,
      request_payload: null,
      response_summary: null,
      duration_ms:     null
    }))

    expect(result.instagramLogin).toBeNull()
    expect(result.httpCode).toBeNull()
    expect(result.requestPayload).toBeNull()
    expect(result.responseSummary).toBeNull()
    expect(result.durationMs).toBeNull()
  })
})

describe('activityLogDTO.toLocalLogsResponse', () => {
  it('маппит метаданные пагинации', () => {
    const response: ActivityLogsResponseApi = {
      items:           [makeLogApi({ id: 1 }), makeLogApi({ id: 2 })],
      has_more_before: true,
      has_more_after:  false,
      total:           50,
      focused_id:      1
    }

    const result = activityLogDTO.toLocalLogsResponse(response)

    expect(result.items).toHaveLength(2)
    expect(result.hasMoreBefore).toBe(true)
    expect(result.hasMoreAfter).toBe(false)
    expect(result.total).toBe(50)
    expect(result.focusedId).toBe(1)
  })

  it('возвращает пустой массив при пустых items', () => {
    const result = activityLogDTO.toLocalLogsResponse({
      items:           [],
      has_more_before: false,
      has_more_after:  false,
      total:           0,
      focused_id:      null
    })

    expect(result.items).toHaveLength(0)
    expect(result.focusedId).toBeNull()
  })
})

describe('activityLogDTO.toLocalStats', () => {
  it('маппит статистику со snake_case в camelCase', () => {
    const stats: ActivityStatsApi = {
      total:           200,
      today:           15,
      success_rate:    0.92,
      by_action:       { like: { total: 100, success: 95, error: 5 } },
      by_status:       { success: 184, error: 16 },
      avg_duration_ms: 180,
      last_error: {
        action:        'comment',
        error_message: 'Rate limit exceeded',
        error_code:    'rate_limited',
        created_at:    '2026-01-15T11:00:00Z'
      }
    }

    const result = activityLogDTO.toLocalStats(stats)

    expect(result.total).toBe(200)
    expect(result.today).toBe(15)
    expect(result.successRate).toBe(0.92)
    expect(result.avgDurationMs).toBe(180)
    expect(result.lastError?.errorMessage).toBe('Rate limit exceeded')
    expect(result.lastError?.errorCode).toBe('rate_limited')
  })

  it('маппит lastError = null', () => {
    const stats: ActivityStatsApi = {
      total:           10,
      today:           2,
      success_rate:    1.0,
      by_action:       {},
      by_status:       {},
      avg_duration_ms: 100,
      last_error:      null
    }

    expect(activityLogDTO.toLocalStats(stats).lastError).toBeNull()
  })
})

describe('activityLogDTO.toLocalSummaryList', () => {
  it('маппит массив сводок в camelCase', () => {
    const items: AccountActivitySummaryApi[] = [
      {
        account_id:        5,
        instagram_login:   'acc1',
        total_actions:     300,
        today_actions:     20,
        error_count_today: 3,
        success_rate:      0.88,
        last_activity_at:  '2026-01-15T09:00:00Z',
        last_error:        'Login failed',
        last_error_at:     '2026-01-14T08:00:00Z'
      }
    ]

    const result = activityLogDTO.toLocalSummaryList(items)

    expect(result).toHaveLength(1)
    expect(result[0].accountId).toBe(5)
    expect(result[0].instagramLogin).toBe('acc1')
    expect(result[0].totalActions).toBe(300)
    expect(result[0].errorCountToday).toBe(3)
    expect(result[0].successRate).toBe(0.88)
    expect(result[0].lastError).toBe('Login failed')
  })
})
