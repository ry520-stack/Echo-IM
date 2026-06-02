import { useEffect } from 'react';
import { HashRouter, Navigate, Route, Routes, useNavigate, useLocation } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { SocketProvider } from './contexts/SocketContext';
import { ToastProvider } from './contexts/ToastContext';
import RequireAuth from './components/RequireAuth';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ChatPage from './pages/ChatPage';
import SettingsPage from './pages/SettingsPage';
import FriendsPage from './pages/FriendsPage';
import GroupsPage from './pages/GroupsPage';
import MomentsPage from './pages/MomentsPage';
import SearchMessagesPage from './pages/SearchMessagesPage';
import FavoritesPage from './pages/FavoritesPage';
import TimeCapsulePage from './pages/TimeCapsulePage';
import ChatSettingsPage from './pages/ChatSettingsPage';
import StarZoneManagePage from './pages/StarZoneManagePage';
import EchoRankingsPage from './pages/EchoRankingsPage';
import NotificationProvider from './components/NotificationProvider';
import { CallProvider } from './contexts/CallContext';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import { is5Plus } from './utils/env';

// 5+ App 物理返回键拦截
function BackButtonHandler() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!is5Plus()) return;
    const plus = (window as any).plus;

    const onBack = () => {
      // 登录/注册页：直接退出
      if (location.pathname === '/login' || location.pathname === '/register') {
        plus.runtime.quit();
        return;
      }
      // 首页（ChatPage index）：双击退出
      if (location.pathname === '/' || location.pathname === '') {
        plus.runtime.quit();
        return;
      }
      // 其他页面：路由回退
      navigate(-1);
    };

    plus.key.addEventListener('backbutton', onBack);
    return () => plus.key.removeEventListener('backbutton', onBack);
  }, [location.pathname, navigate]);

  return null;
}

export default function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <ToastProvider>
          <SocketProvider>
            <CallProvider>
            <HashRouter>
              <BackButtonHandler />
              <NotificationProvider>
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />

                <Route element={<RequireAuth />}>
                  <Route index element={<ChatPage />} />
                  <Route path="/chat/:id" element={<ChatPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="/friends" element={<FriendsPage />} />
                  <Route path="/groups" element={<GroupsPage />} />
                  <Route path="/moments" element={<MomentsPage />} />
                  <Route path="/search" element={<SearchMessagesPage />} />
                  <Route path="/favorites" element={<FavoritesPage />} />
                  <Route path="/time-capsule" element={<TimeCapsulePage />} />
                  <Route path="/orbit/:userId" element={<MomentsPage />} />
                  <Route path="/chat/:userId/settings" element={<ChatSettingsPage />} />
                  <Route path="/star-zones" element={<StarZoneManagePage />} />
                  <Route path="/echo-rankings" element={<EchoRankingsPage />} />
                </Route>

                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
              </NotificationProvider>
            </HashRouter>
            </CallProvider>
          </SocketProvider>
        </ToastProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}
