<script setup lang="ts">
  import type { AutomationTargetStatus } from '@/entities/automation-target'
  import { ButtonComponent } from '@/shared/ui/button-component'

  const props = defineProps<{
    status: AutomationTargetStatus
    loading?: boolean
  }>()

  const emit = defineEmits<{
    exclude: []
    restore: []
  }>()

  const clickHandler = () => (props.status === 'kept' ? emit('exclude') : emit('restore'))
</script>

<template>
  <ButtonComponent
    flat
    round
    :icon="status === 'kept' ? 'delete_outline' : 'restore_from_trash'"
    :color="status === 'kept' ? 'negative' : 'positive'"
    :loading="loading"
    @click.stop="clickHandler"
  >
    <q-tooltip>{{ status === 'kept' ? 'В корзину' : 'Вернуть' }}</q-tooltip>
  </ButtonComponent>
</template>
