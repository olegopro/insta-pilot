<script setup lang="ts">
  import { useAccountStore } from 'src/entities/instagram-account/model/accountStore'
  import type { InstagramAccount } from 'src/entities/instagram-account/model/types'
  import { notifySuccess, notifyError } from 'src/shared/lib'
  import { ModalComponent } from 'src/shared/ui/modal-component'

  const props = defineProps<{
    account: InstagramAccount
  }>()

  const emit = defineEmits<{
    deleted: []
  }>()

  const store = useAccountStore()
  const isOpen = defineModel<boolean>({ default: false })

  const submitHandler = () => {
    store.deleteAccount.execute(props.account.id)
      .then(() => {
        notifySuccess('Аккаунт удалён')
        emit('deleted')
        isOpen.value = false
      })
      .catch(() => notifyError(store.deleteAccount.error ?? 'Ошибка'))
  }
</script>

<template>
  <ModalComponent
    v-model="isOpen"
    title="Удалить аккаунт"
    submit-label="Удалить"
    submit-color="negative"
    reset-label="Отмена"
    :submit-loading="store.deleteAccount.loading"
    @submit="submitHandler"
    @reset="isOpen = false"
  >
    <p>
      Вы уверены, что хотите удалить аккаунт
      <strong>@{{ account.instagram_login }}</strong>?
    </p>
  </ModalComponent>
</template>
