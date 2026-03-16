import { ref, computed } from 'vue'
import { api } from '@/boot/axios'
import { echo } from '@/shared/lib'
import type { Nullable } from '@/shared/lib'

export type GenerationStep = 'idle' | 'starting' | 'downloading' | 'analyzing' | 'completed' | 'failed'

const GENERATION_TIMEOUT_MS = 120_000

export function useCommentGeneration() {
  const step = ref<GenerationStep>('idle')
  const generatedComment = ref<Nullable<string>>(null)
  const error = ref<Nullable<string>>(null)
  const currentJobId = ref<Nullable<string>>(null)
  let timeoutId: ReturnType<typeof setTimeout> | null = null

  const loading = computed(() => !['idle', 'completed', 'failed'].includes(step.value))

  const clearTimeout_ = () => {
    timeoutId && clearTimeout(timeoutId)
    timeoutId = null
  }

  const leaveChannel = () => {
    clearTimeout_()
    if (currentJobId.value) {
      echo.leave(`comment-generation.${currentJobId.value}`)
      currentJobId.value = null
    }
  }

  const generate = async (imageUrl: string, captionText?: string) => {
    leaveChannel()
    step.value = 'starting'
    generatedComment.value = null
    error.value = null

    try {
      const response = await api.post<{ success: boolean; data: { job_id: string } }>(
        '/comments/generate',
        { image_url: imageUrl, caption_text: captionText }
      )

      const jobId = response.data.data.job_id
      currentJobId.value = jobId

      timeoutId = setTimeout(() => {
        step.value = 'failed'
        error.value = 'Превышено время ожидания генерации'
        leaveChannel()
      }, GENERATION_TIMEOUT_MS)

      echo.private(`comment-generation.${jobId}`)
        .listen('.CommentGenerationProgress', (event: { step: GenerationStep; comment?: string; error?: string }) => {
          step.value = event.step

          if (event.step === 'completed') {
            generatedComment.value = event.comment ?? null
            leaveChannel()
          }

          if (event.step === 'failed') {
            error.value = event.error ?? 'Ошибка генерации'
            leaveChannel()
          }
        })
    } catch {
      step.value = 'failed'
      error.value = 'Ошибка запроса генерации'
    }
  }

  const reset = () => {
    leaveChannel()
    step.value = 'idle'
    generatedComment.value = null
    error.value = null
  }

  return { step, generatedComment, error, loading, generate, reset, cleanup: leaveChannel }
}
