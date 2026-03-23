import js from '@eslint/js'
import globals from 'globals'
import pluginVue from 'eslint-plugin-vue'
import pluginQuasar from '@quasar/app-vite/eslint'
import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript'
import stylisticPlugin from '@stylistic/eslint-plugin'
import noRelativeImportPaths from 'eslint-plugin-no-relative-import-paths'
// import prettierSkipFormatting from '@vue/eslint-config-prettier/skip-formatting';

export default defineConfigWithVueTs(
  {
    /**
     * Ignore the following files.
     * Please note that pluginQuasar.configs.recommended() already ignores
     * the "node_modules" folder for you (and all other Quasar project
     * relevant folders and files).
     *
     * ESLint requires "ignores" key to be the only one in this object
     */
    // ignores: []
  },

  pluginQuasar.configs.recommended(),
  js.configs.recommended,

  /**
   * https://eslint.vuejs.org
   *
   * pluginVue.configs.base
   *   -> Settings and rules to enable correct ESLint parsing.
   * pluginVue.configs[ 'flat/essential']
   *   -> base, plus rules to prevent errors or unintended behavior.
   * pluginVue.configs["flat/strongly-recommended"]
   *   -> Above, plus rules to considerably improve code readability and/or dev experience.
   * pluginVue.configs["flat/recommended"]
   *   -> Above, plus rules to enforce subjective community defaults to ensure consistency.
   */
  pluginVue.configs['flat/strongly-recommended'],

  {
    files: ['**/*.ts', '**/*.vue'],
    plugins: {
      '@stylistic': stylisticPlugin,
      'no-relative-import-paths': noRelativeImportPaths
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      '@typescript-eslint/no-confusing-void-expression': 'off',
      '@stylistic/quotes': ['warn', 'single', { avoidEscape: true }],
      '@stylistic/arrow-parens': ['error', 'always'],
      '@stylistic/semi': ['error', 'never'],
      'no-relative-import-paths/no-relative-import-paths': ['error', {
        allowSameFolder: false,
        rootDir: 'src',
        prefix: '@'
      }]
    }
  },

  {
    files: ['**/*.ts', '**/*.js'],
    plugins: { '@stylistic': stylisticPlugin },
    rules: {
      '@stylistic/indent': ['warn', 2, { SwitchCase: 1 }]
    }
  },

  {
    files: ['**/*.js'],
    plugins: { '@stylistic': stylisticPlugin },
    rules: {
      '@stylistic/quotes': ['warn', 'single', { avoidEscape: true }],
      '@stylistic/arrow-parens': ['error', 'always'],
      '@stylistic/semi': ['error', 'never']
    }
  },

  // https://github.com/vuejs/eslint-config-typescript
  vueTsConfigs.strictTypeChecked,
  vueTsConfigs.stylisticTypeChecked,

  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',

      globals: {
        ...globals.browser,
        ...globals.node, // SSR, Electron, config files
        process: 'readonly', // process.env.*
        ga: 'readonly', // Google Analytics
        cordova: 'readonly',
        Capacitor: 'readonly',
        chrome: 'readonly', // BEX related
        browser: 'readonly' // BEX related
      }
    },

    // Custom rules here
    rules: {
      'prefer-promise-reject-errors': 'off',

      // allow debugger during development only
      'no-debugger': process.env.NODE_ENV === 'production' ? 'error' : 'off',

      // Настройка отступов для тега <script> в Vue файлах
      'vue/script-indent': ['warn', 2, {
        baseIndent: 1,
        switchCase: 1
      }],

      // Настройка отступов для тега <template> в файлах Vue
      'vue/html-indent': ['warn', 2, {
        baseIndent: 1,
        attribute: 1,
        closeBracket: 0,
        alignAttributesVertically: false,
        ignores: []
      }],

      'vue/require-default-prop': 'off',
      'vue/prop-name-casing': 'off',
      'vue/singleline-html-element-content-newline': 'off',
      'vue/require-explicit-emits': 'error',
      'vue/max-attributes-per-line': 'off',
      'vue/attributes-order': ['error', {
        order: [
          'DEFINITION',
          'LIST_RENDERING',
          'CONDITIONALS',
          'RENDER_MODIFIERS',
          ['UNIQUE', 'SLOT'],
          'GLOBAL',
          'TWO_WAY_BINDING',
          'OTHER_DIRECTIVES',
          'OTHER_ATTR',
          'CONTENT',
          'EVENTS'
        ],
        alphabetical: false
      }],

      '@typescript-eslint/no-unused-expressions': ['error', { allowShortCircuit: true, allowTernary: true }],

      '@stylistic/arrow-spacing': ['error', { before: true, after: true }],
      '@stylistic/space-before-function-paren': 'off',
      '@stylistic/function-call-spacing': ['error', 'never'],
      '@stylistic/no-multi-spaces': 'error',
      '@stylistic/comma-dangle': ['error', 'never'],
      '@stylistic/no-multiple-empty-lines': ['error', { max: 2, maxEOF: 0, maxBOF: 0 }],
      '@stylistic/eol-last': ['error', 'always'],
      '@stylistic/object-property-newline': ['error', { allowAllPropertiesOnSameLine: true }]
    }
  },

  {
    files: ['src-pwa/custom-service-worker.ts'],
    languageOptions: {
      globals: {
        ...globals.serviceworker
      }
    }
  },

  {
    files: ['**/__tests__/**/*.ts', '**/*.spec.ts'],
    rules: {
      '@typescript-eslint/prefer-promise-reject-errors': 'off',
      '@typescript-eslint/unbound-method': 'off'
    }
  }
  // prettierSkipFormatting,
)
