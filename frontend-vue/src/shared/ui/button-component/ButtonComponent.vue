<script setup lang="ts">
  import { useAttrs } from 'vue'
  import type { QBtnProps, QBtnSlots } from 'quasar'

  defineOptions({ inheritAttrs: false })
  defineSlots<QBtnSlots>()

  const attrs = useAttrs() as QBtnProps
</script>

<template>
  <q-btn v-bind="attrs" no-caps>
    <template v-for="(_, slotName) in $slots" #[slotName]="scope" :key="slotName">
      <slot :name="slotName as keyof QBtnSlots" v-bind="scope || {}" />
    </template>
  </q-btn>
</template>
