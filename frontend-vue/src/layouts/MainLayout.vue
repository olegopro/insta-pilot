<script setup lang="ts">
  import { useRouter } from 'vue-router'
  import { Notify } from 'quasar'
  import { useAuthStore } from '@/entities/user'

  const router = useRouter()
  const authStore = useAuthStore()

  const logoutHandler = async () => {
    await authStore.logout()
      .then(() => router.push('/login'))
      .catch(() => Notify.create({ type: 'negative', message: 'Ошибка выхода' }))
  }
</script>

<template>
  <q-layout view="hHh lpR fFf">
    <q-header elevated>
      <q-toolbar>
        <q-toolbar-title>Insta Pilot</q-toolbar-title>

        <q-btn flat to="/" label="Аккаунты" />
        <q-btn flat to="/feed" label="Лента" />
        <q-btn flat to="/search" label="Поиск" />
        <q-btn v-if="authStore.isAdmin" flat to="/admin/users" label="Пользователи" />

        <q-separator vertical inset class="q-mx-sm" />

        <span class="q-mr-sm text-caption">{{ authStore.user?.name }}</span>
        <q-btn flat icon="logout" @click="logoutHandler" />
      </q-toolbar>
    </q-header>

    <q-page-container>
      <router-view />
    </q-page-container>
  </q-layout>
</template>
