import { ref } from 'vue'
import type { QTableColumn } from 'quasar'

export const useFilterColumns = <T extends QTableColumn>(initialColumns: T[]) => {
  const columns = ref<T[]>(initialColumns)
  const columnsVisibleNames = ref<T['name'][]>(initialColumns.map((col) => col.name))

  return { columns, columnsVisibleNames }
}
