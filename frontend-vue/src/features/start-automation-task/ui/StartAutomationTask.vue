<script setup lang="ts">
  import { MODE_OPTIONS } from '@/entities/automation-parsing'
  import type { AutomationMode } from '@/entities/automation-parsing'
  import { SegmentedControlComponent } from '@/shared/ui/segmented-control-component'
  import { ButtonComponent } from '@/shared/ui/button-component'

  defineProps<{
    canStart: boolean
    loading?: boolean
    startLabel?: string
  }>()

  const mode = defineModel<AutomationMode>('mode', { required: true })

  defineEmits<{
    start: []
  }>()
</script>

<template>
  <div class="start-task">
    <div class="start-task__mode">
      <span class="start-task__label">Режим</span>
      <SegmentedControlComponent
        v-model="mode"
        :options="MODE_OPTIONS"
      />
    </div>

    <ButtonComponent
      :label="startLabel ?? 'Старт парсинга'"
      icon="play_arrow"
      color="primary"
      :loading="loading"
      :disable="!canStart"
      @click="$emit('start')"
    />
  </div>
</template>

<style scoped lang="scss">
  .start-task {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: $spacing-section-gap;
    flex-wrap: wrap;
  }

  .start-task__mode {
    display: flex;
    align-items: center;
    gap: $spacing-inline-gap;
  }

  .start-task__label {
    font-size: $font-size-sm;
    font-weight: $font-weight-medium;
    color: $content-secondary;
  }
</style>
