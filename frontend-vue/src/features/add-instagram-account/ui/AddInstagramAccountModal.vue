<script setup lang="ts">
  import { reactive, onMounted } from 'vue'
  import { useAccountStore } from '@/entities/instagram-account/model/accountStore'
  import type { AddAccountRequest } from '@/entities/instagram-account/model/types'
  import { notifySuccess, notifyError, type Nullable } from '@/shared/lib'
  import { ModalComponent } from '@/shared/ui/modal-component'
  import { InputComponent } from '@/shared/ui/input-component'
  import { SelectComponent } from '@/shared/ui/select-component'

  const emit = defineEmits<{
    added: []
  }>()

  const store = useAccountStore()
  const isOpen = defineModel<boolean>({ default: false })

  interface AddAccountForm extends Omit<AddAccountRequest, 'device_profile_id'> {
    device_profile_id: Nullable<number>
  }

  const form = reactive<AddAccountForm>({
    instagram_login: '',
    instagram_password: '',
    proxy: '',
    device_profile_id: null
  })

  const requiredTextRule = [(value: string) => !!value.trim()]
  const requiredDeviceRule = [(value: Nullable<number>) => value !== null]

  const resetHandler = () => {
    form.instagram_login = ''
    form.instagram_password = ''
    form.proxy = ''
    form.device_profile_id = store.deviceProfiles[0]?.id ?? null
    isOpen.value = false
  }

  const submitHandler = () => {
    if (form.device_profile_id === null) {
      notifyError('Выберите модель устройства')
      return
    }

    store.addAccount({
      instagram_login: form.instagram_login,
      instagram_password: form.instagram_password,
      ...(form.proxy ? { proxy: form.proxy } : {}),
      device_profile_id: form.device_profile_id
    })
      .then(() => {
        notifySuccess('Аккаунт добавлен')
        emit('added')
        resetHandler()
      })
      .catch(() => notifyError(store.addAccountError ?? 'Ошибка'))
  }

  onMounted(() => {
    if (store.deviceProfiles.length > 0) {
      form.device_profile_id = store.deviceProfiles[0]?.id ?? null
      return
    }

    store.fetchDeviceProfiles()
      .then(() => {
        form.device_profile_id = store.deviceProfiles[0]?.id ?? null
      })
      .catch(() => notifyError('Не удалось загрузить устройства'))
  })
</script>

<template>
  <ModalComponent
    v-model="isOpen"
    persistent
    title="Добавить аккаунт"
    submit-label="Добавить"
    reset-label="Отмена"
    :submit-loading="store.addAccountLoading"
    @submit="submitHandler"
    @reset="resetHandler"
  >
    <InputComponent
      v-model="form.instagram_login"
      label-text="Логин Instagram"
      :rules="requiredTextRule"
      outlined
    />
    <InputComponent
      v-model="form.instagram_password"
      label-text="Пароль Instagram"
      type="password"
      :rules="requiredTextRule"
      outlined
    />
    <SelectComponent
      v-model="form.device_profile_id"
      :options="store.deviceProfiles"
      :loading="store.fetchDeviceProfilesLoading"
      option-label="title"
      option-value="id"
      label="Модель устройства"
      emit-value
      map-options
      outlined
      :rules="requiredDeviceRule"
    />
    <InputComponent
      v-model="form.proxy"
      label-text="Прокси (необязательно)"
      outlined
    />
  </ModalComponent>
</template>
