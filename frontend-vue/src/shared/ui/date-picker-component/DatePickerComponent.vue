<script setup lang="ts">
  import type { QInputProps } from 'quasar'
  import { useForwardProps, formatDateRu } from '@/shared/lib'
  import { InputComponent } from '@/shared/ui/input-component'
  import { ButtonComponent } from '@/shared/ui/button-component'

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
      <q-icon
        v-if="model"
        name="cancel"
        class="cursor-pointer"
        @click.stop="model = ''"
      />
      <q-icon name="event" class="cursor-pointer">
        <q-popup-proxy cover transition-show="scale" transition-hide="scale">
          <q-date
            :model-value="model"
            mask="YYYY-MM-DD"
            @update:model-value="(value) => (model = value ?? '')"
          >
            <div class="row items-center justify-end">
              <ButtonComponent v-close-popup label="Закрыть" color="primary" flat />
            </div>
          </q-date>
        </q-popup-proxy>
      </q-icon>
    </template>
  </InputComponent>
</template>
