declare module 'vuedraggable' {
  import type { DefineComponent } from 'vue'

  const draggable: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>
  export default draggable
}
