<script setup lang="ts">
  import { ref, watch, nextTick } from 'vue'
  import { useSidebarActivityStore } from '@/entities/activity-log'
  import type { SidebarActivityEntry } from '@/entities/activity-log'
  import ActivitySidebarEntry from './ActivitySidebarEntry.vue'
  import SidebarResizeHandle from './SidebarResizeHandle.vue'

  const FILTER_OPTIONS: { label: string; value: 'all' | 'errors' | 'likes' | 'comments' }[] = [
    { label: 'Все', value: 'all' },
    { label: 'Ошибки', value: 'errors' },
    { label: 'Лайки', value: 'likes' },
    { label: 'Коммент.', value: 'comments' }
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

    <div class="row q-px-sm q-py-xs q-gutter-xs">
      <q-chip
        v-for="opt in FILTER_OPTIONS"
        :key="opt.value"
        :selected="store.quickFilter === opt.value"
        :color="store.quickFilter === opt.value ? 'primary' : undefined"
        :text-color="store.quickFilter === opt.value ? 'white' : undefined"
        dense
        clickable
        size="sm"
        @click="store.quickFilter = opt.value"
      >
        {{ opt.label }}
      </q-chip>
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

<style scoped>
.activity-sidebar {
  border-right: 1px solid rgba(0, 0, 0, 0.12);
}
.sidebar-header {
  background: rgba(0, 0, 0, 0.02);
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
}
.sidebar-scroll {
  overflow-y: auto;
}
</style>
