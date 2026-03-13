<script setup lang="ts">
  import { ref } from 'vue'
  import type { QInputProps, QInputSlots } from 'quasar'
  import { QInput } from 'quasar'
  import { useForwardProps } from '@/shared/lib'

  export interface InputComponentProps extends Omit<QInputProps, 'modelValue'> {
    labelText?: string
  }

  defineOptions({ inheritAttrs: false })
  const props = defineProps<InputComponentProps>()
  defineSlots<QInputSlots>()

  defineExpose({
    validate: () => qInputRef.value?.validate(),
    resetValidation: () => qInputRef.value?.resetValidation()
  })

  const forwarded = useForwardProps(props)
  const qInputRef = ref<QInput>()
  const model = defineModel<QInputProps['modelValue']>()
  const passType = ref(props.type)

  const changePassVisibilityHandler = () => {
    passType.value = passType.value === 'password' ? 'text' : 'password'
  }
</script>

<template>
  <label class="ui-input">
    <q-input
      ref="qInputRef"
      v-bind="{ ...$attrs, ...forwarded }"
      v-model="model"
      :type="passType"
      :label="labelText"
      no-error-icon
    >
      <template v-for="(_, slotName) in $slots" #[slotName]="scope" :key="slotName">
        <slot :name="slotName as keyof QInputSlots" v-bind="scope || {}" />
      </template>

      <template v-if="props.type === 'password'" #append>
        <q-icon
          class="cursor-pointer"
          :name="passType === 'password' ? 'visibility_off' : 'visibility'"
          @click="changePassVisibilityHandler"
        />
      </template>
    </q-input>
  </label>
</template>
