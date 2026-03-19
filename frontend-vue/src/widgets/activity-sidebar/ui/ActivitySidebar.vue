<script setup lang="ts">
  import { ref, watch, nextTick } from 'vue'
  import { useSidebarActivityStore } from '@/entities/activity-log'
  import type { SidebarActivityEntry } from '@/entities/activity-log'
  import { BadgeComponent } from '@/shared/ui/badge-component'
  import ActivitySidebarEntry from './ActivitySidebarEntry.vue'
  import SidebarResizeHandle from './SidebarResizeHandle.vue'

  const FILTER_OPTIONS: { label: string; value: 'all' | 'errors' | 'likes' | 'comments'; icon: string }[] = [
    { label: 'Все', value: 'all', icon: 'apps' },
    { label: 'Ошибки', value: 'errors', icon: 'error_outline' },
    { label: 'Лайки', value: 'likes', icon: 'favorite_border' },
    { label: 'Коммент.', value: 'comments', icon: 'chat_bubble_outline' }
  ]

  const emit = defineEmits<{
    'entry-click': [entry: SidebarActivityEntry]
  }>()

  const store = useSidebarActivityStore()
  const scrollRef = ref<HTMLElement | null>(null)

  const resizeHandler = (delta: number) => {
    store.setWidth(store.width + delta)
  }

  const isAtBottom = (el: HTMLElement) =>
    el.scrollHeight - el.scrollTop - el.clientHeight < 40

  watch(() => store.filteredEntries.length, async () => {
    await nextTick()
    const el = scrollRef.value
    el && isAtBottom(el) && (el.scrollTop = el.scrollHeight)
  })
</script>

<template>
  <div class="activity-sidebar column" style="height: 100%; position: relative">
    <SidebarResizeHandle @resize="resizeHandler" />

    <div class="sidebar-header row items-center justify-between q-pa-sm">
      <span class="text-subtitle2">Активность</span>
      <div class="row items-center q-gutter-xs">
        <q-btn flat round dense size="xs" icon="delete_sweep" @click="store.clearEntries()" />
        <q-btn flat round dense size="xs" icon="close" @click="store.close()" />
      </div>
    </div>

    <div class="filter-bar">
      <BadgeComponent
        v-for="opt in FILTER_OPTIONS"
        :key="opt.value"
        :label="opt.label"
        :icon="opt.icon"
        :color="store.quickFilter === opt.value ? 'primary' : 'grey'"
        :outline="store.quickFilter !== opt.value"
        size="sm"
        class="filter-chip"
        @click="store.quickFilter = opt.value"
      />
    </div>

    <q-separator />

    <div ref="scrollRef" class="sidebar-scroll col">
      <div v-if="store.filteredEntries.length === 0" class="text-caption text-grey text-center q-pa-md">
        Нет записей
      </div>
      <ActivitySidebarEntry
        v-for="entry in store.filteredEntries"
        :key="entry.id"
        :entry="entry"
        @click="emit('entry-click', entry)"
      />
    </div>

    <q-separator />

    <div class="row items-center justify-between q-px-sm q-py-xs">
      <span class="text-caption text-grey">{{ store.filteredEntries.length }} записей</span>
    </div>
  </div>
</template>

<style scoped lang="scss">
.filter-bar {
  display: flex;
  flex-wrap: wrap;
  gap: $indent-xs;
  padding: $indent-xs $indent-sm;
}

.filter-chip {
  cursor: pointer;
  transition: all $transition-fast;

  &:hover {
    opacity: 0.8;
  }
}

.activity-sidebar {
  border-right: $border-width-default $border-style-default $border-default;
  overflow: hidden;
}

.sidebar-header {
  background: $surface-secondary;
  border-bottom: $border-width-default $border-style-default $border-default;
}

.sidebar-scroll {
  overflow-y: auto;
  min-height: 0;
  overscroll-behavior: contain;
}
</style>
