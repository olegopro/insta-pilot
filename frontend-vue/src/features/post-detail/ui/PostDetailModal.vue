<script setup lang="ts">
  import { ref, computed } from 'vue'
  import type { MediaPost } from '@/entities/media-post'
  import { formatCount, formatDate } from '@/shared/lib'
  import type { Nullable } from '@/shared/lib'
  import { ModalComponent } from '@/shared/ui/modal-component'

  const props = defineProps<{
    post: MediaPost
    isLiking?: (postId: string) => boolean
    loadingUserPk?: Nullable<string>
  }>()

  const emit = defineEmits(['like', 'openUser'])

  const INFO_PANEL_WIDTH = '350px'

  const isOpen = defineModel<boolean>({ default: false })
  const carouselSlide = ref(0)

  const isUserLoading = computed(() => props.loadingUserPk === props.post.user.pk)

  const videoAspectRatio = computed(() =>
    props.post.videoWidth && props.post.videoHeight
      ? `${String(props.post.videoWidth)} / ${String(props.post.videoHeight)}`
      : '9 / 16'
  )

  const carouselStyle = computed(() => {
    const first = props.post.resources.at(0)
    const maxWidth = `calc(70vw - ${INFO_PANEL_WIDTH})`
    return first?.width && first.height
      ? {
        height: '100%',
        width: 'auto',
        maxWidth,
        aspectRatio: `${String(first.width)} / ${String(first.height)}`
      }
      : {
        width: maxWidth,
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
  <ModalComponent
    v-model="isOpen"
    inner-class="post-detail-modal__inner"
  >
    <div class="body">
      <div class="media">
        <video
          v-if="post.mediaType === 2 && post.videoUrl"
          :src="post.videoUrl"
          :style="{ aspectRatio: videoAspectRatio }"
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
        >
        <div v-else class="no-image">
          <q-icon name="image" size="64px" color="grey-4" />
        </div>
      </div>

      <div class="info">
        <div class="user" :class="{ loading: isUserLoading }" @click="!isUserLoading && emit('openUser', post)" @selectstart="isUserLoading && $event.preventDefault()">
          <q-avatar size="40px">
            <q-spinner v-if="isUserLoading" size="22px" color="primary" />
            <img v-else-if="post.user.profilePicUrl" :src="post.user.profilePicUrl">
            <q-icon v-else name="person" />
          </q-avatar>
          <div>
            <div class="text-weight-bold">{{ post.user.username }}</div>
            <div v-if="post.user.fullName" class="text-caption text-grey">{{ post.user.fullName }}</div>
          </div>
        </div>

        <p v-if="post.captionText">{{ post.captionText }}</p>

        <div class="meta text-caption text-grey">
          <span v-if="post.locationName">
            <q-icon name="location_on" size="14px" />
            {{ post.locationName }}
          </span>
          <span>{{ formatDate(post.takenAt) }}</span>
        </div>

        <div class="actions">
          <q-btn
            flat
            round
            :icon="post.hasLiked ? 'favorite' : 'favorite_border'"
            :color="post.hasLiked ? 'red' : 'grey-7'"
            :loading="isLiking?.(post.id)"
            :disable="post.hasLiked"
            @click="emit('like', post)"
          />
          <span>{{ formatCount(post.likeCount) }}</span>

          <q-icon name="chat_bubble_outline" color="grey-7" size="20px" class="q-ml-md" />
          <span>{{ formatCount(post.commentCount) }}</span>

          <template v-if="post.viewCount > 0">
            <q-icon name="play_arrow" color="grey-7" size="20px" class="q-ml-md" />
            <span>{{ formatCount(post.viewCount) }}</span>
          </template>
        </div>
      </div>
    </div>
  </ModalComponent>
</template>

<style>
  .modal-inner.post-detail-modal__inner {
    display: inline-flex;
    max-width: 70vw;
    height: 85vh;
    min-width: 0;
    padding: 0;
    flex-direction: column;
    overflow: hidden;
  }
</style>

<style lang="scss" scoped>
  $info-panel-width: 350px;

  .body {
    display: flex;
    flex: 1;
    min-height: 0;
    overflow: hidden;

    @media (max-width: 600px) {
      flex-direction: column;
      overflow-y: auto;
    }

    .media {
      flex: 0 0 auto;
      height: 85vh;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;

      video, img {
        height: 100%;
        width: auto;
        max-width: calc(70vw - $info-panel-width);
        display: block;
      }

      .no-image {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        height: 300px;
      }
    }

    .info {
      width: $info-panel-width;
      padding: 20px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 16px;
      border-left: 1px solid #eee;

      @media (max-width: 600px) {
        width: 100%;
        border-left: none;
        border-top: 1px solid #eee;
      }

      .user {
        display: flex;
        align-items: center;
        gap: 12px;
        cursor: pointer;

        &:hover {
          opacity: 0.8;
        }

        &.loading {
          cursor: wait;
          opacity: 0.6;
        }
      }

      p {
        margin: 0;
        font-size: 14px;
        line-height: 1.5;
        white-space: pre-wrap;
        word-break: break-word;
      }

      .meta {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .actions {
        display: flex;
        align-items: center;
        margin-top: auto;
        padding-top: 16px;
        border-top: 1px solid #eee;

        span {
          font-size: 14px;
          color: #555;
          margin-left: 4px;
        }
      }
    }
  }
</style>
