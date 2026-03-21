import { defineBoot } from '#q-app/wrappers'
import axios, { type AxiosInstance } from 'axios'

declare module 'vue' {
  interface ComponentCustomProperties {
    $axios: AxiosInstance
    $api: AxiosInstance
  }
}

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL })

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const isAuthLogin = (error.config?.url as string | undefined)?.includes('/auth/login')
    if (error.response?.status === 401 && !isAuthLogin) {
      localStorage.removeItem('token')
      window.location.href = '/#/login'
    }
    throw error
  }
)

export default defineBoot(({ app }) => {
  app.config.globalProperties.$axios = axios
  app.config.globalProperties.$api = api
})

export { api }
