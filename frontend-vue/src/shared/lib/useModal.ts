import { reactive, ref } from 'vue'

interface ModalModel {
  isVisible: boolean
  open: () => void
  close: () => void
}

const useModal = (): ModalModel => {
  const isVisible = ref<boolean>(false)

  const open = () => { isVisible.value = true }
  const close = () => { isVisible.value = false }

  return reactive({ isVisible, open, close })
}

export { useModal }
