import type { Nullable } from '@/shared/lib'
import type { GenerationStep } from '@/features/generate-comment'

export interface PostState {
  commentText: string
  step: GenerationStep
  comment: Nullable<string>
  error: Nullable<string>
}
