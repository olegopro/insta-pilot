<script setup lang="ts">
  import { watch } from 'vue'
  import { useAccountStore } from 'src/entities/instagram-account/model/accountStore'
  import { ModalComponent } from 'src/shared/ui/modal-component'
  import { ButtonComponent } from 'src/shared/ui/button-component'

  const props = defineProps<{
    accountId: number
  }>()

  const store = useAccountStore()
  const isOpen = defineModel<boolean>({ default: false })

  watch(isOpen, (opened) => opened && store.fetchAccountDetails.execute(props.accountId))

  const details = store.fetchAccountDetails
</script>

<template>
  <ModalComponent v-model="isOpen">
    <q-card style="min-width: 350px">
      <q-card-section>
        <div class="text-h6">Информация об аккаунте</div>
      </q-card-section>
      {{ details.data?.data }}
      <q-card-section v-if="details.loading" class="flex flex-center q-pa-lg">
        <q-spinner size="48px" color="primary" />
      </q-card-section>

      <q-card-section v-else-if="details.data">
        <div class="column items-center q-gutter-sm">
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
      </q-card-section>

      <q-card-actions align="right">
        <ButtonComponent flat label="Закрыть" @click="isOpen = false" />
      </q-card-actions>
    </q-card>
  </ModalComponent>
</template>
