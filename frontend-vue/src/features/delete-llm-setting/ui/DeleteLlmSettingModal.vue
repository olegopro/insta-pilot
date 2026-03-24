<script setup lang="ts">
  import { useLlmSettingsStore } from '@/entities/llm-settings'
  import type { LlmSetting } from '@/entities/llm-settings'
  import { notifySuccess, notifyError } from '@/shared/lib'
  import { ModalComponent } from '@/shared/ui/modal-component'

  const props = defineProps<{
    setting: LlmSetting
  }>()

  const emit = defineEmits<{
    deleted: []
  }>()

  const store = useLlmSettingsStore()
  const isOpen = defineModel<boolean>({ default: false })

  const submitHandler = () => store.deleteSetting(props.setting.id)
    .then(() => {
      notifySuccess('Провайдер удалён')
      emit('deleted')
      isOpen.value = false
    })
    .catch(() => notifyError(store.deleteSettingError ?? 'Ошибка удаления'))
</script>

<template>
  <ModalComponent
    v-model="isOpen"
    title="Удалить провайдер"
    submit-label="Удалить"
    submit-color="negative"
    reset-label="Отмена"
    :submit-loading="store.deleteSettingLoading"
    @submit="submitHandler"
    @reset="isOpen = false"
  >
    <p>
      Вы уверены, что хотите удалить провайдер
      <strong>{{ setting.provider.toUpperCase() }}</strong>
      ({{ setting.modelName }})?
    </p>
  </ModalComponent>
</template>
