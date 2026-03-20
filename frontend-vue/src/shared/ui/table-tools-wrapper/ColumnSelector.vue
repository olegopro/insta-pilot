<script setup lang="ts">
  import type { QTableColumn } from 'quasar'
  import { ButtonComponent } from '@/shared/ui/button-component'

  defineProps<{ columns: QTableColumn[] }>()

  const columnsVisibleNames = defineModel<string[]>({ required: true })
</script>

<template>
  <ButtonComponent flat round dense icon="view_column">
    <q-menu anchor="bottom end" self="top end" :offset="[0, 8]">
      <q-list dense style="min-width: 160px">
        <q-item
          v-for="col in columns"
          :key="col.name"
          tag="label"
          clickable
        >
          <q-item-section side>
            <q-checkbox v-model="columnsVisibleNames" :val="col.name" dense />
          </q-item-section>
          <q-item-section>
            <q-item-label>{{ col.label }}</q-item-label>
          </q-item-section>
        </q-item>
      </q-list>
    </q-menu>
  </ButtonComponent>
</template>

<style lang="scss" scoped>
  .q-item{
    height: $indent-m + $indent-2xl;
    // background-color: $accent;
  }
</style>
