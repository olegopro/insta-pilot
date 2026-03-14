<script setup lang="ts">
  import type { Nullable } from '@/shared/lib'
  import { formatCount } from '@/shared/lib'
  import type { InstagramUserDetail } from '@/entities/media-post'
  import { ModalComponent } from '@/shared/ui/modal-component'

  defineProps<{
    user: Nullable<InstagramUserDetail>
    loading?: boolean
  }>()

  const isOpen = defineModel<boolean>({ default: false })
</script>

<template>
  <ModalComponent
    v-model="isOpen"
    title="Профиль"
    icon="person"
    readonly
    inner-class="user-modal-inner"
  >
    <div class="body">
      <div v-if="loading" class="row justify-center q-pa-xl">
        <q-spinner size="40px" color="primary" />
      </div>

      <div v-else-if="user" class="content">
        <div class="header">
          <q-avatar size="80px" class="q-mb-sm">
            <img v-if="user.profilePicUrl" :src="user.profilePicUrl">
            <q-icon v-else name="person" size="40px" />
          </q-avatar>
          <div class="names">
            <div class="text-h6 text-weight-bold">
              {{ user.username }}
              <q-icon v-if="user.isVerified" name="verified" color="blue" size="18px" />
            </div>
            <div v-if="user.fullName" class="text-subtitle2 text-grey">{{ user.fullName }}</div>
          </div>
          <q-badge v-if="user.isPrivate" color="grey-5" label="Приватный" />
        </div>

        <div class="stats">
          <div
            v-for="stat in [
              { value: user.mediaCount, label: 'Публикаций' },
              { value: user.followerCount, label: 'Подписчиков' },
              { value: user.followingCount, label: 'Подписок' }
            ]"
            :key="stat.label"
            class="stat"
          >
            <span class="value">{{ formatCount(stat.value) }}</span>
            <span class="label">{{ stat.label }}</span>
          </div>
        </div>

        <p v-if="user.biography">{{ user.biography }}</p>

        <a
          v-if="user.externalUrl"
          :href="user.externalUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="link"
        >
          <q-icon name="link" size="14px" />
          {{ user.externalUrl }}
        </a>
      </div>

      <div v-else class="text-center text-grey q-pa-xl">
        Не удалось загрузить профиль
      </div>
    </div>
  </ModalComponent>
</template>

<style>
  .modal-inner.user-modal-inner {
    width: 480px;
    max-width: 480px;
  }
</style>

<style scoped lang="scss">
  .body {
    padding: 4px 0;

    .content {
      display: flex;
      flex-direction: column;
      gap: 16px;

      .header {
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        gap: 8px;

        .names {
          display: flex;
          flex-direction: column;
          align-items: center;
        }
      }

      .stats {
        display: flex;
        justify-content: space-around;
        padding: 12px 0;
        border-top: 1px solid #eee;
        border-bottom: 1px solid #eee;

        .stat {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;

          .value {
            font-size: 18px;
            font-weight: 700;
            color: #111;
          }

          .label {
            font-size: 12px;
            color: #888;
          }
        }
      }

      p {
        margin: 0;
        font-size: 14px;
        line-height: 1.5;
        white-space: pre-wrap;
        word-break: break-word;
        color: #333;
      }

      .link {
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 13px;
        color: #0095f6;
        text-decoration: none;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;

        &:hover {
          text-decoration: underline;
        }
      }
    }
  }
</style>
