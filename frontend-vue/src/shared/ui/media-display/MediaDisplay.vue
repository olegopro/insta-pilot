<script setup lang="ts">
  import { computed, ref, watch } from 'vue'
  import { Swiper, SwiperSlide } from 'swiper/vue'
  import { Pagination, Mousewheel } from 'swiper/modules'
  import type { Swiper as SwiperClass } from 'swiper'
  import 'swiper/css'
  import 'swiper/css/pagination'
  import { MEDIA_TYPE } from '@/entities/media-post'
  import type { MediaPost } from '@/entities/media-post'
  import type { Nullable } from 'src/shared/lib'

  const props = defineProps<{
    post: MediaPost
    maxWidth: string
  }>()

  const carouselSlide = defineModel<number>('slide', { default: 0 })
  const swiperRef = ref<Nullable<SwiperClass>>(null)

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
    if (props.post.mediaType === MEDIA_TYPE.CAROUSEL && props.post.resources.length > 0) {
      return props.post.resources
        .map((resource) => resource.thumbnailUrl ?? '')
        .filter(Boolean)
    }
    return props.post.thumbnailUrl ? [props.post.thumbnailUrl] : []
  })

  let wheelLocked = false

  // Только колёсико физической мыши (deltaY >= 50) — трекпад генерирует мелкие непрерывные deltaY < 20
  const wheelHandler = (event: WheelEvent) => {
    const deltaX = Math.abs(event.deltaX)
    const deltaY = Math.abs(event.deltaY)
    if (deltaX >= deltaY || deltaY < 50 || !swiperRef.value || wheelLocked) return
    event.preventDefault()
    wheelLocked = true
    setTimeout(() => { wheelLocked = false }, 500)
    event.deltaY > 0 ? swiperRef.value.slideNext() : swiperRef.value.slidePrev()
  }

  const swiperInitHandler = (swiper: SwiperClass) => {
    swiperRef.value = swiper
    swiper.el.addEventListener('wheel', wheelHandler, { passive: false })
  }

  const slideChangeHandler = (swiper: SwiperClass) => carouselSlide.value = swiper.activeIndex

  watch(carouselSlide, (idx) => swiperRef.value?.activeIndex !== idx && swiperRef.value?.slideTo(idx))
  watch(() => props.post, () => swiperRef.value?.slideTo(0, 0))
</script>

<template>
  <video
    v-if="post.mediaType === MEDIA_TYPE.VIDEO && post.videoUrl"
    :src="post.videoUrl"
    :style="{ aspectRatio: videoAspectRatio, maxWidth, height: '100%', width: 'auto', display: 'block' }"
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
    :style="{ maxWidth, height: '100%', width: 'auto', display: 'block' }"
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
