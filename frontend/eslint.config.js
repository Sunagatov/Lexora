import js from '@eslint/js'
import reactHooks from 'eslint-plugin-react-hooks'
import tseslint from 'typescript-eslint'

const browserGlobals = {
  window: 'readonly',
  document: 'readonly',
  navigator: 'readonly',
  location: 'readonly',
  history: 'readonly',
  localStorage: 'readonly',
  sessionStorage: 'readonly',
  fetch: 'readonly',
  Headers: 'readonly',
  URL: 'readonly',
  URLSearchParams: 'readonly',
  setTimeout: 'readonly',
  clearTimeout: 'readonly',
  alert: 'readonly',
  console: 'readonly',
  KeyboardEvent: 'readonly',
  React: 'readonly',
}

export default [
  {
    ignores: [
      'dist',
      'coverage',
      'node_modules',
      '.vite',
      '.vite-temp',
      '*.tsbuildinfo',
      'vite.config.js',
      'vite.config.d.ts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: {jsx: true},
      },
      globals: browserGlobals,
    },
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['error', {argsIgnorePattern: '^_'}],
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: [
      'src/**/*.test.ts',
      'src/**/*.test.tsx',
      'src/**/__tests__/**',
      'src/test/**',
    ],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          {
            group: ['../../*', '../../../*', '../../../../*', '../../../../../*'],
            message: 'Use @/ aliases instead of deep relative imports.',
          },
        ],
      }],
    },
  },
  {
    files: ['src/shared/**/*.{ts,tsx}'],
    ignores: ['src/shared/**/__tests__/**'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          {
            group: ['@/features/*'],
            message: 'The shared layer must not depend on feature modules.',
          },
          {
            group: ['@/app/layout/*', '@/app/providers'],
            message: 'The shared layer must not depend on app composition modules.',
          },
        ],
      }],
    },
  },
  {
    files: [
      'src/features/**/api/**/*.{ts,tsx}',
      'src/features/**/hooks/**/*.{ts,tsx}',
      'src/features/**/model/**/*.{ts,tsx}',
      'src/features/**/services/**/*.{ts,tsx}',
    ],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          {
            group: ['@/features/*/components/*'],
            message: 'Non-UI feature layers must not depend on component modules.',
          },
          {
            group: ['@/features/*/routes/*'],
            message: 'Non-route feature layers must not depend on route modules.',
          },
        ],
      }],
    },
  },
]
