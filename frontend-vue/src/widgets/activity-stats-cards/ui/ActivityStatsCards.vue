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
    <q-card flat bordered class="col">
      <q-card-section class="row items-center q-gutter-sm">
        <q-icon name="bar_chart" color="primary" size="md" />
        <div>
          <div class="text-caption text-grey">Всего действий</div>
          <div class="text-h6">
            <q-skeleton v-if="loading" type="text" width="60px" />
            <template v-else>{{ stats?.total ?? 0 }}</template>
          </div>
        </div>
      </q-card-section>
    </q-card>

    <q-card flat bordered class="col">
      <q-card-section class="row items-center q-gutter-sm">
        <q-icon name="today" color="info" size="md" />
        <div>
          <div class="text-caption text-grey">Сегодня</div>
          <div class="text-h6">
            <q-skeleton v-if="loading" type="text" width="60px" />
            <template v-else>{{ stats?.today ?? 0 }}</template>
          </div>
        </div>
      </q-card-section>
    </q-card>

    <q-card flat bordered class="col">
      <q-card-section class="row items-center q-gutter-sm">
        <q-icon name="error_outline" color="negative" size="md" />
        <div>
          <div class="text-caption text-grey">Ошибок</div>
          <div class="text-h6">
            <q-skeleton v-if="loading" type="text" width="60px" />
            <template v-else>{{ errorCount }}</template>
          </div>
        </div>
      </q-card-section>
    </q-card>

    <q-card flat bordered class="col">
      <q-card-section class="row items-center q-gutter-sm">
        <q-icon name="check_circle_outline" color="positive" size="md" />
        <div>
          <div class="text-caption text-grey">Успех</div>
          <div class="text-h6">
            <q-skeleton v-if="loading" type="text" width="60px" />
            <template v-else>{{ stats ? `${stats.successRate.toFixed(1)}%` : '—' }}</template>
          </div>
        </div>
      </q-card-section>
    </q-card>
  </div>
</template>
