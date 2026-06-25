<script setup lang="ts">
  import { ShowcaseTile } from '@/entities/showcase-media'
  import type { ShowcaseMedia } from '@/entities/showcase-media'

  defineProps<{
    posts: ShowcaseMedia[]
    selectedPk?: string
  }>()

  defineEmits<{
    open: [media: ShowcaseMedia]
    select: [media: ShowcaseMedia]
  }>()
</script>

<template>
  <div class="showcase-grid">
    <button
      v-for="media in posts"
      :key="media.post.pk"
      type="button"
      class="grid-cell"
      @click="$emit('select', media)"
      @dblclick="$emit('open', media)"
    >
      <ShowcaseTile :media="media" :selected="media.post.pk === selectedPk" />
    </button>
  </div>
</template>

<style scoped lang="scss">
  .showcase-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 2px;
  }

  .grid-cell {
    padding: 0;
    border: none;
    cursor: pointer;
    background: none;
  }
</style>
