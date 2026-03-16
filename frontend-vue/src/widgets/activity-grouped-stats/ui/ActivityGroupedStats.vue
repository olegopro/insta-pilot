<script setup lang="ts">
  import { computed } from 'vue'
  import { ACTION_LABELS, STATUS_CONFIG } from '@/entities/activity-log'
  import type { ActivityStats } from '@/entities/activity-log'

  interface Props {
    stats: ActivityStats | null
  }

  const props = defineProps<Props>()

  const actionEntries = computed(() => {
    if (!props.stats) return []
    return Object.entries(props.stats.byAction).map(([action, breakdown]) => ({
      action,
      label: (ACTION_LABELS as Partial<typeof ACTION_LABELS>)[action as keyof typeof ACTION_LABELS] ?? action,
      total: breakdown.total,
      success: breakdown.success,
      error: breakdown.error,
      rate: breakdown.total > 0 ? breakdown.success / breakdown.total : 0
    }))
  })

  const statusEntries = computed(() => {
    if (!props.stats) return []
    return Object.entries(props.stats.byStatus)
      .filter(([, count]) => count > 0)
      .map(([status, count]) => {
        const config = (STATUS_CONFIG as Partial<typeof STATUS_CONFIG>)[status as keyof typeof STATUS_CONFIG]
        return {
          status,
          label: config?.label ?? status,
          icon: config?.icon ?? 'help',
          color: config?.color ?? 'grey',
          count
        }
      })
  })
</script>

<template>
  <div class="row q-gutter-md">
    <q-card flat bordered class="col">
      <q-card-section>
        <div class="text-subtitle2 q-mb-sm">По действиям</div>
        <div v-if="!stats" class="text-grey text-caption">Нет данных</div>
        <div v-for="entry in actionEntries" :key="entry.action" class="q-mb-sm">
          <div class="row items-center justify-between q-mb-xs">
            <span class="text-caption">{{ entry.label }}</span>
            <span class="text-caption text-grey">
              <span class="text-positive">{{ entry.success }} ok</span>
              <span v-if="entry.error > 0" class="text-negative q-ml-xs">/ {{ entry.error }} err</span>
            </span>
          </div>
          <q-linear-progress
            :value="entry.rate"
            color="positive"
            track-color="negative"
            rounded
            size="4px"
          />
        </div>
      </q-card-section>
    </q-card>

    <q-card flat bordered class="col">
      <q-card-section>
        <div class="text-subtitle2 q-mb-sm">По статусам</div>
        <div v-if="!stats" class="text-grey text-caption">Нет данных</div>
        <div v-for="entry in statusEntries" :key="entry.status" class="row items-center q-mb-sm">
          <q-icon :name="entry.icon" :color="entry.color" size="xs" class="q-mr-sm" />
          <span class="text-caption col">{{ entry.label }}</span>
          <q-badge :color="entry.color" :label="entry.count" />
        </div>
      </q-card-section>
    </q-card>
  </div>
</template>
