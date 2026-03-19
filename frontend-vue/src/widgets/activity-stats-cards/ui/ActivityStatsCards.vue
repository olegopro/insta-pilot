<script setup lang="ts">
  import { computed } from 'vue'
  import type { ActivityStats } from '@/entities/activity-log'

  interface Props {
    stats: ActivityStats | null
    loading: boolean
  }

  const props = defineProps<Props>()

  const errorCount = computed(() => {
    if (!props.stats) return 0
    const s = props.stats.byStatus
    return (s.error ?? 0) + (s.rate_limited ?? 0) + (s.challenge_required ?? 0) + (s.login_required ?? 0) + (s.timeout ?? 0)
  })
</script>

<template>
  <div class="row q-gutter-md">
    <q-card flat bordered class="col stat-card">
      <q-card-section class="stat-card__section">
        <div class="stat-card__title">Всего действий</div>
        <div class="row items-center stat-card__body">
          <q-icon name="bar_chart" color="primary" size="28px" class="stat-card__icon" />
          <div class="stat-card__value">
            <q-skeleton v-if="loading" type="text" width="60px" />
            <template v-else>{{ stats?.total ?? 0 }}</template>
          </div>
        </div>
      </q-card-section>
    </q-card>

    <q-card flat bordered class="col stat-card">
      <q-card-section class="stat-card__section">
        <div class="stat-card__title">Сегодня</div>
        <div class="row items-center stat-card__body">
          <q-icon name="today" color="info" size="28px" class="stat-card__icon" />
          <div class="stat-card__value">
            <q-skeleton v-if="loading" type="text" width="60px" />
            <template v-else>{{ stats?.today ?? 0 }}</template>
          </div>
        </div>
      </q-card-section>
    </q-card>

    <q-card flat bordered class="col stat-card">
      <q-card-section class="stat-card__section">
        <div class="stat-card__title">Ошибок</div>
        <div class="row items-center stat-card__body">
          <q-icon name="error_outline" color="negative" size="28px" class="stat-card__icon" />
          <div class="stat-card__value">
            <q-skeleton v-if="loading" type="text" width="60px" />
            <template v-else>{{ errorCount }}</template>
          </div>
        </div>
      </q-card-section>
    </q-card>

    <q-card flat bordered class="col stat-card">
      <q-card-section class="stat-card__section">
        <div class="stat-card__title">Успех</div>
        <div class="row items-center stat-card__body">
          <q-icon name="check_circle_outline" color="positive" size="28px" class="stat-card__icon" />
          <div class="stat-card__value">
            <q-skeleton v-if="loading" type="text" width="60px" />
            <template v-else>{{ stats ? `${stats.successRate.toFixed(1)}%` : '—' }}</template>
          </div>
        </div>
      </q-card-section>
    </q-card>
  </div>
</template>

<style scoped lang="scss">
  .stat-card {
    &__section {
      padding: $indent-ml $indent-l;
    }

    &__title {
      font-size: $font-size-sm;
      font-weight: $font-weight-medium;
      color: $content-secondary;
      margin-bottom: $spacing-stack-gap;
    }

    &__body {
      gap: $indent-sm;
    }

    &__icon {
      flex-shrink: 0;
    }

    &__value {
      font-size: $font-size-2xl;
      font-weight: $font-weight-bold;
      color: $content-primary;
      line-height: 1;
    }
  }
</style>
