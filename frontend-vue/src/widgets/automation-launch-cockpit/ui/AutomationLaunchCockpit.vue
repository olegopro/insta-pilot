<script setup lang="ts">
  import { computed } from 'vue'
  import { useAutomationParsingStore } from '@/entities/automation-parsing'
  import type { AutomationTask } from '@/entities/automation-task'
  import { CommentActionConfig } from '@/features/configure-automation-action'
  import { TimeDistributionPreview } from '@/shared/ui/time-distribution-preview'
  import { BadgeComponent } from '@/shared/ui/badge-component'
  import { ButtonComponent } from '@/shared/ui/button-component'

  const props = defineProps<{
    task: AutomationTask
    keptCount: number
    loading?: boolean
  }>()

  const emit = defineEmits<{
    launch: []
  }>()

  const parsingStore = useAutomationParsingStore()

  const isComment = computed(() => props.task.actionType === 'comment')
  const canLaunch = computed(() => props.keptCount > 0)
</script>

<template>
  <div class="cockpit">
    <section v-if="isComment" class="cockpit__section">
      <h2 class="cockpit__title">Настройка комментария</h2>
      <CommentActionConfig v-model="parsingStore.commentConfig" />
    </section>

    <section class="cockpit__section">
      <h2 class="cockpit__title">Распределение во времени</h2>
      <TimeDistributionPreview
        :count="keptCount"
        :spread-seconds="task.spreadSeconds || 5400"
        :jitter-seconds="task.jitterSeconds"
      />
    </section>

    <footer class="cockpit__footer">
      <div class="cockpit__summary">
        <BadgeComponent :label="`Целей к запуску: ${String(keptCount)}`" color="primary" size="md" />
      </div>
      <ButtonComponent
        label="Запустить задачу"
        icon="rocket_launch"
        color="primary"
        :loading="loading"
        :disable="!canLaunch"
        @click="emit('launch')"
      />
    </footer>
  </div>
</template>

<style scoped lang="scss">
  .cockpit {
    display: flex;
    flex-direction: column;
    gap: $spacing-section-gap;
  }

  .cockpit__section {
    background: $surface-primary;
    border-radius: $radius-lg;
    padding: $spacing-card-padding;
    box-shadow: $elevation-card;
    border: $border-width-default $border-style-default $border-default;
  }

  .cockpit__title {
    font-size: $font-size-md;
    font-weight: $font-weight-semibold;
    margin: 0 0 $indent-m;
  }

  .cockpit__footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: $spacing-section-gap;
    flex-wrap: wrap;
  }
</style>
