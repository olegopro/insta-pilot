<script setup lang="ts">
  import { ref, computed } from 'vue'
  import type { MediaPost } from '@/entities/media-post'
  import { formatCount } from '@/shared/lib'
  import { ModalComponent } from '@/shared/ui/modal-component'

  const props = defineProps<{
    post: MediaPost
    isLiking?: (postId: string) => boolean
  }>()

  const emit = defineEmits(['like', 'openUser'])

  const isOpen = defineModel<boolean>({ default: false })
  const carouselSlide = ref(0)

  const formatDate = (iso: string): string => {
    if (!iso) return ''
    return new Date(iso).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })
  }

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
    <q-bar class="post-detail__bar">
      <q-space />
      <q-btn flat round dense icon="close" @click="isOpen = false" />
    </q-bar>

    <div class="post-detail__body">
      <div class="post-detail__media">
        <video
          v-if="post.mediaType === 2 && post.videoUrl"
          :src="post.videoUrl"
          class="post-detail__video"
          controls
        />
        <q-carousel
          v-else-if="displayImages.length > 1"
          v-model="carouselSlide"
          animated
          arrows
          navigation
          swipeable
          class="post-detail__carousel"
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
          class="post-detail__image"
          :alt="post.captionText"
        >
        <div v-else class="post-detail__no-image">
          <q-icon name="image" size="64px" color="grey-4" />
        </div>
      </div>

      <div class="post-detail__info">
        <div class="post-detail__user" @click="emit('openUser', post)">
          <q-avatar size="40px">
            <img v-if="post.user.profilePicUrl" :src="post.user.profilePicUrl">
            <q-icon v-else name="person" />
          </q-avatar>
          <div>
            <div class="text-weight-bold">{{ post.user.username }}</div>
            <div v-if="post.user.fullName" class="text-caption text-grey">{{ post.user.fullName }}</div>
          </div>
        </div>

        <p v-if="post.captionText" class="post-detail__caption">{{ post.captionText }}</p>

        <div class="post-detail__meta text-caption text-grey">
          <span v-if="post.locationName">
            <q-icon name="location_on" size="14px" />
            {{ post.locationName }}
          </span>
          <span>{{ formatDate(post.takenAt) }}</span>
        </div>

        <div class="post-detail__actions">
          <q-btn
            flat
            round
            :icon="post.hasLiked ? 'favorite' : 'favorite_border'"
            :color="post.hasLiked ? 'red' : 'grey-7'"
            :loading="isLiking?.(post.id)"
            @click="emit('like', post)"
          />
          <span class="post-detail__stat">{{ formatCount(post.likeCount) }}</span>

          <q-icon name="chat_bubble_outline" color="grey-7" size="20px" class="q-ml-md" />
          <span class="post-detail__stat">{{ formatCount(post.commentCount) }}</span>

          <template v-if="post.viewCount > 0">
            <q-icon name="play_arrow" color="grey-7" size="20px" class="q-ml-md" />
            <span class="post-detail__stat">{{ formatCount(post.viewCount) }}</span>
          </template>
        </div>
      </div>
    </div>
  </ModalComponent>
</template>

<style>
  .post-detail-modal__inner {
    width: 70vw;
    height: 85vh;
    min-width: unset;
    padding: 0;
    display: flex;
    flex-direction: column;
  }
</style>

<style scoped>
  .post-detail__bar {
    background: white;
    border-bottom: 1px solid #eee;
  }

  .post-detail__body {
    display: flex;
    gap: 0;
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }

  @media (max-width: 600px) {
    .post-detail__body {
      flex-direction: column;
      overflow-y: auto;
    }
  }

  .post-detail__media {
    flex: 1;
    min-height: 0;
    background: #000;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .post-detail__carousel {
    width: 100%;
    height: 100%;
  }

  .post-detail__video {
    max-width: 100%;
    max-height: 100%;
  }

  .post-detail__image {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
  }

  .post-detail__no-image {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 300px;
  }

  .post-detail__info {
    width: 350px;
    padding: 20px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 16px;
    border-left: 1px solid #eee;
  }

  @media (max-width: 600px) {
    .post-detail__info {
      width: 100%;
      border-left: none;
      border-top: 1px solid #eee;
    }
  }

  .post-detail__user {
    display: flex;
    align-items: center;
    gap: 12px;
    cursor: pointer;
  }

  .post-detail__user:hover {
    opacity: 0.8;
  }

  .post-detail__caption {
    margin: 0;
    font-size: 14px;
    line-height: 1.5;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .post-detail__meta {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .post-detail__actions {
    display: flex;
    align-items: center;
    margin-top: auto;
    padding-top: 8px;
    border-top: 1px solid #eee;
  }

  .post-detail__stat {
    font-size: 14px;
    color: #555;
    margin-left: 4px;
  }
</style>
