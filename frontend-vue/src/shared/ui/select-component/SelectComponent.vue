<script setup lang="ts">
  import { ref } from 'vue'
  import type { QSelect, QSelectProps, QSelectSlots } from 'quasar'
  import { useForwardProps } from '@/shared/lib'

  export type SelectComponentProps = Omit<QSelectProps, 'modelValue'>

  defineOptions({ inheritAttrs: false })
  const props = defineProps<SelectComponentProps>()
  defineSlots<QSelectSlots>()

  const forwarded = useForwardProps(props)
  const model = defineModel<QSelectProps['modelValue']>()

  const selectRef = ref<QSelect>()
  defineExpose({ blur: () => selectRef.value?.blur() })
</script>

<template>
  <q-select
    ref="selectRef"
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

<style scoped lang="scss">
  :deep(.q-field__control) {
    border-radius: $radius-md;
  }

  :global(.q-menu) {
    border: $border-width-default $border-style-default $border-default;
    border-radius: $radius-lg;
    box-shadow: $elevation-dropdown;
  }
</style>
