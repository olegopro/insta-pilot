<script setup lang="ts">
  import type { CommentActionConfig } from '@/entities/automation-task'
  import { TONES } from '@/entities/llm-settings'
  import { SelectComponent } from '@/shared/ui/select-component'
  import { InputComponent } from '@/shared/ui/input-component'
  import { ToggleComponent } from '@/shared/ui/toggle-component'

  const model = defineModel<CommentActionConfig>({ required: true })
</script>

<template>
  <div class="comment-action-config">
    <div class="field">
      <span class="field__label">Тон комментария</span>
      <SelectComponent
        v-model="model.tone"
        :options="TONES"
        option-label="label"
        option-value="value"
        emit-value
        map-options
        outlined
        dense
        clearable
        label="По умолчанию (из настроек LLM)"
      />
    </div>

    <div class="field">
      <span class="field__label">Шаблон / подсказка (необязательно)</span>
      <InputComponent
        v-model="model.template"
        type="textarea"
        outlined
        dense
        autogrow
        placeholder="Доп. инструкция для генерации комментария"
      />
    </div>

    <ToggleComponent v-model="model.useCaption" label="Учитывать описание поста при генерации" />
  </div>
</template>

<style scoped lang="scss">
  .comment-action-config {
    display: flex;
    flex-direction: column;
    gap: $spacing-stack-gap;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: $indent-2xs;
  }

  .field__label {
    font-size: $font-size-sm;
    color: $content-secondary;
  }
</style>
