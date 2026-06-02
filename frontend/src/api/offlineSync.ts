const CACHE_PREFIX = 'echo-cache-';
const QUEUE_KEY = 'echo-offline-queue';
const STATUS_KEY = 'echo-online-status';

interface QueuedOp {
  id: string;
  method: string;
  path: string;
  body?: unknown;
  queuedAt: string;
  retries: number;
}

export function isOnline(): boolean {
  return navigator.onLine && localStorage.getItem(STATUS_KEY) !== 'offline';
}

export function setOffline() {
  localStorage.setItem(STATUS_KEY, 'offline');
  window.dispatchEvent(new CustomEvent('echo-status-change', { detail: { online: false } }));
}

export function setOnline() {
  localStorage.removeItem(STATUS_KEY);
  window.dispatchEvent(new CustomEvent('echo-status-change', { detail: { online: true } }));
}

export function cacheGet(path: string, data: unknown) {
  try {
    const key = CACHE_PREFIX + path;
    localStorage.setItem(key, JSON.stringify({ data, ts: Date.now() }));
  } catch { /* storage full */ }
}

export function readCache(path: string): { data: unknown; ts: number } | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + path);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function invalidateCache(pattern: string) {
  const prefix = CACHE_PREFIX;
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(prefix) && k.includes(pattern)) {
      keysToRemove.push(k);
    }
  }
  keysToRemove.forEach(k => localStorage.removeItem(k));
}

export function queueOp(method: string, path: string, body?: unknown) {
  const ops = getQueue();
  ops.push({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    method,
    path,
    body,
    queuedAt: new Date().toISOString(),
    retries: 0,
  });
  localStorage.setItem(QUEUE_KEY, JSON.stringify(ops));
}

export function getQueue(): QueuedOp[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function processQueue(
  apiFn: (method: string, path: string, body?: unknown) => Promise<unknown>,
  onProgress?: (done: number, total: number) => void,
) {
  const ops = getQueue();
  if (!ops.length) return;

  let done = 0;
  const remaining: QueuedOp[] = [];

  for (const op of ops) {
    try {
      await apiFn(op.method, op.path, op.body);
      done++;
      onProgress?.(done, ops.length);
    } catch (e: unknown) {
      const msg = (e as Error).message || '';
      if (msg.includes('无法连接') || msg.includes('网络') || msg.includes('fetch')) {
        remaining.push(op);
        break;
      }
      if (msg.includes('409') || msg.includes('已存在') || msg.includes('duplicate')) {
        done++;
        onProgress?.(done, ops.length);
        continue;
      }
      op.retries++;
      if (op.retries < 3) {
        remaining.push(op);
      }
      done++;
      onProgress?.(done, ops.length);
    }
  }

  localStorage.setItem(QUEUE_KEY, JSON.stringify(remaining));
}

export function initOfflineListeners(processFn?: () => void) {
  window.addEventListener('online', () => {
    setOnline();
    processFn?.();
  });
  window.addEventListener('offline', () => {
    setOffline();
  });
  if (!navigator.onLine) setOffline();
}
