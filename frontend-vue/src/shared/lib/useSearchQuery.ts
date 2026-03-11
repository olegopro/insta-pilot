import { ref } from 'vue'

export const useSearchQuery = () => {
  const searchText = ref('')

  return { searchText }
}
