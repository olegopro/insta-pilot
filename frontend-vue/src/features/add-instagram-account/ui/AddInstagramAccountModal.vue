<script setup lang="ts">
  import { reactive } from 'vue'
  import { useAccountStore } from '@/entities/instagram-account/model/accountStore'
  import type { AddAccountRequest } from '@/entities/instagram-account/model/types'
  import { notifySuccess, notifyError } from '@/shared/lib'
  import { ModalComponent } from '@/shared/ui/modal-component'
  import { InputComponent } from '@/shared/ui/input-component'

  const emit = defineEmits<{
    added: []
  }>()

  const store = useAccountStore()
  const isOpen = defineModel<boolean>({ default: false })

  const form = reactive<AddAccountRequest>({
    instagram_login: '',
    instagram_password: '',
    proxy: ''
  })

  const requiredRule = [(value: string) => !!value]

  const resetHandler = () => {
    form.instagram_login = ''
    form.instagram_password = ''
    form.proxy = ''
    isOpen.value = false
  }

  const submitHandler = () => {
    store.addAccount.execute(form)
      .then(() => {
        notifySuccess('Аккаунт добавлен')
        emit('added')
        resetHandler()
      })
      .catch(() => notifyError(store.addAccount.error ?? 'Ошибка'))
  }
</script>

<template>
  <ModalComponent
    v-model="isOpen"
    persistent
    title="Добавить аккаунт"
    submit-label="Добавить"
    reset-label="Отмена"
    :submit-loading="store.addAccount.loading"
    @submit="submitHandler"
    @reset="resetHandler"
  >
    <InputComponent
      v-model="form.instagram_login"
      label-text="Логин Instagram"
      :rules="requiredRule"
    />
    <InputComponent
      v-model="form.instagram_password"
      label-text="Пароль Instagram"
      type="password"
      :rules="requiredRule"
    />
    <InputComponent
      v-model="form.proxy"
      label-text="Прокси (необязательно)"
    />
  </ModalComponent>
</template>
