import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { AuthProvider, useAuth } from './lib/auth';
import { Spinner } from './components/ui';
import HomePage from './pages/HomePage';
import AdminLoginPage from './pages/AdminLoginPage';
import AdminDashboard from './pages/AdminDashboard';
import ScheduleManagement from './pages/ScheduleManagement';
import SportSettings from './pages/SportSettings';
import GradeClassSettings from './pages/GradeClassSettings';
import AdminLogs from './pages/AdminLogs';
import AdminGuide from './pages/AdminGuide';

// 需要登录才能访问的路由；requireSuper=true 时还要求超管
function Protected({ children, requireSuper = false }: { children: ReactNode; requireSuper?: boolean }) {
  const { user, isSuperAdmin, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/admin/login" state={{ from: location }} replace />;
  if (requireSuper && !isSuperAdmin) return <Navigate to="/admin" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/admin/login" element={<AdminLoginPage />} />
        <Route path="/admin" element={<Protected><AdminDashboard /></Protected>} />
        <Route path="/admin/schedule" element={<Protected><ScheduleManagement /></Protected>} />
        <Route path="/admin/sports" element={<Protected><SportSettings /></Protected>} />
        <Route path="/admin/taxonomy" element={<Protected><GradeClassSettings /></Protected>} />
        <Route path="/admin/guide" element={<Protected><AdminGuide /></Protected>} />
        <Route path="/admin/logs" element={<Protected requireSuper><AdminLogs /></Protected>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
