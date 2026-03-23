import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { api } from '@/boot/axios'
import { useApi, type ApiResponseWrapper } from '@/shared/api'
import type { ActivityLog, ActivityStats, AccountActivitySummary, ActivityFilters } from '@/entities/activity-log/model/types'
import type { ActivityLogsResponseApi, ActivityStatsApi, AccountActivitySummaryApi, ActivityLogApi } from '@/entities/activity-log/model/apiTypes'
import activityLogDTO from '@/entities/activity-log/model/activityLogDTO'

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
    const result = activityLogDTO.toLocalLogsResponse(data)
    logs.value = result.items
    hasMoreBefore.value = result.hasMoreBefore
    hasMoreAfter.value = result.hasMoreAfter
    totalCount.value = result.total
    focusedId.value = result.focusedId
  }

  const loadOlderLogs = async (accountId: number, filters?: ActivityFilters) => {
    const lastId = logs.value[logs.value.length - 1]?.id
    if (!lastId || !hasMoreBefore.value || fetchLogsApi.loading.value) return

    const { data } = await fetchLogsApi.execute({ accountId, ...(filters ? { filters } : {}), beforeId: lastId })
    const result = activityLogDTO.toLocalLogsResponse(data)
    logs.value = [...logs.value, ...result.items]
    hasMoreBefore.value = result.hasMoreBefore
    totalCount.value = result.total
  }

  const loadAroundId = async (accountId: number, aroundId: number) => {
    const { data } = await fetchLogsApi.execute({ accountId, aroundId })
    const result = activityLogDTO.toLocalLogsResponse(data)
    logs.value = result.items.reverse()
    hasMoreBefore.value = result.hasMoreBefore
    hasMoreAfter.value = result.hasMoreAfter
    totalCount.value = result.total
    focusedId.value = result.focusedId
  }

  const appendNewLog = (item: ActivityLogApi) => {
    logs.value.unshift(activityLogDTO.toLocal(item))
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
    stats.value = activityLogDTO.toLocalStats(data)
  }

  const fetchSummary = async () => {
    const { data } = await fetchSummaryApi.execute()
    summary.value = activityLogDTO.toLocalSummaryList(data)
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
