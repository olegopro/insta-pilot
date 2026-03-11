<script setup lang="ts">
  import { useAttrs } from 'vue'
  import type { QSelectProps, QSelectSlots } from 'quasar'

  defineOptions({ inheritAttrs: false })
  defineSlots<QSelectSlots>()

  const attrs = useAttrs() as Omit<QSelectProps, 'modelValue'>
  const model = defineModel<QSelectProps['modelValue']>()
</script>

<template>
  <q-select v-bind="attrs" v-model="model">
    <template v-for="(_, slotName) in $slots" #[slotName]="scope" :key="slotName">
      <slot :name="slotName as keyof QSelectSlots" v-bind="scope || {}" />
    </template>
  </q-select>
</template>
