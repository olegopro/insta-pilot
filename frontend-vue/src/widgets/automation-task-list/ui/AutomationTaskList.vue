<script setup lang="ts">
  import { computed, ref, watch, onMounted } from 'vue'
  import { useAutomationTaskStore } from '@/entities/automation-task'
  import type { AutomationTask, AutomationTaskStatus } from '@/entities/automation-task'
  import { getActionTypeIcon } from '@/entities/automation-action'
  import { useAutomationTaskLive } from '@/features/automation-task-live'
  import { BadgeComponent } from '@/shared/ui/badge-component'
  import { ButtonComponent } from '@/shared/ui/button-component'
  import { SelectComponent } from '@/shared/ui/select-component'
  import { EmptyStateComponent } from '@/shared/ui/empty-state-component'
  import { ModalComponent } from '@/shared/ui/modal-component'
  import { notifyError, useModal } from '@/shared/lib'
  import {
    TASK_STATUS_META,
    TASK_FILTER_OPTIONS,
    TASK_SORT_OPTIONS,
    isActiveStatus,
    isPausedStatus,
    isTerminalStatus,
    canStartStatus,
    canCancelStatus,
    canDeleteStatus,
    currentActionLabel,
    emptyTerminalText,
    taskStatsKind,
    draftPhase,
    filterAndSortTasks
  } from '@/widgets/automation-task-list/lib/taskStatusMeta'
  import type { TaskListFilter, TaskListSort } from '@/widgets/automation-task-list/lib/taskStatusMeta'

  const taskStore = useAutomationTaskStore()
  const taskLive = useAutomationTaskLive()

  const emit = defineEmits<{ open: [taskId: number]; create: [] }>()

  const tasks = computed<AutomationTask[]>(() => taskStore.tasks)
  const hasTasks = computed(() => taskStore.tasks.length > 0)

  const filter = ref<TaskListFilter>('all')
  const sort = ref<TaskListSort>('newest')

  const visibleTasks = computed(() => filterAndSortTasks(taskStore.tasks, filter.value, sort.value))

  // Открывать имеет смысл задачи, у которых живы цели: всё, кроме failed/cancelled.
  const canOpen = (status: AutomationTaskStatus): boolean =>
    status !== 'failed' && status !== 'cancelled'

  // Перезапуск парсинга — только у черновика с провалившимся сбором целей.
  const canRetryParse = (task: AutomationTask): boolean =>
    task.status === 'draft' && task.parseStatus === 'failed'

  const openHandler = (task: AutomationTask) => emit('open', task.id)
  const createHandler = () => emit('create')

  // Пропсы бейджа фазы черновика: icon добавляем только когда он есть (exactOptionalPropertyTypes
  // запрещает явный undefined для опционального пропа).
  const draftBadgeProps = (task: AutomationTask) => {
    const phase = draftPhase(task)
    const base = { label: phase.label, color: phase.color, size: 'md' as const }
    return phase.icon ? { ...base, icon: phase.icon } : base
  }

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

  const cloneHandler = (task: AutomationTask) =>
    taskStore.cloneTask(task.id).catch(() => notifyError('Не удалось клонировать задачу'))

  const retryParseHandler = (task: AutomationTask) =>
    taskStore.retryParse(task.id).catch(() => notifyError('Не удалось перезапустить парсинг'))

  const deleteModal = useModal()
  const taskToDelete = ref<AutomationTask | null>(null)

  const openDeleteHandler = (task: AutomationTask) => {
    taskToDelete.value = task
    deleteModal.open()
  }

  const confirmDeleteHandler = () => {
    const taskId = taskToDelete.value?.id
    if (!taskId) return
    taskStore.deleteTask(taskId)
      .then(() => deleteModal.close())
      .catch(() => notifyError('Не удалось удалить задачу'))
  }

  // Подписка realtime на все незавершённые задачи (после reconnect стор уже синхронизирован fetchTasks).
  watch(tasks, (list) => list.forEach((task) => isTerminalStatus(task.status)
    ? taskLive.unsubscribe(task.id)
    : taskLive.subscribe(task.id)), { immediate: true })

  onMounted(() => taskStore.fetchTasks().catch(() => notifyError('Не удалось загрузить задачи')))
</script>

<template>
  <div class="task-list">
    <div v-if="taskStore.fetchTasksLoading && !hasTasks" class="task-list__loading">
      <q-spinner size="40px" color="primary" />
    </div>

    <div v-else-if="!hasTasks" class="task-list__empty">
      <EmptyStateComponent icon="smart_toy" text="Пока нет запущенных задач" />
      <ButtonComponent
        label="Создать задачу"
        icon="add"
        color="primary"
        unelevated
        @click="createHandler"
      />
    </div>

    <template v-else>
      <div class="task-list__toolbar">
        <SelectComponent
          v-model="filter"
          :options="TASK_FILTER_OPTIONS"
          option-value="value"
          option-label="label"
          emit-value
          map-options
          label="Статус"
          dense
          outlined
          class="task-list__filter"
        />
        <SelectComponent
          v-model="sort"
          :options="TASK_SORT_OPTIONS"
          option-value="value"
          option-label="label"
          emit-value
          map-options
          label="Сортировка"
          dense
          outlined
          class="task-list__filter"
        />
      </div>

      <p v-if="visibleTasks.length === 0" class="task-list__no-match">
        Нет задач по выбранному фильтру
      </p>

      <TransitionGroup v-else name="task-fade" tag="div" class="task-list__items">
        <div
          v-for="task in visibleTasks"
          :key="task.id"
          class="task-card"
          :class="{ 'task-card--clickable': canOpen(task.status) }"
          @click="canOpen(task.status) && openHandler(task)"
        >
          <q-icon
            :name="getActionTypeIcon(task.actionType)"
            class="task-card__watermark"
            :class="`task-card__watermark--${task.actionType}`"
          />

          <div class="task-card__header">
            <div class="task-card__title">
              <span class="task-card__id">Задача #{{ task.id }}</span>
              <BadgeComponent
                v-if="task.status === 'draft'"
                v-bind="draftBadgeProps(task)"
              />
              <BadgeComponent
                v-else
                :label="TASK_STATUS_META[task.status].label"
                :color="TASK_STATUS_META[task.status].color"
                size="md"
              />
            </div>

            <div class="task-card__controls">
              <ButtonComponent
                v-if="canStartStatus(task.status)"
                flat
                round
                icon="arrow_forward"
                color="primary"
                @click.stop="openHandler(task)"
              >
                <q-tooltip>Открыть задачу</q-tooltip>
              </ButtonComponent>
              <ButtonComponent
                v-if="canRetryParse(task)"
                flat
                round
                icon="refresh"
                color="warning"
                @click.stop="retryParseHandler(task)"
              >
                <q-tooltip>Повторить парсинг</q-tooltip>
              </ButtonComponent>
              <ButtonComponent
                v-if="isActiveStatus(task.status)"
                flat
                round
                icon="pause"
                color="warning"
                @click.stop="pauseHandler(task)"
              >
                <q-tooltip>Пауза</q-tooltip>
              </ButtonComponent>
              <ButtonComponent
                v-if="isPausedStatus(task.status)"
                flat
                round
                icon="play_arrow"
                color="primary"
                @click.stop="resumeHandler(task)"
              >
                <q-tooltip>Продолжить</q-tooltip>
              </ButtonComponent>
              <ButtonComponent
                v-if="canCancelStatus(task.status)"
                flat
                round
                icon="stop"
                color="negative"
                @click.stop="cancelHandler(task)"
              >
                <q-tooltip>Отменить</q-tooltip>
              </ButtonComponent>
              <ButtonComponent
                v-if="isTerminalStatus(task.status)"
                flat
                round
                icon="content_copy"
                color="primary"
                @click.stop="cloneHandler(task)"
              >
                <q-tooltip>Клонировать</q-tooltip>
              </ButtonComponent>
              <ButtonComponent
                v-if="canDeleteStatus(task.status)"
                flat
                round
                icon="delete"
                color="negative"
                @click.stop="openDeleteHandler(task)"
              >
                <q-tooltip>Удалить задачу</q-tooltip>
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
            <template v-if="taskStatsKind(task) === 'collected'">
              <template v-if="draftPhase(task).kind === 'parsing'">
                <q-spinner size="16px" color="info" />
                <span class="text-info">Идёт сбор целей…</span>
              </template>
              <span v-else-if="draftPhase(task).kind === 'failed'" class="text-negative">
                Ошибка: {{ task.parseError ?? 'не удалось собрать цели' }}
              </span>
              <span v-else-if="draftPhase(task).kind === 'ready'" class="text-positive">
                Готово к запуску: {{ task.collectedTargetsCount }}
              </span>
              <span v-else class="text-grey">
                Собрано целей: {{ task.collectedTargetsCount }}
              </span>
            </template>
            <span v-else-if="taskStatsKind(task) === 'empty'" class="text-grey">
              {{ emptyTerminalText(task) }}
            </span>
            <template v-else>
              <span class="task-card__done">{{ task.itemsDone }} из {{ task.itemsTotal }} выполнено</span>
              <div class="task-card__minor">
                <BadgeComponent
                  v-if="task.itemsFailed > 0"
                  :label="`Ошибки: ${task.itemsFailed}`"
                  icon="error_outline"
                  color="negative"
                  size="sm"
                  outline
                />
                <BadgeComponent
                  v-if="task.itemsSkipped > 0"
                  :label="`Пропущено: ${task.itemsSkipped}`"
                  icon="redo"
                  color="grey"
                  size="sm"
                  outline
                />
                <span v-if="currentActionLabel(task)" class="task-card__current">{{ currentActionLabel(task) }}</span>
              </div>
            </template>
          </div>
        </div>
      </TransitionGroup>
    </template>

    <ModalComponent
      v-model="deleteModal.isVisible"
      title="Удаление задачи"
      submit-label="Удалить"
      submit-color="negative"
      reset-label="Отмена"
      :submit-loading="taskStore.deleteTaskLoading"
      @submit="confirmDeleteHandler"
      @reset="deleteModal.close()"
    >
      <p>Удалить задачу #{{ taskToDelete?.id }}?</p>
    </ModalComponent>
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

  .task-list__empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: $indent-m;
  }

  .task-list__toolbar {
    display: flex;
    flex-wrap: wrap;
    gap: $spacing-inline-gap;
  }

  .task-list__filter {
    min-width: 180px;
  }

  .task-list__no-match {
    padding: $indent-l 0;
    text-align: center;
    color: $content-tertiary;
  }

  .task-list__items {
    display: flex;
    flex-direction: column;
    gap: $spacing-stack-gap;
  }

  .task-card {
    position: relative;
    overflow: hidden;
    background: $surface-primary;
    border-radius: $radius-lg;
    padding: $spacing-card-padding;
    box-shadow: $elevation-card;
    border: $border-width-default $border-style-default $border-default;
    display: flex;
    flex-direction: column;
    gap: $spacing-stack-gap;
  }

  // Контент держим над декоративным watermark.
  .task-card > *:not(.task-card__watermark) {
    position: relative;
    z-index: 1;
  }

  // Декоративный значок действия: крупный, выезжает за верхне-правый угол карточки и
  // обрезается её overflow:hidden. Лежит ПОД контентом (z-index:0), не перехватывает клики.
  .task-card__watermark {
    position: absolute;
    top: -20px;
    right: -16px;
    font-size: 140px;
    color: $content-primary;
    opacity: 0.1;
    pointer-events: none;
    z-index: 0;
  }

  // Лёгкий оттенок по действию: для лайков — красноватое «сердечко» сверху-справа.
  .task-card__watermark--like {
    color: $negative;
    opacity: 0.12;
  }

  .task-card--clickable {
    cursor: pointer;
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
    font-size: $font-size-lg;
    font-weight: $font-weight-bold;
    color: $content-primary;
  }

  // Локальное укрупнение бейджа в карточке (без правки shared/ui/badge-component).
  .task-card__title :deep(.badge-component) {
    font-size: $font-size-sm;
    padding: $indent-xs $indent-sm;
  }

  .task-card__controls {
    display: flex;
    gap: $indent-2xs;
  }

  .task-card__stats {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: $spacing-inline-gap;
    font-size: $font-size-sm;
    color: $content-secondary;
  }

  .task-card__done {
    font-size: $font-size-base;
    font-weight: $font-weight-semibold;
    color: $content-primary;
  }

  .task-card__minor {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: $indent-s;
  }

  .task-card__current {
    font-style: italic;
  }

  // Появление/удаление карточек — быстрый fade без горизонтального сдвига.
  .task-fade-enter-active,
  .task-fade-leave-active {
    transition: opacity $transition-fast;
  }

  .task-fade-enter-from,
  .task-fade-leave-to {
    opacity: 0;
  }

  .task-fade-leave-active {
    position: absolute;
    width: 100%;
  }
</style>
