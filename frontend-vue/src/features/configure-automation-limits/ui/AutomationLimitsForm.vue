<script setup lang="ts">
  import type { ActionLimit } from '@/entities/automation-settings'
  import { LIMIT_ACTION_LABELS } from '@/entities/automation-settings'
  import { InputComponent } from '@/shared/ui/input-component'
  import { ToggleComponent } from '@/shared/ui/toggle-component'
  import { ButtonComponent } from '@/shared/ui/button-component'

  defineProps<{
    loading?: boolean
  }>()

  const limits = defineModel<ActionLimit[]>({ required: true })

  defineEmits<{
    save: []
  }>()
</script>

<template>
  <div class="limits-form">
    <div
      v-for="limit in limits"
      :key="limit.action"
      class="limits-form__row"
    >
      <span class="limits-form__action">{{ LIMIT_ACTION_LABELS[limit.action] }}</span>

      <InputComponent
        v-model.number="limit.dailyLimit"
        type="number"
        label-text="В день"
        outlined
        dense
        min="0"
        class="limits-form__field"
      />

      <InputComponent
        v-model.number="limit.minActionSpacingSec"
        type="number"
        label-text="Интервал, сек"
        outlined
        dense
        min="0"
        class="limits-form__field"
      />

      <ToggleComponent v-model="limit.isActive" label="Активен" />
    </div>

    <div class="limits-form__footer">
      <ButtonComponent
        label="Сохранить лимиты"
        icon="save"
        color="primary"
        :loading="loading"
        @click="$emit('save')"
      />
    </div>
  </div>
</template>

<style scoped lang="scss">
  .limits-form {
    display: flex;
    flex-direction: column;
    gap: $spacing-stack-gap;
  }

  .limits-form__row {
    display: flex;
    align-items: center;
    gap: $spacing-inline-gap;
    flex-wrap: wrap;
  }

  .limits-form__action {
    min-width: 120px;
    font-weight: $font-weight-medium;
  }

  .limits-form__field {
    width: 140px;
  }

  .limits-form__footer {
    display: flex;
    justify-content: flex-end;
    margin-top: $indent-s;
  }
</style>
