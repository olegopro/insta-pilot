import { patterns } from 'quasar'

const { testPattern } = patterns

export const requiredField = (v: string) => !!v || 'Обязательное поле'
export const checkEmail = (v: string) => testPattern.email(v) || 'Некорректный email'
