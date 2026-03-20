<script setup lang="ts">
  export interface EmptyStateComponentProps {
    icon: string
    text: string
    iconSize?: string
  }

  withDefaults(defineProps<EmptyStateComponentProps>(), {
    iconSize: '96px'
  })
</script>

<template>
  <div class="empty-state-component">
    <q-icon :name="icon" :size="iconSize" />
    <p class="text">{{ text }}</p>
  </div>
</template>

<style scoped lang="scss">
    .empty-state-component {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: $indent-ml;
    color: $content-tertiary;
  }

  .text {
    font-size: $font-size-2xl;
  }
</style>
