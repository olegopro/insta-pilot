<script setup lang="ts">
  import type { ShowcaseMedia } from '@/entities/showcase-media'
  import { MEDIA_TYPE } from '@/entities/media-post'

  defineProps<{
    posts: ShowcaseMedia[]
  }>()

  defineEmits<{
    open: [media: ShowcaseMedia]
  }>()
</script>

<template>
  <div class="showcase-grid">
    <button
      v-for="media in posts"
      :key="media.post.pk"
      type="button"
      class="grid-item"
      @click="$emit('open', media)"
    >
      <img
        v-if="media.post.thumbnailUrl"
        :src="media.post.thumbnailUrl"
        :alt="media.post.captionText"
        class="thumbnail"
        loading="eager"
      >
      <div v-else class="placeholder">
        <q-icon name="image" size="32px" color="grey-4" />
      </div>

      <q-icon
        v-if="media.isPinned"
        name="push_pin"
        color="white"
        size="18px"
        class="badge badge-pinned"
      />

      <q-icon
        v-if="media.post.mediaType === MEDIA_TYPE.VIDEO"
        name="play_circle_filled"
        color="white"
        size="20px"
        class="badge badge-type"
      />
      <q-icon
        v-else-if="media.post.mediaType === MEDIA_TYPE.CAROUSEL"
        name="collections"
        color="white"
        size="20px"
        class="badge badge-type"
      />
    </button>
  </div>
</template>

<style scoped lang="scss">
  .showcase-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 2px;
  }

  .grid-item {
    position: relative;
    width: 100%;
    aspect-ratio: 1;
    padding: 0;
    border: none;
    cursor: pointer;
    background: $surface-tertiary;
    overflow: hidden;

    &:hover .thumbnail {
      transform: scale(1.03);
    }
  }

  .thumbnail {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
    transition: transform $transition-fast;
  }

  .placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: $neutral-300;
  }

  .badge {
    position: absolute;
    filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.5));
  }

  .badge-pinned {
    top: $indent-xs;
    left: $indent-xs;
  }

  .badge-type {
    top: $indent-xs;
    right: $indent-xs;
  }
</style>
