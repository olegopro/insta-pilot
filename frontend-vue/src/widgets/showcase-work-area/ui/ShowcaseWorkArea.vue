<script setup lang="ts">
  import { useShowcaseStore } from '@/entities/showcase-media'
  import type { ShowcaseMedia } from '@/entities/showcase-media'
  import { useModal, type Nullable } from '@/shared/lib'
  import { ButtonComponent } from '@/shared/ui/button-component'
  import { ToggleComponent } from '@/shared/ui/toggle-component'
  import { CaptionText } from '@/shared/ui/caption-text'
  import { EmptyStateComponent } from '@/shared/ui/empty-state-component'
  import { EditShowcaseNoteModal } from '@/features/edit-showcase-note'

  const props = defineProps<{
    media: Nullable<ShowcaseMedia>
    accountId?: number
  }>()

  const showcaseStore = useShowcaseStore()
  const noteModal = useModal()

  const hiddenLocalHandler = (value: boolean) =>
    props.media && props.accountId !== undefined &&
    showcaseStore.updateOverlay(props.accountId, props.media.post.pk, { isHiddenLocal: value })
</script>

<template>
  <section class="work-area">
    <EmptyStateComponent
      v-if="!media"
      icon="touch_app"
      text="Выберите пост"
      icon-size="48px"
    />

    <template v-else>
      <div class="work-preview">
        <img
          v-if="media.post.thumbnailUrl"
          :src="media.post.thumbnailUrl"
          :alt="media.post.captionText"
          class="preview-thumb"
        >
        <div v-else class="preview-thumb preview-placeholder">
          <q-icon name="image" size="32px" color="grey-4" />
        </div>
      </div>

      <div class="work-details">
        <CaptionText
          :text="media.post.captionText"
          :account-id="accountId"
          class="work-caption"
        />

        <div class="work-controls">
          <ButtonComponent
            :label="media.overlay.note ? 'Изменить заметку' : 'Добавить заметку'"
            icon="sticky_note_2"
            color="primary"
            outline
            @click="noteModal.open"
          />
          <ToggleComponent
            :model-value="media.overlay.isHiddenLocal"
            label="Скрыть локально"
            color="negative"
            :disable="showcaseStore.updateOverlayLoading"
            @update:model-value="hiddenLocalHandler"
          />
        </div>

        <p v-if="media.overlay.note" class="work-note">{{ media.overlay.note }}</p>
      </div>
    </template>

    <EditShowcaseNoteModal
      v-if="media && accountId !== undefined"
      v-model="noteModal.isVisible"
      :media="media"
      :account-id="accountId"
    />
  </section>
</template>

<style scoped lang="scss">
  .work-area {
    display: flex;
    gap: $spacing-section-gap;
    align-items: flex-start;
    padding: $spacing-section-gap;
    min-height: 160px;
    background: $surface-primary;
    border: 1px solid $neutral-300;
    border-radius: $radius-xl;
  }

  .work-preview {
    flex-shrink: 0;
  }

  .preview-thumb {
    width: 120px;
    height: 120px;
    object-fit: cover;
    border-radius: $radius-md;
    display: block;
  }

  .preview-placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    background: $neutral-300;
  }

  .work-details {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: $indent-m;
    min-width: 0;
  }

  .work-controls {
    display: flex;
    align-items: center;
    gap: $spacing-section-gap;
    flex-wrap: wrap;
  }

  .work-note {
    margin: 0;
    padding: $indent-sm;
    background: $surface-tertiary;
    border-radius: $radius-md;
    font-size: $font-size-sm;
    color: $content-primary;
    white-space: pre-line;
  }
</style>
