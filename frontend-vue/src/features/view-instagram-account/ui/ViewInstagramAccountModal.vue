<script setup lang="ts">
  import { watch } from 'vue'
  import { useAccountStore } from '@/entities/instagram-account/model/accountStore'
  import { ModalComponent } from '@/shared/ui/modal-component'

  const props = defineProps<{
    accountId: number
  }>()

  const store = useAccountStore()
  const isOpen = defineModel<boolean>({ default: false })

  watch(isOpen, (opened) => opened && store.fetchAccountDetails(props.accountId))
</script>

<template>
  <ModalComponent
    v-model="isOpen"
    title="Информация об аккаунте"
    reset-label="Закрыть"
  >
    <div v-if="store.fetchAccountDetailsLoading" class="flex flex-center q-pa-lg">
      <q-spinner size="48px" color="primary" />
    </div>

    <div v-else-if="store.accountDetail" class="column items-center q-gutter-sm">
      <q-avatar size="80px">
        <img
          v-if="store.accountDetail.profilePicUrl"
          :src="store.accountDetail.profilePicUrl"
          alt="avatar"
        >
        <q-icon v-else name="account_circle" size="80px" />
      </q-avatar>

      <div class="text-h6">
        {{ store.accountDetail.fullName ?? store.accountDetail.instagramLogin }}
      </div>
      <div class="text-caption text-grey">
        @{{ store.accountDetail.instagramLogin }}
      </div>

      <div class="row q-gutter-lg q-mt-md">
        <div class="column items-center">
          <div class="text-h6">{{ store.accountDetail.followersCount ?? '—' }}</div>
          <div class="text-caption">Подписчики</div>
        </div>
        <div class="column items-center">
          <div class="text-h6">{{ store.accountDetail.followingCount ?? '—' }}</div>
          <div class="text-caption">Подписки</div>
        </div>
      </div>
    </div>
  </ModalComponent>
</template>
