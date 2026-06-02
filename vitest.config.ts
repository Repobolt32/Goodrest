import { configDefaults, defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/tests/setup.ts'],
    globals: true,
    clearMocks: true,
    exclude: [
      ...configDefaults.exclude,
      '**/src/tests/e2e/**',
      'tests/**',
      '.chrome-profile/**',
      '.chrome-profile-headful/**'
    ],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
