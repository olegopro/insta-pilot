import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { createDefaultDraft } from '@/entities/automation-parsing/model/constants'
import parsingDraftDTO from '@/entities/automation-parsing/model/parsingDraftDTO'
import { useAutomationTaskStore } from '@/entities/automation-task'
import type { CommentActionConfig } from '@/entities/automation-task'

const createDefaultCommentConfig = (): CommentActionConfig => ({
  llmSettingId: null,
  tone: null,
  template: null,
  useCaption: true
})

// Стор-черновик: держит UI-state конфигурации парсинга (источник/фильтры/объём)
// и конфиг действия. startParse материализует задачу на бэке и запускает парсинг.
export const useAutomationParsingStore = defineStore('automationParsing', () => {
  const taskStore = useAutomationTaskStore()

  const draft = ref(createDefaultDraft())
  const commentConfig = ref(createDefaultCommentConfig())

  const isSourceValid = computed(() => {
    const { source } = draft.value
    if (source.type === 'location') return source.locationPk !== null
    if (source.type === 'hashtag_location') return source.hashtags.length > 0 && source.locationPk !== null
    return source.hashtags.length > 0
  })

  const canStartParse = computed(() => draft.value.accountId !== null && isSourceValid.value)

  const resetDraft = () => {
    draft.value = createDefaultDraft()
    commentConfig.value = createDefaultCommentConfig()
  }

  // Создаёт задачу из черновика и запускает парсинг источника. Возвращает созданную задачу.
  const startParse = async () => {
    const payload = parsingDraftDTO.toCreateRequest(draft.value, commentConfig.value)
    const task = await taskStore.createTask(payload)
    await taskStore.parseTargets(task.id)
    return task
  }

  // taskStore.createTaskLoading/Error — уже computed; в setup-сторе они разворачиваются
  // в значения, поэтому оборачиваем заново для прокидывания наружу.
  const startParseLoading = computed<boolean>(() => taskStore.createTaskLoading)
  const startParseError = computed(() => taskStore.createTaskError)

  return {
    draft,
    commentConfig,
    isSourceValid,
    canStartParse,
    resetDraft,
    startParse,
    startParseLoading,
    startParseError
  }
})
