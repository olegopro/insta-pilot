<script setup lang="ts">
  import type { QBtnProps, QBtnSlots } from 'quasar'
  import { useForwardProps } from '@/shared/lib'

  export type IconScale = 'sm' | 'md' | 'lg' | 'xl'
  export type ButtonComponentProps = QBtnProps & {
    iconScale?: IconScale
  }

  defineOptions({ inheritAttrs: false })
  const props = defineProps<ButtonComponentProps>()
  defineSlots<QBtnSlots>()

  const forwarded = useForwardProps(props)
</script>

<template>
  <q-btn
    v-bind="{ ...$attrs, ...forwarded }" 
    :data-icon="props.icon" 
    :data-icon-scale="props.iconScale"
  >
    <template v-for="(_, slotName) in $slots" #[slotName]="scope" :key="slotName">
      <slot :name="slotName as keyof QBtnSlots" v-bind="scope || {}" />
    </template>
  </q-btn>
</template>

<style scoped lang="scss">
  .q-btn {
    border-radius: $radius-md;
    padding: $indent-xs $indent-sm;

    :deep(.q-btn__content) {
      line-height: 1;
    }

    :deep(.q-icon) {
      font-size: 1.25em;
    }

    &[data-icon-scale="md"] :deep(.q-icon) {
      font-size: 1.5em;
    }

    &[data-icon-scale="lg"] :deep(.q-icon) {
      font-size: 1.715em;
    }

    &[data-icon-scale="xl"] :deep(.q-icon) {
      font-size: 1.9em;
    }

    :deep(.q-icon.on-left) {
      margin-right: 6px;
    }

    :deep(.q-icon.on-right) {
      margin-left: 6px;
    }

    &[data-icon="check"] :deep(.q-icon) {
      position: relative;
      top: -1px;
    }
  }
</style>
