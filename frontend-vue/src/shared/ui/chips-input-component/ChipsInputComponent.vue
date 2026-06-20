<script setup lang="ts">
  import type { QSelectProps, QSelectSlots } from 'quasar'
  import { useForwardProps } from '@/shared/lib'

  // Обёртка над q-select multiple+use-input для ввода набора строк-чипов
  // (хэштеги, бело/чёрные списки слов). modelValue — массив строк.
  export interface ChipsInputComponentProps extends Omit<QSelectProps, 'modelValue'> {
    labelText?: string
  }

  defineOptions({ inheritAttrs: false })
  const props = defineProps<ChipsInputComponentProps>()
  defineSlots<QSelectSlots>()

  const forwarded = useForwardProps(props)
  const model = defineModel<string[]>({ default: () => [] })
</script>

<template>
  <q-select
    v-bind="{ ...$attrs, ...forwarded }"
    v-model="model"
    :label="labelText"
    multiple
    use-input
    use-chips
    hide-dropdown-icon
    new-value-mode="add-unique"
    input-debounce="0"
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
</style>
