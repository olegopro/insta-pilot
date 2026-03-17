<script setup lang="ts">
  import { onMounted, onBeforeUnmount } from 'vue'
  import { useRouter } from 'vue-router'
  import { Notify } from 'quasar'
  import { useAuthStore } from '@/entities/user'
  import { useSidebarActivityStore } from '@/entities/activity-log'
  import type { SidebarActivityEntry } from '@/entities/activity-log'
  import { useGlobalActivityLive } from '@/features/activity-live'
  import { ActivitySidebar } from '@/widgets/activity-sidebar'

  const router = useRouter()
  const authStore = useAuthStore()
  const sidebarStore = useSidebarActivityStore()

  const { subscribe, unsubscribe } = useGlobalActivityLive()

  const logoutHandler = async () => {
    await authStore.logout()
      .then(() => router.push('/login'))
      .catch(() => Notify.create({ type: 'negative', message: 'Ошибка выхода' }))
  }

  const entryClickHandler = (entry: SidebarActivityEntry) => {
    void router.push({ path: `/logs/${String(entry.accountId)}`, query: { highlight: String(entry.id) } })
  }

  onMounted(subscribe)
  onBeforeUnmount(unsubscribe)
</script>

<template>
  <q-layout view="LHh LpR fFf">
    <q-header elevated>
      <q-toolbar>
        <q-toolbar-title>Insta Pilot</q-toolbar-title>

        <q-btn flat to="/" label="Аккаунты" />
        <q-btn flat to="/feed" label="Лента" />
        <q-btn flat to="/search" label="Поиск" />
        <q-btn flat to="/logs" label="Логи" />
        <q-btn v-if="authStore.isAdmin" flat to="/settings/llm" label="Настройки LLM" />
        <q-btn v-if="authStore.isAdmin" flat to="/admin/users" label="Пользователи" />

        <q-separator vertical inset class="q-mx-sm" />

        <span class="q-mr-sm text-caption">{{ authStore.user?.name }}</span>
        <q-btn flat icon="logout" @click="logoutHandler" />
      </q-toolbar>
    </q-header>

    <q-drawer
      v-model="sidebarStore.isOpen"
      side="left"
      :width="sidebarStore.width"
      :breakpoint="0"
      bordered
      no-swipe-open
      no-swipe-close
    >
      <ActivitySidebar @entry-click="entryClickHandler" />
    </q-drawer>

    <q-page-container>
      <router-view />
    </q-page-container>

    <q-btn
      v-if="!sidebarStore.isOpen"
      round
      color="primary"
      icon="terminal"
      style="position: fixed; bottom: 16px; left: 16px; z-index: 100"
      @click="sidebarStore.open()"
    >
      <q-badge
        v-if="sidebarStore.unreadCount > 0"
        floating
        color="negative"
        :label="sidebarStore.unreadCount > 99 ? '99+' : sidebarStore.unreadCount"
      />
    </q-btn>
  </q-layout>
</template>
