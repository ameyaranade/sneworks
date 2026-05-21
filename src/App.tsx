import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import Layout from './shared/Layout';
import LandingPage from './pages/LandingPage';
import NotFoundPage from './pages/NotFoundPage';
import GamesHub from './games/GamesHub';
import Connect4Game from './games/connect4/Connect4Game';
import MinesweeperGame from './games/minesweeper/MinesweeperGame';
import LoginPage from './auth/LoginPage';
import ProtectedRoute from './auth/ProtectedRoute';
import TrackerShell from './tracker/TrackerShell';
import TodayDashboard from './tracker/pages/TodayDashboard';
import SettingsPage from './tracker/pages/SettingsPage';
import FinancesDetailPage from './tracker/pages/FinancesDetailPage';
import ExerciseDetailPage from './tracker/pages/ExerciseDetailPage';
import GroceriesPage from './tracker/pages/GroceriesPage';
import RemindersPage from './tracker/pages/RemindersPage';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<LandingPage />} />
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
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
