import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { registerNativePushDevice } from '../utils/nativePush';

interface User {
  id: string;
  username: string;
  email: string;
  digitalId: number;
  nickname: string;
  avatar: string;
  status: string;
  allowStrangerMessage: boolean;
  callRingtoneUrl?: string;
  callRingtoneMode?: 'peer' | 'mine';
  lastSeenAt?: string;
}

interface AuthValue {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string, code?: string) => Promise<void>;
  logout: () => void;
  updateUser: (patch: Partial<User>) => void;
  ready: boolean;
}

const AuthContext = createContext<AuthValue | null>(null);

const TOKEN_KEY = 'echo-token';
const USER_KEY = 'echo-user';

function loadAuth(): { user: User | null; token: string | null } {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    const user = JSON.parse(localStorage.getItem(USER_KEY) || 'null');
    return { token, user };
  } catch {
    return { token: null, user: null };
  }
}

function saveAuth(token: string, user: User) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

function getApiBase() {
  const manual = localStorage.getItem('echo-server-url');
  if (manual) return manual;
  return (import.meta as any).env?.VITE_API_BASE || '';
}

function requestNotificationIfSafe() {
  if (!('Notification' in window) || !window.isSecureContext) return;
  if (Notification.permission === 'default') {
    Notification.requestPermission().catch(() => {});
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const saved = loadAuth();
    if (saved.token) {
      setToken(saved.token);
      setUser(saved.user);
      fetch(`${getApiBase()}/api/users/me`, {
        headers: { 'Authorization': `Bearer ${saved.token}` },
      })
        .then(res => (res.ok ? res.json() : null))
        .then(freshUser => {
          if (!freshUser) return;
          setUser(freshUser);
          localStorage.setItem(USER_KEY, JSON.stringify(freshUser));
          registerNativePushDevice(saved.token).catch(() => {});
        })
        .catch(() => {});
    }
    setReady(true);
  }, []);

  const login = async (email: string, password: string) => {
    let res: Response;
    try {
      res = await fetch(`${getApiBase()}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
    } catch {
      throw new Error('无法连接服务器，请检查后端是否已启动');
    }
    const data = await res.json();
    if (!res.ok || !data.token || !data.user) {
      throw new Error(data.error || '登录失败，服务器返回数据异常');
    }

    setToken(data.token);
    setUser(data.user);
    saveAuth(data.token, data.user);
    requestNotificationIfSafe();
    registerNativePushDevice(data.token).catch(() => {});
  };

  const register = async (username: string, email: string, password: string, code?: string) => {
    let res: Response;
    try {
      res = await fetch(`${getApiBase()}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password, code }),
      });
    } catch {
      throw new Error('无法连接服务器，请检查后端是否已启动');
    }
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '注册失败');

    setToken(data.token);
    setUser(data.user);
    saveAuth(data.token, data.user);
    requestNotificationIfSafe();
    registerNativePushDevice(data.token).catch(() => {});
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    clearAuth();
  };

  const updateUser = (patch: Partial<User>) => {
    setUser(prev => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      localStorage.setItem(USER_KEY, JSON.stringify(next));
      return next;
    });
  };

  return (
    <AuthContext.Provider value={{ user, token, login, register, logout, updateUser, ready }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be within AuthProvider');
  return ctx;
}
