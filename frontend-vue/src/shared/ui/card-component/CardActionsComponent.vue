<script setup lang="ts">
  import type { QCardActionsProps, QCardActionsSlots } from 'quasar'
  import { useForwardProps } from '@/shared/lib'

  export type CardActionsComponentProps = QCardActionsProps

  defineOptions({ inheritAttrs: false })
  const props = defineProps<CardActionsComponentProps>()
  defineSlots<QCardActionsSlots>()

  const forwarded = useForwardProps(props)
</script>

<template>
  <q-card-actions v-bind="{ ...$attrs, ...forwarded }">
    <slot />
  </q-card-actions>
</template>
