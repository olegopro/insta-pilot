<script setup lang="ts">
  import type { PostComment } from '@/entities/media-post'
  import { formatRelativeTime, formatCount } from '@/shared/lib'
  import { ButtonComponent } from '@/shared/ui/button-component'

  defineProps<{
    comments: PostComment[]
    loading: boolean
    canLoadMore: boolean
    loadMoreLoading: boolean
  }>()

  const emit = defineEmits<{
    loadMore: []
    loadReplies: [commentPk: string]
  }>()

  const visibleReplies = (comment: PostComment): PostComment[] =>
    comment.childComments.length > 0 ? comment.childComments : comment.previewChildComments

  const hasMoreReplies = (comment: PostComment): boolean => {
    const loaded = comment.childComments.length > 0
      ? comment.childComments.length
      : comment.previewChildComments.length
    return comment.childCommentCount > loaded
  }
</script>

<template>
  <div class="comment-list">
    <div v-if="loading" class="comment-list__loading">
      <q-spinner size="24px" color="primary" />
    </div>

    <div v-else-if="comments.length === 0" class="comment-list__empty text-caption text-grey">
      Нет комментариев
    </div>

    <template v-else>
      <div v-for="comment in comments" :key="comment.pk" class="comment-item">
        <div class="comment-item__main">
          <q-avatar size="26px" class="comment-item__avatar">
            <img v-if="comment.user.profilePicUrl" :src="comment.user.profilePicUrl">
            <q-icon v-else name="person" size="16px" />
          </q-avatar>
          <div class="comment-item__body">
            <span class="comment-item__username">{{ comment.user.username }}</span>
            <span class="comment-item__text">{{ comment.text }}</span>
            <div class="comment-item__meta">
              <span>{{ formatRelativeTime(comment.createdAtUtc) }}</span>
              <span v-if="comment.likeCount > 0" class="comment-item__likes">
                <q-icon name="favorite_border" size="10px" />
                {{ formatCount(comment.likeCount) }}
              </span>
            </div>
          </div>
        </div>

        <div v-if="comment.childCommentCount > 0 || visibleReplies(comment).length > 0" class="comment-item__replies">
          <div
            v-for="reply in visibleReplies(comment)"
            :key="reply.pk"
            class="comment-item comment-item--reply"
          >
            <div class="comment-item__main">
              <q-avatar size="20px" class="comment-item__avatar">
                <img v-if="reply.user.profilePicUrl" :src="reply.user.profilePicUrl">
                <q-icon v-else name="person" size="12px" />
              </q-avatar>
              <div class="comment-item__body">
                <span class="comment-item__username">{{ reply.user.username }}</span>
                <span class="comment-item__text">{{ reply.text }}</span>
                <div class="comment-item__meta">
                  <span>{{ formatRelativeTime(reply.createdAtUtc) }}</span>
                  <span v-if="reply.likeCount > 0" class="comment-item__likes">
                    <q-icon name="favorite_border" size="10px" />
                    {{ formatCount(reply.likeCount) }}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <button
            v-if="hasMoreReplies(comment)"
            class="comment-item__load-replies"
            :disabled="comment.childCommentsLoading"
            @click="emit('loadReplies', comment.pk)"
          >
            <q-spinner v-if="comment.childCommentsLoading" size="12px" />
            <template v-else>
              Показать ответы ({{ comment.childCommentCount }})
            </template>
          </button>
        </div>
      </div>

      <ButtonComponent
        v-if="canLoadMore"
        label="Загрузить ещё"
        flat
        dense
        color="primary"
        class="comment-list__load-more"
        :loading="loadMoreLoading"
        @click="emit('loadMore')"
      />
    </template>
  </div>
</template>

<style scoped lang="scss">
  .comment-list {
    display: flex;
    flex-direction: column;
    gap: $indent-s;

    &__loading {
      display: flex;
      justify-content: center;
      padding: $indent-m 0;
    }

    &__empty {
      text-align: center;
      padding: $indent-m 0;
    }

    &__load-more {
      align-self: center;
    }
  }

  .comment-item {
    display: flex;
    flex-direction: column;
    gap: $indent-xs;

    &--reply {
      padding-left: 34px;
    }

    &__main {
      display: flex;
      gap: $indent-s;
      align-items: flex-start;
    }

    &__avatar {
      flex-shrink: 0;
      margin-top: 2px;
    }

    &__body {
      flex: 1;
      min-width: 0;
      font-size: $font-size-sm;
      line-height: $line-height-normal;
    }

    &__username {
      font-weight: $font-weight-medium;
      margin-right: $indent-xs;
    }

    &__text {
      word-break: break-word;
    }

    &__meta {
      display: flex;
      align-items: center;
      gap: $indent-s;
      margin-top: 2px;
      color: $content-secondary;
      font-size: $font-size-xs;
    }

    &__likes {
      display: inline-flex;
      align-items: center;
      gap: 2px;
    }

    &__replies {
      display: flex;
      flex-direction: column;
      gap: $indent-xs;
    }

    &__load-replies {
      margin-left: 34px;
      background: none;
      border: none;
      padding: 0;
      color: $content-secondary;
      font-size: $font-size-xs;
      font-weight: $font-weight-medium;
      cursor: pointer;

      &:hover:not(:disabled) {
        color: $primary;
      }

      &:disabled {
        cursor: default;
      }
    }
  }
</style>
