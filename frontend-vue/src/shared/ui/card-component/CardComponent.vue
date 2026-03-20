<script setup lang="ts">
  import type { QCardProps, QCardSlots } from 'quasar'
  import { useForwardProps } from '@/shared/lib'

  export type CardComponentProps = QCardProps

  defineOptions({ inheritAttrs: false })
  const props = defineProps<CardComponentProps>()
  defineSlots<QCardSlots>()

  const forwarded = useForwardProps(props)
</script>

<template>
  <q-card v-bind="{ ...$attrs, ...forwarded }">
    <template v-for="(_, slotName) in $slots" #[slotName]="scope" :key="slotName">
      <slot :name="slotName as keyof QCardSlots" v-bind="scope || {}" />
    </template>
  </q-card>
</template>

<style scoped lang="scss">
  .q-card {
    border-radius: $radius-lg;
    box-shadow: $elevation-card;
    background: $surface-primary;
    border: 1px solid $border-default;
  }
</style>
