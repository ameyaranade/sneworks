import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    sourcemap: 'hidden',
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor: heavy animation library — split so it caches independently
          'vendor-motion': ['framer-motion'],
          // Vendor: icon library — tree-shaken but still sizeable
          'vendor-icons': ['lucide-react'],
          // Vendor: state + date utilities
          'vendor-utils': ['zustand', 'date-fns', 'rrule'],
        },
      },
    },
  },
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.ts', 'src/**/*.spec.ts'],
    exclude: ['e2e/**', 'node_modules/**'],
    env: { TZ: 'UTC' },
  },
});
