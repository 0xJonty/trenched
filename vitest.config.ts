import { defineConfig } from 'vitest/config'

/**
 * Deliberately separate from vite.config.ts: the CRXJS plugin rewrites the
 * manifest and content-script entries, which has no place in a unit test run.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts', 'src/**/*.test.ts'],
    restoreMocks: true,
  },
})
