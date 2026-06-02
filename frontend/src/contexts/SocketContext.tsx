import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { getServerUrl } from '../api/client';

interface SocketValue {
  socket: Socket | null;
  connected: boolean;
  onlineUsers: Set<string>;
  isUserOnline: (userId: string) => boolean;
}

const SocketContext = createContext<SocketValue>({
  socket: null,
  connected: false,
  onlineUsers: new Set(),
  isUserOnline: () => false,
});

export function SocketProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());

  const isUserOnline = useCallback((userId: string) => onlineUsers.has(userId), [onlineUsers]);

  useEffect(() => {
    if (!token) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
        setConnected(false);
      }
      return;
    }

    const base = getServerUrl();
    const s = io(base || undefined, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    s.on('connect', () => setConnected(true));
    s.on('disconnect', () => setConnected(false));
    s.on('connect_error', () => setConnected(false));

    s.on('online:update', (data: { userId: string; online: boolean }) => {
      setOnlineUsers(prev => {
        const next = new Set(prev);
        if (data.online) next.add(data.userId);
        else next.delete(data.userId);
        return next;
      });
    });

    s.on('online:list', (data: { userIds: string[] }) => {
      setOnlineUsers(new Set(data.userIds || []));
    });

    // Force online on message or typing events
    const forceOnline = (data: any) => {
      const uid = data?.userId || data?.senderId;
      if (uid) {
        setOnlineUsers(prev => { const next = new Set(prev); next.add(uid); return next; });
      }
    };
    s.on('message:receive', forceOnline);
    s.on('typing:update', forceOnline);

    setSocket(s);

    return () => {
      s.disconnect();
    };
  }, [token]);

  return (
    <SocketContext.Provider value={{ socket, connected, onlineUsers, isUserOnline }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  return useContext(SocketContext);
}
