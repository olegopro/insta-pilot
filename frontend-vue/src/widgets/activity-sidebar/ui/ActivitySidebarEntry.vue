<script setup lang="ts">
  import { STATUS_CONFIG, ACTION_LABELS, ACTION_COLORS, HTTP_CODE_COLOR } from '@/entities/activity-log'
  import type { SidebarActivityEntry } from '@/entities/activity-log'
  import { formatTimeHMS } from '@/shared/lib'
  import { BadgeComponent } from '@/shared/ui/badge-component'

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
    class="sidebar-entry cursor-pointer"
    @click="emit('click', entry)"
  >
    <div class="entry-row row items-center no-wrap">
      <q-icon
        :name="STATUS_CONFIG[entry.status]?.icon ?? 'help'"
        :color="STATUS_CONFIG[entry.status]?.color ?? 'grey'"
        size="20px"
      />
      <span class="entry-action ellipsis col" :class="`text-${ACTION_COLORS[entry.action] ?? 'grey'}`">
        {{ ACTION_LABELS[entry.action] ?? entry.action }}
      </span>
      <BadgeComponent
        v-if="entry.httpCode"
        :color="HTTP_CODE_COLOR(entry.httpCode)"
        :label="String(entry.httpCode)"
        size="sm"
      />
      <span class="entry-time">{{ formatTimeHMS(entry.createdAt) }}</span>
    </div>

    <div v-if="entry.accountLogin" class="entry-meta q-ml-lg">
      @{{ entry.accountLogin }}
    </div>

    <div
      v-if="entry.shortMessage"
      class="entry-meta ellipsis q-ml-lg"
      :class="entry.status !== 'success' ? 'text-negative' : 'text-grey-7'"
    >
      {{ entry.shortMessage }}
    </div>
  </div>
</template>

<style scoped lang="scss">
.entry-row {
  gap: $indent-s;
}

.sidebar-entry {
  padding: $spacing-inline-gap $indent-sm;
  border-bottom: $border-width-default $border-style-default $border-subtle;
  transition: background $transition-fast;
}

.sidebar-entry:hover {
  background: $surface-hover;
}

.entry-action {
  font-size: $font-size-base;
  font-weight: $font-weight-semibold;
}

.entry-time {
  font-size: $font-size-sm;
  color: $content-secondary;
  white-space: nowrap;
}

.entry-meta {
  font-size: $font-size-sm;
  color: $content-secondary;
  margin-top: $indent-2xs;
}
</style>
