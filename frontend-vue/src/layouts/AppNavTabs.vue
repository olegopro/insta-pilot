<script setup lang="ts">
  import { useAuthStore } from '@/entities/user'

  const authStore = useAuthStore()
</script>

<template>
  <q-tabs
    dense
    shrink
    active-color="primary"
    indicator-color="transparent"
  >
    <q-route-tab to="/" label="Аккаунты" exact />
    <q-route-tab to="/feed" label="Лента" />
    <q-route-tab to="/search" label="Поиск" />
    <q-route-tab to="/logs" label="Логи" />
    <q-route-tab v-if="authStore.isAdmin" to="/settings/llm" label="Настройки LLM" />
    <q-route-tab v-if="authStore.isAdmin" to="/admin/users" label="Пользователи" />
  </q-tabs>
</template>

<style scoped lang="scss">
:deep(.q-tab) {
  font-size: $font-size-base;
  font-weight: $font-weight-semibold;
  letter-spacing: 0;
  border-radius: $radius-md;
  text-transform: uppercase;
  margin-right: 5px;
}

:deep(.q-tab--active) {
  box-shadow: inset 0 0 0 $border-width-default $primary;
}
</style>
