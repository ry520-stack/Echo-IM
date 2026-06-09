import { useEffect, useState, type ComponentType } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Bell,
  ChevronRight,
  Clock3,
  Heart,
  LogOut,
  MessageCircle,
  Orbit,
  Settings,
  Sparkles,
  Users,
} from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { useTheme } from '../contexts/ThemeContext';
import { assetUrl } from '../utils/assetUrl';
import GooeyToggle from './GooeyToggle';

interface Props {
  open: boolean;
  onClose: () => void;
}

interface NavItem {
  title: string;
  subtitle: string;
  path: string;
  Icon: ComponentType<{ size?: number; className?: string }>;
  accent: string;
  unread?: boolean;
  beforeNavigate?: () => void;
}

export default function SidebarDrawer({ open, onClose }: Props) {
  const { user, logout, updateUser } = useAuth();
  const { socket } = useSocket();
  const { theme, toggleTheme } = useTheme();
  const nav = useNavigate();
  const [editingStatus, setEditingStatus] = useState(false);
  const [statusText, setStatusText] = useState(user?.status || '');
  const [unreadMoments, setUnreadMoments] = useState(() => localStorage.getItem('echo-moments-has-unread') === 'true');
  const [unreadFriends, setUnreadFriends] = useState(false);

  const navigate = (path: string, beforeNavigate?: () => void) => {
    beforeNavigate?.();
    onClose();
    window.setTimeout(() => nav(path), 0);
  };

  const saveStatus = async () => {
    setEditingStatus(false);
    if (statusText === (user?.status || '')) return;
    try {
      await api('PUT', '/api/users/me', { status: statusText });
      updateUser({ status: statusText });
    } catch {
      setStatusText(user?.status || '');
    }
  };

  useEffect(() => {
    if (!socket) return;
    const onMoment = (data: { userId?: string }) => {
      if (data.userId === user?.id) return;
      localStorage.setItem('echo-moments-has-unread', 'true');
      setUnreadMoments(true);
    };
    const onFriendRequest = () => setUnreadFriends(true);
    socket.on('moment:new', onMoment);
    socket.on('friend:request', onFriendRequest);
    socket.on('friend:accepted', onFriendRequest);
    return () => {
      socket.off('moment:new', onMoment);
      socket.off('friend:request', onFriendRequest);
      socket.off('friend:accepted', onFriendRequest);
    };
  }, [socket, user?.id]);

  const navItems: NavItem[] = [
    {
      title: '空间中心',
      subtitle: '情侣、朋友与家人空间',
      path: '/?space=couple',
      Icon: Heart,
      accent: 'bg-rose-50 text-rose-500 dark:bg-rose-950/30',
    },
    {
      title: '通讯录',
      subtitle: '好友与请求',
      path: '/friends',
      Icon: Users,
      accent: 'bg-sky-50 text-sky-500 dark:bg-sky-950/30',
      unread: unreadFriends,
      beforeNavigate: () => setUnreadFriends(false),
    },
    {
      title: '群聊',
      subtitle: '群资料与成员',
      path: '/groups',
      Icon: MessageCircle,
      accent: 'bg-emerald-50 text-emerald-500 dark:bg-emerald-950/30',
    },
    {
      title: '动态',
      subtitle: '好友近况',
      path: '/moments',
      Icon: Bell,
      accent: 'bg-violet-50 text-violet-500 dark:bg-violet-950/30',
      unread: unreadMoments,
      beforeNavigate: () => {
        localStorage.setItem('echo-moments-last-read', String(Date.now()));
        localStorage.setItem('echo-moments-has-unread', 'false');
        setUnreadMoments(false);
      },
    },
    {
      title: '好友分组',
      subtitle: '分组与权限',
      path: '/star-zones',
      Icon: Orbit,
      accent: 'bg-teal-50 text-teal-500 dark:bg-teal-950/30',
    },
    {
      title: '回声胶囊',
      subtitle: '定时消息',
      path: '/time-capsule',
      Icon: Clock3,
      accent: 'bg-amber-50 text-amber-500 dark:bg-amber-950/30',
    },
  ];

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-50 bg-gray-950/32 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open && (
          <motion.aside
            className="fixed inset-y-0 left-0 z-50 flex w-[72vw] max-w-[276px] flex-col bg-[#f8f8fb] p-2.5 shadow-2xl dark:bg-gray-950"
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', stiffness: 240, damping: 28 }}
          >
            <section className="rounded-[24px] bg-white p-3.5 shadow-sm ring-1 ring-black/[0.04] dark:bg-gray-900 dark:ring-white/[0.05]">
              <div className="flex items-center gap-3">
                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl bg-primary-500 text-white shadow-lg shadow-primary-500/20">
                  {user?.avatar ? (
                    <img src={assetUrl(user.avatar)} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xl font-bold">
                      {(user?.nickname || user?.username || 'E')[0]?.toUpperCase()}
                    </div>
                  )}
                  <span className="absolute bottom-1.5 right-1.5 h-3 w-3 rounded-full border-2 border-white bg-emerald-500 dark:border-gray-900" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-bold text-gray-950 dark:text-gray-50">{user?.nickname || user?.username || 'Echo'}</p>
                  <p className="mt-1 font-mono text-xs text-gray-400">Echo ID: {user?.digitalId || '--'}</p>
                </div>
              </div>

              {editingStatus ? (
                <input
                  type="text"
                  value={statusText}
                  onChange={(e) => setStatusText(e.target.value)}
                  onBlur={saveStatus}
                  onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                  placeholder="设置个性签名..."
                  className="mt-3 w-full rounded-2xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 outline-none focus:border-primary-400 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-200"
                  autoFocus
                />
              ) : (
                <button
                  onClick={() => setEditingStatus(true)}
                  className="mt-3 flex w-full items-center gap-2 rounded-2xl bg-gray-50 px-3 py-2 text-left text-sm text-gray-500 transition-colors hover:bg-gray-100 dark:bg-gray-950 dark:text-gray-400"
                >
                  <Sparkles size={15} className="shrink-0 text-primary-500" />
                  <span className="truncate">{user?.status || '设置个性签名...'}</span>
                </button>
              )}
            </section>

            <nav className="mt-2.5 min-h-0 flex-1 space-y-1 overflow-y-auto rounded-[24px] bg-white p-1.5 shadow-sm ring-1 ring-black/[0.04] dark:bg-gray-900 dark:ring-white/[0.05]">
              {navItems.map(({ title, subtitle, path, Icon, accent, unread, beforeNavigate }) => (
                <button
                  key={path}
                  onClick={() => navigate(path, beforeNavigate)}
                  className="group flex w-full items-center gap-2.5 rounded-2xl px-2.5 py-2.5 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/70"
                >
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl ${accent}`}>
                    <Icon size={18} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
                      {title}
                      {unread && <span className="h-2 w-2 rounded-full bg-red-500" />}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-gray-400">{subtitle}</span>
                  </span>
                  <ChevronRight size={16} className="text-gray-300 transition-transform group-hover:translate-x-0.5" />
                </button>
              ))}
            </nav>

            <footer className="mt-2.5 rounded-[24px] bg-white p-1.5 shadow-sm ring-1 ring-black/[0.04] dark:bg-gray-900 dark:ring-white/[0.05]">
              <div className="mb-1 flex items-center justify-between rounded-2xl bg-gray-50 px-3 py-3 dark:bg-gray-950">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-200">外观</span>
                <GooeyToggle isDark={theme === 'dark'} onToggle={toggleTheme} />
              </div>

              <button
                onClick={() => navigate('/settings')}
                className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800/70"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gray-100 text-gray-500 dark:bg-gray-950 dark:text-gray-400">
                  <Settings size={18} />
                </span>
                <span className="flex-1">设置</span>
                <ChevronRight size={16} className="text-gray-300" />
              </button>

              <button
                onClick={() => { logout(); nav('/login'); }}
                className="mt-1 flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm font-medium text-red-500 transition-colors hover:bg-red-50 dark:hover:bg-red-950/20"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-red-50 text-red-500 dark:bg-red-950/30">
                  <LogOut size={18} />
                </span>
                <span className="flex-1">退出登录</span>
              </button>
            </footer>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}
