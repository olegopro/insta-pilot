<script setup lang="ts">
  import { ref, computed, watch, onMounted } from 'vue'
  import { useAccountSelect, AccountSelectComponent } from '@/entities/instagram-account'
  import { useAutomationParsingStore } from '@/entities/automation-parsing'
  import { useAutomationTargetStore } from '@/entities/automation-target'
  import { useAutomationTaskStore } from '@/entities/automation-task'
  import type { AutomationTask } from '@/entities/automation-task'
  import { AutomationBuilder } from '@/widgets/automation-builder'
  import { AutomationTargetsView } from '@/widgets/automation-targets-view'
  import { AutomationLaunchCockpit } from '@/widgets/automation-launch-cockpit'
  import { AutomationTaskList, draftPhase } from '@/widgets/automation-task-list'
  import { AutomationAccountSettings } from '@/widgets/automation-account-settings'
  import { useParseProgress } from '@/features/automation-task-live'
  import { PageComponent } from '@/shared/ui/page-component'
  import { ButtonComponent } from '@/shared/ui/button-component'
  import { BadgeComponent } from '@/shared/ui/badge-component'
  import { isCancelledRequest } from '@/shared/api'
  import { notifyError, notifySuccess } from '@/shared/lib'

  type BuilderStep = 'configure' | 'review' | 'launch'
  type Tab = 'builder' | 'tasks' | 'settings'

  // Шаги создания задачи для верхнего степпера правой панели. Назад разрешён по пройденным
  // шагам (не во время парсинга); вперёд — только через явные CTA (старт парсинга / «К запуску»).
  const BUILDER_STEPS: { value: BuilderStep; label: string }[] = [
    { value: 'configure', label: 'Настройка' },
    { value: 'review', label: 'Отбор целей' },
    { value: 'launch', label: 'Запуск' }
  ]

  const { selectedAccount, accountSelectRef, accountStackLabel, isInitializing, initAccounts } =
    useAccountSelect('automation_selected_account_id')

  const parsingStore = useAutomationParsingStore()
  const targetStore = useAutomationTargetStore()
  const taskStore = useAutomationTaskStore()

  const activeTab = ref<Tab>('builder')
  const builderStep = ref<BuilderStep>('configure')
  const curatingId = ref<number | null>(null)
  // Происхождение review-шага: true — открыли существующую задачу из списка «Задачи»
  // (кнопки контекстные: «К задачам», курирование только для draft); false — создание новой.
  const openedFromList = ref(false)
  // Парсинг идёт асинхронно в очереди (ParseTargetsJob) — держим флаг, пока ждём
  // завершение по WebSocket/fallback, чтобы review-таблица показывала загрузку.
  const isParsing = ref(false)

  const accountId = computed(() => selectedAccount.value?.id ?? null)
  const keptCount = computed(() => targetStore.keptTargets.length)
  const targetsLoading = computed(() => isParsing.value || targetStore.fetchTargetsLoading)

  // Курирование целей (exclude/restore) осмысленно только для черновика. Создание новой
  // задачи — всегда draft; открытая из списка — только если её статус ещё 'draft'.
  const isDraftReview = computed(() =>
    openedFromList.value ? taskStore.currentTask?.status === 'draft' : true
  )

  // Завершение async-парсинга: для semi_auto рефетчим цели в review-таблицу;
  // для full_auto бэк сам планирует исполнение (ScheduleActionItemsJob) — фронт не зовёт
  // /start, а уходит на вкладку «Задачи» к запущенной задаче с realtime-прогрессом.
  const parseProgress = useParseProgress({
    onDone: async (taskId: number): Promise<number> => {
      // full_auto: целей в review нет — бэк сам планирует исполнение. Завершаем сразу
      // (возвращаем >0 как терминальный успех) и уходим на вкладку «Задачи».
      if (parsingStore.draft.mode === 'full_auto') {
        isParsing.value = false
        resetBuilderHandler()
        activeTab.value = 'tasks'
        await taskStore.fetchTasks().catch(() => notifyError('Не удалось обновить задачи'))
        return 1
      }
      // semi_auto: рефетч — источник истины. count===0 (парс ещё идёт / гонка коммита)
      // не считаем терминалом: useParseProgress продолжит поллинг до появления целей.
      await targetStore.fetchTargets(taskId)
      return targetStore.targets.length
    },
    // Терминал парсинга (цели получены ИЛИ исчерпан backstop) — снимаем визуальный флаг
    // загрузки НЕЗАВИСИМО от числа целей: 0 целей даёт пустую таблицу, а не вечную загрузку.
    onSettled: () => isParsing.value = false,
    onFail: (_taskId: number, message?: string | null) => {
      isParsing.value = false
      // Показываем причину из события (например, требование верификации аккаунта). Если бэк
      // её не прислал — внятный generic с подсказкой про возможный challenge/верификацию.
      notifyError(message
        ?? 'Парсинг завершился с ошибкой. Возможно, Instagram требует подтверждение входа — '
          + 'проверьте аккаунт и обновите сессию, затем повторите')
      resetBuilderHandler()
    }
  })

  // Старт парсинга: создаёт задачу из черновика и запускает парсинг источника.
  // Парсинг асинхронный — подписываемся на его завершение (см. parseProgress).
  const startParseHandler = () => {
    if (!accountId.value) return
    openedFromList.value = false
    parsingStore.draft.accountId = accountId.value
    const isFullAuto = parsingStore.draft.mode === 'full_auto'
    isParsing.value = true
    builderStep.value = isFullAuto ? builderStep.value : 'review'
    parsingStore.startParse()
      .then((task) => {
        notifySuccess(isFullAuto ? 'Задача запущена в авто-режиме' : 'Парсинг запущен')
        parseProgress.watchParse(task.id)
      })
      .catch((error: unknown) => {
        isParsing.value = false
        builderStep.value = 'configure'
        isCancelledRequest(error) || notifyError('Не удалось запустить парсинг')
      })
  }

  const excludeTargetHandler = (targetId: number) => {
    const taskId = taskStore.currentTask?.id
    if (!taskId) return
    curatingId.value = targetId
    targetStore.excludeTarget(taskId, targetId)
      .catch(() => notifyError('Не удалось убрать цель'))
      .finally(() => curatingId.value = null)
  }

  const restoreTargetHandler = (targetId: number) => {
    const taskId = taskStore.currentTask?.id
    if (!taskId) return
    curatingId.value = targetId
    targetStore.restoreTarget(taskId, targetId)
      .catch(() => notifyError('Не удалось вернуть цель'))
      .finally(() => curatingId.value = null)
  }

  const goToLaunchHandler = () => builderStep.value = 'launch'

  // Индекс текущего шага в BUILDER_STEPS — основа подсветки и логики «назад» в степпере.
  const currentStepIndex = computed(() =>
    BUILDER_STEPS.findIndex((step) => step.value === builderStep.value))

  // Клик по шагу степпера: только назад (на уже пройденный шаг) и только когда парсинг не идёт.
  const goToStepHandler = (step: BuilderStep) => {
    const targetIndex = BUILDER_STEPS.findIndex((item) => item.value === step)
    if (isParsing.value || targetIndex < 0 || targetIndex >= currentStepIndex.value) return
    builderStep.value = step
  }

  // Пропсы бейджа фазы сбора целей текущей задачи. icon добавляем только при наличии
  // (exactOptionalPropertyTypes запрещает явный undefined для опционального пропа).
  const phaseBadgeProps = (task: AutomationTask) => {
    const phase = draftPhase(task)
    const base = { label: phase.label, color: phase.color }
    return phase.icon ? { ...base, icon: phase.icon } : base
  }

  const launchTaskHandler = (payload: { offsets: number[]; windowSeconds: number }) => {
    const taskId = taskStore.currentTask?.id
    if (!taskId) return
    // Индекс кубика → parsed_target_id: kept-цели в том же порядке, что грузит планировщик.
    // Бэк ключует run_at строго по parsed_target_id (дедуп может выкинуть часть целей).
    const schedule = targetStore.keptTargets.map((target, index) => ({
      parsed_target_id: target.id,
      offset_seconds: payload.offsets[index] ?? 0
    }))
    taskStore.startTask(taskId, { window_seconds: payload.windowSeconds, schedule })
      .then(async () => {
        notifySuccess('Задача запущена')
        // Рефетч списка — свежий статус ('scheduling'/'running') и realtime-подписка.
        await taskStore.fetchTasks().catch(() => notifyError('Не удалось обновить задачи'))
        resetBuilderHandler()
        activeTab.value = 'tasks'
      })
      .catch(() => notifyError('Не удалось запустить задачу'))
  }

  // Открытие задачи из списка «Задачи»: подтягиваем задачу и её цели, возвращаемся в
  // конструктор на review. Шаг 'launch' остаётся только для создания (goToLaunchHandler);
  // здесь review универсален — кнопка «К запуску» показывается лишь для draft (см. шаблон).
  const openReviewHandler = async (taskId: number) => {
    try {
      targetStore.clearTargets()
      taskStore.clearCurrentTask()
      await taskStore.fetchTask(taskId)
      await targetStore.fetchTargets(taskId)
      openedFromList.value = true
      builderStep.value = 'review'
      activeTab.value = 'builder'
    } catch {
      notifyError('Не удалось открыть задачу')
    }
  }

  // Возврат из review существующей задачи в список «Задачи»: сбрасываем конструктор
  // (в т.ч. openedFromList) и переключаем таб программно (tabChangeHandler не дёргается).
  const backToTasksHandler = () => {
    resetBuilderHandler()
    activeTab.value = 'tasks'
  }

  // Создание новой задачи из пустого состояния списка «Задачи»: чистим конструктор
  // (configure + сброс черновика) и уводим пользователя на вкладку «Конструктор».
  const createNewTaskHandler = () => {
    resetBuilderHandler()
    activeTab.value = 'builder'
  }

  // Повтор парсинга для ОТКРЫТОЙ из списка задачи с проваленным сбором целей: целей нет —
  // запускать нечего. retryParse оптимистично переводит задачу в фазу 'parsing' (бейдж в
  // шапке сам обновится), остаёмся на review; финальный статус приедет по WebSocket-прогрессу.
  const retryParseReviewHandler = () => {
    const taskId = taskStore.currentTask?.id
    if (!taskId) return
    taskStore.retryParse(taskId)
      .then(() => notifySuccess('Парсинг перезапущен'))
      .catch(() => notifyError('Не удалось перезапустить парсинг'))
  }

  const resetBuilderHandler = () => {
    parseProgress.leave()
    isParsing.value = false
    openedFromList.value = false
    builderStep.value = 'configure'
    parsingStore.resetDraft()
    // resetDraft() обнуляет accountId — сразу возвращаем выбранный аккаунт в черновик,
    // иначе кнопка «Старт» останется заблокированной (canStartParse требует accountId).
    parsingStore.draft.accountId = accountId.value
    targetStore.clearTargets()
    taskStore.clearCurrentTask()
  }

  // Ручной клик по табу 'Конструктор' всегда показывает чистый configure. Срабатывает только
  // на пользовательском переходе: программная смена activeTab (openReviewHandler) меняет prop
  // q-tabs без эмита update:model-value, поэтому review/launch при открытии задачи сохраняются.
  const tabChangeHandler = (tab: Tab) => tab === 'builder' && (builderStep.value = 'configure')

  // Смена аккаунта сбрасывает незавершённый черновик конструктора и синхронизирует accountId
  // в черновик парсинга (от него зависит canStartParse и валидность кнопки «Старт парсинга»).
  watch(accountId, (id, oldId) => {
    oldId && id !== oldId && resetBuilderHandler()
    parsingStore.draft.accountId = id
  }, { immediate: true })

  onMounted(() => void initAccounts())
</script>

<template>
  <PageComponent title="Автоматизация" icon="smart_toy" class="automation-page">
    <template #append>
      <AccountSelectComponent
        ref="accountSelectRef"
        v-model="selectedAccount"
        :loading="isInitializing"
        :stack-label="accountStackLabel"
      />
    </template>

    <q-tabs
      v-model="activeTab"
      class="automation-page__tabs q-mb-md"
      align="left"
      no-caps
      inline-label
      @update:model-value="tabChangeHandler"
    >
      <q-tab name="builder" icon="build" label="Конструктор" />
      <q-tab name="tasks" icon="list_alt" label="Задачи" />
      <q-tab name="settings" icon="tune" label="Настройки" />
    </q-tabs>

    <q-tab-panels
      v-model="activeTab"
      animated
      transition-prev="fade"
      transition-next="fade"
      class="automation-page__panels"
    >
      <!-- Конструктор -->
      <q-tab-panel name="builder" class="automation-page__panel">
        <!-- Навигация: степпер для создания / контекст задачи для открытой из списка -->
        <nav v-if="!openedFromList" class="builder-stepper" aria-label="Шаги создания задачи">
          <template v-for="(step, index) in BUILDER_STEPS" :key="step.value">
            <q-icon v-if="index > 0" name="chevron_right" class="builder-stepper__sep" />
            <button
              type="button"
              class="builder-stepper__step"
              :class="{
                'builder-stepper__step--active': step.value === builderStep,
                'builder-stepper__step--done': index < currentStepIndex,
                'builder-stepper__step--clickable': index < currentStepIndex && !isParsing
              }"
              :disabled="index >= currentStepIndex || isParsing"
              @click="goToStepHandler(step.value)"
            >
              <span class="builder-stepper__index">{{ index + 1 }}</span>
              <span class="builder-stepper__label">{{ step.label }}</span>
            </button>
          </template>
        </nav>

        <div v-else class="builder-context">
          <div class="builder-context__title">
            <q-icon name="assignment" size="20px" />
            <span class="builder-context__id">Задача #{{ taskStore.currentTask?.id }}</span>
            <!-- Бейдж фазы сбора целей рядом с тайтлом (как на карточке списка) -->
            <template v-if="taskStore.currentTask?.status === 'draft'">
              <q-spinner
                v-if="draftPhase(taskStore.currentTask).kind === 'parsing'"
                size="16px"
                color="info"
              />
              <BadgeComponent v-bind="phaseBadgeProps(taskStore.currentTask)" />
            </template>
            <!-- Текст ошибки сбора (только review + failed): усекается многоточием, полный — в tooltip -->
            <span
              v-if="builderStep === 'review' && taskStore.currentTask?.status === 'draft'
                && draftPhase(taskStore.currentTask).kind === 'failed' && taskStore.currentTask.parseError"
              class="builder-context__error text-negative"
            >
              {{ taskStore.currentTask.parseError }}
              <q-tooltip>{{ taskStore.currentTask.parseError }}</q-tooltip>
            </span>
          </div>

          <div class="builder-context__actions">
            <!-- Из шага «Запуск» открытой задачи назад к отбору; иначе — к списку задач -->
            <ButtonComponent
              v-if="builderStep === 'launch'"
              label="К отбору"
              icon="arrow_back"
              flat
              @click="builderStep = 'review'"
            />
            <ButtonComponent
              v-else
              label="К задачам"
              icon="arrow_back"
              flat
              @click="backToTasksHandler"
            />
            <!-- Действие review открытого черновика: повтор парсинга при failed (целей нет) / переход к запуску при ready -->
            <template v-if="builderStep === 'review' && taskStore.currentTask?.status === 'draft'">
              <ButtonComponent
                v-if="draftPhase(taskStore.currentTask).kind === 'failed'"
                label="Повторить парсинг"
                icon="refresh"
                color="warning"
                :loading="taskStore.retryParseLoading"
                @click="retryParseReviewHandler"
              />
              <ButtonComponent
                v-else
                label="К запуску"
                icon="arrow_forward"
                color="primary"
                :disable="keptCount === 0 || targetsLoading"
                @click="goToLaunchHandler"
              />
            </template>
          </div>
        </div>

        <transition name="fade" mode="out-in">
          <AutomationBuilder
            v-if="builderStep === 'configure'"
            key="configure"
            :account-id="accountId"
            @start="startParseHandler"
          />

          <div v-else-if="builderStep === 'review'" key="review" class="builder-step">
            <!-- Создание: фазовый индикатор сбора целей слева + CTA «К запуску» справа.
                 Для ОТКРЫТОЙ задачи бейдж/ошибка/действие живут в шапке (builder-context). -->
            <div v-if="!openedFromList && taskStore.currentTask?.status === 'draft'" class="builder-step__head">
              <div class="builder-step__phase">
                <q-spinner
                  v-if="draftPhase(taskStore.currentTask).kind === 'parsing'"
                  size="18px"
                  color="info"
                />
                <BadgeComponent v-bind="phaseBadgeProps(taskStore.currentTask)" />
                <span
                  v-if="draftPhase(taskStore.currentTask).kind === 'failed' && taskStore.currentTask.parseError"
                  class="text-negative"
                >
                  {{ taskStore.currentTask.parseError }}
                </span>
              </div>
              <ButtonComponent
                class="builder-step__cta"
                label="К запуску"
                icon="arrow_forward"
                color="primary"
                :disable="keptCount === 0 || targetsLoading"
                @click="goToLaunchHandler"
              />
            </div>
            <AutomationTargetsView
              :targets="targetStore.targets"
              :loading="targetsLoading"
              :curating-id="curatingId"
              :readonly="!isDraftReview"
              @exclude="excludeTargetHandler"
              @restore="restoreTargetHandler"
            />
          </div>

          <AutomationLaunchCockpit
            v-else-if="taskStore.currentTask"
            key="launch"
            :task="taskStore.currentTask"
            :kept-count="keptCount"
            :loading="taskStore.startTaskLoading"
            @launch="launchTaskHandler"
          />
        </transition>
      </q-tab-panel>

      <!-- Задачи -->
      <q-tab-panel name="tasks" class="automation-page__panel">
        <AutomationTaskList @open="openReviewHandler" @create="createNewTaskHandler" />
      </q-tab-panel>

      <!-- Настройки -->
      <q-tab-panel name="settings" class="automation-page__panel">
        <AutomationAccountSettings :account-id="accountId" />
      </q-tab-panel>
    </q-tab-panels>
  </PageComponent>
</template>

<style scoped lang="scss">
  .automation-page__tabs {
    border-bottom: $border-width-default $border-style-default $border-default;
  }

  .automation-page__panels {
    background: transparent;
  }

  .automation-page__panel {
    padding: 0;
  }

  .builder-step {
    display: flex;
    flex-direction: column;
    gap: $spacing-section-gap;
  }

  .builder-step__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .builder-step__phase {
    display: flex;
    align-items: center;
    gap: $spacing-inline-gap;
  }

  // CTA review-шага всегда прижата к правому краю — даже когда слева пусто (parsing/ready).
  .builder-step__cta {
    margin-left: auto;
  }

  // ──────────────────────────────────────────
  // Степпер шагов создания (configure → review → launch)
  // ──────────────────────────────────────────
  .builder-stepper {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: $indent-xs;
    margin-bottom: $spacing-section-gap;
  }

  .builder-stepper__step {
    display: flex;
    align-items: center;
    gap: $indent-s;
    padding: $indent-s $indent-m;
    border: $border-width-default $border-style-default $border-default;
    border-radius: $radius-full;
    background: $surface-primary;
    color: $content-secondary;
    font-family: inherit;
    font-size: $font-size-sm;
    font-weight: $font-weight-medium;
    cursor: default;
    transition: color $transition-fast, border-color $transition-fast, background $transition-fast;
  }

  .builder-stepper__index {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    border-radius: $radius-full;
    background: $surface-tertiary;
    color: $content-secondary;
    font-weight: $font-weight-semibold;
    transition: background $transition-fast, color $transition-fast;
  }

  .builder-stepper__step--active {
    border-color: $primary;
    color: $primary;

    .builder-stepper__index {
      background: $primary;
      color: $surface-primary;
    }
  }

  .builder-stepper__step--done {
    color: $content-primary;

    .builder-stepper__index {
      background: rgba($primary, 0.12);
      color: $primary;
    }
  }

  .builder-stepper__step--clickable {
    cursor: pointer;

    &:hover {
      border-color: $border-hover;
      background: $surface-hover;
    }
  }

  .builder-stepper__sep {
    color: $content-tertiary;
    font-size: $font-size-lg;
  }

  // ──────────────────────────────────────────
  // Контекст-заголовок открытой из списка задачи
  // ──────────────────────────────────────────
  .builder-context {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: nowrap;
    gap: $spacing-inline-gap;
    margin-bottom: $spacing-section-gap;
  }

  .builder-context__title {
    display: flex;
    align-items: center;
    gap: $spacing-inline-gap;
    min-width: 0; // позволяет левой группе сжиматься и усекать текст ошибки
    font-size: $font-size-md;
    font-weight: $font-weight-semibold;
    color: $content-primary;
  }

  // Внутри левой группы ничего не сжимается, КРОМЕ текста ошибки.
  .builder-context__title > * {
    flex-shrink: 0;
  }

  .builder-context__id {
    white-space: nowrap;
  }

  // Текст ошибки сбора: единственный сжимаемый элемент — усекается многоточием, не переносит строку.
  .builder-context__error {
    flex-shrink: 1;
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    font-size: $font-size-sm;
    font-weight: $font-weight-regular;
  }

  // Правая группа: навигация + действие, не переносится и не сжимается.
  .builder-context__actions {
    display: flex;
    align-items: center;
    flex-shrink: 0;
    gap: $spacing-inline-gap;
    white-space: nowrap;
  }

  // ──────────────────────────────────────────
  // Fade-переход между шагами (только opacity, без сдвигов)
  // ──────────────────────────────────────────
  .fade-enter-active,
  .fade-leave-active {
    transition: opacity $transition-fast;
  }

  .fade-enter-from,
  .fade-leave-to {
    opacity: 0;
  }
</style>
