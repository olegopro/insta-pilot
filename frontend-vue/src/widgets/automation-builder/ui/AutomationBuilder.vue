<script setup lang="ts">
  import { computed } from 'vue'
  import { useAutomationParsingStore } from '@/entities/automation-parsing'
  import { TARGET_COUNT_MAX, TARGET_COUNT_MIN } from '@/entities/automation-parsing'
  import type { Nullable } from '@/shared/lib'
  import { AutomationSourceConfig } from '@/features/automation-source-config'
  import { AutomationFilterConfig } from '@/features/automation-filter-config'
  import { StartAutomationTask } from '@/features/start-automation-task'
  import { InputComponent } from '@/shared/ui/input-component'

  defineProps<{
    accountId: Nullable<number>
  }>()

  const emit = defineEmits<{
    start: []
  }>()

  const parsingStore = useAutomationParsingStore()

  const startLabel = computed(() =>
    parsingStore.draft.mode === 'full_auto' ? 'Старт (авто)' : 'Старт парсинга')

  const startHandler = () => emit('start')
</script>

<template>
  <div class="builder">
    <section class="builder__section">
      <h2 class="builder__title">Источник</h2>
      <AutomationSourceConfig v-model="parsingStore.draft.source" :account-id="accountId" />
    </section>

    <section class="builder__section">
      <h2 class="builder__title">Фильтры отбора</h2>
      <AutomationFilterConfig v-model="parsingStore.draft.filters" />
    </section>

    <footer class="builder__footer">
      <div class="builder__count">
        <span class="builder__count-label">Собрать целей</span>
        <InputComponent
          v-model.number="parsingStore.draft.targetCount"
          type="number"
          outlined
          dense
          :min="TARGET_COUNT_MIN"
          :max="TARGET_COUNT_MAX"
          style="width: 120px"
        />
      </div>

      <StartAutomationTask
        v-model:mode="parsingStore.draft.mode"
        :can-start="parsingStore.canStartParse && !!accountId"
        :loading="parsingStore.startParseLoading"
        :start-label="startLabel"
        @start="startHandler"
      />
    </footer>
  </div>
</template>

<style scoped lang="scss">
  .builder {
    display: flex;
    flex-direction: column;
    gap: $spacing-section-gap;
  }

  .builder__section {
    background: $surface-primary;
    border-radius: $radius-lg;
    padding: $spacing-card-padding;
    box-shadow: $elevation-card;
    border: $border-width-default $border-style-default $border-default;
  }

  .builder__title {
    font-size: $font-size-md;
    font-weight: $font-weight-semibold;
    margin: 0 0 $indent-m;
  }

  .builder__footer {
    position: sticky;
    bottom: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: $spacing-section-gap;
    flex-wrap: wrap;
    background: $surface-primary;
    border-radius: $radius-lg;
    padding: $spacing-card-padding;
    box-shadow: $elevation-card;
    border: $border-width-default $border-style-default $border-default;
  }

  .builder__count {
    display: flex;
    align-items: center;
    gap: $spacing-inline-gap;
  }

  .builder__count-label {
    font-size: $font-size-sm;
    font-weight: $font-weight-medium;
    color: $content-secondary;
  }
</style>
