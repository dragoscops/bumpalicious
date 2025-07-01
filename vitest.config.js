import templDefineConfig from '@templ-project/vitest';

/** @type {import('vitest').ViteUserConfig} */
export default templDefineConfig({
  // Custom test file patterns
  include: ['src/**/*.spec.js'],
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
    exclude: ['src/legacy/**/*'],
  },
});

// import {defineConfig} from 'vitest/config';
//
// export default defineConfig({
//   test: {
//     // Enable global test APIs like `describe`, `it`, `expect` without importing them
//     globals: true,
//     // Specify the test environment (e.g., 'node' or 'jsdom')
//     environment: 'node',
//     // Automatically clear mock calls, instances, contexts, and results before every test
//     clearMocks: true,
//     // Include the "src" directory for module resolution
//     include: ['src/**/*.spec.js'],
//     // Add the setupFiles option
//     setupFiles: ['./vitest.setup.js'],
//     // Coverage configuration
//     coverage: {
//       provider: 'v8', // Use the V8 coverage provider for more accurate coverage
//       reporter: ['text', 'json', 'html', 'lcov'], // Generate multiple report formats
//       exclude: ['node_modules/**', 'src/vitest/**', '**/*.spec.js', 'vitest.setup.js'],
//       all: true, // Enable collecting coverage from all files, not just the ones being tested
//       lines: 80, // Minimum coverage threshold for lines
//       functions: 80, // Minimum coverage threshold for functions
//       branches: 70, // Minimum coverage threshold for branches
//       statements: 80, // Minimum coverage threshold for statements
//     },
//     allowOnly: true,
//     // retry
//     retry: 3,
//   },
// });
