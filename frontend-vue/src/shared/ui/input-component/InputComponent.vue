<script setup lang="ts">
  import { ref, useAttrs } from 'vue'
  import type { QInputProps, QInputSlots } from 'quasar'
  import { QInput } from 'quasar'

  export interface InputComponentProps {
    labelText?: string
  }

  defineOptions({ inheritAttrs: false })
  defineProps<InputComponentProps>()
  defineSlots<QInputSlots>()

  defineExpose({
    validate: () => qInputRef.value?.validate(),
    resetValidation: () => qInputRef.value?.resetValidation()
  })

  const attrs = useAttrs() as Omit<QInputProps, 'modelValue'>
  const qInputRef = ref<QInput>()
  const model = defineModel<QInputProps['modelValue']>()
  const passType = ref(attrs.type)

  const changePassVisibilityHandler = () => {
    passType.value = passType.value === 'password' ? 'text' : 'password'
  }
</script>

<template>
  <label class="ui-input">
    <span v-if="labelText" class="ui-input__label">{{ labelText }}</span>
    <q-input
      ref="qInputRef"
      v-bind="$attrs"
      v-model="model"
      :type="passType"
      dense
      outlined
      no-error-icon
    >
      <template v-for="(_, slotName) in $slots" #[slotName]="scope" :key="slotName">
        <slot :name="slotName as keyof QInputSlots" v-bind="scope || {}" />
      </template>

      <template v-if="attrs.type === 'password'" #append>
        <q-icon
          class="cursor-pointer"
          :name="passType === 'password' ? 'visibility_off' : 'visibility'"
          @click="changePassVisibilityHandler"
        />
      </template>
    </q-input>
  </label>
</template>
