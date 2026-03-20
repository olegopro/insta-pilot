import { defineBoot } from '#q-app/wrappers'
import { Quasar } from 'quasar'
import langRu from 'quasar/lang/ru'

export default defineBoot(() => {
  Quasar.lang.set(langRu)
})
