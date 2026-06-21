<script setup lang="ts">
  import { computed } from 'vue'
  import { useAutomationParsingStore } from '@/entities/automation-parsing'
  import type { AutomationTask } from '@/entities/automation-task'
  import { ACTION_TYPE_OPTIONS, isLlmAction } from '@/entities/automation-action'
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

  // Конфиг комментария (тон/шаблон/use_caption) нужен только для LLM-действий (comment).
  // Для like LLM не задействован — секция настройки скрывается.
  const showCommentConfig = computed(() => isLlmAction(props.task.actionType))
  const actionLabel = computed(() =>
    ACTION_TYPE_OPTIONS.find((option) => option.value === props.task.actionType)?.label
    ?? props.task.actionType)
  const canLaunch = computed(() => props.keptCount > 0)
</script>

<template>
  <div class="cockpit">
    <section class="cockpit__section cockpit__section--action">
      <h2 class="cockpit__title">Действие</h2>
      <BadgeComponent :label="actionLabel" color="primary" size="md" />
    </section>

    <section v-if="showCommentConfig" class="cockpit__section">
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

  .cockpit__section--action {
    display: flex;
    align-items: center;
    gap: $spacing-inline-gap;

    .cockpit__title {
      margin: 0;
    }
  }

  .cockpit__footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: $spacing-section-gap;
    flex-wrap: wrap;
  }
</style>
