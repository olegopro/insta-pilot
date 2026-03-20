<script setup lang="ts">
  import type { QTableProps, QTableSlots } from 'quasar'
  import { useForwardProps } from '@/shared/lib'

  defineOptions({ inheritAttrs: false })
  const props = defineProps<QTableProps>()
  defineSlots<QTableSlots>()

  const forwarded = useForwardProps(props)
</script>

<template>
  <q-table
    v-bind="({ ...$attrs, ...forwarded as QTableProps})"
    :rows-per-page-options="[0]"
    flat
    bordered
    hide-pagination
  >
    <template v-for="(_, slotName) in $slots" #[slotName]="scope" :key="slotName">
      <slot :name="slotName as keyof QTableSlots" v-bind="scope ?? {}" />
    </template>
  </q-table>
</template>

<style scoped lang="scss">
  :deep(.q-table__container) {
    border-radius: $radius-lg;
    overflow: hidden;
    box-shadow: $elevation-card;
  }

  :deep(.q-table thead th) {
    font-size: $font-size-sm;
    font-weight: $font-weight-semibold;
    text-transform: uppercase;
    letter-spacing: 0.4px;
    color: $content-secondary;
    background: $neutral-50;
    padding: $spacing-stack-gap $indent-m;
  }

  :deep(.q-table tbody td) {
    font-size: $font-size-base;
    font-weight: $font-weight-regular;
    color: $content-primary;
    padding: $spacing-stack-gap $indent-m;
  }

  :deep(.q-table tbody tr td) {
    border-bottom: 1px solid $border-table;
  }

  :deep(.q-table tbody tr:hover) {
    background: $surface-tertiary;
  }
</style>
