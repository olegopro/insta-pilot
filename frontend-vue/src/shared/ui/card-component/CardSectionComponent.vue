<script setup lang="ts">
  import type { QCardSectionProps, QCardSectionSlots } from 'quasar'
  import { useForwardProps } from '@/shared/lib'

  export type CardSectionComponentProps = QCardSectionProps

  defineOptions({ inheritAttrs: false })
  const props = defineProps<CardSectionComponentProps>()
  defineSlots<QCardSectionSlots>()

  const forwarded = useForwardProps(props)
</script>

<template>
  <q-card-section v-bind="{ ...$attrs, ...forwarded }">
    <slot />
  </q-card-section>
</template>
