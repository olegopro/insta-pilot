<script setup lang="ts">
  import { Swiper, SwiperSlide } from 'swiper/vue'
  import { Pagination, Mousewheel } from 'swiper/modules'
  import 'swiper/css'
  import 'swiper/css/pagination'
  import { MEDIA_TYPE } from '@/entities/media-post'
  import type { MediaPost } from '@/entities/media-post'
  import { useMediaStyle } from './useMediaStyle'
  import { useSwiperCarousel } from './useSwiperCarousel'

  const props = defineProps<{
    post: MediaPost
    maxWidth: string
    maxHeight: string
  }>()

  const carouselSlide = defineModel<number>('slide', { default: 0 })

  const {
    videoAspectRatio,
    videoMinWidth,
    imageAspectRatio,
    imageMinWidth,
    carouselStyle,
    displayImages
  } = useMediaStyle(
    () => props.post,
    () => props.maxWidth,
    () => props.maxHeight
  )

  const { swiperInitHandler, slideChangeHandler } = useSwiperCarousel(
    carouselSlide,
    () => props.post
  )
</script>

<template>
  <video
    v-if="post.mediaType === MEDIA_TYPE.VIDEO && post.videoUrl"
    :src="post.videoUrl"
    :style="{ aspectRatio: videoAspectRatio, maxWidth, maxHeight, minWidth: videoMinWidth, height: 'auto', width: 'auto', display: 'block' }"
    controls
  />
  <Swiper
    v-else-if="displayImages.length > 1"
    :modules="[Pagination, Mousewheel]"
    :slides-per-view="1"
    :pagination="{ clickable: true }"
    :mousewheel="{ forceToAxis: true, thresholdDelta: 50, thresholdTime: 500 }"
    :prevent-interaction-on-transition="true"
    :lazy-preload-prev-next="1"
    :initial-slide="carouselSlide"
    :style="carouselStyle"
    class="carousel-swiper"
    @swiper="swiperInitHandler"
    @slide-change="slideChangeHandler"
  >
    <SwiperSlide v-for="(imgUrl, index) in displayImages" :key="index">
      <img :src="imgUrl" :alt="post.captionText" loading="lazy" draggable="false">
    </SwiperSlide>
  </Swiper>
  <img
    v-else-if="displayImages.length === 1"
    :src="displayImages[0]"
    :alt="post.captionText"
    :style="{ aspectRatio: imageAspectRatio, maxWidth, maxHeight, minWidth: imageMinWidth, height: 'auto', width: 'auto', display: 'block' }"
  >
  <div v-else class="no-image">
    <q-icon name="image" size="64px" color="grey-4" />
  </div>
</template>

<style scoped lang="scss">
  .no-image {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 300px;
  }

  .carousel-swiper {
    display: block;
    overscroll-behavior-x: contain;
    touch-action: pan-y;
  }

  .carousel-swiper :deep(.swiper-slide) {
    height: 101%;
  }

  .carousel-swiper :deep(.swiper-slide img) {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
    pointer-events: none;
    user-select: none;
  }

  .carousel-swiper :deep(.swiper-pagination-bullet) {
    width: $indent-m;
    height: $indent-m;
    background: $overlay-light;
    opacity: 1;
  }

  .carousel-swiper :deep(.swiper-pagination-bullet-active) {
    background: white;
  }
</style>
