<script setup lang="ts">
  import { ref, computed, watch, nextTick, onBeforeUnmount } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { useActivityLogStore } from '@/entities/activity-log'
  import { activityLogListDTO } from '@/entities/activity-log'
  import type { ActivityFilters, ActionType, ActionStatus } from '@/entities/activity-log'
  import { ActivityFilter } from '@/features/activity-filter'
  import { useActivityLive } from '@/features/activity-live'
  import { ActivityStatsCards } from '@/widgets/activity-stats-cards'
  import { ActivityGroupedStats } from '@/widgets/activity-grouped-stats'
  import { ActivityLogTable } from '@/widgets/activity-log-table'
  import { ActivitySummaryTable } from '@/widgets/activity-summary-table'
  import { PageComponent } from '@/shared/ui/page-component'
  import { ButtonComponent } from '@/shared/ui/button-component'

  const route = useRoute()
  const router = useRouter()
  const store = useActivityLogStore()

  const accountId = computed(() => {
    const id = route.params.accountId
    return id ? Number(id) : null
  })

  const isDetailMode = computed(() => accountId.value !== null)

  const filters = ref<ActivityFilters>({})

  const rows = computed(() => activityLogListDTO.toLocal(store.logs))

  const highlightId = computed(() => {
    const q = route.query.highlight
    return q ? Number(q) : null
  })

  const accountIdForLive = computed(() => accountId.value ?? 0)
  const { isConnected } = useActivityLive(accountIdForLive)

  const loadOlderHandler = async () => {
    if (accountId.value === null) return
    await store.loadOlderLogs(accountId.value, filters.value)
  }

  const applyFiltersHandler = () => {
    accountId.value && void store.fetchLogs(accountId.value, filters.value)
  }

  const selectActionHandler = (action: ActionType | null) => {
    const updated = { ...filters.value }
    if (action) updated.action = action
    else delete updated.action
    filters.value = updated
    applyFiltersHandler()
  }

  const selectStatusHandler = (status: ActionStatus | null) => {
    const updated = { ...filters.value }
    if (status) updated.status = status
    else delete updated.status
    filters.value = updated
    applyFiltersHandler()
  }

  const rowClickHandler = (id: number) => {
    void router.push(`/logs/${String(id)}`)
  }

  const backHandler = () => {
    void router.push('/logs')
  }

  const scrollToHighlight = async (id: number) => {
    await nextTick()
    const el = document.getElementById(`log-${String(id)}`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  watch(
    () => [accountId.value, highlightId.value] as const,
    async ([id, highlight], prev) => {
      const prevId = prev?.[0] ?? null
      if (id !== null) {
        if (id !== prevId) {
          filters.value = {}
          await Promise.all([
            highlight ? store.loadAroundId(id, highlight) : store.fetchLogs(id),
            store.fetchStats(id)
          ])
          highlight && await scrollToHighlight(highlight)
        } else if (highlight !== null) {
          await store.loadAroundId(id, highlight)
          await scrollToHighlight(highlight)
        }
      } else {
        store.resetLogs()
        await store.fetchSummary()
      }
    },
    { immediate: true }
  )

  onBeforeUnmount(() => store.resetLogs())
</script>

<template>
  <PageComponent v-if="isDetailMode" title="Логи аккаунта">
    <template #prepend>
      <ButtonComponent flat dense icon="arrow_back" @click="backHandler" />
    </template>
    <template #append>
      <div class="row items-center q-gutter-xs">
        <q-icon
          name="circle"
          :color="isConnected ? 'positive' : 'grey'"
          size="xs"
        />
        <span class="text-caption text-grey">
          Real-time: {{ isConnected ? 'подключено' : 'отключено' }}
        </span>
      </div>
    </template>

    <ActivityStatsCards
      :stats="store.stats"
      :loading="store.fetchStatsLoading"
      class="q-mb-md"
    />

    <ActivityGroupedStats
      :stats="store.stats"
      :active-action="filters.action ?? null"
      :active-status="filters.status ?? null"
      class="q-mb-md"
      @select-action="selectActionHandler"
      @select-status="selectStatusHandler"
    />

    <div class="q-mb-md">
      <ActivityFilter
        v-model="filters"
        @apply="applyFiltersHandler"
      />
    </div>

    <ActivityLogTable
      :rows="rows"
      :loading="store.fetchLogsLoading"
      :has-more="store.hasMoreBefore"
      :total="store.totalCount"
      :highlight-id="highlightId"
      @load-more="loadOlderHandler"
    />
  </PageComponent>

  <PageComponent v-else title="Мониторинг активности" icon="analytics">
    <ActivitySummaryTable
      :data="store.summary"
      :loading="store.fetchSummaryLoading"
      @row-click="rowClickHandler"
    />
  </PageComponent>
</template>
