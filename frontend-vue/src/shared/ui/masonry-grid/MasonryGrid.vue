<script setup lang="ts" generic="T">
  import { ref, shallowRef, watch, computed, onMounted, onBeforeUnmount } from 'vue'
  import type { Nullable } from '@/shared/lib'

  const props = withDefaults(defineProps<{
    items: T[]
    columns?: number
    getItemHeight?: (item: T, columnWidth: number) => number | undefined
  }>(), { columns: 3 })

  const FALLBACK_HEIGHT = 350

  const columnCount = computed(() => props.columns)

  const columnHeights = ref<number[]>(Array.from({ length: columnCount.value }, () => 0))
  const columnItems = shallowRef<T[][]>(Array.from({ length: columnCount.value }, () => []))
  const columnRefs = ref<Nullable<HTMLElement>[]>(Array.from({ length: columnCount.value }, () => null))
  const columnWidth = ref(0)

  let observer: Nullable<ResizeObserver> = null
  let previousLength = 0

  const setColumnRef = (element: Nullable<HTMLElement>, index: number) => {
    columnRefs.value[index] = element
  }

  const resetColumns = () => {
    columnItems.value = Array.from({ length: columnCount.value }, () => [])
    columnHeights.value = Array.from({ length: columnCount.value }, () => 0)
    previousLength = 0
  }

  const estimateHeight = (item: T): number => {
    if (props.getItemHeight && columnWidth.value > 0) {
      return props.getItemHeight(item, columnWidth.value) ?? FALLBACK_HEIGHT
    }
    return FALLBACK_HEIGHT
  }

  const distributeItems = (items: T[]) => {
    const nextColumns = columnItems.value.map((column) => [...column])
    items.slice(previousLength).forEach((item) => {
      const minIndex = columnHeights.value.reduce(
        (shortest, height, index) =>
          (height < (columnHeights.value[shortest] ?? Infinity) ? index : shortest),
        0
      )
      nextColumns[minIndex]?.push(item)
      columnHeights.value[minIndex] = (columnHeights.value[minIndex] ?? 0) + estimateHeight(item)
    })
    columnItems.value = nextColumns
    previousLength = items.length
  }

  watch(
    () => props.items,
    (newItems) => {
      newItems.length < previousLength && resetColumns()
      distributeItems(newItems)
    },
    { immediate: true }
  )

  // На первом render columnWidth = 0, поэтому используется FALLBACK_HEIGHT.
  // Как только ResizeObserver устанавливает реальную ширину — перераспределяем элементы.
  const stopColumnWidthWatch = watch(columnWidth, (width) => {
    if (width > 0) {
      resetColumns()
      distributeItems(props.items)
      stopColumnWidthWatch()
    }
  })

  onMounted(() => {
    observer = new ResizeObserver(() => {
      columnRefs.value.forEach((element, index) => {
        element && (columnHeights.value[index] = element.scrollHeight)
      })
      const firstColumn = columnRefs.value[0]
      firstColumn && (columnWidth.value = firstColumn.clientWidth)
    })
    columnRefs.value.forEach((element) => element && observer?.observe(element))
  })

  onBeforeUnmount(() => observer?.disconnect())
</script>

<template>
  <div class="masonry-grid">
    <div
      v-for="(column, columnIndex) in columnItems"
      :key="columnIndex"
      :ref="(element) => setColumnRef(element as Nullable<HTMLElement>, columnIndex)"
      class="masonry-col"
    >
      <slot v-for="item in column" :item="item" />
    </div>
  </div>
</template>

<style scoped lang="scss">
  .masonry-grid {
    display: flex;
    gap: $spacing-stack-gap;
    align-items: flex-start;
  }

  .masonry-col {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: $spacing-stack-gap;
  }
</style>
