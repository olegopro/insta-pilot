<script setup lang="ts">
  import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
  import {
    pxToSeconds,
    secondsToPercent,
    evenDistribution,
    clampDragWithGap,
    minWindowSeconds,
    rescaleOffsets
  } from '@/shared/ui/time-distribution-editor/lib'
  import { ButtonComponent } from '@/shared/ui/button-component'
  import { InputComponent } from '@/shared/ui/input-component'

  // Интерактивный таймлайн: по одному перетаскиваемому кубику на цель.
  // offsets — секунды запуска по индексу цели; windowSeconds — ширина окна.
  // Точные run_at считает серверный планировщик; здесь — пользовательская раскладка.
  const offsets = defineModel<number[]>('offsets', { required: true })
  const windowSeconds = defineModel<number>('windowSeconds', { required: true })

  // Подмножество деталей v-touch-pan, которое реально используем.
  interface PanDetails {
    offset: { x: number; y: number }
    isFirst: boolean
    isFinal: boolean
  }

  const trackRef = ref<HTMLElement | null>(null)
  const trackWidth = ref(1)
  const dragIndex = ref<number | null>(null)
  const dragStartSeconds = ref(0)

  let resizeObserver: ResizeObserver | null = null

  const windowMinutes = computed(() => Math.round(windowSeconds.value / 60))
  // Минимум окна (мин) под текущее число кубиков — ниже него кубики бы схлопнулись.
  const windowMinMinutes = computed(() => Math.ceil(minWindowSeconds(offsets.value.length) / 60))

  // Пять засечек по оси (0 … window) с подписью минут.
  const ticks = computed(() =>
    Array.from({ length: 5 }, (_, index) => ({
      percent: index * 25,
      minutes: Math.round((windowSeconds.value * index) / 4 / 60)
    })))

  const cubeStyle = (offset: number) => ({ left: `${String(secondsToPercent(offset, windowSeconds.value))}%` })
  const offsetMinutes = (offset: number) => Math.round(offset / 60)

  const beginDrag = (index: number) => {
    dragIndex.value = index
    dragStartSeconds.value = offsets.value[index] ?? 0
  }

  const panHandler = (index: number, details: PanDetails) => {
    details.isFirst && beginDrag(index)
    const deltaSeconds = pxToSeconds(details.offset.x, trackWidth.value, windowSeconds.value)
    const next = clampDragWithGap(offsets.value, index, dragStartSeconds.value + deltaSeconds, windowSeconds.value)
    const updated = [...offsets.value]
    updated[index] = next
    offsets.value = updated
    details.isFinal && (dragIndex.value = null)
  }

  const distributeEvenlyHandler = () =>
    offsets.value = evenDistribution(offsets.value.length, windowSeconds.value)

  const updateWindowHandler = (raw: string | number | FileList | null | undefined) => {
    const minutes = typeof raw === 'string' || typeof raw === 'number' ? Number(raw) : NaN
    if (!Number.isFinite(minutes) || minutes < 1) return
    const requested = Math.round(minutes) * 60
    const next = Math.max(requested, minWindowSeconds(offsets.value.length))
    offsets.value = rescaleOffsets(offsets.value, windowSeconds.value, next)
    windowSeconds.value = next
  }

  const measureTrack = () => trackRef.value && (trackWidth.value = Math.max(1, trackRef.value.clientWidth))

  // Рост числа целей мог сделать окно меньше минимально нужного — поднимаем окно и
  // пере-раскладываем смещения, чтобы кубики не наложились.
  watch(() => offsets.value.length, () => {
    const min = minWindowSeconds(offsets.value.length)
    if (windowSeconds.value < min) {
      offsets.value = rescaleOffsets(offsets.value, windowSeconds.value, min)
      windowSeconds.value = min
    }
  })

  onMounted(() => {
    measureTrack()
    resizeObserver = new ResizeObserver(measureTrack)
    trackRef.value && resizeObserver.observe(trackRef.value)
  })

  onBeforeUnmount(() => resizeObserver?.disconnect())
</script>

<template>
  <div class="time-editor">
    <div class="time-editor__controls">
      <InputComponent
        :model-value="windowMinutes"
        type="number"
        label-text="Окно, мин"
        outlined
        dense
        :min="windowMinMinutes"
        class="time-editor__window"
        @update:model-value="updateWindowHandler"
      />
      <ButtonComponent
        label="Распределить равномерно"
        icon="equalizer"
        color="primary"
        flat
        @click="distributeEvenlyHandler"
      />
    </div>

    <div ref="trackRef" class="time-editor__track">
      <span
        v-for="tick in ticks"
        :key="tick.percent"
        class="time-editor__tick"
        :style="{ left: `${String(tick.percent)}%` }"
      />

      <div
        v-for="(offset, index) in offsets"
        :key="index"
        v-touch-pan.horizontal.prevent.mouse="(details: PanDetails) => panHandler(index, details)"
        class="time-editor__cube"
        :class="{ 'time-editor__cube--active': dragIndex === index }"
        :style="cubeStyle(offset)"
      >
        <span class="time-editor__cube-label">{{ offsetMinutes(offset) }} мин</span>
        <q-tooltip>Цель #{{ index + 1 }} · {{ offsetMinutes(offset) }} мин</q-tooltip>
      </div>
    </div>

    <div class="time-editor__axis">
      <span v-for="tick in ticks" :key="tick.percent">{{ tick.minutes }} мин</span>
    </div>
  </div>
</template>

<style scoped lang="scss">
  .time-editor {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: $indent-m;
  }

  .time-editor__controls {
    display: flex;
    align-items: center;
    gap: $spacing-inline-gap;
    flex-wrap: wrap;

    .time-editor__window {
      width: 140px;
    }
  }

  .time-editor__track {
    position: relative;
    height: 72px;
    background: $surface-tertiary;
    border-radius: $radius-md;
    touch-action: pan-y;
  }

  .time-editor__tick {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 1px;
    background: $border-default;
    transform: translateX(-0.5px);
  }

  .time-editor__cube {
    position: absolute;
    top: 50%;
    width: 18px;
    height: 36px;
    margin-left: -9px;
    background: $primary;
    border-radius: $radius-sm;
    transform: translateY(-50%);
    cursor: grab;
    transition: background $transition-fast, transform $transition-fast;
    user-select: none;

    &--active {
      background: $primary;
      cursor: grabbing;
      transform: translateY(-50%) scale(1.1);
      z-index: 2;
    }
  }

  .time-editor__cube-label {
    position: absolute;
    top: calc(100% + #{$indent-2xs});
    left: 50%;
    transform: translateX(-50%);
    font-size: $font-size-2xs;
    color: $content-secondary;
    white-space: nowrap;
    pointer-events: none;
  }

  .time-editor__axis {
    display: flex;
    justify-content: space-between;
    font-size: $font-size-2xs;
    color: $content-secondary;
  }
</style>
