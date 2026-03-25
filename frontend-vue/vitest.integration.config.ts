import { defineConfig } from 'vitest/config'

/**
 * Конфиг для integration-тестов (раздел 7.2 TESTING_PLAN).
 * Требует запущенного Docker-стека (http://localhost:8000).
 * Запуск: npm run test:integration
 */
export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/integration/**/*.spec.ts'],
    testTimeout: 15_000,
    hookTimeout: 15_000,
    reporters: ['verbose']
  }
})
