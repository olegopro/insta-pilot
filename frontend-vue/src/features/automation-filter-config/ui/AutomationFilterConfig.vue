<script setup lang="ts">
  import { computed } from 'vue'
  import type { AutomationFilters } from '@/entities/automation-parsing'
  import { NumberRangeComponent } from '@/shared/ui/number-range-component'
  import { ChipsInputComponent } from '@/shared/ui/chips-input-component'
  import { InputComponent } from '@/shared/ui/input-component'
  import { ToggleComponent } from '@/shared/ui/toggle-component'
  import { BadgeComponent } from '@/shared/ui/badge-component'
  import {
    countAudienceFields,
    countContentFields,
    countKeywordFields
  } from '@/features/automation-filter-config/lib/countActiveFields'

  const model = defineModel<AutomationFilters>({ required: true })

  const audienceBadge = computed(() => countAudienceFields(model.value.audience))
  const contentBadge = computed(() => countContentFields(model.value.content))
  const keywordsBadge = computed(() => countKeywordFields(model.value.keywords))
</script>

<template>
  <div class="filter-config">
    <!-- Аудитория -->
    <q-expansion-item class="filter-group" expand-separator icon="group">
      <template #header>
        <q-item-section>Аудитория</q-item-section>
        <q-item-section side>
          <BadgeComponent
            v-if="audienceBadge > 0"
            :label="String(audienceBadge)"
            color="primary"
            size="sm"
          />
        </q-item-section>
      </template>

      <div class="filter-group__body">
        <ToggleComponent v-model="model.audience.enabled" label="Фильтровать по аудитории" />
        <template v-if="model.audience.enabled">
          <div class="field">
            <span class="field__label">Подписчики</span>
            <NumberRangeComponent v-model="model.audience.followers" />
          </div>
          <div class="field">
            <span class="field__label">Подписки</span>
            <NumberRangeComponent v-model="model.audience.following" />
          </div>
        </template>
      </div>
    </q-expansion-item>

    <!-- Анализ контента -->
    <q-expansion-item class="filter-group" expand-separator icon="insights">
      <template #header>
        <q-item-section>Анализ контента</q-item-section>
        <q-item-section side>
          <BadgeComponent
            v-if="contentBadge > 0"
            :label="String(contentBadge)"
            color="primary"
            size="sm"
          />
        </q-item-section>
      </template>

      <div class="filter-group__body">
        <ToggleComponent v-model="model.content.enabled" label="Фильтровать по контенту" />
        <template v-if="model.content.enabled">
          <div class="field">
            <span class="field__label">Последний пост не старше (дней)</span>
            <InputComponent
              v-model.number="model.content.lastPostMaxAgeDays"
              type="number"
              outlined
              dense
              min="0"
            />
          </div>
          <div class="field">
            <span class="field__label">Сумма лайков (мин)</span>
            <InputComponent
              v-model.number="model.content.likesSumMin"
              type="number"
              outlined
              dense
              min="0"
            />
          </div>
          <div class="field">
            <span class="field__label">Среднее лайков за N постов</span>
            <NumberRangeComponent v-model="model.content.avgLikes" />
          </div>
        </template>
      </div>
    </q-expansion-item>

    <!-- Ключевые слова -->
    <q-expansion-item class="filter-group" expand-separator icon="key">
      <template #header>
        <q-item-section>Ключевые слова</q-item-section>
        <q-item-section side>
          <BadgeComponent
            v-if="keywordsBadge > 0"
            :label="String(keywordsBadge)"
            color="primary"
            size="sm"
          />
        </q-item-section>
      </template>

      <div class="filter-group__body">
        <ToggleComponent v-model="model.keywords.enabled" label="Фильтровать по словам" />
        <template v-if="model.keywords.enabled">
          <div class="field">
            <span class="field__label">Белый список</span>
            <ChipsInputComponent v-model="model.keywords.whitelist" outlined dense />
          </div>
          <div class="field">
            <span class="field__label">Чёрный список</span>
            <ChipsInputComponent v-model="model.keywords.blacklist" outlined dense />
          </div>
        </template>
      </div>
    </q-expansion-item>
  </div>
</template>

<style scoped lang="scss">
  .filter-config {
    display: flex;
    flex-direction: column;
    gap: $spacing-stack-gap;
  }

  .filter-group {
    border: $border-width-default $border-style-default $border-default;
    border-radius: $radius-md;
    overflow: hidden;
  }

  .filter-group__body {
    display: flex;
    flex-direction: column;
    gap: $spacing-stack-gap;
    padding: $indent-m;
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
