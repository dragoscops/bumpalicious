// vitest.config.js

import {defineConfig} from 'vitest/config';

export default defineConfig({
  test: {
    // Enable global test APIs like `describe`, `it`, `expect` without importing them
    globals: true,
    // Specify the test environment (e.g., 'node' or 'jsdom')
    environment: 'node',
    // Automatically clear mock calls, instances, contexts, and results before every test
    clearMocks: true,
    // Include the "src" directory for module resolution
    include: ['src/**/*.spec.js'],
    // Add the setupFiles option
    setupFiles: ['./vitest.setup.js'],
  },
});
