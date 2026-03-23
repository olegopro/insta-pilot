import type { LlmProvider, LlmTone } from '@/entities/llm-settings/model/types'

export const PROVIDERS: { value: LlmProvider; label: string }[] = [
  { value: 'glm', label: 'GLM (Z.ai / Zhipu AI)' },
  { value: 'openai', label: 'OpenAI' }
]

export const MODELS_BY_PROVIDER: Record<LlmProvider, { value: string; label: string }[]> = {
  glm: [
    { value: 'glm-4.6v', label: 'GLM-4.6V (flagship, 128K)' },
    { value: 'glm-4.6v-flashx', label: 'GLM-4.6V-FlashX (быстрый)' },
    { value: 'glm-4.6v-flash', label: 'GLM-4.6V-Flash (бесплатный)' }
  ],
  openai: [
    { value: 'gpt-4o', label: 'GPT-4o (flagship, 128K)' },
    { value: 'gpt-4o-mini', label: 'GPT-4o-mini (дешевле)' },
    { value: 'gpt-4.1', label: 'GPT-4.1 (1M контекст)' },
    { value: 'gpt-4.1-mini', label: 'GPT-4.1-mini (облегчённый)' }
  ]
}

export const TONES: { value: LlmTone; label: string }[] = [
  { value: 'friendly', label: 'Дружелюбный' },
  { value: 'professional', label: 'Профессиональный' },
  { value: 'casual', label: 'Непринуждённый' },
  { value: 'humorous', label: 'Юмористический' }
]
