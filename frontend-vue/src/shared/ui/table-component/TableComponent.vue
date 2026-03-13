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
