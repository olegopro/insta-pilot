<script setup lang="ts">
  import { ref, computed, watch, nextTick, onBeforeUnmount } from 'vue'
  import type { MediaPost } from '@/entities/media-post'
  import { useSearchStore, MEDIA_TYPE } from '@/entities/media-post'
  import { formatCount, formatDate, notifyError, notifySuccess } from '@/shared/lib'
  import type { Nullable } from '@/shared/lib'
  import { ModalComponent } from '@/shared/ui/modal-component'
  import { MediaDisplay } from '@/shared/ui/media-display'
  import { InputComponent } from '@/shared/ui/input-component'
  import { ButtonComponent } from '@/shared/ui/button-component'
  import { useCommentGeneration, GenerationStatus } from '@/features/generate-comment'
  import type { GenerationStep } from '@/features/generate-comment'

  interface PostState { commentText: string; step: GenerationStep; comment: Nullable<string>; error: Nullable<string> }

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
  const commentText = ref('')
  const carouselSlide = ref(0)
  const postStateCache = new Map<string, PostState>()
  const { step, generatedComment, error, loading, generate, reset, restore, cleanup } = useCommentGeneration()

  const isUserLoading = computed(() => props.loadingUserPk === props.post.user.pk)

  const generateHandler = async () => {
    let url: string | null | undefined
    if (props.post.mediaType === MEDIA_TYPE.CAROUSEL && props.post.resources.length > 0) {
      url = props.post.resources[carouselSlide.value]?.thumbnailUrl
    } else {
      url = props.post.thumbnailUrl
    }

    if (!url) return

    await generate(url, props.post.captionText, props.accountId)
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

  watch(generatedComment, (comment) => {
    comment && (commentText.value = comment)
  })

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
      void nextTick(() => { commentText.value = cached.commentText })
    } else {
      reset()
      commentText.value = ''
    }
    carouselSlide.value = 0
  })

  watch(isOpen, (opened) => {
    if (!opened) {
      cleanup()
      carouselSlide.value = 0
    }
  })

  onBeforeUnmount(cleanup)
</script>

<template>
  <ModalComponent
    v-model="isOpen"
    inner-class="post-detail-modal__inner"
  >
    <div class="body">
      <div class="media">
        <MediaDisplay v-model:slide="carouselSlide" :post="post" :max-width="`calc(70vw - ${INFO_PANEL_WIDTH})`" />
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

        <div class="bottom-section">
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
                label="Сгенерировать"
                icon="auto_awesome"
                flat
                dense
                color="grey-7"
                :loading="loading"
                :disable="!post.thumbnailUrl && post.resources.length === 0"
                @click="generateHandler"
              />
              <ButtonComponent
                label="Отправить"
                icon="send"
                color="primary"
                dense
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

      .bottom-section {
        margin-top: auto;
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      .actions {
        display: flex;
        align-items: center;
        padding-top: 16px;
        border-top: 1px solid #eee;

        span {
          font-size: 14px;
          color: #555;
          margin-left: 4px;
        }
      }

      .comment-section {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding-top: 16px;
        border-top: 1px solid #eee;

        .comment-actions {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
        }
      }
    }
  }
</style>
