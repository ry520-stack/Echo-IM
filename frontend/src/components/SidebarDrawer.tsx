import { useEffect, useState, type ComponentType } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell,
  ChevronRight,
  Clock3,
  Coffee,
  Heart,
  LogOut,
  MessageCircle,
  Moon,
  Orbit,
  Settings,
  Shield,
  Sparkles,
  Sun,
  Users,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { useTheme } from '../contexts/ThemeContext';
import { api } from '../api/client';
import GooeyToggle from './GooeyToggle';
import { assetUrl } from '../utils/assetUrl';

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

interface NavSection {
  label: string;
  items: NavItem[];
}

export default function SidebarDrawer({ open, onClose }: Props) {
  const { user, logout, updateUser } = useAuth();
  const { socket } = useSocket();
  const { theme, toggleTheme } = useTheme();
  const nav = useNavigate();
  const location = useLocation();
  const [editingStatus, setEditingStatus] = useState(false);
  const [statusText, setStatusText] = useState(user?.status || '');
  const [presence, setPresence] = useState(user?.presence || 'online');
  const [unreadMoments, setUnreadMoments] = useState(() => localStorage.getItem('echo-moments-has-unread') === 'true');
  const [unreadFriends, setUnreadFriends] = useState(false);
  const [coupleStatus, setCoupleStatus] = useState<'none' | 'pending' | 'active'>('none');
  const [unreadCouple, setUnreadCouple] = useState(false);

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

  const savePresence = async (next: 'online' | 'busy' | 'away' | 'dnd') => {
    setPresence(next);
    try {
      await api('PUT', '/api/users/me', { presence: next });
      updateUser({ presence: next });
    } catch {
      setPresence(user?.presence || 'online');
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

  useEffect(() => {
    if (!open) return;
    api<{ status?: 'none' | 'pending' | 'active' }>('GET', '/api/couples')
      .then(data => setCoupleStatus(data.status || 'none'))
      .catch(() => setCoupleStatus('none'));
  }, [open]);

  useEffect(() => {
    if (!socket) return;
    const onCoupleUpdated = () => {
      setUnreadCouple(true);
      api<{ status?: 'none' | 'pending' | 'active' }>('GET', '/api/couples')
        .then(data => setCoupleStatus(data.status || 'none'))
        .catch(() => {});
    };
    socket.on('couple:updated', onCoupleUpdated);
    return () => { socket.off('couple:updated', onCoupleUpdated); };
  }, [socket]);

  const navSections: NavSection[] = [
    { label: '社交', items: [{
      title: '通讯录',
      subtitle: '好友与请求',
      path: '/friends',
      Icon: Users,
      accent: 'text-sky-500 bg-sky-50 dark:bg-sky-950/30',
      unread: unreadFriends,
      beforeNavigate: () => setUnreadFriends(false),
    },
    {
      title: '群聊',
      subtitle: '创建群、拉好友与群资料',
      path: '/groups',
      Icon: MessageCircle,
      accent: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950/30',
    }] },
    { label: '内容与工具', items: [{
      title: '动态',
      subtitle: '好友近况与可见星域',
      path: '/moments',
      Icon: Bell,
      accent: 'text-violet-500 bg-violet-50 dark:bg-violet-950/30',
      unread: unreadMoments,
      beforeNavigate: () => {
        localStorage.setItem('echo-moments-last-read', String(Date.now()));
        localStorage.setItem('echo-moments-has-unread', 'false');
        setUnreadMoments(false);
      },
    },
    {
      title: '星域',
      subtitle: '分组与动态权限',
      path: '/star-zones',
      Icon: Orbit,
      accent: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950/30',
    },
    {
      title: '回声胶囊',
      subtitle: '定时消息与私密记录',
      path: '/time-capsule',
      Icon: Clock3,
      accent: 'text-amber-500 bg-amber-50 dark:bg-amber-950/30',
    }] },
  ];

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-50 bg-black/35 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open && (
          <motion.aside
            className="fixed inset-y-0 left-0 z-50 flex w-[84vw] max-w-[340px] flex-col overflow-hidden border-r border-gray-200 bg-white shadow-2xl dark:border-gray-800 dark:bg-gray-950"
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', stiffness: 220, damping: 26 }}
          >
            <div className="flex min-h-0 flex-1 flex-col">
              <section className="bg-gradient-to-br from-primary-50 via-white to-violet-50 px-5 pb-4 pt-6 dark:from-primary-950/30 dark:via-gray-950 dark:to-violet-950/20">
                <div className="mb-3 flex items-center gap-3">
                  <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl bg-primary-500 text-white shadow-lg shadow-primary-500/20">
                    {user?.avatar ? (
                      <img src={assetUrl(user.avatar)} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xl font-bold">
                        {(user?.nickname || user?.username || 'E')[0]?.toUpperCase()}
                      </div>
                    )}
                    <span className={`absolute bottom-1 right-1 h-2.5 w-2.5 rounded-full border-2 border-white dark:border-gray-950 ${presence === 'online' ? 'bg-emerald-500' : presence === 'busy' ? 'bg-rose-500' : presence === 'away' ? 'bg-amber-400' : 'bg-slate-400'}`} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-semibold text-gray-950 dark:text-gray-50">
                      {user?.nickname || user?.username || 'Echo'}
                    </p>
                    <p className="mt-0.5 font-mono text-xs text-gray-400">Echo ID: {user?.digitalId || '--'}</p>
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
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 outline-none focus:border-primary-400 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-200"
                    autoFocus
                  />
                ) : (
                  <button
                    onClick={() => setEditingStatus(true)}
                    className="flex w-full items-center gap-2 rounded-xl bg-gray-50 px-3 py-2 text-left text-sm text-gray-500 transition-colors hover:bg-gray-100 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800"
                  >
                    <Sparkles size={15} className="shrink-0 text-primary-500" />
                    <span className="truncate">{user?.status || '设置个性签名...'}</span>
                  </button>
                )}
                <div className="mt-3 grid grid-cols-4 gap-1 rounded-2xl bg-white/80 p-1 shadow-sm dark:bg-gray-900/70">
                  {([
                    ['online', '在线', Sun],
                    ['busy', '忙碌', Coffee],
                    ['away', '离开', Moon],
                    ['dnd', '勿扰', Shield],
                  ] as const).map(([key, label, Icon]) => (
                    <button key={key} type="button" onClick={() => savePresence(key)} className={`flex flex-col items-center gap-1 rounded-xl px-1 py-2 text-[10px] transition-colors ${presence === key ? 'bg-primary-500 text-white shadow-sm' : 'text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
                      <Icon size={13} />{label}
                    </button>
                  ))}
                </div>
              </section>

              <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
                <button
                  onClick={() => { setUnreadCouple(false); navigate('/?space=relationship'); }}
                  className="mb-3 flex w-full items-center gap-3 rounded-2xl border border-rose-100 bg-gradient-to-r from-rose-50 to-fuchsia-50 px-3 py-2.5 text-left shadow-sm transition-transform active:scale-[0.98] dark:border-rose-900/40 dark:from-rose-950/35 dark:to-fuchsia-950/25"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-500 text-white shadow-md shadow-rose-500/20"><Heart size={19} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 text-sm font-semibold text-rose-700 dark:text-rose-200">情侣空间{unreadCouple && <span className="h-2 w-2 rounded-full bg-red-500" />}</span>
                    <span className="mt-0.5 block truncate text-xs text-rose-400">{coupleStatus === 'active' ? '纪念日、天气、宠物与甜蜜回忆' : coupleStatus === 'pending' ? '有一条情侣绑定申请待处理' : '邀请情侣开启情侣空间'}</span>
                  </span>
                  <ChevronRight size={16} className="text-rose-300" />
                </button>

                {navSections.map(section => <section key={section.label} className="mb-3">
                  <p className="mb-1 px-3 text-[11px] font-semibold tracking-widest text-gray-300 dark:text-gray-600">{section.label}</p>
                  <div className="space-y-1">{section.items.map(({ title, subtitle, path, Icon, accent, unread, beforeNavigate }) => (
                  <button
                    key={path}
                    onClick={() => navigate(path, beforeNavigate)}
                    className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-900 ${location.pathname === path ? 'bg-gray-50 dark:bg-gray-900' : ''}`}
                  >
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${accent}`}>
                      <Icon size={20} />
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
                  ))}</div>
                </section>)}
              </nav>

              <footer className="shrink-0 border-t border-gray-100 bg-white px-3 py-2 dark:border-gray-800 dark:bg-gray-950">
                <div className="flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2 dark:bg-gray-900">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-200">外观</span>
                  <GooeyToggle isDark={theme === 'dark'} onToggle={toggleTheme} />
                </div>

                <button
                  onClick={() => navigate('/settings')}
                  className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-900"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gray-100 text-gray-500 dark:bg-gray-900 dark:text-gray-400">
                    <Settings size={18} />
                  </span>
                  <span className="flex-1">设置</span>
                  <ChevronRight size={16} className="text-gray-300" />
                </button>

                <button
                  onClick={() => { logout(); nav('/login'); }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-medium text-red-500 transition-colors hover:bg-red-50 dark:hover:bg-red-950/20"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-50 text-red-500 dark:bg-red-950/30">
                    <LogOut size={18} />
                  </span>
                  <span className="flex-1">退出登录</span>
                </button>

              </footer>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}
