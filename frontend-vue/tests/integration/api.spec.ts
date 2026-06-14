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

  // ─── 7.2.2 Request with token → 200 ──────────────────────────────────────

  it('GET /me с токеном → 200 + данные пользователя', async () => {
    const resp = await axios.get(`${API_URL}/api/auth/me`, {
      headers: authHeaders(authToken)
    })

    expect(resp.status).toBe(200)
    expect(resp.data.success).toBe(true)
    expect(resp.data.data.email).toBe(SEEDED_EMAIL)
  }, 15000)

  // ─── 7.2.3 Auth-guard /me — без токена и с невалидным токеном → 401 ──────

  it.each([
    ['без токена', { Accept: 'application/json' }],
    [
      'с невалидным токеном',
      { Authorization: 'Bearer invalid-token-xyz', Accept: 'application/json' }
    ]
  ])('GET /me %s → 401', async (_label, headers) => {
    try {
      await axios.get(`${API_URL}/api/auth/me`, { headers })
      expect.fail('Ожидался 401')
    } catch (error: unknown) {
      expect(getStatusCode(error)).toBe(401)
    }
  }, 15000)

  // ─── 7.2.4 Happy-GET endpoints → 200 + структура { success, data } ───────

  it.each([
    ['/api/accounts', () => authToken],
    ['/api/activity/summary', () => authToken],
    ['/api/llm-settings', () => adminToken],
    ['/api/admin/users', () => adminToken]
  ])('GET %s → 200 + структура { success, data }', async (path, getToken) => {
    const resp = await axios.get(`${API_URL}${path}`, {
      headers: authHeaders(getToken())
    })

    expect(resp.status).toBe(200)
    expect(resp.data.success).toBe(true)
    expect(Array.isArray(resp.data.data)).toBe(true)
  }, 15000)

  // ─── 7.2.5 Admin endpoints без admin-прав → 403 ─────────────────────────

  it.each([
    ['/api/llm-settings'],
    ['/api/admin/users']
  ])('GET %s без admin-прав → 403', async (path) => {
    try {
      await axios.get(`${API_URL}${path}`, {
        headers: authHeaders(authToken)
      })
      expect.fail('Ожидался 403')
    } catch (error: unknown) {
      expect(getStatusCode(error)).toBe(403)
    }
  }, 15000)

  // ─── 7.2.6 CORS headers ──────────────────────────────────────────────────

  it('CORS — ответ содержит access-control-allow-origin', async () => {
    const resp = await axios.get(`${API_URL}/api/auth/me`, {
      headers: { ...authHeaders(authToken), Origin: 'http://localhost:9000' }
    })
    expect(resp.headers['access-control-allow-origin']).toBeTruthy()
  }, 15000)

  // ─── 7.2.7 WebSocket auth без токена → 401 или 403 ──────────────────────

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

  // ─── 7.2.8 WebSocket auth с токеном ─────────────────────────────────────

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
