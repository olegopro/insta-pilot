<script setup lang="ts">
  import { ref, watch } from 'vue'
  import { useShowcaseStore } from '@/entities/showcase-media'
  import type { ShowcaseMedia } from '@/entities/showcase-media'
  import { notifySuccess } from '@/shared/lib'
  import { ModalComponent } from '@/shared/ui/modal-component'
  import { InputComponent } from '@/shared/ui/input-component'

  const props = defineProps<{
    media: ShowcaseMedia
    accountId: number
  }>()

  const showcaseStore = useShowcaseStore()
  const isOpen = defineModel<boolean>({ default: false })
  const noteText = ref(props.media.overlay.note ?? '')

  const submitHandler = async () => {
    const ok = await showcaseStore.updateOverlay(props.accountId, props.media.post.pk, { note: noteText.value.trim() || null })
    if (!ok) return
    notifySuccess('Заметка сохранена')
    isOpen.value = false
  }

  watch(() => isOpen.value, (open) => open && (noteText.value = props.media.overlay.note ?? ''))
</script>

<template>
  <ModalComponent
    v-model="isOpen"
    title="Заметка к посту"
    icon="sticky_note_2"
    submit-label="Сохранить"
    reset-label="Отмена"
    :submit-loading="showcaseStore.updateOverlayLoading"
    @submit="submitHandler"
    @reset="isOpen = false"
  >
    <InputComponent
      v-model="noteText"
      type="textarea"
      label-text="Текст заметки"
      outlined
      autogrow
      counter
      maxlength="500"
    />
  </ModalComponent>
</template>
