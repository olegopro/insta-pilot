<script setup lang="ts">
  import { useRouter } from 'vue-router'
  import { useAuthStore } from '@/entities/user'
  import { notifyError } from '@/shared/lib'
  import { DropdownComponent } from '@/shared/ui/dropdown-component'

  const router = useRouter()
  const authStore = useAuthStore()

  const logoutHandler = async () => await authStore.logout()
    .then(() => router.push('/login'))
    .catch(() => notifyError('Ошибка выхода'))
</script>

<template>
  <DropdownComponent
    flat no-icon-animation class="q-ml-sm"
    :label="authStore.user?.name ?? ''"
    :menu-offset="[0, 18]"
  >
    <q-list style="min-width: 200px">
      <q-item>
        <q-item-section>
          <q-item-label class="text-weight-medium">{{ authStore.user?.name }}</q-item-label>
          <q-item-label caption>{{ authStore.user?.email }}</q-item-label>
        </q-item-section>
      </q-item>
      <q-separator />
      <q-item v-close-popup clickable disabled>
        <q-item-section avatar>
          <q-icon name="manage_accounts" />
        </q-item-section>
        <q-item-section>Настройки</q-item-section>
      </q-item>
      <q-item v-close-popup clickable @click="logoutHandler">
        <q-item-section avatar>
          <q-icon name="logout" color="negative" />
        </q-item-section>
        <q-item-section class="text-negative">Выйти</q-item-section>
      </q-item>
    </q-list>
  </DropdownComponent>
</template>

<style scoped lang="scss">
    :deep(.q-btn-dropdown__arrow) {
      top: -3px;
    }
</style>
