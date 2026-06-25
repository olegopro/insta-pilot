<script setup lang="ts">
  import { ref, computed, watch } from 'vue'
  import { useAutomationParsingStore } from '@/entities/automation-parsing'
  import type { AutomationTask } from '@/entities/automation-task'
  import { ACTION_TYPE_OPTIONS, isLlmAction } from '@/entities/automation-action'
  import { getActionTypeLabel } from '@/entities/automation-action'
  import { CommentActionConfig } from '@/features/configure-automation-action'
  import { TimeDistributionEditor, evenDistribution } from '@/shared/ui/time-distribution-editor'
  import { BadgeComponent } from '@/shared/ui/badge-component'
  import { ButtonComponent } from '@/shared/ui/button-component'

  const props = defineProps<{
    task: AutomationTask
    keptCount: number
    loading?: boolean
  }>()

  const emit = defineEmits<{
    launch: [payload: { offsets: number[]; windowSeconds: number }]
  }>()

  const parsingStore = useAutomationParsingStore()

  // Окно распределения (сек) — сид из spread_seconds задачи; смещения целей по индексу —
  // равномерный сид. Дальше пользователь правит таймлайн вручную в редакторе.
  const windowSeconds = ref(props.task.spreadSeconds || 3600)
  const offsets = ref<number[]>(evenDistribution(props.keptCount, windowSeconds.value))

  // Конфиг комментария (тон/шаблон/use_caption) нужен только для LLM-действий (comment).
  // Для like LLM не задействован — секция настройки скрывается.
  const showCommentConfig = computed(() => isLlmAction(props.task.actionType))
  const actionLabel = computed(() =>
    ACTION_TYPE_OPTIONS.find((option) => option.value === props.task.actionType)?.label
    ?? props.task.actionType)
  const canLaunch = computed(() => props.keptCount > 0)

  // Сводка перед запуском: лейбл действия (через getActionTypeLabel из entities/automation-action,
  // с фолбэком на сырое значение) и окно распределения в минутах из текущего windowSeconds.
  const summaryActionLabel = computed(() =>
    getActionTypeLabel(props.task.actionType) ?? props.task.actionType)
  const windowMinutes = computed(() => Math.max(1, Math.round(windowSeconds.value / 60)))

  // Число целей может измениться (догрузка/курирование) — переинициализируем сид смещений.
  watch(() => props.keptCount, (count) => offsets.value = evenDistribution(count, windowSeconds.value))
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
      <TimeDistributionEditor
        v-model:offsets="offsets"
        v-model:window-seconds="windowSeconds"
      />
    </section>

    <footer class="cockpit__footer">
      <p class="cockpit__summary">
        Будет выполнено <strong>{{ keptCount }}</strong> действий ·
        тип: <strong>{{ summaryActionLabel }}</strong> ·
        в течение <strong>{{ windowMinutes }}</strong> мин
      </p>
      <ButtonComponent
        label="Запустить задачу"
        icon="rocket_launch"
        color="primary"
        :loading="loading"
        :disable="!canLaunch"
        @click="emit('launch', { offsets, windowSeconds })"
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

  .cockpit__summary {
    margin: 0;
    font-size: $font-size-base;
    color: $content-secondary;

    strong {
      color: $content-primary;
      font-weight: $font-weight-semibold;
    }
  }
</style>
