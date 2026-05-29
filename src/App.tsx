import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import Layout from './shared/Layout';
import ProtectedRoute from './auth/ProtectedRoute';

const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));
const LoginPage = lazy(() => import('./auth/LoginPage'));

const GamesHub = lazy(() => import('./games/GamesHub'));
const Connect4Game = lazy(() => import('./games/connect4/Connect4Game'));
const MinesweeperGame = lazy(() => import('./games/minesweeper/MinesweeperGame'));

const TrackerShell = lazy(() => import('./tracker/TrackerShell'));
const TodayDashboard = lazy(() => import('./tracker/pages/TodayDashboard'));
const SettingsPage = lazy(() => import('./tracker/pages/SettingsPage'));
const FinancesDetailPage = lazy(() => import('./tracker/pages/FinancesDetailPage'));
const ExerciseDetailPage = lazy(() => import('./tracker/pages/ExerciseDetailPage'));
const GroceriesPage = lazy(() => import('./tracker/pages/GroceriesPage'));
const RemindersPage = lazy(() => import('./tracker/pages/RemindersPage'));

const LoggerShell = lazy(() => import('./logger/LoggerShell'));
const LoggerTodayPage = lazy(() => import('./logger/pages/TodayPage'));
const LoggerTimelinePage = lazy(() => import('./logger/pages/TimelinePage'));
const LoggerPlanPage = lazy(() => import('./logger/pages/PlanPage'));
const LoggerMorePage = lazy(() => import('./logger/pages/MorePage'));
const LoggerGroupDetailPage = lazy(() => import('./logger/pages/GroupDetailPage'));

const SandboxShell = lazy(() => import('./sandbox/SandboxShell'));
const SandboxTodayPage = lazy(() => import('./sandbox/pages/TodayPage'));
const SandboxRoutinesPage = lazy(() => import('./sandbox/pages/RoutinesPage'));
const SandboxTimelinePage = lazy(() => import('./sandbox/pages/TimelinePage'));
const SandboxMorePage = lazy(() => import('./sandbox/pages/MorePage'));
const SandboxGroupDetailPage = lazy(() => import('./sandbox/pages/GroupDetailPage'));
const SandboxProjectsPage = lazy(() => import('./sandbox/pages/ProjectsPage'));
const SandboxProjectPage = lazy(() => import('./sandbox/pages/ProjectDetailPage'));
const SandboxRoutineDetailPage = lazy(() => import('./sandbox/pages/RoutineDetailPage'));
const SandboxHealthPage = lazy(() => import('./sandbox/pages/HealthDetailPage'));

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Suspense fallback={null}>
          <Routes>
            {/* Root app — full-viewport, no Layout nav */}
            <Route path="/" element={<ProtectedRoute><SandboxShell /></ProtectedRoute>}>
              <Route index element={<SandboxTodayPage />} />
              <Route path="routines" element={<SandboxRoutinesPage />} />
              <Route path="timeline" element={<SandboxTimelinePage />} />
              <Route path="more" element={<SandboxMorePage />} />
              <Route path="groups/:groupId" element={<SandboxGroupDetailPage />} />
              <Route path="projects" element={<SandboxProjectsPage />} />
              <Route path="projects/:projectId" element={<SandboxProjectPage />} />
              <Route path="routines/:routineId" element={<SandboxRoutineDetailPage />} />
              <Route path="health" element={<SandboxHealthPage />} />
            </Route>

            {/* Legacy apps — keep the shared Layout nav */}
            <Route element={<Layout />}>
              <Route path="/games" element={<GamesHub />} />
              <Route path="/games/connect4" element={<Connect4Game />} />
              <Route path="/games/minesweeper" element={<MinesweeperGame />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/tracker" element={<ProtectedRoute><TrackerShell /></ProtectedRoute>}>
                <Route index element={<TodayDashboard />} />
                <Route path="settings" element={<SettingsPage />} />
                <Route path="finances" element={<FinancesDetailPage />} />
                <Route path="exercise" element={<ExerciseDetailPage />} />
                <Route path="groceries" element={<GroceriesPage />} />
                <Route path="reminders" element={<RemindersPage />} />
              </Route>
              <Route path="/logger" element={<ProtectedRoute><LoggerShell /></ProtectedRoute>}>
                <Route index element={<LoggerTodayPage />} />
                <Route path="timeline" element={<LoggerTimelinePage />} />
                <Route path="plan" element={<LoggerPlanPage />} />
                <Route path="more" element={<LoggerMorePage />} />
                <Route path="groups/:groupId" element={<LoggerGroupDetailPage />} />
              </Route>
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  );
}
