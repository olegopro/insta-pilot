<script setup lang="ts">
  import { watch } from 'vue'
  import { useAccountStore } from 'src/entities/instagram-account/model/accountStore'
  import { ModalComponent } from 'src/shared/ui/modal-component'

  const props = defineProps<{
    accountId: number
  }>()

  const store = useAccountStore()
  const isOpen = defineModel<boolean>({ default: false })

  watch(isOpen, (opened) => opened && store.fetchAccountDetails.execute(props.accountId))

  const details = store.fetchAccountDetails
</script>

<template>
  <ModalComponent
    v-model="isOpen"
    title="Информация об аккаунте"
    reset-label="Закрыть"
  >
    <div v-if="details.loading" class="flex flex-center q-pa-lg">
      <q-spinner size="48px" color="primary" />
    </div>

    <div v-else-if="details.data" class="column items-center q-gutter-sm">
      <q-avatar size="80px">
        <img
          v-if="details.data.data.profile_pic_url"
          :src="details.data.data.profile_pic_url"
          alt="avatar"
        >
        <q-icon v-else name="account_circle" size="80px" />
      </q-avatar>

      <div class="text-h6">
        {{ details.data.data.full_name ?? details.data.data.instagram_login }}
      </div>
      <div class="text-caption text-grey">
        @{{ details.data.data.instagram_login }}
      </div>

      <div class="row q-gutter-lg q-mt-md">
        <div class="column items-center">
          <div class="text-h6">{{ details.data.data.followers_count ?? '—' }}</div>
          <div class="text-caption">Подписчики</div>
        </div>
        <div class="column items-center">
          <div class="text-h6">{{ details.data.data.following_count ?? '—' }}</div>
          <div class="text-caption">Подписки</div>
        </div>
      </div>
    </div>
  </ModalComponent>
</template>
