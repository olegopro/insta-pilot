<script setup lang="ts">
  import { computed } from 'vue'
  import type { MediaPost } from '@/entities/media-post'
  import { formatCount } from '@/shared/lib'
  import type { Nullable } from '@/shared/lib'

  const props = defineProps<{
    post: MediaPost
    isMock?: boolean
    isLiking?: (postId: string) => boolean
    loadingUserPk?: Nullable<string>
  }>()

  defineEmits(['open', 'like', 'openUser'])

  const isUserLoading = computed(() => props.loadingUserPk === props.post.user.pk)
</script>

<template>
  <div
    class="card"
    :class="{ mock: isMock }"
    @click="$emit('open', post)"
  >
    <div class="image-wrap">
      <img
        v-if="post.thumbnailUrl"
        :src="post.thumbnailUrl"
        :alt="post.captionText"
        class="image"
        loading="lazy"
      >
      <div v-else class="placeholder">
        <q-icon name="image" size="48px" color="grey-4" />
      </div>

      <div class="badges">
        <q-icon v-if="post.mediaType === 2" name="play_circle_filled" color="white" size="28px" />
        <q-icon v-else-if="post.mediaType === 8" name="collections" color="white" size="28px" />
      </div>

      <div class="overlay">
        <div class="stats">
          <span>
            <q-icon name="favorite" size="20px" />
            {{ formatCount(post.likeCount) }}
          </span>
          <span>
            <q-icon name="chat_bubble" size="20px" />
            {{ formatCount(post.commentCount) }}
          </span>
        </div>
        <q-btn
          v-if="!isMock"
          round
          size="md"
          :color="post.hasLiked ? 'red' : 'white'"
          :text-color="post.hasLiked ? 'white' : 'red'"
          :icon="post.hasLiked ? 'favorite' : 'favorite_border'"
          :loading="isLiking?.(post.id)"
          :disable="post.hasLiked"
          @click.stop="$emit('like', post)"
        />
      </div>
    </div>

    <div class="footer">
      <div
        class="user"
        :class="{ clickable: !isMock && !isUserLoading, loading: isUserLoading }"
        @click.stop="!isMock && !isUserLoading && $emit('openUser', post)"
        @selectstart="isUserLoading && $event.preventDefault()"
      >
        <q-avatar size="22px" class="q-mr-xs">
          <q-spinner v-if="isUserLoading" size="14px" color="primary" />
          <img v-else-if="post.user.profilePicUrl" :src="post.user.profilePicUrl">
          <q-icon v-else name="person" />
        </q-avatar>
        <span class="username">{{ post.user.username }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
  .card {
    cursor: pointer;
    border-radius: $radius-lg;
    overflow: hidden;
    background: $surface-tertiary;
    box-shadow: $elevation-card;
    transition: transform $transition-fast;

    &:hover {
      transform: translateY(-2px);

      .overlay {
        opacity: 1;
      }
    }

    &.mock {
      opacity: 0.7;
    }
  }

  .image-wrap {
    position: relative;
    overflow: hidden;
  }

  .image {
    width: 100%;
    display: block;
    object-fit: cover;
  }

  .placeholder {
    width: 100%;
    aspect-ratio: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    background: $neutral-300;
  }

  .badges {
    position: absolute;
    top: $indent-s;
    right: $indent-s;
    display: flex;
    gap: $indent-xs;
    filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.5));
  }

  .overlay {
    position: absolute;
    inset: 0;
    background: $overlay-dimmed;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: $spacing-stack-gap;
    padding: $indent-sm;
    opacity: 0;
    transition: opacity $transition-normal;
  }

  .stats {
    display: flex;
    gap: $indent-m;
    color: white;
    font-weight: $font-weight-semibold;
    font-size: $font-size-base;

    span {
      display: flex;
      align-items: center;
      gap: $indent-xs;
    }
  }

  .footer {
    padding: $indent-s $indent-sm;
  }

  .user {
    display: flex;
    align-items: center;
    gap: $indent-xs;
    min-width: 0;

    &.clickable {
      cursor: pointer;

      &:hover .username {
        text-decoration: underline;
      }
    }

    &.loading {
      cursor: wait;
      opacity: 0.6;
    }
  }

  .username {
    font-size: $font-size-sm;
    font-weight: $font-weight-medium;
    color: $content-primary;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
