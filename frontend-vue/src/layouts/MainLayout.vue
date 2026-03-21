<script setup lang="ts">
  import { onMounted, onBeforeUnmount } from 'vue'
  import { useRouter } from 'vue-router'
  import { useSidebarActivityStore } from '@/entities/activity-log'
  import type { SidebarActivityEntry } from '@/entities/activity-log'
  import { useGlobalActivityLive } from '@/features/activity-live'
  import { ActivitySidebar } from '@/widgets/activity-sidebar'
  import { ButtonComponent } from '@/shared/ui/button-component'
  import AppNavTabs from './AppNavTabs.vue'
  import UserMenuDropdown from './UserMenuDropdown.vue'

  const router = useRouter()

  const sidebarStore = useSidebarActivityStore()

  const { subscribe, unsubscribe } = useGlobalActivityLive()

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

        <AppNavTabs />

        <UserMenuDropdown />
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

    <ButtonComponent
      v-if="!sidebarStore.isOpen"
      round
      size="md"
      icon-scale="lg"
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
    </ButtonComponent>
  </q-layout>
</template>

<style scoped lang="scss">
  .app-header {
    background: $surface-primary;
    color: $content-primary;
    border-bottom: 1px solid $border-default;
    box-shadow: none;
  }

  .app-logo {
    font-weight: $font-weight-bold;
    color: $primary;
  }

  .sidebar-toggle {
    width: 50px;
    height: 44px;
  }

  :deep(.q-toolbar) {
    min-height: 64px;
  }

</style>
