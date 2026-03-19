<script setup lang="ts">
  import { onMounted, onBeforeUnmount } from 'vue'
  import { useRouter } from 'vue-router'
  import { useAuthStore } from '@/entities/user'
  import { useSidebarActivityStore } from '@/entities/activity-log'
  import type { SidebarActivityEntry } from '@/entities/activity-log'
  import { notifyError } from '@/shared/lib'
  import { useGlobalActivityLive } from '@/features/activity-live'
  import { ActivitySidebar } from '@/widgets/activity-sidebar'

  const router = useRouter()
  const authStore = useAuthStore()

  const sidebarStore = useSidebarActivityStore()

  const { subscribe, unsubscribe } = useGlobalActivityLive()

  const logoutHandler = async () => {
    await authStore.logout()
      .then(() => router.push('/login'))
      .catch(() => notifyError('Ошибка выхода'))
  }

  const entryClickHandler = (entry: SidebarActivityEntry) => {
    void router.push({ path: `/logs/${String(entry.accountId)}`, query: { highlight: String(entry.id) } })
  }

  onMounted(subscribe)
  onBeforeUnmount(unsubscribe)
</script>

<template>
  <q-layout view="LHh LpR fFf">
    <q-header class="app-header">
      <q-toolbar>
        <q-toolbar-title class="app-logo">Insta Pilot</q-toolbar-title>

        <q-space />

        <div class="row items-center q-gutter-xs">
          <q-btn flat to="/" label="Аккаунты" class="nav-btn" />
          <q-btn flat to="/feed" label="Лента" class="nav-btn" />
          <q-btn flat to="/search" label="Поиск" class="nav-btn" />
          <q-btn flat to="/logs" label="Логи" class="nav-btn" />
          <q-btn v-if="authStore.isAdmin" flat to="/settings/llm" label="Настройки LLM" class="nav-btn" />
          <q-btn v-if="authStore.isAdmin" flat to="/admin/users" label="Пользователи" class="nav-btn" />
        </div>

        <q-btn-dropdown flat no-icon-animation class="nav-btn q-ml-sm" :label="authStore.user?.name ?? ''">
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
        </q-btn-dropdown>
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
      size="md"
      color="primary"
      icon="terminal"
      class="sidebar-toggle"
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
