import { describe, it, expect } from 'vitest'
import llmSettingsDTO from '@/entities/llm-settings/model/llmSettingsDTO'
import type { LlmSettingApi } from '@/entities/llm-settings/model/apiTypes'

const makeSettingApi = (overrides: Partial<LlmSettingApi> = {}): LlmSettingApi => ({
  id:            1,
  provider:      'openai',
  model_name:    'gpt-4o-mini',
  system_prompt: null,
  tone:          'friendly',
  use_caption:   true,
  is_default:    false,
  created_at:    '2026-01-01T00:00:00Z',
  updated_at:    '2026-01-01T00:00:00Z',
  ...overrides
})

describe('llmSettingsDTO.toLocal', () => {
  it('маппит snake_case поля в camelCase', () => {
    const result = llmSettingsDTO.toLocal(makeSettingApi())

    expect(result).toMatchObject({
      id:           1,
      provider:     'openai',
      modelName:    'gpt-4o-mini',
      systemPrompt: null,
      tone:         'friendly',
      useCaption:   true,
      isDefault:    false,
      createdAt:    '2026-01-01T00:00:00Z',
      updatedAt:    '2026-01-01T00:00:00Z'
    })
  })

  it('корректно маппит is_default = true и use_caption = false', () => {
    const result = llmSettingsDTO.toLocal(makeSettingApi({ is_default: true, use_caption: false }))

    expect(result.isDefault).toBe(true)
    expect(result.useCaption).toBe(false)
  })

  it('сохраняет system_prompt когда задан', () => {
    const result = llmSettingsDTO.toLocal(makeSettingApi({
      system_prompt: 'Custom instructions',
      provider:      'glm',
      model_name:    'glm-4-flash'
    }))

    expect(result.systemPrompt).toBe('Custom instructions')
    expect(result.provider).toBe('glm')
    expect(result.modelName).toBe('glm-4-flash')
  })
})

describe('llmSettingsDTO.toLocalList', () => {
  it('маппит массив настроек', () => {
    const result = llmSettingsDTO.toLocalList([
      makeSettingApi({ id: 1, provider: 'openai' }),
      makeSettingApi({ id: 2, provider: 'glm', is_default: true })
    ])

    expect(result).toHaveLength(2)
    expect(result[0]!.provider).toBe('openai')
    expect(result[1]!.isDefault).toBe(true)
  })

  it('возвращает пустой массив при пустом входе', () => expect(llmSettingsDTO.toLocalList([])).toEqual([]))
})
