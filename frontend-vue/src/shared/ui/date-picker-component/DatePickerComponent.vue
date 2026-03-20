<script setup lang="ts">
  import type { QInputProps } from 'quasar'
  import { useForwardProps, formatDateRu } from '@/shared/lib'
  import { InputComponent } from '@/shared/ui/input-component'

  export type DatePickerComponentProps = Omit<QInputProps, 'modelValue' | 'onUpdate:modelValue'>

  defineOptions({ inheritAttrs: false })
  const props = defineProps<DatePickerComponentProps>()
  const forwarded = useForwardProps(props)
  const model = defineModel<string>({ default: '' })
</script>

<template>
  <InputComponent
    v-bind="{ ...$attrs, ...forwarded }"
    :model-value="model ? formatDateRu(model) : ''"
    readonly
  >
    <template #append>
      <q-icon name="event" class="cursor-pointer">
        <q-popup-proxy cover transition-show="scale" transition-hide="scale">
          <q-date
            :model-value="model"
            mask="YYYY-MM-DD"
            @update:model-value="(val) => (model = val ?? '')"
          >
            <div class="row items-center justify-end">
              <q-btn v-close-popup label="Закрыть" color="primary" flat />
            </div>
          </q-date>
        </q-popup-proxy>
      </q-icon>
    </template>
  </InputComponent>
</template>
