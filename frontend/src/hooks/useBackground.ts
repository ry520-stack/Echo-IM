import { useState, useCallback, useEffect } from 'react';
import { api, getServerUrl } from '../api/client';
import { prepareBackgroundImage } from '../utils/compressImage';

export type PageKey = 'conversation' | 'gravity' | 'chat';
const STORAGE_KEY = 'echo-backgrounds';
const CHANGE_EVENT = 'echo-backgrounds-changed';

interface BackgroundSettings {
  conversation: string;
  gravity: string;
  chat: string;
  chatBackgrounds: Record<string, string>;
}

let remoteLoaded = false;
let remoteRequest: Promise<void> | null = null;

function loadLocal(): BackgroundSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* */ }
  return { conversation: '', gravity: '', chat: '', chatBackgrounds: {} };
}

function saveLocal(settings: BackgroundSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: settings }));
}

export function useBackground() {
  const [settings, setSettings] = useState<BackgroundSettings>(loadLocal);

  useEffect(() => {
    if (remoteLoaded) return;
    if (!remoteRequest) {
      remoteRequest = api<BackgroundSettings>('GET', '/api/backgrounds')
        .then(data => {
          const merged: BackgroundSettings = {
            conversation: data.conversation || '',
            gravity: data.gravity || '',
            chat: data.chat || '',
            chatBackgrounds: data.chatBackgrounds || {},
          };
          remoteLoaded = true;
          saveLocal(merged);
        })
        .catch(() => { /* offline */ })
        .finally(() => { remoteRequest = null; });
    }
  }, []);

  useEffect(() => {
    const sync = () => setSettings(loadLocal());
    const syncCustom = (event: Event) => {
      const detail = (event as CustomEvent<BackgroundSettings>).detail;
      setSettings(detail || loadLocal());
    };

    window.addEventListener('storage', sync);
    window.addEventListener(CHANGE_EVENT, syncCustom);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener(CHANGE_EVENT, syncCustom);
    };
  }, []);

  const getBg = useCallback((page: PageKey): string => {
    return settings[page] || '';
  }, [settings]);

  const getChatBg = useCallback((peerId: string): string => {
    if (!peerId) return settings.chat || '';
    return settings.chatBackgrounds[peerId] || settings.chat || '';
  }, [settings]);

  const uploadAndGetUrl = async (file: File): Promise<string> => {
    const compressed = await prepareBackgroundImage(file);
    const base = getServerUrl();
    const token = localStorage.getItem('echo-token');
    const formData = new FormData();
    formData.append('file', compressed);
    const res = await fetch(base + '/api/upload/chat-image', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '上传失败');
    return data.url;
  };

  const setBg = useCallback(async (page: PageKey, imageUrl: string) => {
    const prev = settings;
    const next = { ...prev, [page]: imageUrl };
    setSettings(next);
    saveLocal(next);
    try {
      await api('PUT', '/api/backgrounds', { page, imageUrl });
    } catch (err) {
      setSettings(prev);
      saveLocal(prev);
      throw err;
    }
  }, [settings]);

  const setChatBg = useCallback(async (peerId: string, imageUrl: string) => {
    const prev = settings;
    const next = {
      ...prev,
      chatBackgrounds: imageUrl
        ? { ...prev.chatBackgrounds, [peerId]: imageUrl }
        : Object.fromEntries(Object.entries(prev.chatBackgrounds).filter(([id]) => id !== peerId)),
    };
    setSettings(next);
    saveLocal(next);
    try {
      await api('PUT', '/api/backgrounds/chat', { peerId, imageUrl });
    } catch {
      // Keep the local per-chat background even when this target cannot be persisted remotely.
    }
  }, [settings]);

  const resetBg = useCallback(async (page: PageKey) => {
    const prev = settings;
    const next = { ...prev, [page]: '' };
    setSettings(next);
    saveLocal(next);
    try {
      await api('PUT', '/api/backgrounds', { page, imageUrl: '' });
    } catch (err) {
      setSettings(prev);
      saveLocal(prev);
      throw err;
    }
  }, [settings]);

  const resetAll = useCallback(async () => {
    const defaults: BackgroundSettings = { conversation: '', gravity: '', chat: '', chatBackgrounds: {} };
    setSettings(defaults);
    saveLocal(defaults);
    try {
      await api('PUT', '/api/backgrounds', { page: 'conversation', imageUrl: '' });
      await api('PUT', '/api/backgrounds', { page: 'gravity', imageUrl: '' });
      await api('PUT', '/api/backgrounds', { page: 'chat', imageUrl: '' });
    } catch { /* */ }
  }, []);

  return {
    settings,
    getBg,
    getChatBg,
    setBg,
    setChatBg,
    resetBg,
    resetAll,
    uploadAndGetUrl,
  };
}
