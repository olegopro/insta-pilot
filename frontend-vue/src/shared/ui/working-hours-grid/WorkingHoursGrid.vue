<script setup lang="ts">
  import { ref, onBeforeUnmount } from 'vue'

  // Сетка рабочих часов: 7 строк (дни недели) × 24 столбца (часы).
  // v-model — матрица boolean[7][24]. Поддержка drag-select: зажать и протянуть.
  export interface WorkingHoursGridProps {
    disable?: boolean
  }

  const props = defineProps<WorkingHoursGridProps>()

  const model = defineModel<boolean[][]>({
    default: () => Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => false))
  })

  const DAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
  const HOURS = Array.from({ length: 24 }, (_, hour) => hour)

  let isDragging = false
  let dragValue = false
  const hoveredDay = ref<number>(-1)
  const hoveredHour = ref<number>(-1)

  const cloneMatrix = (matrix: boolean[][]): boolean[][] => matrix.map((row) => [...row])

  const setCell = (day: number, hour: number, value: boolean) => {
    const next = cloneMatrix(model.value)
    const row = next[day]
    if (!row) return
    row[hour] = value
    model.value = next
  }

  const stopDrag = () => {
    isDragging = false
    window.removeEventListener('mouseup', stopDrag)
  }

  const startDragHandler = (day: number, hour: number) => {
    if (props.disable) return
    isDragging = true
    dragValue = !(model.value[day]?.[hour] ?? false)
    setCell(day, hour, dragValue)
    window.addEventListener('mouseup', stopDrag)
  }

  const enterCellHandler = (day: number, hour: number) => {
    hoveredDay.value = day
    hoveredHour.value = hour
    isDragging && !props.disable && setCell(day, hour, dragValue)
  }

  const leaveGridHandler = () => {
    hoveredDay.value = -1
    hoveredHour.value = -1
  }

  const toggleRowHandler = (day: number) => {
    if (props.disable) return
    const row = model.value[day]
    if (!row) return
    const allActive = row.every((cell) => cell)
    const next = cloneMatrix(model.value)
    next[day] = Array.from({ length: 24 }, () => !allActive)
    model.value = next
  }

  const toggleColumnHandler = (hour: number) => {
    if (props.disable) return
    const allActive = model.value.every((row) => row[hour])
    const next = model.value.map((row) => {
      const copy = [...row]
      copy[hour] = !allActive
      return copy
    })
    model.value = next
  }

  onBeforeUnmount(() => window.removeEventListener('mouseup', stopDrag))
</script>

<template>
  <div class="working-hours-grid" :class="{ 'working-hours-grid--disabled': disable }">
    <table @mouseleave="leaveGridHandler">
      <thead>
        <tr>
          <th class="corner" />
          <th
            v-for="hour in HOURS"
            :key="hour"
            class="hour-head"
            :class="{ highlight: hoveredHour === hour }"
            @click="toggleColumnHandler(hour)"
          >
            {{ hour }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(label, day) in DAYS" :key="day">
          <th
            class="day-head"
            :class="{ highlight: hoveredDay === day }"
            @click="toggleRowHandler(day)"
          >
            {{ label }}
          </th>
          <td
            v-for="hour in HOURS"
            :key="hour"
            class="cell"
            :class="{ active: model[day]?.[hour] }"
            @mousedown.prevent="startDragHandler(day, hour)"
            @mouseenter="enterCellHandler(day, hour)"
          />
        </tr>
      </tbody>
    </table>
    <p class="hint">Зажмите и протяните, чтобы выделить диапазон. Клик по заголовку — вся строка/столбец.</p>
  </div>
</template>

<style scoped lang="scss">
  .working-hours-grid {
    user-select: none;

    &--disabled {
      opacity: 0.5;
      pointer-events: none;
    }

    table {
      border-collapse: collapse;
      width: 100%;
    }

    th,
    td {
      border: 1px solid $border-default;
      text-align: center;
    }

    .corner {
      width: 36px;
    }

    .hour-head,
    .day-head {
      font-size: $font-size-2xs;
      font-weight: $font-weight-medium;
      color: $content-secondary;
      cursor: pointer;
      background: $neutral-50;

      &.highlight {
        background: $surface-tertiary;
        color: $content-primary;
      }
    }

    .hour-head {
      padding: $indent-2xs 0;
    }

    .day-head {
      padding: 0 $indent-xs;
      width: 36px;
    }

    .cell {
      height: 22px;
      cursor: pointer;
      background: $surface-primary;
      transition: background $transition-fast;

      &:hover {
        background: $surface-tertiary;
      }

      &.active {
        background: $primary;
      }
    }

    .hint {
      margin: $indent-xs 0 0;
      font-size: $font-size-2xs;
      color: $content-secondary;
    }
  }
</style>
