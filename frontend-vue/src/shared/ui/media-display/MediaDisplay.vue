<script setup lang="ts">
  import { ref, computed } from 'vue'
  import type { MediaPost } from '@/entities/media-post'

  const props = defineProps<{
    post: MediaPost
    maxWidth: string
  }>()

  const carouselSlide = ref(0)

  const videoAspectRatio = computed(() =>
    props.post.videoWidth && props.post.videoHeight
      ? `${String(props.post.videoWidth)} / ${String(props.post.videoHeight)}`
      : '9 / 16'
  )

  const carouselStyle = computed(() => {
    const first = props.post.resources.at(0)
    return first?.width && first.height
      ? {
        height: '100%',
        width: 'auto',
        maxWidth: props.maxWidth,
        aspectRatio: `${String(first.width)} / ${String(first.height)}`
      }
      : {
        width: props.maxWidth,
        height: '100%'
      }
  })

  const displayImages = computed(() => {
    if (props.post.mediaType === 8 && props.post.resources.length > 0) {
      return props.post.resources
        .map((resource) => resource.thumbnailUrl ?? '')
        .filter(Boolean)
    }
    return props.post.thumbnailUrl ? [props.post.thumbnailUrl] : []
  })
</script>

<template>
  <video
    v-if="post.mediaType === 2 && post.videoUrl"
    :src="post.videoUrl"
    :style="{ aspectRatio: videoAspectRatio, maxWidth, height: '100%', width: 'auto', display: 'block' }"
    controls
  />
  <q-carousel
    v-else-if="displayImages.length > 1"
    v-model="carouselSlide"
    transition-prev="slide-right"
    transition-next="slide-left"
    animated
    arrows
    navigation
    swipeable
    :style="carouselStyle"
  >
    <q-carousel-slide
      v-for="(imgUrl, idx) in displayImages"
      :key="idx"
      :name="idx"
      :img-src="imgUrl"
    />
  </q-carousel>
  <img
    v-else-if="displayImages.length === 1"
    :src="displayImages[0]"
    :alt="post.captionText"
    :style="{ maxWidth, height: '100%', width: 'auto', display: 'block' }"
  >
  <div v-else class="no-image">
    <q-icon name="image" size="64px" color="grey-4" />
  </div>
</template>

<style scoped>
  .no-image {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 300px;
  }
</style>
