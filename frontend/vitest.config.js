import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    // Use happy-dom for DOM environment (more compatible with Node 18)
    environment: 'happy-dom',

    // Setup files (global setup, mocks)
    setupFiles: ['./src/test/setup.js'],

    // Include test files
    include: ['src/**/*.{test,spec}.{js,jsx}'],

    // Exclude patterns
    exclude: ['node_modules', 'dist'],

    // Global test APIs (describe, it, expect)
    globals: true,

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/index.js'
      ]
    },

    // Test timeout
    testTimeout: 10000,

    // Reporter
    reporters: ['default'],

    // Mock browser APIs
    deps: {
      inline: ['@testing-library/react']
    }
  },

  // Resolve aliases (match vite.config.js if any)
  resolve: {
    alias: {
      '@': '/src'
    }
  }
});
