<script setup lang="ts">
  import { ACTION_TYPE_OPTIONS } from '@/entities/automation-action'
  import type { AutomationActionType } from '@/entities/automation-parsing'
  import { SegmentedControlComponent } from '@/shared/ui/segmented-control-component'

  const model = defineModel<AutomationActionType>({ required: true })
</script>

<template>
  <div class="action-type-select">
    <span class="action-type-select__label">Действие</span>
    <SegmentedControlComponent
      v-model="model"
      :options="ACTION_TYPE_OPTIONS"
    />
  </div>
</template>

<style scoped lang="scss">
  .action-type-select {
    display: flex;
    align-items: center;
    gap: $spacing-inline-gap;
  }

  .action-type-select__label {
    font-size: $font-size-sm;
    font-weight: $font-weight-medium;
    color: $content-secondary;
  }
</style>
