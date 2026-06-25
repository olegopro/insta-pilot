<script setup lang="ts">
  import type { ShowcaseMedia } from '@/entities/showcase-media/model/types'
  import { MEDIA_TYPE } from '@/entities/media-post'

  defineProps<{
    media: ShowcaseMedia
    selected?: boolean
  }>()
</script>

<template>
  <div
    class="showcase-tile"
    :class="{ 'is-hidden': media.overlay.isHiddenLocal, 'is-selected': selected }"
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

    <div v-if="media.overlay.isHiddenLocal" class="hidden-overlay">
      <q-icon name="visibility_off" color="white" size="22px" />
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

    <q-icon
      v-if="media.overlay.note"
      name="sticky_note_2"
      color="white"
      size="16px"
      class="badge badge-note"
    >
      <q-tooltip>{{ media.overlay.note }}</q-tooltip>
    </q-icon>
  </div>
</template>

<style scoped lang="scss">
  .showcase-tile {
    position: relative;
    width: 100%;
    aspect-ratio: 1;
    overflow: hidden;
    background: $surface-tertiary;
    transition: filter $transition-fast, box-shadow $transition-fast;

    &.is-hidden {
      filter: grayscale(1) brightness(0.55);
    }

    &.is-selected {
      box-shadow: inset 0 0 0 3px $primary;
    }
  }

  .thumbnail {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
    transition: transform $transition-fast;
  }

  .showcase-tile:hover .thumbnail {
    transform: scale(1.03);
  }

  .placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: $neutral-300;
  }

  .hidden-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
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

  .badge-note {
    bottom: $indent-xs;
    left: $indent-xs;
  }
</style>
