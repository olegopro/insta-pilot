<script setup lang="ts">
  import { STATUS_CONFIG, ACTION_LABELS, HTTP_CODE_COLOR } from '@/entities/activity-log'
  import type { SidebarActivityEntry } from '@/entities/activity-log'
  import { formatTimeHMS } from '@/shared/lib'

  interface Props {
    entry: SidebarActivityEntry
  }

  defineProps<Props>()

  const emit = defineEmits<{
    click: [entry: SidebarActivityEntry]
  }>()
</script>

<template>
  <div
    class="sidebar-entry q-pa-xs cursor-pointer"
    @click="emit('click', entry)"
  >
    <div class="row items-center q-gutter-xs no-wrap">
      <q-icon
        :name="STATUS_CONFIG[entry.status]?.icon ?? 'help'"
        :color="STATUS_CONFIG[entry.status]?.color ?? 'grey'"
        size="xs"
      />
      <span class="text-caption text-weight-medium ellipsis col">
        {{ ACTION_LABELS[entry.action] ?? entry.action }}
      </span>
      <q-badge
        v-if="entry.httpCode"
        :color="HTTP_CODE_COLOR(entry.httpCode)"
        :label="entry.httpCode"
        class="text-caption"
      />
      <span class="text-caption text-grey-6 q-ml-xs">{{ formatTimeHMS(entry.createdAt) }}</span>
    </div>

    <div v-if="entry.accountLogin" class="text-caption text-grey q-ml-md">
      @{{ entry.accountLogin }}
    </div>

    <div
      v-if="entry.shortMessage"
      class="text-caption ellipsis q-ml-md"
      :class="entry.status !== 'success' ? 'text-negative' : 'text-grey-7'"
    >
      {{ entry.shortMessage }}
    </div>
  </div>
</template>

<style scoped>
.sidebar-entry {
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
  transition: background 0.1s;
}
.sidebar-entry:hover {
  background: rgba(0, 0, 0, 0.04);
}
</style>
