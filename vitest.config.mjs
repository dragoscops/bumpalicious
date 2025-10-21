import templDefineConfig from '@templ-project/vitest';

/** @type {import('vitest').ViteUserConfig} */
export default templDefineConfig({
  // Custom test file patterns
  include: ['src/**/*.spec.{js,ts}', 'test/**/*.test.{js,ts}'],
  setupFiles: ['./vitest.setup.js'],
  retry: 3,
  allowOnly: true,
  poolOptions: {
    threads: {
      maxThreads: 1, // Limit the maximum number of threads to 1
    },
  },

  // Custom coverage settings
  coverage: {
    threshold: {
      global: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80,
      },
    },
    exclude: ['src/legacy/**/*', 'src-js/**/*', '**/*.spec.ts', '**/*.test.ts', '**/fixtures/**'],
  },
});
