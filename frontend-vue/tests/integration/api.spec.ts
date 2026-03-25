/**
 * Integration-тесты Vue ↔ Laravel (7.2)
 *
 * Требования:
 *   - Laravel-контейнер запущен (http://localhost:8000)
 *   - БД сидирована: php artisan db:seed
 *     (создаёт admin@insta-pilot.local / password и user@insta-pilot.local / password)
 *
 * Запуск: npm run test:integration
 */

import type { AxiosError } from 'axios'
import axios from 'axios'
import { describe, it, expect, beforeAll } from 'vitest'

const API_URL = process.env.INTEGRATION_API_URL ?? 'http://localhost:8000'

// Сидированные пользователи (AdminSeeder + DatabaseSeeder)
const SEEDED_EMAIL = 'user@insta-pilot.local'
const SEEDED_PASSWORD = 'password'

let authToken = ''

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function checkApiAvailable(): Promise<boolean> {
  try {
    await axios.post(
      `${API_URL}/api/auth/login`,
      { email: SEEDED_EMAIL, password: SEEDED_PASSWORD },
      { headers: { Accept: 'application/json' }, timeout: 3000 }
    )
    return true
  } catch (error: unknown) {
    const axiosError = error as AxiosError
    // 422 (неверные данные) означает что API доступен, просто не сидирован
    return axiosError.response !== undefined
  }
}

function getStatusCode(error: unknown): number {
  return (error as AxiosError).response?.status ?? 0
}

// ─── Suite ───────────────────────────────────────────────────────────────────

describe.skipIf(!(await checkApiAvailable()))('Vue ↔ Laravel API Integration', () => {
  beforeAll(async () => {
    const resp = await axios.post(
      `${API_URL}/api/auth/login`,
      { email: SEEDED_EMAIL, password: SEEDED_PASSWORD },
      { headers: { Accept: 'application/json' } }
    )
    authToken = resp.data.data.token
  })

  // ─── 7.2.1 Login via API → token ─────────────────────────────────────────

  it('POST /auth/login — возвращает токен', async () => {
    const resp = await axios.post(
      `${API_URL}/api/auth/login`,
      { email: SEEDED_EMAIL, password: SEEDED_PASSWORD },
      { headers: { Accept: 'application/json' } }
    )

    expect(resp.status).toBe(200)
    expect(resp.data.success).toBe(true)
    expect(typeof resp.data.data.token).toBe('string')
    expect(resp.data.data.token.length).toBeGreaterThan(0)
  })

  // ─── 7.2.2 Request with token → 200 ──────────────────────────────────────

  it('GET /me с токеном → 200 + данные пользователя', async () => {
    const resp = await axios.get(`${API_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${authToken}`, Accept: 'application/json' }
    })

    expect(resp.status).toBe(200)
    expect(resp.data.success).toBe(true)
    expect(resp.data.data.email).toBe(SEEDED_EMAIL)
  })

  // ─── 7.2.3 Request without token → 401 ───────────────────────────────────

  it('GET /me без токена → 401', async () => {
    try {
      await axios.get(`${API_URL}/api/auth/me`, {
        headers: { Accept: 'application/json' }
      })
      expect.fail('Ожидался 401')
    } catch (error: unknown) {
      expect(getStatusCode(error)).toBe(401)
    }
  })

  // ─── 7.2.4 Invalid token → 401 ───────────────────────────────────────────

  it('GET /me с невалидным токеном → 401', async () => {
    try {
      await axios.get(`${API_URL}/api/auth/me`, {
        headers: { Authorization: 'Bearer invalid-token-xyz', Accept: 'application/json' }
      })
      expect.fail('Ожидался 401')
    } catch (error: unknown) {
      expect(getStatusCode(error)).toBe(401)
    }
  })

  // ─── 7.2.5 CORS headers ──────────────────────────────────────────────────

  it('CORS — ответ содержит access-control-allow-origin', async () => {
    // Делаем реальный POST — CORS-заголовок присутствует в ответе при allowedOrigins=*
    const resp = await axios.post(
      `${API_URL}/api/auth/login`,
      { email: SEEDED_EMAIL, password: SEEDED_PASSWORD },
      {
        headers: {
          Accept: 'application/json',
          Origin: 'http://localhost:9000'
        }
      }
    )
    const origin = resp.headers['access-control-allow-origin']
    expect(origin).toBeTruthy()
  })

  // ─── 7.2.6 WebSocket auth без токена → 401 ───────────────────────────────

  it('POST /broadcasting/auth без токена → 401 или 403', async () => {
    // Laravel Sanctum возвращает 403 для broadcasting/auth без токена
    try {
      await axios.post(
        `${API_URL}/broadcasting/auth`,
        { socket_id: '1234.5678', channel_name: 'private:activity-log' },
        { headers: { Accept: 'application/json' } }
      )
      expect.fail('Ожидался 401 или 403')
    } catch (error: unknown) {
      expect([401, 403]).toContain(getStatusCode(error))
    }
  })

  // ─── 7.2.7 WebSocket auth с токеном ──────────────────────────────────────

  it('POST /broadcasting/auth с токеном — не 500', async () => {
    try {
      const resp = await axios.post(
        `${API_URL}/broadcasting/auth`,
        { socket_id: '1234.5678', channel_name: 'private:activity-log' },
        {
          headers: { Authorization: `Bearer ${authToken}`, Accept: 'application/json' }
        }
      )
      // 200 (authorized) или 403 (канал требует совпадения user_id) — оба валидны
      expect([200, 403]).toContain(resp.status)
    } catch (error: unknown) {
      const axiosError = error as AxiosError
      if (axiosError.response?.status === 403) return
      throw error
    }
  })
})
