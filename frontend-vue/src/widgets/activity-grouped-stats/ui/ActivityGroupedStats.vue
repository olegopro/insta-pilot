<script setup lang="ts">
  import { computed } from 'vue'
  import { ACTION_LABELS, ACTION_ICONS, STATUS_CONFIG } from '@/entities/activity-log'
  import type { ActivityStats } from '@/entities/activity-log'
  import { BadgeComponent } from '@/shared/ui/badge-component'

  interface Props {
    stats: ActivityStats | null
  }

  const props = defineProps<Props>()

  const actionEntries = computed(() => {
    if (!props.stats) return []
    return Object.entries(props.stats.byAction).map(([action, breakdown]) => ({
      action,
      label: (ACTION_LABELS as Partial<typeof ACTION_LABELS>)[action as keyof typeof ACTION_LABELS] ?? action,
      icon: (ACTION_ICONS as Partial<typeof ACTION_ICONS>)[action as keyof typeof ACTION_ICONS] ?? 'circle',
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
        <div class="section-title">
          <q-icon name="bar_chart" size="16px" class="q-mr-xs" />
          По действиям
        </div>
        <div v-if="!stats" class="text-grey text-caption">Нет данных</div>
        <div v-for="entry in actionEntries" :key="entry.action" class="action-entry">
          <div class="row items-center justify-between q-mb-xs">
            <div class="row items-center" style="gap: 6px">
              <q-icon :name="entry.icon" size="14px" color="grey-6" />
              <span class="text-caption">{{ entry.label }}</span>
            </div>
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
        <div class="section-title">
          <q-icon name="donut_large" size="16px" class="q-mr-xs" />
          По статусам
        </div>
        <div v-if="!stats" class="text-grey text-caption">Нет данных</div>
        <div v-for="entry in statusEntries" :key="entry.status" class="row items-center status-entry">
          <q-icon :name="entry.icon" :color="entry.color" size="xs" class="q-mr-sm" />
          <span class="text-caption col">{{ entry.label }}</span>
          <BadgeComponent :color="entry.color" :label="String(entry.count)" size="sm" />
        </div>
      </q-card-section>
    </q-card>
  </div>
</template>

<style scoped lang="scss">
  .section-title {
    display: flex;
    align-items: center;
    font-size: $font-size-sm;
    font-weight: $font-weight-semibold;
    color: $content-primary;
    margin-bottom: $indent-m;
  }

  .action-entry {
    margin-bottom: $spacing-stack-gap;

    &:last-child {
      margin-bottom: 0;
    }
  }

  .status-entry {
    margin-bottom: $indent-sm;

    &:last-child {
      margin-bottom: 0;
    }
  }
</style>
