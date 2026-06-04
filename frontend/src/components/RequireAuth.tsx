import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import EchoConnectScreen from './EchoConnectScreen';

export default function RequireAuth() {
  const { token, ready } = useAuth();

  if (!ready) return <EchoConnectScreen />;

  return token ? <Outlet /> : <Navigate to="/login" replace />;
}
