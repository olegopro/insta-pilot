<script setup lang="ts">
  import type { InstagramAccount } from '@/entities/instagram-account/model/types'
  import { CardComponent, CardSectionComponent } from '@/shared/ui/card-component'

  defineProps<{ account: InstagramAccount }>()
</script>

<template>
  <CardComponent style="min-width: 360px">
    <CardSectionComponent class="row items-center q-gutter-md">
      <q-avatar size="64px">
        <img
          v-if="account.profilePicUrl"
          :src="account.profilePicUrl"
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
          {{ account.fullName ?? account.instagramLogin }}
        </div>
        <div class="text-caption text-grey">
          @{{ account.instagramLogin }}
        </div>
      </div>
    </CardSectionComponent>
  </CardComponent>
</template>
