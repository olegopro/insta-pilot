<script setup lang="ts">
  import type { Nullable } from '@/shared/lib'
  import { InputComponent } from '@/shared/ui/input-component'

  // Пара числовых полей min/max. v-model — кортеж [min, max], где каждое значение
  // nullable (пустое поле = ограничение не задано).
  export interface NumberRangeValue {
    min: Nullable<number>
    max: Nullable<number>
  }

  export interface NumberRangeComponentProps {
    minLabel?: string
    maxLabel?: string
    minPlaceholder?: string
    maxPlaceholder?: string
    disable?: boolean
  }

  withDefaults(defineProps<NumberRangeComponentProps>(), {
    minLabel: 'От',
    maxLabel: 'До',
    minPlaceholder: 'мин',
    maxPlaceholder: 'макс'
  })

  const model = defineModel<NumberRangeValue>({ default: () => ({ min: null, max: null }) })

  // QInput пробрасывает string | number | FileList | null | undefined; FileList игнорируем.
  const parseValue = (raw: string | number | FileList | null | undefined): Nullable<number> => {
    if (raw === null || raw === '' || raw === undefined || raw instanceof FileList) return null
    const parsed = Number(raw)
    return Number.isFinite(parsed) ? parsed : null
  }

  const updateMinHandler = (raw: string | number | FileList | null | undefined) =>
    model.value = { min: parseValue(raw), max: model.value.max }

  const updateMaxHandler = (raw: string | number | FileList | null | undefined) =>
    model.value = { min: model.value.min, max: parseValue(raw) }
</script>

<template>
  <div class="number-range">
    <InputComponent
      :model-value="model.min"
      type="number"
      :label-text="minLabel"
      :placeholder="minPlaceholder"
      :disable="disable"
      outlined
      dense
      min="0"
      @update:model-value="updateMinHandler"
    />
    <span class="number-range__dash">—</span>
    <InputComponent
      :model-value="model.max"
      type="number"
      :label-text="maxLabel"
      :placeholder="maxPlaceholder"
      :disable="disable"
      outlined
      dense
      min="0"
      @update:model-value="updateMaxHandler"
    />
  </div>
</template>

<style scoped lang="scss">
  .number-range {
    display: flex;
    align-items: center;
    gap: $spacing-inline-gap;

    :deep(.ui-input) {
      flex: 1;
    }
  }

  .number-range__dash {
    color: $content-secondary;
  }
</style>
