<script setup lang="ts">
  import type { QBtnDropdownProps, QBtnDropdownSlots } from 'quasar'
  import { useForwardProps } from '@/shared/lib'

  export type DropdownComponentProps = Omit<QBtnDropdownProps, 'modelValue'>

  defineOptions({ inheritAttrs: false })
  const props = defineProps<DropdownComponentProps>()
  defineSlots<QBtnDropdownSlots>()

  const forwarded = useForwardProps(props)
  const model = defineModel<boolean>({ default: false })
</script>

<template>
  <q-btn-dropdown v-bind="({ ...$attrs, ...forwarded })" v-model="model">
    <template v-for="(_, slotName) in $slots" #[slotName]="scope" :key="slotName">
      <slot :name="slotName as keyof QBtnDropdownSlots" v-bind="scope || {}" />
    </template>
  </q-btn-dropdown>
</template>

<style scoped lang="scss">
  :global(.q-menu) {
  border: $border-width-default $border-style-default $border-default;
  border-radius: $radius-lg;
  box-shadow: $elevation-dropdown;
}
</style>
