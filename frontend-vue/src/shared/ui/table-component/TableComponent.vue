<script setup lang="ts">
  import type { QTableProps, QTableSlots } from 'quasar'

  defineProps<QTableProps>()
  defineSlots<QTableSlots>()
</script>

<template>
  <q-table
    v-bind="($props as QTableProps)"
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
