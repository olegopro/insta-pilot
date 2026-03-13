<script setup lang="ts">
  import type { QToggleProps, QToggleSlots } from 'quasar'
  import { useForwardProps } from '@/shared/lib'

  export type ToggleComponentProps = Omit<QToggleProps, 'modelValue'>

  defineOptions({ inheritAttrs: false })
  const props = defineProps<ToggleComponentProps>()
  defineSlots<QToggleSlots>()

  const forwarded = useForwardProps(props)
  const model = defineModel<QToggleProps['modelValue']>()
</script>

<template>
  <q-toggle v-bind="{ ...$attrs, ...forwarded }" v-model="model">
    <template v-for="(_, slotName) in $slots" #[slotName]="scope" :key="slotName">
      <slot :name="slotName as keyof QToggleSlots" v-bind="scope || {}" />
    </template>
  </q-toggle>
</template>
