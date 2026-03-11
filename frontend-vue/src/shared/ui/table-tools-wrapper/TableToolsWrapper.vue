<script setup lang="ts">
  import type { QTableColumn } from 'quasar'
  import { InputComponent } from '@/shared/ui/input-component'
  import ColumnSelector from '@/shared/ui/table-tools-wrapper/ColumnSelector.vue'

  defineProps<{ searchPlaceholder?: string }>()

  const search = defineModel<string>('search', { default: '' })
  const columns = defineModel<QTableColumn[]>('columns')
  const columnsVisibleNames = defineModel<string[]>('columnsVisibleNames')
</script>

<template>
  <div class="table-tools">
    <InputComponent
      v-model="search"
      :placeholder="searchPlaceholder ?? 'Поиск'"
      clearable
    >
      <template #append>
        <q-icon name="search" />
      </template>
    </InputComponent>

    <div class="table-tools__controls">
      <slot name="tools" />
      <ColumnSelector
        v-if="columns && columnsVisibleNames"
        v-model="columnsVisibleNames"
        :columns="columns"
      />
    </div>
  </div>

  <slot />
</template>

<style scoped lang="scss">
  .table-tools {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 12px;

    &__controls {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-left: auto;
    }
  }
</style>
