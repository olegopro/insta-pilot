<script setup lang="ts">
  import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
  import type { Nullable } from '@/shared/lib'
  import { TableComponent } from '@/shared/ui/table-component'
  import { ButtonComponent } from '@/shared/ui/button-component'
  import { BadgeComponent } from '@/shared/ui/badge-component'
  import { activityLogTableColumns } from '@/entities/activity-log'
  import type { ActivityLogRowModel } from '@/entities/activity-log'
  import ActivityLogExpandedRow from '@/widgets/activity-log-table/ui/ActivityLogExpandedRow.vue'

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

  const isLoadingOlder = computed(() => props.loading && props.rows.length > 0)

  let lastScrollTime = 0
  const handleWindowScroll = () => {
    if (!props.hasMore || props.loading) return
    const now = Date.now()
    if (now - lastScrollTime < 150) return
    lastScrollTime = now
    const scrolledToBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 100
    scrolledToBottom && emit('load-more')
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
    <TableComponent
      :rows="rows"
      :columns="activityLogTableColumns"
      :loading="loading && !rows.length"
      row-key="id"
      no-data-label="Нет записей"
      table-style="table-layout: fixed"
    >
      <template #body="{ row }: { row: ActivityLogRowModel }">
        <q-tr
          :id="`log-${row.id}`"
          :class="[highlightId === row.id ? 'bg-yellow-1' : '', expandedRows.has(row.id) ? 'bg-grey-2' : '']"
          :props="{ row }"
          class="cursor-pointer"
          @click="toggleExpandHandler(row.id)"
        >
          <q-td key="time">
            <span class="text-mono">{{ row.timeFormatted }}</span>
          </q-td>

          <q-td key="action">
            <BadgeComponent :color="row.actionColor" :label="row.actionLabel" size="md" />
          </q-td>

          <q-td key="status">
            <div class="row items-center q-gutter-xs">
              <q-icon :name="row.statusIcon" :color="row.statusColor" size="sm" />
              <span>{{ row.statusLabel }}</span>
            </div>
          </q-td>

          <q-td key="httpCode" class="text-center">
            <BadgeComponent v-if="row.httpCode" :color="row.httpCodeColor" :label="String(row.httpCode)" size="md" />
          </q-td>

          <q-td key="endpoint">
            <span class="text-grey">{{ row.endpoint ?? '—' }}</span>
          </q-td>

          <q-td key="duration" class="text-right">
            <span :class="row.durationColor ? `text-${row.durationColor}` : ''">
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
      <div v-if="hasMore" class="row items-center q-gutter-xs">
        <q-spinner v-if="isLoadingOlder" color="primary" size="xs" />
        <ButtonComponent
          flat
          dense
          label="Загрузить ещё"
          icon="expand_more"
          :loading="isLoadingOlder"
          @click="emit('load-more')"
        />
      </div>
    </div>
  </div>
</template>
