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
          tracker: [
            './src/tracker/TrackerShell.tsx',
            './src/tracker/pages/TodayDashboard.tsx',
            './src/tracker/pages/SettingsPage.tsx',
            './src/tracker/pages/FinancesDetailPage.tsx',
            './src/tracker/pages/ExerciseDetailPage.tsx',
            './src/tracker/pages/GroceriesPage.tsx',
            './src/tracker/pages/RemindersPage.tsx',
          ],
          games: [
            './src/games/GamesHub.tsx',
            './src/games/connect4/Connect4Game.tsx',
            './src/games/minesweeper/MinesweeperGame.tsx',
          ],
          logger: [
            './src/logger/LoggerShell.tsx',
            './src/logger/pages/TodayPage.tsx',
            './src/logger/pages/TimelinePage.tsx',
            './src/logger/pages/PlanPage.tsx',
            './src/logger/pages/MorePage.tsx',
            './src/logger/pages/GroupDetailPage.tsx',
          ],
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
