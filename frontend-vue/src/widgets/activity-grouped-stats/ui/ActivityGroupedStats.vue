<script setup lang="ts">
  import { computed } from 'vue'
  import { getActionLabel, getActionIcon, getActionColor, getStatusConfig } from '@/entities/activity-log'
  import type { ActivityStats, ActionType, ActionStatus } from '@/entities/activity-log'
  import type { Nullable } from '@/shared/lib'
  import { BadgeComponent } from '@/shared/ui/badge-component'
  import { CardComponent, CardSectionComponent } from '@/shared/ui/card-component'

  interface Props {
    stats: ActivityStats | null
    activeAction?: Nullable<ActionType>
    activeStatus?: Nullable<ActionStatus>
  }

  const props = defineProps<Props>()

  const emit = defineEmits<{
    'select-action': [action: ActionType | null]
    'select-status': [status: ActionStatus | null]
  }>()

  const actionEntries = computed(() => {
    if (!props.stats) return []
    return Object.entries(props.stats.byAction).map(([action, breakdown]) => ({
      action: action as ActionType,
      label: getActionLabel(action),
      icon: getActionIcon(action),
      color: getActionColor(action),
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
        const config = getStatusConfig(status)
        return {
          status: status as ActionStatus,
          label: config.label,
          icon: config.icon,
          color: config.color,
          count
        }
      })
  })

  const toggleActionHandler = (action: ActionType) =>
    emit('select-action', props.activeAction === action ? null : action)

  const toggleStatusHandler = (status: ActionStatus) =>
    emit('select-status', props.activeStatus === status ? null : status)
</script>

<template>
  <div class="row q-gutter-md">
    <CardComponent flat bordered class="col">
      <CardSectionComponent class="grouped-section">
        <div class="section-title">
          <q-icon name="bar_chart" size="20px" class="q-mr-xs" />
          По действиям
        </div>
        <div v-if="!stats" class="text-grey text-caption">Нет данных</div>
        <div
          v-for="entry in actionEntries"
          :key="entry.action"
          :class="['action-entry', activeAction === entry.action && 'action-entry--active']"
          @click="toggleActionHandler(entry.action)"
        >
          <div class="row items-center justify-between q-mb-xs">
            <div class="row items-center" style="gap: 8px">
              <q-icon
                :name="entry.icon"
                size="18px"
                :color="activeAction === entry.action ? entry.color : 'grey-6'"
              />
              <span
                :class="['action-label', activeAction === entry.action && `text-${entry.color}`]"
              >{{ entry.label }}</span>
            </div>
            <span class="action-count">
              <span :class="activeAction === entry.action ? `text-${entry.color}` : 'text-positive'">{{ entry.success }} ok</span>
              <span v-if="entry.error > 0" class="text-negative q-ml-xs">/ {{ entry.error }} error</span>
            </span>
          </div>
          <q-linear-progress
            :value="entry.rate"
            :color="activeAction === entry.action ? entry.color : 'positive'"
            track-color="negative"
            rounded
            size="6px"
          />
        </div>
      </CardSectionComponent>
    </CardComponent>

    <CardComponent flat bordered class="col">
      <CardSectionComponent class="grouped-section">
        <div class="section-title">
          <q-icon name="donut_large" size="20px" class="q-mr-xs" />
          По статусам
        </div>
        <div v-if="!stats" class="text-grey text-caption">Нет данных</div>
        <div
          v-for="entry in statusEntries"
          :key="entry.status"
          :class="['row items-center status-entry', activeStatus === entry.status && 'status-entry--active']"
          @click="toggleStatusHandler(entry.status)"
        >
          <q-icon
            :name="entry.icon"
            :color="entry.color"
            size="sm"
            class="q-mr-sm"
          />
          <span
            :class="['status-label col', activeStatus === entry.status && `text-${entry.color}`]"
          >{{ entry.label }}</span>
          <BadgeComponent :color="entry.color" :label="String(entry.count)" size="lg" />
        </div>
      </CardSectionComponent>
    </CardComponent>
  </div>
</template>

<style scoped lang="scss">
  .grouped-section {
    padding: $indent-l;
  }

  .section-title {
    display: flex;
    align-items: center;
    font-size: $font-size-md;
    font-weight: $font-weight-semibold;
    color: $content-primary;
    margin-bottom: $indent-l;
  }

  .action-entry {
    margin-bottom: $indent-ml;
    padding: $indent-s $indent-sm;
    border-radius: $radius-md;
    cursor: pointer;
    transition: background-color 0.15s;

    &:hover {
      background: $neutral-50;
    }

    &--active {
      background: $neutral-100;

      &:hover {
        background: $neutral-100;
      }
    }

    &:last-child {
      margin-bottom: 0;
    }
  }

  .action-label {
    font-size: $font-size-base;
    color: $content-primary;
    transition: color 0.15s;
  }

  .action-entry--active .action-label {
    font-weight: $font-weight-semibold;
  }

  .action-count {
    font-size: $font-size-base;
  }

  .status-label {
    font-size: $font-size-base;
    color: $content-primary;
    transition: color 0.15s;
  }

  .status-entry {
    margin-bottom: $indent-m;
    padding: $indent-s $indent-sm;
    border-radius: $radius-md;
    cursor: pointer;
    transition: background-color 0.15s;

    &:hover {
      background: $neutral-50;
    }

    &--active {
      background: $neutral-100;

      &:hover {
        background: $neutral-100;
      }
    }

    &--active .status-label {
      font-weight: $font-weight-semibold;
    }

    &:last-child {
      margin-bottom: 0;
    }
  }
</style>
