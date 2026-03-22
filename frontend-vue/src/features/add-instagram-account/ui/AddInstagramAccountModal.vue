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

  interface AddAccountForm extends Omit<AddAccountRequest, 'deviceProfileId'> {
    deviceProfileId: Nullable<number>
  }

  const form = reactive<AddAccountForm>({
    instagramLogin: '',
    instagramPassword: '',
    proxy: '',
    deviceProfileId: null
  })

  const requiredTextRule = [(value: string) => !!value.trim()]
  const requiredDeviceRule = [(value: Nullable<number>) => value !== null]

  const resetHandler = () => {
    form.instagramLogin = ''
    form.instagramPassword = ''
    form.proxy = ''
    form.deviceProfileId = store.deviceProfiles[0]?.id ?? null
    isOpen.value = false
  }

  const submitHandler = () => {
    if (form.deviceProfileId === null) {
      notifyError('Выберите модель устройства')
      return
    }

    store.addAccount({
      instagramLogin: form.instagramLogin,
      instagramPassword: form.instagramPassword,
      ...(form.proxy ? { proxy: form.proxy } : {}),
      deviceProfileId: form.deviceProfileId
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
      form.deviceProfileId = store.deviceProfiles[0]?.id ?? null
      return
    }

    store.fetchDeviceProfiles()
      .then(() => {
        form.deviceProfileId = store.deviceProfiles[0]?.id ?? null
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
      v-model="form.instagramLogin"
      label-text="Логин Instagram"
      :rules="requiredTextRule"
      outlined
    />
    <InputComponent
      v-model="form.instagramPassword"
      label-text="Пароль Instagram"
      type="password"
      :rules="requiredTextRule"
      outlined
    />
    <SelectComponent
      v-model="form.deviceProfileId"
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
