<script setup lang="ts">
  import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
  import type { Nullable } from '@/shared/lib'
  import { TableComponent } from '@/shared/ui/table-component'
  import { ButtonComponent } from '@/shared/ui/button-component'
  import { useReverseInfiniteScroll } from '@/shared/lib'
  import { activityLogTableColumns } from '@/entities/activity-log'
  import type { ActivityLogRowModel } from '@/entities/activity-log'
  import ActivityLogExpandedRow from './ActivityLogExpandedRow.vue'

  interface Props {
    rows: ActivityLogRowModel[]
    loading: boolean
    hasMore: boolean
    total: number
    highlightId?: Nullable<number>
  }

  const props = defineProps<Props>()

  const emit = defineEmits<{
    'load-more': []
  }>()

  const expandedRows = ref<Set<number>>(new Set())

  const { isLoadingOlder, onScroll } = useReverseInfiniteScroll()

  let lastScrollTime = 0
  const handleWindowScroll = () => {
    if (!props.hasMore || props.loading) return
    const now = Date.now()
    if (now - lastScrollTime < 150) return
    lastScrollTime = now
    void onScroll(() => { emit('load-more'); return Promise.resolve() })
  }

  const toggleExpandHandler = (id: number) => {
    if (expandedRows.value.has(id)) {
      expandedRows.value.delete(id)
    } else {
      expandedRows.value.add(id)
    }
  }

  watch(() => props.rows, (newRows, oldRows) => {
    if (newRows[0]?.id !== oldRows[0]?.id && oldRows.length > 0) {
      expandedRows.value.clear()
    }
  }, { flush: 'sync' })

  onMounted(() => window.addEventListener('scroll', handleWindowScroll))
  onBeforeUnmount(() => window.removeEventListener('scroll', handleWindowScroll))
</script>

<template>
  <div style="position: relative">
    <div v-if="isLoadingOlder" class="row justify-center q-py-sm">
      <q-spinner color="primary" size="sm" />
      <span class="q-ml-sm text-caption text-grey">Загрузка старых записей...</span>
    </div>

    <TableComponent
      :rows="rows"
      :columns="activityLogTableColumns"
      :loading="loading && !rows.length"
      row-key="id"
      no-data-label="Нет записей"
    >
      <template #body="{ row }: { row: ActivityLogRowModel }">
        <q-tr
          :id="`log-${row.id}`"
          :class="highlightId === row.id ? 'bg-yellow-1' : ''"
          :props="{ row }"
          class="cursor-pointer"
          @click="toggleExpandHandler(row.id)"
        >
          <q-td key="time">
            <span class="text-caption text-mono">{{ row.timeFormatted }}</span>
          </q-td>

          <q-td key="action">
            <q-badge
              :color="row.actionColor"
              :label="row.actionLabel"
              class="text-caption"
            />
          </q-td>

          <q-td key="status">
            <div class="row items-center q-gutter-xs">
              <q-icon :name="row.statusIcon" :color="row.statusColor" size="xs" />
              <span class="text-caption">{{ row.statusLabel }}</span>
            </div>
          </q-td>

          <q-td key="httpCode" class="text-center">
            <q-badge
              v-if="row.httpCode"
              :color="row.httpCodeColor"
              :label="row.httpCode"
            />
          </q-td>

          <q-td key="endpoint">
            <span class="text-caption text-grey">{{ row.endpoint ?? '—' }}</span>
          </q-td>

          <q-td key="duration" class="text-right">
            <span :class="row.durationColor ? `text-${row.durationColor}` : ''" class="text-caption">
              {{ row.durationFormatted }}
            </span>
          </q-td>
        </q-tr>

        <q-tr v-if="expandedRows.has(row.id)" :props="{ row }">
          <q-td colspan="100%" class="q-pa-none">
            <ActivityLogExpandedRow :row="row" />
          </q-td>
        </q-tr>
      </template>
    </TableComponent>

    <div class="row items-center justify-between q-mt-sm q-px-xs">
      <span class="text-caption text-grey">Показано {{ rows.length }} из {{ total }}</span>
      <ButtonComponent
        v-if="hasMore"
        flat
        dense
        label="Загрузить ещё"
        icon="expand_more"
        :loading="isLoadingOlder"
        @click="emit('load-more')"
      />
    </div>
  </div>
</template>
