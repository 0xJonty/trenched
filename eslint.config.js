import js from '@eslint/js'
import tseslint from 'typescript-eslint'

/** Browser + extension globals used across the codebase. */
const globals = {
  chrome: 'readonly',
  window: 'readonly',
  document: 'readonly',
  console: 'readonly',
  fetch: 'readonly',
  WebSocket: 'readonly',
  MessageEvent: 'readonly',
  CustomEvent: 'readonly',
  crypto: 'readonly',
  self: 'readonly',
  setTimeout: 'readonly',
  clearTimeout: 'readonly',
  structuredClone: 'readonly',
  AudioContext: 'readonly',
  URL: 'readonly',
  TextDecoder: 'readonly',
  Blob: 'readonly',
  process: 'readonly',
}

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', '*.zip'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'always'],
      'prefer-const': 'error',
    },
  },
)
