<script setup lang="ts">
  import type { ShowcaseProfile } from '@/entities/showcase-media'
  import type { Nullable } from '@/shared/lib'
  import { formatCount } from '@/shared/lib'

  defineProps<{
    profile: Nullable<ShowcaseProfile>
    loading?: boolean
  }>()
</script>

<template>
  <div class="phone-frame">
    <div class="phone-screen">
      <div v-if="loading && !profile" class="profile-header">
        <div class="profile-top">
          <q-skeleton type="QAvatar" size="86px" />
          <div class="profile-counters">
            <q-skeleton type="text" width="40px" />
            <q-skeleton type="text" width="40px" />
            <q-skeleton type="text" width="40px" />
          </div>
        </div>
        <div class="profile-meta">
          <q-skeleton type="text" width="160px" />
          <q-skeleton type="text" width="100px" />
          <q-skeleton type="text" width="80%" />
        </div>
      </div>

      <header v-else-if="profile" class="profile-header">
        <div class="profile-top">
          <q-avatar size="86px" class="profile-avatar">
            <img v-if="profile.profilePicUrl" :src="profile.profilePicUrl" :alt="profile.username">
            <q-icon v-else name="person" size="48px" color="grey-5" />
          </q-avatar>

          <div class="profile-counters">
            <div class="counter">
              <span class="counter-value">{{ formatCount(profile.mediaCount) }}</span>
              <span class="counter-label">Постов</span>
            </div>
            <div class="counter">
              <span class="counter-value">{{ formatCount(profile.followerCount) }}</span>
              <span class="counter-label">Подписчиков</span>
            </div>
            <div class="counter">
              <span class="counter-value">{{ formatCount(profile.followingCount) }}</span>
              <span class="counter-label">Подписок</span>
            </div>
          </div>
        </div>

        <div class="profile-meta">
          <div class="profile-name">
            <span class="full-name">{{ profile.fullName }}</span>
            <q-icon v-if="profile.isVerified" name="verified" color="primary" size="16px" />
            <q-icon v-if="profile.isPrivate" name="lock" color="grey-6" size="14px" />
          </div>
          <span class="username">@{{ profile.username }}</span>
          <p v-if="profile.biography" class="biography">{{ profile.biography }}</p>
        </div>
      </header>

      <div class="phone-body">
        <slot />
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
  .phone-frame {
    width: 100%;
    max-width: 460px;
    margin: 0 auto;
    background: $surface-primary;
    border: 1px solid $neutral-300;
    border-radius: $radius-xl;
    box-shadow: $elevation-modal;
    overflow: hidden;
  }

  .phone-screen {
    display: flex;
    flex-direction: column;
  }

  .profile-header {
    padding: $spacing-section-gap;
    border-bottom: 1px solid $neutral-300;
  }

  .profile-top {
    display: flex;
    align-items: center;
    gap: $spacing-section-gap;
  }

  .profile-avatar {
    flex-shrink: 0;
  }

  .profile-counters {
    display: flex;
    flex: 1;
    justify-content: space-around;
  }

  .counter {
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .counter-value {
    font-size: $font-size-base;
    font-weight: $font-weight-semibold;
    color: $content-primary;
  }

  .counter-label {
    font-size: $font-size-sm;
    color: $content-secondary;
  }

  .profile-meta {
    margin-top: $indent-m;
    display: flex;
    flex-direction: column;
    gap: $indent-xs;
  }

  .profile-name {
    display: flex;
    align-items: center;
    gap: $indent-xs;
  }

  .full-name {
    font-weight: $font-weight-semibold;
    color: $content-primary;
  }

  .username {
    font-size: $font-size-sm;
    color: $content-secondary;
  }

  .biography {
    margin: $indent-xs 0 0;
    font-size: $font-size-sm;
    color: $content-primary;
    white-space: pre-line;
  }

  .phone-body {
    flex: 1;
  }
</style>
