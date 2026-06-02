import { getPlus, is5Plus } from './env';
import { getServerUrl } from '../api/client';

export interface NativePushPayload {
  chatId: string;
}

export function createNativeMessage(title: string, body: string, payload: NativePushPayload) {
  if (!is5Plus()) return false;
  const plus = getPlus();
  if (!plus?.push?.createMessage) return false;
  try {
    plus.push.createMessage(body, JSON.stringify(payload), {
      title,
      sound: 'system',
      cover: false,
    });
    return true;
  } catch {
    return false;
  }
}

export function bindNativePushClick() {
  if (!is5Plus()) return () => {};
  const plus = getPlus();
  if (!plus?.push?.addEventListener) return () => {};

  const handler = (msg: any) => {
    try {
      const rawPayload = msg?.payload || msg?.payloadString || msg?.content;
      const payload = typeof rawPayload === 'string' ? JSON.parse(rawPayload) : rawPayload;
      if (payload?.chatId) {
        window.location.hash = `#/chat/${payload.chatId}`;
      }
    } catch {
      // Ignore malformed payloads from older local notifications.
    }
  };

  plus.push.addEventListener('click', handler, false);
  return () => {
    try {
      plus.push.removeEventListener?.('click', handler);
    } catch {
      // Some 5+ runtimes do not expose removeEventListener for push.
    }
  };
}

function waitForPlusReady(): Promise<any> {
  if (is5Plus()) return Promise.resolve(getPlus());
  return new Promise(resolve => {
    document.addEventListener('plusready', () => resolve(getPlus()), { once: true });
    setTimeout(() => resolve(getPlus()), 4000);
  });
}

function isValidClientId(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const clientId = value.trim();
  return clientId !== '' && clientId !== 'null' && clientId !== 'undefined';
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function readPushClientId(plus: any) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const info = plus.push.getClientInfo();
    const clientId = info?.clientid || info?.clientId;
    if (isValidClientId(clientId)) {
      return {
        clientId: clientId.trim(),
        appId: info?.appid || info?.appId || '',
      };
    }
    await sleep(800);
  }
  return null;
}

export async function registerNativePushDevice(token: string | null) {
  if (!token) return false;
  const plus = await waitForPlusReady();
  if (!plus?.push?.getClientInfo) return false;

  const info = await readPushClientId(plus);
  if (!info) return false;

  const res = await fetch(`${getServerUrl()}/api/push/devices`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      clientId: info.clientId,
      platform: plus.os?.name || 'android',
      appId: info.appId,
    }),
  });
  return res.ok;
}
