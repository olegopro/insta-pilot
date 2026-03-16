<script setup lang="ts">
  import { ref, computed, watch, nextTick, onBeforeUnmount } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { useActivityLogStore } from '@/entities/activity-log'
  import { activityLogListDTO } from '@/entities/activity-log'
  import type { ActivityFilters } from '@/entities/activity-log'
  import { ActivityFilter } from '@/features/activity-filter'
  import { useActivityLive } from '@/features/activity-live'
  import { ActivityStatsCards } from '@/widgets/activity-stats-cards'
  import { ActivityGroupedStats } from '@/widgets/activity-grouped-stats'
  import { ActivityLogTable } from '@/widgets/activity-log-table'
  import { ActivitySummaryTable } from '@/widgets/activity-summary-table'

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

  watch(accountId, async (id) => {
    if (id !== null) {
      filters.value = {}
      const highlight = highlightId.value
      if (highlight) {
        await Promise.all([
          store.loadAroundId(id, highlight),
          store.fetchStats(id)
        ])
        await scrollToHighlight(highlight)
      } else {
        await Promise.all([
          store.fetchLogs(id),
          store.fetchStats(id)
        ])
      }
    } else {
      store.resetLogs()
      await store.fetchSummary()
    }
  }, { immediate: true })

  onBeforeUnmount(() => store.resetLogs())
</script>

<template>
  <q-page class="q-pa-md">
    <template v-if="isDetailMode">
      <div class="row items-center justify-between q-mb-md">
        <div class="row items-center q-gutter-sm">
          <q-btn flat dense icon="arrow_back" @click="backHandler" />
          <span class="text-h6">Логи аккаунта</span>
        </div>
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
      </div>

      <ActivityStatsCards
        :stats="store.stats"
        :loading="store.fetchStatsLoading"
        class="q-mb-md"
      />

      <ActivityGroupedStats
        :stats="store.stats"
        class="q-mb-md"
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
    </template>

    <template v-else>
      <div class="row items-center q-mb-md">
        <span class="text-h6">Мониторинг активности</span>
      </div>

      <ActivitySummaryTable
        :data="store.summary"
        :loading="store.fetchSummaryLoading"
        @row-click="rowClickHandler"
      />
    </template>
  </q-page>
</template>
