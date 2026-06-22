<script setup lang="ts">
  import { ref, computed, watch, onMounted } from 'vue'
  import { useAccountSelect, AccountSelectComponent } from '@/entities/instagram-account'
  import { useAutomationParsingStore } from '@/entities/automation-parsing'
  import { useAutomationTargetStore } from '@/entities/automation-target'
  import { useAutomationTaskStore } from '@/entities/automation-task'
  import { AutomationBuilder } from '@/widgets/automation-builder'
  import { AutomationTargetsView } from '@/widgets/automation-targets-view'
  import { AutomationLaunchCockpit } from '@/widgets/automation-launch-cockpit'
  import { AutomationTaskList } from '@/widgets/automation-task-list'
  import { AutomationAccountSettings } from '@/widgets/automation-account-settings'
  import { useParseProgress } from '@/features/automation-task-live'
  import { PageComponent } from '@/shared/ui/page-component'
  import { ButtonComponent } from '@/shared/ui/button-component'
  import { isCancelledRequest } from '@/shared/api'
  import { notifyError, notifySuccess } from '@/shared/lib'

  type BuilderStep = 'configure' | 'review' | 'launch'
  type Tab = 'builder' | 'tasks' | 'settings'

  const { selectedAccount, accountSelectRef, accountStackLabel, isInitializing, initAccounts } =
    useAccountSelect('automation_selected_account_id')

  const parsingStore = useAutomationParsingStore()
  const targetStore = useAutomationTargetStore()
  const taskStore = useAutomationTaskStore()

  const activeTab = ref<Tab>('builder')
  const builderStep = ref<BuilderStep>('configure')
  const curatingId = ref<number | null>(null)
  // Парсинг идёт асинхронно в очереди (ParseTargetsJob) — держим флаг, пока ждём
  // завершение по WebSocket/fallback, чтобы review-таблица показывала загрузку.
  const isParsing = ref(false)

  const accountId = computed(() => selectedAccount.value?.id ?? null)
  const keptCount = computed(() => targetStore.keptTargets.length)
  const targetsLoading = computed(() => isParsing.value || targetStore.fetchTargetsLoading)

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
    onFail: () => {
      isParsing.value = false
      notifyError('Парсинг завершился с ошибкой')
      resetBuilderHandler()
    }
  })

  // Старт парсинга: создаёт задачу из черновика и запускает парсинг источника.
  // Парсинг асинхронный — подписываемся на его завершение (см. parseProgress).
  const startParseHandler = () => {
    if (!accountId.value) return
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

  // Открытие задачи из списка «Задачи»: подтягиваем задачу и её цели, возвращаемся
  // в конструктор. draft → таблица ревью целей; иначе (есть action-items) → запуск.
  const openReviewHandler = async (taskId: number) => {
    try {
      await taskStore.fetchTask(taskId)
      await targetStore.fetchTargets(taskId)
      builderStep.value = taskStore.currentTask?.status === 'draft' ? 'review' : 'launch'
      activeTab.value = 'builder'
    } catch {
      notifyError('Не удалось открыть задачу')
    }
  }

  const resetBuilderHandler = () => {
    parseProgress.leave()
    isParsing.value = false
    builderStep.value = 'configure'
    parsingStore.resetDraft()
    // resetDraft() обнуляет accountId — сразу возвращаем выбранный аккаунт в черновик,
    // иначе кнопка «Старт» останется заблокированной (canStartParse требует accountId).
    parsingStore.draft.accountId = accountId.value
    targetStore.clearTargets()
    taskStore.clearCurrentTask()
  }

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
    >
      <q-tab name="builder" icon="build" label="Конструктор" />
      <q-tab name="tasks" icon="list_alt" label="Задачи" />
      <q-tab name="settings" icon="tune" label="Настройки" />
    </q-tabs>

    <q-tab-panels v-model="activeTab" animated class="automation-page__panels">
      <!-- Конструктор -->
      <q-tab-panel name="builder" class="automation-page__panel">
        <AutomationBuilder
          v-if="builderStep === 'configure'"
          :account-id="accountId"
          @start="startParseHandler"
        />

        <div v-else-if="builderStep === 'review'" class="builder-step">
          <div class="builder-step__head">
            <ButtonComponent label="Назад к настройке" icon="arrow_back" flat @click="resetBuilderHandler" />
            <ButtonComponent
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
            @exclude="excludeTargetHandler"
            @restore="restoreTargetHandler"
          />
        </div>

        <div v-else class="builder-step">
          <div class="builder-step__head">
            <ButtonComponent label="Назад к отбору" icon="arrow_back" flat @click="builderStep = 'review'" />
          </div>
          <AutomationLaunchCockpit
            v-if="taskStore.currentTask"
            :task="taskStore.currentTask"
            :kept-count="keptCount"
            :loading="taskStore.startTaskLoading"
            @launch="launchTaskHandler"
          />
        </div>
      </q-tab-panel>

      <!-- Задачи -->
      <q-tab-panel name="tasks" class="automation-page__panel">
        <AutomationTaskList @open="openReviewHandler" />
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
</style>
