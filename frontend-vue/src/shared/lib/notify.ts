import { Notify } from 'quasar'

export const notifySuccess = (message: string) =>
  Notify.create({ type: 'positive', message, position: 'top-right' })

export const notifyError = (message: string) =>
  Notify.create({ type: 'negative', message, position: 'top-right' })
