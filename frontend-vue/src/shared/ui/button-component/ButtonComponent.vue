<script setup lang="ts">
  import type { QBtnProps, QBtnSlots } from 'quasar'
  import { useForwardProps } from '@/shared/lib'

  export type ButtonComponentProps = QBtnProps

  defineOptions({ inheritAttrs: false })
  const props = defineProps<ButtonComponentProps>()
  defineSlots<QBtnSlots>()

  const forwarded = useForwardProps(props)
</script>

<template>
  <q-btn v-bind="{ ...$attrs, ...forwarded }">
    <template v-for="(_, slotName) in $slots" #[slotName]="scope" :key="slotName">
      <slot :name="slotName as keyof QBtnSlots" v-bind="scope || {}" />
    </template>
  </q-btn>
</template>

<style scoped lang="scss">
  .q-btn {
    border-radius: $radius-md;
  }
</style>
