import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import ProtectedRoute from './auth/ProtectedRoute';

const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));
const LoginPage = lazy(() => import('./auth/LoginPage'));

const AppShell = lazy(() => import('./AppShell'));
const TodayPage = lazy(() => import('./pages/TodayPage'));
const RoutinesPage = lazy(() => import('./pages/RoutinesPage'));
const TimelinePage = lazy(() => import('./pages/TimelinePage'));
const MorePage = lazy(() => import('./pages/MorePage'));
const GroupDetailPage = lazy(() => import('./pages/GroupDetailPage'));
const ProjectsPage = lazy(() => import('./pages/ProjectsPage'));
const ProjectDetailPage = lazy(() => import('./pages/ProjectDetailPage'));
const RoutineDetailPage = lazy(() => import('./pages/RoutineDetailPage'));
const HealthDetailPage = lazy(() => import('./pages/HealthDetailPage'));
const HealthRoutineEditPage = lazy(() => import('./pages/HealthRoutineEditPage'));
const HealthRoutineDashPage = lazy(() => import('./pages/HealthRoutineDashPage'));

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Suspense fallback={null}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={<ProtectedRoute><AppShell /></ProtectedRoute>}>
              <Route index element={<TodayPage />} />
              <Route path="routines" element={<RoutinesPage />} />
              <Route path="timeline" element={<TimelinePage />} />
              <Route path="more" element={<MorePage />} />
              <Route path="groups/:groupId" element={<GroupDetailPage />} />
              <Route path="projects" element={<ProjectsPage />} />
              <Route path="projects/:projectId" element={<ProjectDetailPage />} />
              <Route path="routines/:routineId" element={<RoutineDetailPage />} />
              <Route path="health" element={<HealthDetailPage />} />
              <Route path="health/routines/new" element={<HealthRoutineEditPage />} />
              <Route path="health/routines/:routineId" element={<HealthRoutineDashPage />} />
              <Route path="health/routines/:routineId/edit" element={<HealthRoutineEditPage />} />
            </Route>
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  );
}
