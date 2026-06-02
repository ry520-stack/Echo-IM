import { useNavigate } from 'react-router-dom';
import { useNotification } from '../hooks/useNotification';
import NotificationBanner from './NotificationBanner';
import { useEffect } from 'react';
import { useSocket } from '../contexts/SocketContext';
import { useToast } from '../contexts/ToastContext';

export default function NotificationProvider({ children }: { children: React.ReactNode }) {
  const nav = useNavigate();
  const { notification, isVisible, hideNotification } = useNotification();
  const { socket } = useSocket();
  const toast = useToast();

  useEffect(() => {
    if (!socket) return;
    const onSos = (data: { message?: string }) => toast(data.message || '对方想你了', 'info');
    socket.on('couple:sos', onSos);
    return () => { socket.off('couple:sos', onSos); };
  }, [socket, toast]);

  return (
    <>
      {children}
      <NotificationBanner
        isVisible={isVisible}
        notification={notification}
        onClose={hideNotification}
        onClick={(chatId) => { hideNotification(); nav(`/chat/${chatId}`); }}
      />
    </>
  );
}
