<script setup lang="ts">
  import type { QDialogProps } from 'quasar'
  import { useAttrs, useSlots } from 'vue'
  import { ButtonComponent } from 'src/shared/ui/button-component'

  interface ModalComponentProps {
    title?: string
    icon?: string
    submitLabel?: string
    submitColor?: string
    submitLoading?: boolean
    resetLabel?: string
    submitDisable?: boolean
    readonly?: boolean
  }

  defineProps<ModalComponentProps>()

  defineEmits<{
    submit: [payload: Event | SubmitEvent]
    reset: []
  }>()

  defineOptions({ inheritAttrs: false })

  const model = defineModel<boolean>({ default: false })
  const dialogAttrs = useAttrs() as Omit<QDialogProps, 'modelValue'>
  const hasHeaderContent = useSlots()['header-content']
</script>

<template>
  <q-dialog
    v-model="model"
    v-bind="dialogAttrs" 
    @hide="$emit('reset')" 
  >
    <q-form
      class="modal-inner" 
      @submit="(event) => $emit('submit', event)" 
      @reset="$emit('reset')"
    >
      <header v-if="title || hasHeaderContent" class="modal-header">
        <h3 v-if="title" class="modal-title">
          <q-icon v-if="icon" :name="icon" />
          {{ title }}
        </h3>
        <slot name="header-content" />
      </header>

      <slot />

      <footer class="modal-footer">
        <ButtonComponent
          v-if="submitLabel && !readonly"
          type="submit"
          :color="submitColor ?? 'primary'"
          :label="submitLabel"
          icon="file_download_done"
          :disable="submitDisable"
          :loading="submitLoading"
        />
        <ButtonComponent
          v-if="resetLabel"
          type="reset"
          flat
          :label="resetLabel"
          icon="clear"
        />
      </footer>
    </q-form>
  </q-dialog>
</template>

<style scoped lang="scss">
  .modal-inner {
    background: white;
    border-radius: 8px;
    padding: 24px;
    min-width: 450px;
    pointer-events: initial;
  }

  .modal-header {
    display: flex;
    flex-direction: column;
    align-items: center;
    margin-bottom: 16px;
  }

  .modal-title {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 8px;
    margin: 0;
  }

  .modal-footer {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding-top: 24px;
  }
</style>
