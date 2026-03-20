<script setup lang="ts">
  import { ref, watch, nextTick } from 'vue'
  import { useSidebarActivityStore } from '@/entities/activity-log'
  import type { SidebarActivityEntry } from '@/entities/activity-log'
  import { ButtonComponent } from '@/shared/ui/button-component'
  import ActivitySidebarEntry from './ActivitySidebarEntry.vue'
  import SidebarResizeHandle from './SidebarResizeHandle.vue'

  const FILTER_OPTIONS: { label: string; value: 'all' | 'errors' | 'likes' | 'comments'; icon: string; color: string }[] = [
    { label: 'Все', value: 'all', icon: 'apps', color: 'primary' },
    { label: 'Ошибки', value: 'errors', icon: 'error_outline', color: 'negative' },
    { label: 'Лайки', value: 'likes', icon: 'favorite_border', color: 'pink' },
    { label: 'Комментарии', value: 'comments', icon: 'chat_bubble_outline', color: 'orange' }
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
      <span class="sidebar-title">Активность</span>
      <div class="row items-center q-gutter-xs">
        <ButtonComponent flat round dense size="sm" icon="delete_sweep" color="grey-6" @click="store.clearEntries()" />
        <ButtonComponent flat round dense size="sm" icon="close" color="grey-6" @click="store.close()" />
      </div>
    </div>

    <div class="filter-bar">
      <ButtonComponent
        v-for="opt in FILTER_OPTIONS"
        :key="opt.value"
        :label="opt.label"
        :icon="opt.icon"
        size="sm"
        :color="store.quickFilter === opt.value ? opt.color : 'grey-6'"
        :outline="store.quickFilter === opt.value"
        :flat="store.quickFilter !== opt.value"
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
.activity-sidebar {
  border-right: $border-width-default $border-style-default $border-default;
  overflow: hidden;
}

.sidebar-header {
  background: $surface-secondary;
  border-bottom: $border-width-default $border-style-default $border-default;
}

.sidebar-title {
  font-size: $font-size-lg;
  font-weight: $font-weight-semibold;
  color: $content-primary;
}

.filter-bar {
  display: flex;
  flex-wrap: nowrap;
  gap: $indent-xs;
  padding: $indent-xs $indent-sm;
  overflow-x: auto;

  &::-webkit-scrollbar {
    display: none;
  }
}

.sidebar-scroll {
  overflow-y: auto;
  min-height: 0;
  overscroll-behavior: contain;
}
</style>
