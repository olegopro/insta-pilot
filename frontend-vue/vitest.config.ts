import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import path from 'node:path'

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'happy-dom',
    globals: true,
    include: ['src/**/*.spec.ts']
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '#q-app/wrappers': path.resolve(__dirname, './src/__mocks__/quasarWrappers.ts'),
      'layouts':    path.resolve(__dirname, './src/layouts'),
      'pages':      path.resolve(__dirname, './src/pages'),
      'components': path.resolve(__dirname, './src/components'),
      'assets':     path.resolve(__dirname, './src/assets')
    }
  }
})
