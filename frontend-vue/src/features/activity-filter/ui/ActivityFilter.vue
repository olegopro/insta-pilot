<script setup lang="ts">
  import { InputComponent } from '@/shared/ui/input-component'
  import { SelectComponent } from '@/shared/ui/select-component'
  import { ACTION_LABELS, STATUS_CONFIG } from '@/entities/activity-log'
  import type { ActivityFilters, ActionType, ActionStatus } from '@/entities/activity-log'

  interface Props {
    modelValue: ActivityFilters
  }

  const props = defineProps<Props>()

  const emit = defineEmits<{
    'update:modelValue': [filters: ActivityFilters]
    apply: []
  }>()

  const actionOptions = [
    { label: 'Все действия', value: null },
    ...Object.entries(ACTION_LABELS).map(([value, label]) => ({ label, value }))
  ]

  const statusOptions = [
    { label: 'Все статусы', value: null },
    ...Object.entries(STATUS_CONFIG).map(([value, config]) => ({ label: config.label, value }))
  ]

  const applyUpdate = (updated: ActivityFilters) => {
    emit('update:modelValue', updated)
    emit('apply')
  }

  const updateActionHandler = (val: ActionType | null) => {
    const updated = { ...props.modelValue }
    if (val) updated.action = val
    else delete updated.action
    applyUpdate(updated)
  }

  const updateStatusHandler = (val: ActionStatus | null) => {
    const updated = { ...props.modelValue }
    if (val) updated.status = val
    else delete updated.status
    applyUpdate(updated)
  }

  const updateDateFromHandler = (val: string | number | FileList | null | undefined) => {
    const updated = { ...props.modelValue }
    if (val && typeof val === 'string') updated.dateFrom = val
    else delete updated.dateFrom
    applyUpdate(updated)
  }

  const updateDateToHandler = (val: string | number | FileList | null | undefined) => {
    const updated = { ...props.modelValue }
    if (val && typeof val === 'string') updated.dateTo = val
    else delete updated.dateTo
    applyUpdate(updated)
  }
</script>

<template>
  <div class="row q-gutter-sm items-end">
    <SelectComponent
      :model-value="modelValue.action ?? null"
      :options="actionOptions"
      option-value="value"
      option-label="label"
      emit-value
      map-options
      label="Действие"
      dense
      outlined
      clearable
      style="min-width: 160px"
      @update:model-value="updateActionHandler"
    />

    <SelectComponent
      :model-value="modelValue.status ?? null"
      :options="statusOptions"
      option-value="value"
      option-label="label"
      emit-value
      map-options
      label="Статус"
      dense
      outlined
      clearable
      style="min-width: 160px"
      @update:model-value="updateStatusHandler"
    />

    <InputComponent
      :model-value="modelValue.dateFrom"
      type="date"
      label="Дата от"
      dense
      outlined
      style="min-width: 140px"
      @update:model-value="updateDateFromHandler"
    />

    <InputComponent
      :model-value="modelValue.dateTo"
      type="date"
      label="Дата до"
      dense
      outlined
      style="min-width: 140px"
      @update:model-value="updateDateToHandler"
    />
  </div>
</template>
