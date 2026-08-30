import path from 'path';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    environmentOptions: {
      jsdom: {
        // Enable Web Storage API (localStorage, sessionStorage) in jsdom
        // Required for auth token storage tests
        url: 'http://localhost/',
      },
    },
    setupFiles: ['./src/test/setup.ts'],
    css: true,
    // CI-compatible reporters: verbose output + JUnit for CI systems
    reporters: process.env.CI ? ['verbose', 'junit'] : ['verbose'],
    outputFile: process.env.CI ? 'test-results/junit.xml' : undefined,
    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      reportsDirectory: './coverage',
      // Exclude test utilities, generated code, config files
      exclude: [
        'src/test/**',
        'src/graphql/generated/**',
        'src/main.tsx',
        '**/*.config.*',
        '**/*.d.ts',
      ],
      // Thresholds — raise incrementally as coverage grows
      thresholds: {
        statements: 30,
        branches: 30,
        functions: 30,
        lines: 30,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
