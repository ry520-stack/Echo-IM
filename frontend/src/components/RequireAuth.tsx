import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function RequireAuth() {
  const { token, ready } = useAuth();

  if (!ready) {
    return (
      <div className="flex h-full items-center justify-center text-gray-400 dark:text-gray-500">
        加载中...
      </div>
    );
  }

  return token ? <Outlet /> : <Navigate to="/login" replace />;
}
