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

  const accountId = computed(() => selectedAccount.value?.id ?? null)
  const keptCount = computed(() => targetStore.keptTargets.length)

  // Старт парсинга: создаёт задачу из черновика и запускает парсинг источника.
  const startParseHandler = () => {
    if (!accountId.value) return
    parsingStore.draft.accountId = accountId.value
    parsingStore.startParse()
      .then((task) => {
        notifySuccess('Парсинг запущен')
        return targetStore.fetchTargets(task.id)
      })
      .then(() => builderStep.value = parsingStore.draft.mode === 'full_auto' ? 'launch' : 'review')
      .catch((error: unknown) => isCancelledRequest(error) || notifyError('Не удалось запустить парсинг'))
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

  const launchTaskHandler = () => {
    const taskId = taskStore.currentTask?.id
    if (!taskId) return
    taskStore.startTask(taskId)
      .then(() => {
        notifySuccess('Задача запущена')
        builderStep.value = 'configure'
        parsingStore.resetDraft()
        targetStore.clearTargets()
        taskStore.clearCurrentTask()
        activeTab.value = 'tasks'
      })
      .catch(() => notifyError('Не удалось запустить задачу'))
  }

  const resetBuilderHandler = () => {
    builderStep.value = 'configure'
    parsingStore.resetDraft()
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
              :disable="keptCount === 0"
              @click="goToLaunchHandler"
            />
          </div>
          <AutomationTargetsView
            :targets="targetStore.targets"
            :loading="targetStore.fetchTargetsLoading"
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
        <AutomationTaskList />
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
