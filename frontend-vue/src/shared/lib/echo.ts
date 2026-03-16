import Echo from 'laravel-echo'
import Pusher from 'pusher-js'

declare global {
  interface Window {
    Pusher: typeof Pusher
  }
}

window.Pusher = Pusher

export const echo = new Echo({
  broadcaster: 'reverb',
  key: import.meta.env.VITE_REVERB_APP_KEY as string,
  wsHost: import.meta.env.VITE_REVERB_HOST as string,
  wsPort: Number(import.meta.env.VITE_REVERB_PORT ?? 8080),
  forceTLS: false,
  enabledTransports: ['ws'],
  authEndpoint: `${import.meta.env.VITE_API_URL as string}broadcasting/auth`,
  auth: {
    headers: {
      get Authorization() {
        return `Bearer ${localStorage.getItem('token') ?? ''}`
      }
    }
  }
})
