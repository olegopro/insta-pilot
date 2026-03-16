<script setup lang="ts">
  import { computed } from 'vue'
  import type { GenerationStep } from '@/features/generate-comment'

  const props = defineProps<{
    step: GenerationStep
    error?: string | null
  }>()

  const steps: { key: GenerationStep; label: string }[] = [
    { key: 'starting', label: 'Запуск генерации...' },
    { key: 'downloading', label: 'Загрузка изображения...' },
    { key: 'analyzing', label: 'Анализ изображения (LLM)...' },
    { key: 'completed', label: 'Комментарий готов!' }
  ]

  const activeStepIndex = computed(() => steps.findIndex((item) => item.key === props.step))

  const stepColor = (key: GenerationStep): string => {
    const idx = steps.findIndex((item) => item.key === key)
    if (props.step === 'failed') return idx <= activeStepIndex.value ? 'red' : 'grey'
    if (idx < activeStepIndex.value) return 'positive'
    if (idx === activeStepIndex.value) return 'primary'
    return 'grey'
  }
</script>

<template>
  <div v-if="step !== 'idle'" class="q-mt-sm">
    <q-timeline color="primary" layout="dense">
      <q-timeline-entry
        v-for="item in steps"
        :key="item.key"
        :title="item.label"
        :color="stepColor(item.key)"
        :icon="step === 'completed' && item.key === 'completed' ? 'check_circle' : undefined"
      />
    </q-timeline>

    <q-banner v-if="step === 'failed'" dense class="bg-red-1 text-red q-mt-sm rounded-borders">
      <template #avatar>
        <q-icon name="error" color="red" />
      </template>
      {{ error ?? 'Ошибка генерации' }}
    </q-banner>
  </div>
</template>
