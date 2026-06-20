<script setup lang="ts">
  import { watch } from 'vue'
  import { useAutomationSettingsStore } from '@/entities/automation-settings'
  import { AutomationLimitsForm } from '@/features/configure-automation-limits'
  import { WorkingHoursModal } from '@/features/configure-working-hours'
  import { ButtonComponent } from '@/shared/ui/button-component'
  import { EmptyStateComponent } from '@/shared/ui/empty-state-component'
  import { notifyError, notifySuccess, useModal } from '@/shared/lib'
  import type { Nullable } from '@/shared/lib'

  const props = defineProps<{
    accountId: Nullable<number>
  }>()

  const settingsStore = useAutomationSettingsStore()
  const workingHoursModal = useModal()

  const loadSettings = (accountId: number) =>
    settingsStore.fetchSettings(accountId).catch(() => notifyError('Не удалось загрузить настройки'))

  const saveLimitsHandler = () => {
    if (!props.accountId) return
    settingsStore.saveLimits(props.accountId)
      .then(() => notifySuccess('Лимиты сохранены'))
      .catch(() => notifyError('Не удалось сохранить лимиты'))
  }

  const saveWorkingHoursHandler = () => {
    if (!props.accountId) return
    settingsStore.saveWorkingHours(props.accountId)
      .then(() => {
        notifySuccess('Рабочие часы сохранены')
        workingHoursModal.close()
      })
      .catch(() => notifyError('Не удалось сохранить рабочие часы'))
  }

  watch(() => props.accountId, (accountId) => accountId ? loadSettings(accountId) : settingsStore.resetSettings(), { immediate: true })
</script>

<template>
  <div class="account-settings">
    <EmptyStateComponent
      v-if="!accountId"
      icon="manage_accounts"
      text="Выберите аккаунт для настройки лимитов"
    />

    <template v-else>
      <section class="account-settings__section">
        <div class="account-settings__head">
          <h2 class="account-settings__title">Дневные лимиты</h2>
        </div>
        <AutomationLimitsForm
          v-model="settingsStore.limits"
          :loading="settingsStore.saveLimitsLoading"
          @save="saveLimitsHandler"
        />
      </section>

      <section class="account-settings__section">
        <div class="account-settings__head">
          <h2 class="account-settings__title">Рабочие часы</h2>
          <ButtonComponent
            label="Настроить"
            icon="schedule"
            color="primary"
            outline
            @click="workingHoursModal.open()"
          />
        </div>
        <p class="account-settings__hint">
          Расписание действий по дням недели и часам. Часовой пояс:
          <strong>{{ settingsStore.workingHours.timezone }}</strong>,
          {{ settingsStore.workingHours.isEnabled ? 'соблюдается' : 'отключено' }}.
        </p>
      </section>

      <WorkingHoursModal
        v-model="workingHoursModal.isVisible"
        v-model:working-hours="settingsStore.workingHours"
        :loading="settingsStore.saveWorkingHoursLoading"
        @save="saveWorkingHoursHandler"
      />
    </template>
  </div>
</template>

<style scoped lang="scss">
  .account-settings {
    display: flex;
    flex-direction: column;
    gap: $spacing-section-gap;
  }

  .account-settings__section {
    background: $surface-primary;
    border-radius: $radius-lg;
    padding: $spacing-card-padding;
    box-shadow: $elevation-card;
    border: $border-width-default $border-style-default $border-default;
  }

  .account-settings__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: $indent-m;
  }

  .account-settings__title {
    font-size: $font-size-md;
    font-weight: $font-weight-semibold;
    margin: 0;
  }

  .account-settings__hint {
    margin: 0;
    font-size: $font-size-sm;
    color: $content-secondary;
  }
</style>
