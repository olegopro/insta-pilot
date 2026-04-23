<script setup lang="ts">
  import { ref, computed, watch, nextTick, onBeforeUnmount } from 'vue'
  import type { MediaPost } from '@/entities/media-post'
  import { useSearchStore, useCommentStore, MEDIA_TYPE } from '@/entities/media-post'
  import CommentList from '@/features/post-detail/ui/CommentList.vue'
  import { formatCount, formatDate, notifyError, notifySuccess } from '@/shared/lib'
  import type { Nullable } from '@/shared/lib'
  import { ModalComponent } from '@/shared/ui/modal-component'
  import { MediaDisplay } from '@/shared/ui/media-display'
  import { CaptionText } from '@/shared/ui/caption-text'
  import { InputComponent } from '@/shared/ui/input-component'
  import { ButtonComponent } from '@/shared/ui/button-component'
  import { useCommentGeneration, GenerationStatus } from '@/features/generate-comment'
  import type { PostState } from '@/features/post-detail/model/types'

  const props = defineProps<{
    post: MediaPost
    isLiking?: (postId: string) => boolean
    loadingUserPk?: Nullable<string>
    accountId?: number
  }>()

  const emit = defineEmits(['like', 'openUser'])

  const INFO_PANEL_WIDTH = '350px'

  const isOpen = defineModel<boolean>({ default: false })

  const searchStore = useSearchStore()
  const commentStore = useCommentStore()
  const commentText = ref('')
  const carouselSlide = ref(0)
  const postStateCache = new Map<string, PostState>()
  const { step, generatedComment, error, loading, generate, reset, restore, cleanup } = useCommentGeneration()

  const isUserLoading = computed(() => props.loadingUserPk === props.post.user.pk)

  const generateHandler = async () => {
    let url: string | null | undefined
    if (props.post.mediaType === MEDIA_TYPE.CAROUSEL && props.post.resources.length > 0) {
      url = props.post.resources[carouselSlide.value]?.originalThumbnailUrl
    } else {
      url = props.post.originalThumbnailUrl
    }

    if (!url) return

    await generate(url, props.post.captionText, props.accountId)
  }

  const buildLocationUrl = (): string => {
    const params = new URLSearchParams({
      mode: 'location',
      location_pk: String(props.post.locationPk),
      location_name: props.post.locationName ?? ''
    })
    props.accountId && params.set('account', String(props.accountId))
    return `/search?${params.toString()}`
  }

  const sendCommentHandler = async () => {
    if (!commentText.value.trim() || !props.accountId) return
    try {
      await searchStore.sendComment(props.post.id, props.accountId, commentText.value.trim())
      notifySuccess('Комментарий отправлен')
      commentText.value = ''
    } catch {
      notifyError('Ошибка отправки комментария')
    }
  }

  watch(generatedComment, (comment) => comment && (commentText.value = comment))

  watch(() => props.post.id, (newId, oldId) => {
    if (oldId) {
      postStateCache.set(oldId, {
        commentText: commentText.value,
        step: step.value,
        comment: generatedComment.value,
        error: error.value
      })
    }
    const cached = postStateCache.get(newId)
    if (cached) {
      restore(cached.step, cached.comment, cached.error)
      void nextTick(() => commentText.value = cached.commentText)
    } else {
      reset()
      commentText.value = ''
    }
    carouselSlide.value = 0
  })

  watch(isOpen, (opened) => {
    if (opened) {
      props.accountId
        && props.post.commentCount > 0
        && void commentStore.fetchComments(props.accountId, props.post.pk)
    } else {
      cleanup()
      commentStore.cancelFetch()
      commentStore.clearComments()
      carouselSlide.value = 0
    }
  }, { immediate: true })

  onBeforeUnmount(cleanup)
</script>

<template>
  <ModalComponent
    v-model="isOpen"
    inner-class="post-detail-modal__inner"
  >
    <div class="body">
      <div class="media">
        <MediaDisplay v-model:slide="carouselSlide" :post="post" :max-width="`calc(70vw - ${INFO_PANEL_WIDTH})`" max-height="85vh" />
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

        <CaptionText v-if="post.captionText" :text="post.captionText" :account-id="accountId" />

        <div class="meta text-caption text-grey">
          <a
            v-if="post.locationName && post.locationPk"
            :href="buildLocationUrl()"
            class="location-link"
            target="_blank"
            rel="noopener noreferrer"
          >
            <q-icon name="location_on" size="14px" />
            {{ post.locationName }}
          </a>
          <span v-else-if="post.locationName">
            <q-icon name="location_on" size="14px" />
            {{ post.locationName }}
          </span>
          <span>{{ formatDate(post.takenAt) }}</span>
        </div>

        <CommentList
          :comments="commentStore.comments"
          :loading="commentStore.commentsLoading"
          :can-load-more="commentStore.canLoadMore"
          :load-more-loading="commentStore.loadMoreLoading"
          @load-more="() => accountId && commentStore.loadMoreComments(accountId, post.pk)"
          @load-replies="(commentPk) => accountId && commentStore.fetchReplies(accountId, post.pk, commentPk)"
        />

        <div class="bottom-section">
          <div class="actions">
            <ButtonComponent
              class="like-btn"
              :color="post.hasLiked ? 'red' : 'white'"
              :text-color="post.hasLiked ? 'white' : 'red'"
              :icon="post.hasLiked ? 'favorite' : 'favorite_border'"
              :label="formatCount(post.likeCount)"
              :loading="isLiking?.(post.id)"
              :disable="post.hasLiked"
              @click="emit('like', post)"
            />

            <q-icon name="chat_bubble_outline" color="grey-7" size="20px" />
            <span>{{ formatCount(post.commentCount) }}</span>

            <template v-if="post.viewCount > 0">
              <q-icon name="play_arrow" color="grey-7" size="20px" />
              <span>{{ formatCount(post.viewCount) }}</span>
            </template>
          </div>

          <div v-if="accountId" class="comment-section">
            <InputComponent
              v-model="commentText"
              label-text="Комментарий"
              outlined
              dense
              autogrow
              :max-length="2200"
            />
            <GenerationStatus :step="step" :error="error" />
            <div class="comment-actions">
              <ButtonComponent
                v-if="post.mediaType !== MEDIA_TYPE.VIDEO"
                label="Придумать"
                icon="auto_awesome"
                flat
                color="grey-7"
                :loading="loading"
                :disable="!post.thumbnailUrl && post.resources.length === 0"
                @click="generateHandler"
              />
              <ButtonComponent
                label="Отправить"
                icon="send"
                color="primary"
                :loading="searchStore.sendCommentLoading"
                :disable="!commentText.trim()"
                @click="sendCommentHandler"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  </ModalComponent>
</template>

<style lang="scss">
  .modal-inner.post-detail-modal__inner {
    display: inline-flex;
    max-width: 70vw;
    max-height: 85vh;
    min-width: 0;
    padding: 0;
    flex-direction: column;
    overflow: hidden;
    border-radius: $radius-xl;
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
      align-self: flex-start;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .info {
      align-self: stretch;
      width: $info-panel-width;
      padding: $spacing-card-padding;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: $spacing-card-padding;
      border-left: $border-width-default $border-style-default $border-default;

      @media (max-width: 600px) {
        width: 100%;
        border-left: none;
        border-top: $border-width-default $border-style-default $neutral-200;
      }

      .user {
        display: flex;
        align-items: center;
        gap: $spacing-stack-gap;
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
        font-size: $font-size-base;
        line-height: $line-height-normal;
        white-space: pre-wrap;
        word-break: break-word;
      }

      .meta {
        display: flex;
        flex-direction: column;
        gap: $indent-xs;

        .location-link {
          color: $content-secondary;
          text-decoration: none;

          .q-icon {
            position: relative;
            top: -1px;
          }

          &:hover {
            color: $primary;
          }
        }
      }

      .bottom-section {
        margin-top: auto;
        display: flex;
        flex-direction: column;
        gap: $indent-m;
      }

      .actions {
        display: flex;
        align-items: center;
        gap: $indent-sm;

        span {
          font-size: $font-size-base;
          color: $content-secondary;
        }
      }

      .like-btn {
        padding: $indent-xs $indent-sm;
        min-height: $indent-2xl ;
      }

      .comment-section {
        display: flex;
        flex-direction: column;
        gap: $spacing-stack-gap;

        .comment-actions {
          display: flex;
          gap: $spacing-inline-gap;

          .q-btn {
            flex: 1;
          }
        }
      }
    }
  }
</style>
