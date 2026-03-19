<script setup lang="ts">
  export interface PageComponentProps {
    title?: string
    icon?: string
  }

  defineProps<PageComponentProps>()
</script>

<template>
  <q-page padding class="page-content">
    <div v-if="title || $slots.prepend || $slots.append" class="row items-center justify-between q-mb-lg page-header">
      <div class="row items-center q-gutter-sm">
        <slot name="prepend">
          <q-icon v-if="icon" :name="icon" size="28px" color="primary" />
        </slot>
        <span v-if="title" class="text-h5">{{ title }}</span>
      </div>
      <slot name="append" />
    </div>
    <slot />
  </q-page>
</template>

<style scoped lang="scss">
.page-header {
  height: 60px;
}
</style>
