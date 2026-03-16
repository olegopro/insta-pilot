<script setup lang="ts">
  import { onBeforeUnmount } from 'vue'

  const emit = defineEmits<{
    resize: [delta: number]
  }>()

  let cleanup: (() => void) | null = null

  const mousedownHandler = (e: MouseEvent) => {
    e.preventDefault()
    const startX = e.clientX

    const mousemoveHandler = (ev: MouseEvent) => {
      emit('resize', ev.clientX - startX)
    }

    const mouseupHandler = () => {
      document.removeEventListener('mousemove', mousemoveHandler)
      document.removeEventListener('mouseup', mouseupHandler)
      cleanup = null
    }

    document.addEventListener('mousemove', mousemoveHandler)
    document.addEventListener('mouseup', mouseupHandler)

    cleanup = () => {
      document.removeEventListener('mousemove', mousemoveHandler)
      document.removeEventListener('mouseup', mouseupHandler)
    }
  }

  onBeforeUnmount(() => cleanup?.())
</script>

<template>
  <div class="sidebar-resize-handle" @mousedown="mousedownHandler" />
</template>

<style scoped>
.sidebar-resize-handle {
  position: absolute;
  top: 0;
  right: 0;
  width: 4px;
  height: 100%;
  cursor: col-resize;
  background: transparent;
  z-index: 10;
}
.sidebar-resize-handle:hover {
  background: rgba(0, 0, 0, 0.1);
}
</style>
