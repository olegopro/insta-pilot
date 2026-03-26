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
const ADMIN_EMAIL = 'admin@insta-pilot.local'
const SEEDED_PASSWORD = 'password'

let authToken = ''
let adminToken = ''

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

function authHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}`, Accept: 'application/json' }
}

// ─── Suite ───────────────────────────────────────────────────────────────────

describe.skipIf(!(await checkApiAvailable()))('Vue ↔ Laravel API Integration', () => {
  beforeAll(async () => {
    const [userResp, adminResp] = await Promise.all([
      axios.post(
        `${API_URL}/api/auth/login`,
        { email: SEEDED_EMAIL, password: SEEDED_PASSWORD },
        { headers: { Accept: 'application/json' } }
      ),
      axios.post(
        `${API_URL}/api/auth/login`,
        { email: ADMIN_EMAIL, password: SEEDED_PASSWORD },
        { headers: { Accept: 'application/json' } }
      )
    ])
    authToken = userResp.data.data.token
    adminToken = adminResp.data.data.token
  }, 30000)

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
  }, 15000)

  it('POST /auth/login с невалидными данными → 422', async () => {
    try {
      await axios.post(
        `${API_URL}/api/auth/login`,
        { email: 'not-an-email', password: '' },
        { headers: { Accept: 'application/json' } }
      )
      expect.fail('Ожидался 422')
    } catch (error: unknown) {
      expect(getStatusCode(error)).toBe(422)
    }
  }, 15000)

  // ─── 7.2.2 Request with token → 200 ──────────────────────────────────────

  it('GET /me с токеном → 200 + данные пользователя', async () => {
    const resp = await axios.get(`${API_URL}/api/auth/me`, {
      headers: authHeaders(authToken)
    })

    expect(resp.status).toBe(200)
    expect(resp.data.success).toBe(true)
    expect(resp.data.data.email).toBe(SEEDED_EMAIL)
  }, 15000)

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
  }, 15000)

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
  }, 15000)

  // ─── 7.2.5 Instagram accounts ─────────────────────────────────────────────

  it('GET /accounts → 200 + структура { success, data }', async () => {
    const resp = await axios.get(`${API_URL}/api/accounts`, {
      headers: authHeaders(authToken)
    })

    expect(resp.status).toBe(200)
    expect(resp.data.success).toBe(true)
    expect(Array.isArray(resp.data.data)).toBe(true)
  }, 15000)

  // ─── 7.2.6 Activity summary ───────────────────────────────────────────────

  it('GET /activity/summary → 200 + структура { success, data }', async () => {
    const resp = await axios.get(`${API_URL}/api/activity/summary`, {
      headers: authHeaders(authToken)
    })

    expect(resp.status).toBe(200)
    expect(resp.data.success).toBe(true)
    expect(Array.isArray(resp.data.data)).toBe(true)
  }, 15000)

  // ─── 7.2.7 Admin endpoints — LLM settings ────────────────────────────────

  it('GET /llm-settings (admin) → 200 + структура { success, data }', async () => {
    const resp = await axios.get(`${API_URL}/api/llm-settings`, {
      headers: authHeaders(adminToken)
    })

    expect(resp.status).toBe(200)
    expect(resp.data.success).toBe(true)
    expect(Array.isArray(resp.data.data)).toBe(true)
  }, 15000)

  it('GET /llm-settings без admin-прав → 403', async () => {
    try {
      await axios.get(`${API_URL}/api/llm-settings`, {
        headers: authHeaders(authToken)
      })
      expect.fail('Ожидался 403')
    } catch (error: unknown) {
      expect(getStatusCode(error)).toBe(403)
    }
  }, 15000)

  // ─── 7.2.8 Admin endpoints — Users ───────────────────────────────────────

  it('GET /admin/users (admin) → 200 + структура { success, data }', async () => {
    const resp = await axios.get(`${API_URL}/api/admin/users`, {
      headers: authHeaders(adminToken)
    })

    expect(resp.status).toBe(200)
    expect(resp.data.success).toBe(true)
    expect(Array.isArray(resp.data.data)).toBe(true)
  }, 15000)

  it('GET /admin/users без admin-прав → 403', async () => {
    try {
      await axios.get(`${API_URL}/api/admin/users`, {
        headers: authHeaders(authToken)
      })
      expect.fail('Ожидался 403')
    } catch (error: unknown) {
      expect(getStatusCode(error)).toBe(403)
    }
  }, 15000)

  // ─── 7.2.9 CORS headers ──────────────────────────────────────────────────

  it('CORS — ответ содержит access-control-allow-origin', async () => {
    const resp = await axios.get(`${API_URL}/api/auth/me`, {
      headers: { ...authHeaders(authToken), Origin: 'http://localhost:9000' }
    })
    expect(resp.headers['access-control-allow-origin']).toBeTruthy()
  }, 15000)

  // ─── 7.2.10 WebSocket auth без токена → 401 или 403 ──────────────────────

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
  }, 15000)

  // ─── 7.2.11 WebSocket auth с токеном ─────────────────────────────────────

  it('POST /broadcasting/auth с токеном — не 500', async () => {
    try {
      const resp = await axios.post(
        `${API_URL}/broadcasting/auth`,
        { socket_id: '1234.5678', channel_name: 'private:activity-log' },
        {
          headers: authHeaders(authToken)
        }
      )
      // 200 (authorized) или 403 (канал требует совпадения user_id) — оба валидны
      expect([200, 403]).toContain(resp.status)
    } catch (error: unknown) {
      const axiosError = error as AxiosError
      if (axiosError.response?.status === 403) return
      throw error
    }
  }, 15000)
})
