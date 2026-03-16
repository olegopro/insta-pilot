<script setup lang="ts">
  import { computed } from 'vue'
  import { TableComponent } from '@/shared/ui/table-component'
  import { useSearchQuery, useFilterColumns } from '@/shared/lib'
  import { activitySummaryTableColumns, activitySummaryListDTO } from '@/entities/activity-log'
  import type { AccountActivitySummary } from '@/entities/activity-log'

  interface Props {
    data: AccountActivitySummary[]
    loading: boolean
  }

  const props = defineProps<Props>()

  const emit = defineEmits<{
    'row-click': [accountId: number]
  }>()

  const { columns, columnsVisibleNames } = useFilterColumns(activitySummaryTableColumns)
  const { searchText } = useSearchQuery()

  const rows = computed(() => activitySummaryListDTO.toLocal(props.data))

  const rowClickHandler = (_: Event, row: { accountId: number }) => {
    emit('row-click', row.accountId)
  }
</script>

<template>
  <div>
    <div class="row items-center q-mb-sm q-gutter-sm">
      <q-input
        v-model="searchText"
        dense
        outlined
        placeholder="Поиск по аккаунтам"
        clearable
        style="min-width: 240px"
      >
        <template #prepend>
          <q-icon name="search" />
        </template>
      </q-input>
    </div>

    <TableComponent
      :rows="rows"
      :columns="columns"
      :visible-columns="columnsVisibleNames"
      :filter="searchText"
      :loading="loading"
      row-key="accountId"
      no-data-label="Нет данных"
      style="cursor: pointer"
      @row-click="rowClickHandler"
    >
      <template #body-cell-successRate="{ value }">
        <q-td class="text-right">
          <span :class="parseFloat(value as string) >= 90 ? 'text-positive' : 'text-warning'">
            {{ value }}
          </span>
        </q-td>
      </template>

      <template #body-cell-errorCountToday="{ value }">
        <q-td class="text-right">
          <span :class="(value as number) > 0 ? 'text-negative' : ''">{{ value }}</span>
        </q-td>
      </template>
    </TableComponent>
  </div>
</template>
