<script setup lang="ts">
  import { useAccountStore } from '@/entities/instagram-account/model/accountStore'
  import type { InstagramAccount } from '@/entities/instagram-account/model/types'
  import { notifySuccess, notifyError } from '@/shared/lib'
  import { ModalComponent } from '@/shared/ui/modal-component'

  const props = defineProps<{
    account: InstagramAccount
  }>()

  const emit = defineEmits<{
    deleted: []
  }>()

  const store = useAccountStore()
  const isOpen = defineModel<boolean>({ default: false })

  const submitHandler = () => store.deleteAccount(props.account.id)
    .then(() => {
      notifySuccess('Аккаунт удалён')
      emit('deleted')
      isOpen.value = false
    })
    .catch(() => notifyError(store.deleteAccountError ?? 'Ошибка'))
</script>

<template>
  <ModalComponent
    v-model="isOpen"
    title="Удалить аккаунт"
    submit-label="Удалить"
    submit-color="negative"
    reset-label="Отмена"
    :submit-loading="store.deleteAccountLoading"
    @submit="submitHandler"
    @reset="isOpen = false"
  >
    <p>
      Вы уверены, что хотите удалить аккаунт
      <strong>@{{ account.instagramLogin }}</strong>?
    </p>
  </ModalComponent>
</template>
