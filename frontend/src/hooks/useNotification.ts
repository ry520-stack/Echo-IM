import { useState, useCallback, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useSocket } from '../contexts/SocketContext';
import { messagePreview } from '../utils/messagePreview';
import { useAuth } from '../contexts/AuthContext';
import { createNativeMessage, bindNativePushClick } from '../utils/nativePush';

interface NotificationData {
  senderName: string;
  messagePreview: string;
  avatar?: string;
  chatId: string;
}

export function useNotification(listenForMessages = true) {
  const { socket } = useSocket();
  const { user } = useAuth();
  const location = useLocation();
  const [notification, setNotification] = useState<NotificationData | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const audioCtxRef = useRef<AudioContext | null>(null);
  const pathnameRef = useRef(location.pathname);
  const appPausedRef = useRef(false);
  const canUseNotification = typeof window !== 'undefined'
    && 'Notification' in window
    && window.isSecureContext;

  // 用 ref 跟踪 pathname，避免闭包捕获旧路由
  useEffect(() => {
    pathnameRef.current = location.pathname;
  }, [location.pathname]);

  useEffect(() => {
    if (canUseNotification) setPermission(Notification.permission);
    else setPermission('denied');
  }, [canUseNotification]);

  useEffect(() => bindNativePushClick(), []);

  useEffect(() => {
    const onPause = () => { appPausedRef.current = true; };
    const onResume = () => { appPausedRef.current = false; };
    document.addEventListener('pause', onPause, false);
    document.addEventListener('resume', onResume, false);
    return () => {
      document.removeEventListener('pause', onPause);
      document.removeEventListener('resume', onResume);
    };
  }, []);

  const requestPermission = useCallback(async () => {
    if (!canUseNotification) {
      setPermission('denied');
      return 'denied' as NotificationPermission;
    }
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      return result;
    } catch {
      return 'denied' as NotificationPermission;
    }
  }, []);

  const playSound = useCallback(() => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      if (!audioCtxRef.current) audioCtxRef.current = new AudioContextClass();
      if (audioCtxRef.current.state === 'suspended') audioCtxRef.current.resume();

      const ctx = audioCtxRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 0.05);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.15);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.15);

      // 节点使用完毕后 disconnect，防止内存泄漏
      osc.onended = () => { osc.disconnect(); gain.disconnect(); };
    } catch { /* autoplay blocked */ }
  }, []);

  // 组件卸载时释放 AudioContext
  useEffect(() => {
    return () => {
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        audioCtxRef.current.close().catch(() => {});
      }
    };
  }, []);

  const showNotification = useCallback((data: NotificationData) => {
    const activePeerIds = (localStorage.getItem('echo-active-chat-peer') || '').split(',').filter(Boolean);
    if (activePeerIds.includes(String(data.chatId))) return;

    setNotification(data);
    setIsVisible(true);
    playSound();

    const isBackground = document.visibilityState === 'hidden' || appPausedRef.current;

    if (isBackground) {
      const sentNative = createNativeMessage(data.senderName, data.messagePreview, { chatId: data.chatId });
      if (sentNative) return;
    }

    if (canUseNotification && isBackground && permission === 'granted') {
      try {
        const notification = new Notification(data.senderName, {
          body: data.messagePreview,
          icon: './favicon.svg',
          tag: data.chatId,
          data: { url: `#/chat/${data.chatId}` },
        });
        notification.onclick = () => {
          window.focus();
          window.location.hash = `#/chat/${data.chatId}`;
          notification.close();
        };
      } catch { /* */ }
    }
  }, [canUseNotification, permission, playSound]);

  const hideNotification = useCallback(() => {
    setIsVisible(false);
  }, []);

  // Listen for socket messages
  useEffect(() => {
    if (!listenForMessages || !socket) return;
    const handler = (msg: any) => {
      if (!msg.senderId || !msg.content) return;
      if (msg.senderId === user?.id) return;
      const preview = messagePreview(msg.type, msg.content, 40);
      const peerId = msg.sender?.digitalId ? String(msg.sender.digitalId) : msg.senderId;
      showNotification({
        senderName: msg.sender?.nickname || msg.sender?.username || '新消息',
        messagePreview: preview,
        avatar: msg.sender?.avatar,
        chatId: peerId,
      });
    };
    socket.on('message:receive', handler);
    return () => { socket.off('message:receive', handler); };
  }, [listenForMessages, socket, showNotification, user?.id]);

  return { notification, isVisible, showNotification, hideNotification, permission, requestPermission };
}
