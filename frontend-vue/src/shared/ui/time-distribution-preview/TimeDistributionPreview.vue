<script setup lang="ts">
  import { computed } from 'vue'

  // Read-only превью распределения N действий по окну времени с джиттером.
  // Строит детерминированные псевдослучайные позиции на таймлайне и группирует
  // их в бакеты-столбцы для бар-превью. Серверный планировщик считает точные run_at —
  // здесь только наглядная оценка плотности.
  export interface TimeDistributionPreviewProps {
    count: number
    spreadSeconds: number
    jitterSeconds?: number
    buckets?: number
  }

  const props = withDefaults(defineProps<TimeDistributionPreviewProps>(), {
    jitterSeconds: 0,
    buckets: 24
  })

  // Детерминированный генератор (mulberry32) — превью не «прыгает» между рендерами.
  const seededRandom = (seed: number) => {
    let state = seed >>> 0
    return () => {
      state = (state + 0x6d2b79f5) >>> 0
      let result = Math.imul(state ^ (state >>> 15), 1 | state)
      result = (result + Math.imul(result ^ (result >>> 7), 61 | result)) ^ result
      return ((result ^ (result >>> 14)) >>> 0) / 4294967296
    }
  }

  const bucketCounts = computed<number[]>(() => {
    const buckets = Array.from({ length: props.buckets }, () => 0)
    if (props.count <= 0 || props.spreadSeconds <= 0) return buckets

    const random = seededRandom(props.count * 1000 + props.spreadSeconds)
    const step = props.spreadSeconds / props.count

    for (let index = 0; index < props.count; index++) {
      const base = step * index
      const jitter = props.jitterSeconds > 0 ? (random() - 0.5) * 2 * props.jitterSeconds : 0
      const at = Math.min(Math.max(base + jitter, 0), props.spreadSeconds)
      const bucketIndex = Math.min(
        Math.floor((at / props.spreadSeconds) * props.buckets),
        props.buckets - 1
      )
      const current = buckets[bucketIndex] ?? 0
      buckets[bucketIndex] = current + 1
    }

    return buckets
  })

  const maxBucket = computed(() => Math.max(1, ...bucketCounts.value))

  const spreadLabel = computed(() => {
    const minutes = Math.round(props.spreadSeconds / 60)
    if (minutes < 60) return `${String(minutes)} мин`
    const hours = (minutes / 60).toFixed(1).replace('.0', '')
    return `${hours} ч`
  })
</script>

<template>
  <div class="time-distribution">
    <div class="time-distribution__bars">
      <div
        v-for="(value, index) in bucketCounts"
        :key="index"
        class="bar"
        :style="{ height: `${Math.max((value / maxBucket) * 100, value > 0 ? 8 : 2)}%` }"
        :class="{ 'bar--empty': value === 0 }"
      >
        <q-tooltip v-if="value > 0">{{ value }} действ.</q-tooltip>
      </div>
    </div>
    <div class="time-distribution__axis">
      <span>0</span>
      <span>окно ≈ {{ spreadLabel }}</span>
    </div>
  </div>
</template>

<style scoped lang="scss">
  .time-distribution {
    width: 100%;
  }

  .time-distribution__bars {
    display: flex;
    align-items: flex-end;
    gap: 2px;
    height: 64px;
    padding: $indent-xs;
    background: $surface-tertiary;
    border-radius: $radius-md;
  }

  .bar {
    flex: 1;
    min-height: 2px;
    background: $primary;
    border-radius: $radius-xs;
    transition: height $transition-fast;

    &--empty {
      background: $border-default;
    }
  }

  .time-distribution__axis {
    display: flex;
    justify-content: space-between;
    margin-top: $indent-2xs;
    font-size: $font-size-2xs;
    color: $content-secondary;
  }
</style>
