<script setup lang="ts">
  import type { InstagramProfile } from 'src/types/instagram'

  defineProps<{ profile: InstagramProfile }>()
</script>

<template>
  <q-card style="min-width: 360px">
    <q-card-section class="row items-center q-gutter-md">
      <q-avatar size="64px">
        <img
          v-if="profile.profile_pic_url"
          :src="profile.profile_pic_url"
          alt="avatar"
        >
        <q-icon
          v-else
          name="account_circle"
          size="64px"
        />
      </q-avatar>
      <div>
        <div class="text-h6">
          {{ profile.full_name ?? profile.instagram_login }}
        </div>
        <div class="text-caption text-grey">
          @{{ profile.instagram_login }}
        </div>
      </div>
    </q-card-section>
  </q-card>
</template>
