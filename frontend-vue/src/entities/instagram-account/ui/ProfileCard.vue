<script setup lang="ts">
  import type { InstagramAccount } from 'src/entities/instagram-account/model/types'

  defineProps<{ account: InstagramAccount }>()
</script>

<template>
  <q-card style="min-width: 360px">
    <q-card-section class="row items-center q-gutter-md">
      <q-avatar size="64px">
        <img
          v-if="account.profile_pic_url"
          :src="account.profile_pic_url"
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
          {{ account.full_name ?? account.instagram_login }}
        </div>
        <div class="text-caption text-grey">
          @{{ account.instagram_login }}
        </div>
      </div>
    </q-card-section>
  </q-card>
</template>
