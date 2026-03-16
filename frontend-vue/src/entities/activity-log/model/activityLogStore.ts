import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { api } from '@/boot/axios'
import { useApi, type ApiResponseWrapper } from '@/shared/api'
import type { ActivityLog, ActivityStats, AccountActivitySummary, ActivityFilters } from './types'
import type { ActivityLogsResponseApi, ActivityStatsApi, AccountActivitySummaryApi, ActivityLogApi } from './apiTypes'

function mapLog(item: ActivityLogApi): ActivityLog {
  return {
    id:                 item.id,
    instagramAccountId: item.instagram_account_id,
    instagramLogin:     item.instagram_login,
    userId:             item.user_id,
    action:             item.action,
    status:             item.status,
    httpCode:           item.http_code,
    endpoint:           item.endpoint,
    requestPayload:     item.request_payload,
    responseSummary:    item.response_summary,
    errorMessage:       item.error_message,
    errorCode:          item.error_code,
    durationMs:         item.duration_ms,
    createdAt:          item.created_at
  }
}

function mapStats(data: ActivityStatsApi): ActivityStats {
  return {
    total:         data.total,
    today:         data.today,
    successRate:   data.success_rate,
    byAction:      data.by_action,
    byStatus:      data.by_status,
    avgDurationMs: data.avg_duration_ms,
    lastError:     data.last_error ? {
      action:       data.last_error.action,
      errorMessage: data.last_error.error_message,
      errorCode:    data.last_error.error_code,
      createdAt:    data.last_error.created_at
    } : null
  }
}

function mapSummary(item: AccountActivitySummaryApi): AccountActivitySummary {
  return {
    accountId:       item.account_id,
    instagramLogin:  item.instagram_login,
    totalActions:    item.total_actions,
    todayActions:    item.today_actions,
    errorCountToday: item.error_count_today,
    successRate:     item.success_rate,
    lastActivityAt:  item.last_activity_at,
    lastError:       item.last_error,
    lastErrorAt:     item.last_error_at
  }
}

export const useActivityLogStore = defineStore('activityLog', () => {
  const logs = ref<ActivityLog[]>([])
  const hasMoreBefore = ref(false)
  const hasMoreAfter = ref(false)
  const totalCount = ref(0)
  const focusedId = ref<number | null>(null)
  const stats = ref<ActivityStats | null>(null)
  const summary = ref<AccountActivitySummary[]>([])

  const fetchLogsApi = useApi<ApiResponseWrapper<ActivityLogsResponseApi>, {
    accountId: number
    filters?: ActivityFilters
    beforeId?: number
    afterId?: number
    aroundId?: number
  }>(
    ({ accountId, filters, beforeId, afterId, aroundId }) =>
      api.get(`/accounts/${String(accountId)}/activity`, {
        params: {
          per_page:   50,
          before_id:  beforeId,
          after_id:   afterId,
          around_id:  aroundId,
          action:     filters?.action,
          status:     filters?.status,
          http_code:  filters?.httpCode,
          date_from:  filters?.dateFrom,
          date_to:    filters?.dateTo
        }
      }).then((response) => response.data)
  )

  const fetchStatsApi = useApi<ApiResponseWrapper<ActivityStatsApi>, number>(
    (accountId) =>
      api.get(`/accounts/${String(accountId)}/activity/stats`).then((response) => response.data)
  )

  const fetchSummaryApi = useApi<ApiResponseWrapper<AccountActivitySummaryApi[]>>(
    () => api.get('/activity/summary').then((response) => response.data)
  )

  const fetchLogs = async (accountId: number, filters?: ActivityFilters) => {
    const { data } = await fetchLogsApi.execute({ accountId, ...(filters ? { filters } : {}) })
    logs.value = data.items.map(mapLog).reverse()
    hasMoreBefore.value = data.has_more_before
    hasMoreAfter.value = data.has_more_after
    totalCount.value = data.total
    focusedId.value = data.focused_id
  }

  const loadOlderLogs = async (accountId: number, filters?: ActivityFilters) => {
    const firstId = logs.value[0]?.id
    if (!firstId || !hasMoreBefore.value || fetchLogsApi.loading.value) return

    const { data } = await fetchLogsApi.execute({ accountId, ...(filters ? { filters } : {}), beforeId: firstId })
    const older = data.items.map(mapLog).reverse()
    logs.value = [...older, ...logs.value]
    hasMoreBefore.value = data.has_more_before
    totalCount.value = data.total
  }

  const loadAroundId = async (accountId: number, aroundId: number) => {
    const { data } = await fetchLogsApi.execute({ accountId, aroundId })
    logs.value = data.items.map(mapLog).reverse()
    hasMoreBefore.value = data.has_more_before
    hasMoreAfter.value = data.has_more_after
    totalCount.value = data.total
    focusedId.value = data.focused_id
  }

  const appendNewLog = (item: ActivityLogApi) => {
    logs.value.push(mapLog(item))
    totalCount.value += 1
  }

  const resetLogs = () => {
    logs.value = []
    hasMoreBefore.value = false
    hasMoreAfter.value = false
    totalCount.value = 0
    focusedId.value = null
  }

  const fetchStats = async (accountId: number) => {
    const { data } = await fetchStatsApi.execute(accountId)
    stats.value = mapStats(data)
  }

  const fetchSummary = async () => {
    const { data } = await fetchSummaryApi.execute()
    summary.value = data.map(mapSummary)
  }

  const fetchLogsLoading = computed(() => fetchLogsApi.loading.value)
  const fetchStatsLoading = computed(() => fetchStatsApi.loading.value)
  const fetchSummaryLoading = computed(() => fetchSummaryApi.loading.value)

  return {
    logs,
    hasMoreBefore,
    hasMoreAfter,
    totalCount,
    focusedId,
    stats,
    summary,
    fetchLogs,
    loadOlderLogs,
    loadAroundId,
    appendNewLog,
    resetLogs,
    fetchStats,
    fetchStatsLoading,
    fetchSummary,
    fetchSummaryLoading,
    fetchLogsLoading
  }
})
