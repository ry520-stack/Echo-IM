import {
  isOnline,
  setOffline,
  setOnline,
  cacheGet,
  readCache,
  invalidateCache,
  queueOp,
  processQueue,
  getQueue,
  initOfflineListeners,
} from './offlineSync';
import { is5Plus } from '../utils/env';

const TOKEN_KEY = 'echo-token';
const SERVER_URL_KEY = 'echo-server-url';
const DEFAULT_APP_SERVER_URL = 'https://echo-im.cloud';

function normalizeBaseUrl(url: string): string {
  const base = url.trim().replace(/\/$/, '');
  if (!base) return '';
  if (typeof window !== 'undefined' && window.location.protocol === 'https:' && base.startsWith('http:')) {
    return '';
  }
  return base;
}

function getBaseUrl(): string {
  const manual = normalizeBaseUrl(localStorage.getItem(SERVER_URL_KEY) || '');
  if (manual) return manual;
  const envBase = normalizeBaseUrl((import.meta as any).env?.VITE_API_BASE || '');
  if (envBase) return envBase;
  if (is5Plus() || window.location.protocol === 'file:') return DEFAULT_APP_SERVER_URL;
  return '';
}

export function getServerUrl(): string {
  return getBaseUrl();
}

export function setServerUrl(url: string) {
  if (url) {
    localStorage.setItem(SERVER_URL_KEY, url.replace(/\/$/, ''));
  } else {
    localStorage.removeItem(SERVER_URL_KEY);
  }
}

function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem('echo-user');
}

const offlineFallbackWarning = { shown: false };
function showOfflineModeToast() {
  if (offlineFallbackWarning.shown) return;
  offlineFallbackWarning.shown = true;
  setTimeout(() => { offlineFallbackWarning.shown = false; }, 3000);
  const el = document.createElement('div');
  el.className =
    'fixed top-4 left-1/2 -translate-x-1/2 z-[9999] rounded-2xl bg-amber-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg';
  el.textContent = '已切换到本地模式，网络恢复后自动同步';
  document.body.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity 0.3s'; }, 2500);
  setTimeout(() => el.remove(), 3000);
}

export { processQueue, getQueue, isOnline, setOnline, setOffline, initOfflineListeners };
export { invalidateCache };

export async function api<T>(method: string, path: string, body?: unknown): Promise<T> {
  const isAuth = path.startsWith('/api/auth');
  const isGet = method === 'GET';

  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const token = getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const base = getBaseUrl();
    const url = base + path;

    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    setOnline();

    if (res.status === 401) {
      clearAuth();
      window.location.hash = '#/login';
      throw new Error('登录已过期，请重新登录');
    }

    if (res.status === 204) return undefined as T;

    let data: any;
    try {
      data = await res.json();
    } catch {
      if (!res.ok) throw new Error(`请求失败 (${res.status})`);
      return undefined as T;
    }
    if (!res.ok) {
      throw new Error(data?.error || `请求失败 (${res.status})`);
    }

    if (isGet && !isAuth && data !== undefined) {
      cacheGet(path, data);
    }

    return data as T;
  } catch (err: unknown) {
    const msg = (err as Error).message || '';

    if (msg.includes('登录已过期')) throw err;

    const isNetworkError =
      msg.includes('无法连接') ||
      msg.includes('网络') ||
      msg.includes('fetch') ||
      msg.includes('Failed to fetch') ||
      msg.includes('NetworkError') ||
      msg.includes('ERR_');

    if (isNetworkError) {
      setOffline();
      showOfflineModeToast();

      if (isGet && !isAuth) {
        const cached = readCache(path);
        if (cached) return cached.data as T;
        return [] as unknown as T;
      }

      if (!isGet) {
        queueOp(method, path, body);
        invalidateCache(path.split('?')[0]);
        throw new Error('已加入同步队列，网络恢复后自动提交');
      }

      throw new Error('当前离线，暂无缓存数据');
    }

    throw err;
  }
}

initOfflineListeners(async () => {
  const q = getQueue();
  if (!q.length) return;

  try {
    await processQueue(api);
    if (getQueue().length === 0) {
      setOnline();
      const el = document.createElement('div');
      el.className =
        'fixed top-4 left-1/2 -translate-x-1/2 z-[9999] rounded-2xl bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg';
      el.textContent = '数据已同步到云端';
      document.body.appendChild(el);
      setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity 0.3s'; }, 2500);
      setTimeout(() => el.remove(), 3000);
      window.dispatchEvent(new CustomEvent('echo-sync-complete'));
    }
  } catch {
    // stay offline
  }
});
