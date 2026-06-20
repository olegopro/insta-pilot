<script setup lang="ts">
  import type { WorkingHours } from '@/entities/automation-settings'
  import { ModalComponent } from '@/shared/ui/modal-component'
  import { WorkingHoursGrid } from '@/shared/ui/working-hours-grid'
  import { ToggleComponent } from '@/shared/ui/toggle-component'
  import { SelectComponent } from '@/shared/ui/select-component'

  defineProps<{
    loading?: boolean
  }>()

  const visible = defineModel<boolean>({ required: true })
  const workingHours = defineModel<WorkingHours>('workingHours', { required: true })

  const emit = defineEmits<{
    save: []
  }>()

  // Распространённые TZ для расписания (единый TZ окна и границы суток лимита).
  const TIMEZONE_OPTIONS = [
    'UTC',
    'Europe/Moscow',
    'Europe/Kyiv',
    'Europe/London',
    'Asia/Almaty',
    'Asia/Yekaterinburg',
    'America/New_York'
  ]

  const submitHandler = () => emit('save')
</script>

<template>
  <ModalComponent
    v-model="visible"
    title="Рабочие часы"
    icon="schedule"
    submit-label="Сохранить"
    reset-label="Отмена"
    :submit-loading="loading"
    inner-class="working-hours-modal"
    @submit="submitHandler"
    @reset="visible = false"
  >
    <div class="working-hours-modal__controls">
      <ToggleComponent v-model="workingHours.isEnabled" label="Соблюдать рабочие часы" />
      <SelectComponent
        v-model="workingHours.timezone"
        :options="TIMEZONE_OPTIONS"
        label="Часовой пояс"
        outlined
        dense
        style="min-width: 200px"
      />
    </div>

    <WorkingHoursGrid
      v-model="workingHours.schedule"
      :disable="!workingHours.isEnabled"
      class="q-mt-md"
    />
  </ModalComponent>
</template>

<style scoped lang="scss">
  :global(.working-hours-modal) {
    min-width: 720px;
    max-width: 96vw;
  }

  .working-hours-modal__controls {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: $spacing-section-gap;
    flex-wrap: wrap;
  }
</style>
