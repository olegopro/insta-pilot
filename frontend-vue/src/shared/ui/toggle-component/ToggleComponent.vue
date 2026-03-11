<script setup lang="ts">
  import { useAttrs } from 'vue'
  import type { QToggleProps, QToggleSlots } from 'quasar'

  defineOptions({ inheritAttrs: false })
  defineSlots<QToggleSlots>()

  const attrs = useAttrs() as Omit<QToggleProps, 'modelValue'>
  const model = defineModel<QToggleProps['modelValue']>()
</script>

<template>
  <q-toggle v-bind="attrs" v-model="model">
    <template v-for="(_, slotName) in $slots" #[slotName]="scope" :key="slotName">
      <slot :name="slotName as keyof QToggleSlots" v-bind="scope || {}" />
    </template>
  </q-toggle>
</template>
