<script setup lang="ts">
  import type { QBtnToggleProps } from 'quasar'
  import { useForwardProps } from '@/shared/lib'

  // Обёртка над q-btn-toggle — сегментированный переключатель (режим задачи,
  // вид таблица/плитка). options обязателен для QBtnToggle, поэтому нужен cast.
  // Слоты у QBtnToggle динамические (per-option), фиксированного набора нет.
  export type SegmentedControlComponentProps = Omit<QBtnToggleProps, 'modelValue'>

  defineOptions({ inheritAttrs: false })
  const props = defineProps<SegmentedControlComponentProps>()

  const forwarded = useForwardProps(props)
  const model = defineModel<QBtnToggleProps['modelValue']>()
</script>

<template>
  <q-btn-toggle
    v-bind="{ ...$attrs, ...(forwarded as QBtnToggleProps) }"
    v-model="model"
    no-caps
    unelevated
    toggle-color="primary"
    color="white"
    text-color="grey-8"
    class="segmented-control"
  />
</template>

<style scoped lang="scss">
  .segmented-control {
    border: $border-width-default $border-style-default $border-default;
    border-radius: $radius-md;
    overflow: hidden;
  }
</style>
