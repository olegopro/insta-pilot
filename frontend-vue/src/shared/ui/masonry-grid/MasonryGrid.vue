<script setup lang="ts" generic="T">
  import { ref, shallowRef, watch, computed, onMounted, onBeforeUnmount } from 'vue'
  import type { Nullable } from '@/shared/lib'

  const props = withDefaults(defineProps<{
    items: T[]
    columns?: number
  }>(), { columns: 3 })

  const columnCount = computed(() => props.columns)

  // Оптимистичная высота поста (px) до загрузки изображений.
  // ResizeObserver скорректирует реальные высоты после рендера.
  const ESTIMATED_POST_HEIGHT = 350

  // Реальные высоты колонок — обновляются ResizeObserver'ом при изменении DOM.
  // Используются чтобы следующий пост добавился в самую короткую колонку.
  const colHeights = ref<number[]>(Array.from({ length: columnCount.value }, () => 0))

  // Items, распределённые по колонкам (не пересчитываются при изменении высот)
  const colItems = shallowRef<T[][]>(Array.from({ length: columnCount.value }, () => []))

  // Ссылки на DOM-элементы колонок для ResizeObserver
  const colRefs = ref<Nullable<HTMLElement>[]>(Array.from({ length: columnCount.value }, () => null))

  const setColRef = (element: Nullable<HTMLElement>, index: number) => {
    colRefs.value[index] = element
  }

  let observer: Nullable<ResizeObserver> = null

  onMounted(() => {
    observer = new ResizeObserver(() => {
      colRefs.value.forEach((element, index) => {
        element && (colHeights.value[index] = element.scrollHeight)
      })
    })
    colRefs.value.forEach((element) => element && observer?.observe(element))
  })

  onBeforeUnmount(() => observer?.disconnect())

  let previousLength = 0

  const resetColumns = () => {
    colItems.value = Array.from({ length: columnCount.value }, () => [])
    colHeights.value = Array.from({ length: columnCount.value }, () => 0)
    previousLength = 0
  }

  watch(
    () => props.items,
    (newItems) => {
      // Сброс при смене аккаунта / повторной загрузке ленты
      newItems.length < previousLength && resetColumns()

      // Добавляем только новые посты, каждый — в самую короткую колонку.
      // После цикла заменяем .value целиком — shallowRef не реагирует на вложенные мутации.
      const nextCols = colItems.value.map((col) => [...col])
      newItems.slice(previousLength).forEach((item) => {
        const minIndex = colHeights.value.reduce((shortest, height, index) => (height < (colHeights.value[shortest] ?? Infinity) ? index : shortest), 0)
        nextCols[minIndex]?.push(item)
        // Оптимистично увеличиваем высоту — до обновления от ResizeObserver
        colHeights.value[minIndex] = (colHeights.value[minIndex] ?? 0) + ESTIMATED_POST_HEIGHT
      })
      colItems.value = nextCols

      previousLength = newItems.length
    },
    { immediate: true }
  )
</script>

<template>
  <div class="masonry-grid">
    <div
      v-for="(col, colIndex) in colItems"
      :key="colIndex"
      :ref="(element) => setColRef(element as Nullable<HTMLElement>, colIndex)"
      class="masonry-col"
    >
      <slot v-for="item in col" :item="item" />
    </div>
  </div>
</template>

<style scoped lang="scss">
  .masonry-grid {
    display: flex;
    gap: 12px;
    align-items: flex-start;
  }

  .masonry-col {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
</style>
