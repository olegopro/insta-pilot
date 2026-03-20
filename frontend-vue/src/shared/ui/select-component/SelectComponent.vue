<script setup lang="ts">
  import type { QSelectProps, QSelectSlots } from 'quasar'
  import { useForwardProps } from '@/shared/lib'

  export type SelectComponentProps = Omit<QSelectProps, 'modelValue'>

  defineOptions({ inheritAttrs: false })
  const props = defineProps<SelectComponentProps>()
  defineSlots<QSelectSlots>()

  const forwarded = useForwardProps(props)
  const model = defineModel<QSelectProps['modelValue']>()
</script>

<template>
  <q-select
    v-bind="{
      ...$attrs,
      ...forwarded,
      menuOffset: forwarded.menuOffset ?? [0, 6]
    }" v-model="model"
  >
    <template v-for="(_, slotName) in $slots" #[slotName]="scope" :key="slotName">
      <slot :name="slotName as keyof QSelectSlots" v-bind="scope || {}" />
    </template>
  </q-select>
</template>
