<script setup lang="ts">
  import { computed, watch, onMounted } from 'vue'
  import { useAutomationTaskStore } from '@/entities/automation-task'
  import type { AutomationTask } from '@/entities/automation-task'
  import { useAutomationTaskLive } from '@/features/automation-task-live'
  import { BadgeComponent } from '@/shared/ui/badge-component'
  import { ButtonComponent } from '@/shared/ui/button-component'
  import { EmptyStateComponent } from '@/shared/ui/empty-state-component'
  import { notifyError } from '@/shared/lib'
  import {
    TASK_STATUS_META,
    isActiveStatus,
    isPausedStatus,
    isTerminalStatus
  } from '@/widgets/automation-task-list/lib/taskStatusMeta'

  const taskStore = useAutomationTaskStore()
  const taskLive = useAutomationTaskLive()

  const tasks = computed<AutomationTask[]>(() => taskStore.tasks)

  const progressRatio = (task: AutomationTask): number => {
    if (task.itemsTotal <= 0) return 0
    return (task.itemsDone + task.itemsFailed + task.itemsSkipped) / task.itemsTotal
  }

  const pauseHandler = (task: AutomationTask) =>
    taskStore.pauseTask(task.id).catch(() => notifyError('Не удалось поставить на паузу'))

  const resumeHandler = (task: AutomationTask) =>
    taskStore.resumeTask(task.id).catch(() => notifyError('Не удалось возобновить'))

  const cancelHandler = (task: AutomationTask) =>
    taskStore.cancelTask(task.id).catch(() => notifyError('Не удалось отменить'))

  // Подписка realtime на все незавершённые задачи (после reconnect стор уже синхронизирован fetchTasks).
  watch(tasks, (list) => list.forEach((task) => isTerminalStatus(task.status)
    ? taskLive.unsubscribe(task.id)
    : taskLive.subscribe(task.id)), { immediate: true })

  onMounted(() => taskStore.fetchTasks().catch(() => notifyError('Не удалось загрузить задачи')))
</script>

<template>
  <div class="task-list">
    <div v-if="taskStore.fetchTasksLoading && tasks.length === 0" class="task-list__loading">
      <q-spinner size="40px" color="primary" />
    </div>

    <EmptyStateComponent
      v-else-if="tasks.length === 0"
      icon="smart_toy"
      text="Пока нет запущенных задач"
    />

    <div
      v-for="task in tasks"
      v-else
      :key="task.id"
      class="task-card"
    >
      <div class="task-card__header">
        <div class="task-card__title">
          <span class="task-card__id">Задача #{{ task.id }}</span>
          <BadgeComponent
            :label="TASK_STATUS_META[task.status].label"
            :color="TASK_STATUS_META[task.status].color"
            size="sm"
          />
        </div>

        <div class="task-card__controls">
          <ButtonComponent
            v-if="isActiveStatus(task.status)"
            flat
            round
            icon="pause"
            color="warning"
            @click="pauseHandler(task)"
          >
            <q-tooltip>Пауза</q-tooltip>
          </ButtonComponent>
          <ButtonComponent
            v-if="isPausedStatus(task.status)"
            flat
            round
            icon="play_arrow"
            color="primary"
            @click="resumeHandler(task)"
          >
            <q-tooltip>Продолжить</q-tooltip>
          </ButtonComponent>
          <ButtonComponent
            v-if="!isTerminalStatus(task.status)"
            flat
            round
            icon="stop"
            color="negative"
            @click="cancelHandler(task)"
          >
            <q-tooltip>Отменить</q-tooltip>
          </ButtonComponent>
        </div>
      </div>

      <q-linear-progress
        :value="progressRatio(task)"
        :color="TASK_STATUS_META[task.status].color"
        size="8px"
        rounded
        class="task-card__progress"
      />

      <div class="task-card__stats">
        <span>Всего: {{ task.itemsTotal }}</span>
        <span class="text-positive">Готово: {{ task.itemsDone }}</span>
        <span class="text-negative">Ошибки: {{ task.itemsFailed }}</span>
        <span class="text-grey">Пропущено: {{ task.itemsSkipped }}</span>
        <span v-if="task.currentAction" class="task-card__current">{{ task.currentAction }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
  .task-list {
    display: flex;
    flex-direction: column;
    gap: $spacing-stack-gap;
  }

  .task-list__loading {
    display: flex;
    justify-content: center;
    padding: $spacing-section-gap;
  }

  .task-card {
    background: $surface-primary;
    border-radius: $radius-lg;
    padding: $spacing-card-padding;
    box-shadow: $elevation-card;
    border: $border-width-default $border-style-default $border-default;
    display: flex;
    flex-direction: column;
    gap: $spacing-stack-gap;
  }

  .task-card__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .task-card__title {
    display: flex;
    align-items: center;
    gap: $spacing-inline-gap;
  }

  .task-card__id {
    font-weight: $font-weight-semibold;
  }

  .task-card__controls {
    display: flex;
    gap: $indent-2xs;
  }

  .task-card__stats {
    display: flex;
    flex-wrap: wrap;
    gap: $spacing-inline-gap;
    font-size: $font-size-sm;
    color: $content-secondary;
  }

  .task-card__current {
    font-style: italic;
  }
</style>
