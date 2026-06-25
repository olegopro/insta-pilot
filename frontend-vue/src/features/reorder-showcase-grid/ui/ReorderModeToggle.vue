<script setup lang="ts">
  import { ToggleComponent } from '@/shared/ui/toggle-component'

  const model = defineModel<boolean>({ default: false })
</script>

<template>
  <ToggleComponent
    v-model="model"
    icon="swap_horiz"
    label="Перестановка плиток"
    color="primary"
  />
</template>
