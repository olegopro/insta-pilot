<script setup lang="ts">
  import { computed } from 'vue'

  const props = defineProps<{ columns?: number }>()
  const columnCount = computed(() => props.columns ?? 3)
</script>

<template>
  <div class="masonry-grid">
    <slot />
  </div>
</template>

<style scoped lang="scss">
  .masonry-grid {
    column-count: v-bind(columnCount);
    column-gap: 12px;

    @media (max-width: 900px) {
      column-count: 2;
    }

    @media (max-width: 600px) {
      column-count: 1;
    }

    :deep(> *) {
      break-inside: avoid;
      margin-bottom: 12px;
    }
  }
</style>
