<script setup lang="ts">
  import { ref, computed } from 'vue'
  import { TableComponent } from '@/shared/ui/table-component'
  import { SegmentedControlComponent } from '@/shared/ui/segmented-control-component'
  import { MasonryGrid } from '@/shared/ui/masonry-grid'
  import { InputComponent } from '@/shared/ui/input-component'
  import { BadgeComponent } from '@/shared/ui/badge-component'
  import { EmptyStateComponent } from '@/shared/ui/empty-state-component'
  import { useSearchQuery, useFilterColumns } from '@/shared/lib'
  import { MediaCard } from '@/entities/media-post'
  import type { MediaPost } from '@/entities/media-post'
  import {
    automationTargetTableColumns,
    automationTargetListDTO
  } from '@/entities/automation-target'
  import type { AutomationTarget, AutomationTargetRowModel } from '@/entities/automation-target'
  import { CurateTargetButton } from '@/features/curate-automation-target'
  import { targetsToMediaPosts } from '@/widgets/automation-targets-view/lib/targetToMediaPost'

  type ViewMode = 'table' | 'tiles'

  const props = defineProps<{
    targets: AutomationTarget[]
    loading?: boolean
    curatingId?: number | null
    readonly?: boolean
  }>()

  const emit = defineEmits<{
    exclude: [targetId: number]
    restore: [targetId: number]
  }>()

  const viewMode = ref<ViewMode>('table')

  const viewModeOptions = [
    { label: 'Таблица', value: 'table' as ViewMode, icon: 'table_rows' },
    { label: 'Плитка', value: 'tiles' as ViewMode, icon: 'grid_view' }
  ]

  const { columns, columnsVisibleNames } = useFilterColumns(automationTargetTableColumns)
  const { searchText } = useSearchQuery()

  // Read-only режим (просмотр запущенной/завершённой задачи): прячем колонку действий
  // в таблице и кнопки курирования в плитке — курировать уже нельзя.
  const visibleColumns = computed<string[]>(() =>
    props.readonly
      ? columnsVisibleNames.value.filter((name) => name !== 'actions')
      : columnsVisibleNames.value
  )

  const rows = computed<AutomationTargetRowModel[]>(() => automationTargetListDTO.toLocal(props.targets))
  const mediaPosts = computed<MediaPost[]>(() => targetsToMediaPosts(props.targets))

  const keptCount = computed(() => props.targets.filter((target) => target.status === 'kept').length)
  const trashedCount = computed(() => props.targets.filter((target) => target.status === 'trashed').length)

  const statusByPk = computed(() => {
    const map = new Map<string, AutomationTarget>()
    props.targets.forEach((target) => map.set(target.targetUserPk, target))
    return map
  })

  const curateRowHandler = (row: AutomationTargetRowModel) =>
    row.status === 'kept' ? emit('exclude', row.id) : emit('restore', row.id)

  const curateTileHandler = (post: MediaPost) => {
    const target = statusByPk.value.get(post.user.pk)
    if (!target) return
    target.status === 'kept' ? emit('exclude', target.id) : emit('restore', target.id)
  }

  const getPostHeight = (_: MediaPost, columnWidth: number): number => columnWidth + 60
</script>

<template>
  <div class="targets-view">
    <!-- Идёт сбор целей: пока целей нет и активна загрузка — спиннер вместо пустой таблицы -->
    <div v-if="loading && targets.length === 0" class="targets-view__status">
      <q-spinner size="40px" color="primary" />
      <span class="targets-view__status-text">Идёт сбор целей…</span>
    </div>

    <!-- Пусто без загрузки: внятный empty state -->
    <EmptyStateComponent
      v-else-if="targets.length === 0"
      icon="group_off"
      text="Целей пока нет"
    />

    <template v-else>
      <div class="targets-view__toolbar">
        <div class="targets-view__counters">
          <BadgeComponent :label="`Оставлено: ${String(keptCount)}`" color="positive" size="md" />
          <BadgeComponent v-if="trashedCount > 0" :label="`В корзине: ${String(trashedCount)}`" color="grey" outline size="md" />
        </div>

        <div class="targets-view__controls">
          <InputComponent
            v-model="searchText"
            dense
            outlined
            placeholder="Поиск по аккаунтам"
            clearable
            style="min-width: 220px"
          >
            <template #prepend>
              <q-icon name="search" />
            </template>
          </InputComponent>

          <SegmentedControlComponent v-model="viewMode" :options="viewModeOptions" />
        </div>
      </div>

      <TableComponent
        v-if="viewMode === 'table'"
        :rows="rows"
        :columns="columns"
        :visible-columns="visibleColumns"
        :filter="searchText"
        :loading="loading"
        row-key="id"
        no-data-label="Нет целей"
      >
        <template #body-cell-username="{ row }">
          <q-td>
            <span :class="{ 'targets-view__trashed': row.status === 'trashed' }">{{ row.username }}</span>
          </q-td>
        </template>

        <template #body-cell-status="{ row }">
          <q-td class="text-center">
            <BadgeComponent
              :label="row.status === 'kept' ? 'Оставлен' : 'В корзине'"
              :color="row.status === 'kept' ? 'positive' : 'grey'"
              :outline="row.status === 'trashed'"
              size="sm"
            />
          </q-td>
        </template>

        <template #body-cell-actions="{ row }">
          <q-td class="text-center">
            <CurateTargetButton
              :status="row.status"
              :loading="curatingId === row.id"
              @exclude="curateRowHandler(row)"
              @restore="curateRowHandler(row)"
            />
          </q-td>
        </template>
      </TableComponent>

      <div v-else class="targets-view__tiles">
        <MasonryGrid :items="mediaPosts" :get-item-height="getPostHeight">
          <template #default="{ item }">
            <div class="tile">
              <MediaCard :key="item.pk" :post="item" is-mock />
              <div v-if="!readonly" class="tile__actions">
                <CurateTargetButton
                  :status="statusByPk.get(item.user.pk)?.status ?? 'kept'"
                  :loading="curatingId === statusByPk.get(item.user.pk)?.id"
                  @exclude="curateTileHandler(item)"
                  @restore="curateTileHandler(item)"
                />
              </div>
            </div>
          </template>
        </MasonryGrid>
      </div>
    </template>
  </div>
</template>

<style scoped lang="scss">
  .targets-view {
    display: flex;
    flex-direction: column;
    gap: $spacing-stack-gap;
  }

  .targets-view__status {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: $indent-m;
    padding: $spacing-section-gap;
    color: $content-secondary;
  }

  .targets-view__status-text {
    font-size: $font-size-base;
  }

  .targets-view__toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: $spacing-section-gap;
    flex-wrap: wrap;
  }

  .targets-view__counters,
  .targets-view__controls {
    display: flex;
    align-items: center;
    gap: $spacing-inline-gap;
  }

  .targets-view__trashed {
    text-decoration: line-through;
    color: $content-secondary;
  }

  .tile {
    position: relative;

    &__actions {
      position: absolute;
      top: $indent-xs;
      left: $indent-xs;
      background: $surface-primary;
      border-radius: $radius-md;
      box-shadow: $elevation-card;
    }
  }
</style>
