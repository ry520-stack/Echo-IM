import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { api } from '../api/client';
import ChatWindow from '../components/ChatWindow';
import ConversationList from '../components/ConversationList';
import { CoupleAlbumPage } from '../components/RelationshipSpaceContent';
import SidebarDrawer from '../components/SidebarDrawer';
import SpacesHub from '../components/SpacesHub';
import { useSocket } from '../contexts/SocketContext';
import { useToast } from '../contexts/ToastContext';

interface Peer {
  id: string;
  username: string;
  nickname: string;
  avatar: string;
  digitalId: number;
  lastSeenAt: string;
  status: string;
  allowStrangerMessage?: boolean;
}

interface GroupInfo {
  id: string;
  name: string;
  creatorId: string;
  role: string;
  memberCount: number;
  avatar?: string;
  notice?: string;
}

type ChatTarget = { type: 'user'; peer: Peer } | { type: 'group'; group: GroupInfo } | null;

export default function ChatPage() {
  const { socket } = useSocket();
  const toast = useToast();
  const { id: paramId } = useParams();
  const [searchParams] = useSearchParams();
  const nav = useNavigate();
  const pagerRef = useRef<HTMLDivElement>(null);
  const edgeSwipeRef = useRef({ x: 0, tracking: false });
  const animFrameRef = useRef(0);
  const [target, setTarget] = useState<ChatTarget>(null);
  const [searchError, setSearchError] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [page, setPage] = useState(0);
  const [showChatMobile, setShowChatMobile] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [searchTab, setSearchTab] = useState<'contacts' | 'messages'>('contacts');

  useEffect(() => {
    if (!socket) return;
    const onSos = (data: { message?: string }) => toast(data.message || '对方想你了', 'info');
    socket.on('couple:sos', onSos);
    return () => { socket.off('couple:sos', onSos); };
  }, [socket, toast]);

  useEffect(() => () => cancelAnimationFrame(animFrameRef.current), []);

  const handleScroll = useCallback(() => {
    cancelAnimationFrame(animFrameRef.current);
    animFrameRef.current = requestAnimationFrame(() => {
      const el = pagerRef.current;
      if (!el) return;
      const pageIndex = Math.max(0, Math.min(2, Math.round(el.scrollLeft / el.clientWidth)));
      setPage(prev => prev === pageIndex ? prev : pageIndex);
    });
  }, []);

  const switchPage = useCallback((idx: number) => {
    setPage(idx);
    setSearchText('');
    pagerRef.current?.scrollTo({ left: idx * pagerRef.current.clientWidth, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    if (searchParams.get('space') !== 'couple' || (paramId && showChatMobile)) return;
    window.setTimeout(() => switchPage(1), 0);
  }, [paramId, searchParams, showChatMobile, switchPage]);

  useEffect(() => {
    if (!paramId) {
      setTarget(null);
      setSearchError('');
      setShowChatMobile(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const users = await api<Peer[]>('GET', `/api/users/search?q=${encodeURIComponent(paramId)}`);
        if (cancelled) return;
        const peer = users.find(item => item.digitalId.toString() === paramId || item.id === paramId);
        if (peer) {
          setTarget({ type: 'user', peer });
          setSearchError('');
          setShowChatMobile(true);
          return;
        }
      } catch {
        // Try group lookup below.
      }

      try {
        const groups = await api<GroupInfo[]>('GET', '/api/groups');
        if (cancelled) return;
        const group = groups.find(item => item.id === paramId);
        if (group) {
          setTarget({ type: 'group', group });
          setSearchError('');
          setShowChatMobile(true);
          return;
        }
      } catch {
        // Fall through to not found.
      }

      if (!cancelled) setSearchError(`未找到 ${paramId}`);
    })();

    return () => { cancelled = true; };
  }, [paramId]);

  const getChatWindowProps = () => {
    if (!paramId) return { peerId: '', peer: null, chatType: 'user' as const };
    if (!target) return { peerId: paramId, peer: null, chatType: 'user' as const };
    if (target.type === 'user') return { peerId: target.peer.id, peer: target.peer, chatType: 'user' as const };
    return {
      peerId: target.group.id,
      peer: null,
      chatType: 'group' as const,
      groupName: target.group.name,
      groupAvatar: target.group.avatar,
    };
  };

  const handleBackToList = () => {
    setShowChatMobile(false);
    nav('/');
  };

  const isChatOpen = !!paramId && showChatMobile;

  return (
    <div
      className="flex h-full w-full flex-col overflow-hidden bg-gray-50 dark:bg-gray-950"
      onTouchStart={(e) => {
        if (isChatOpen || page !== 0) return;
        const x = e.touches[0].clientX;
        edgeSwipeRef.current = x < window.innerWidth * 0.15 ? { x, tracking: true } : { x, tracking: false };
      }}
      onTouchEnd={(e) => {
        if (isChatOpen || page !== 0) return;
        const { x, tracking } = edgeSwipeRef.current;
        if (tracking && e.changedTouches[0].clientX - x > 50) {
          e.stopPropagation();
          setDrawerOpen(true);
        }
        edgeSwipeRef.current.tracking = false;
      }}
    >
      <SidebarDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />

      {!isChatOpen && (
        <header className="shrink-0 border-b border-gray-100/60 bg-white/88 backdrop-blur-md dark:border-gray-800/60 dark:bg-gray-900/88">
          <div className="flex h-14 items-center gap-3 px-4">
            <button onClick={() => setDrawerOpen(true)} className="rounded-xl p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800">☰</button>
            <h1 className="min-w-0 flex-1 truncate text-lg font-extrabold tracking-normal text-gray-950 dark:text-gray-50">
              {page === 0 ? 'Echo' : page === 1 ? '空间' : '相册'}
            </h1>
            {page === 0 && (
              <button onClick={() => nav('/friends')} className="rounded-xl bg-primary-500 px-4 py-1.5 text-xs font-medium text-white hover:bg-primary-600">
                + 好友
              </button>
            )}
          </div>

          {page === 0 && (
            <div className="px-4 pb-2">
              <div className="flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 dark:bg-zinc-900/80">
                <span className="text-sm text-slate-400">⌕</span>
                <input
                  type="text"
                  placeholder="搜索好友或聊天记录..."
                  className="flex-1 bg-transparent text-sm text-gray-700 outline-none placeholder:text-slate-400 dark:text-gray-300"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                />
                {searchText && <button onClick={() => setSearchText('')} className="text-xs text-slate-400 hover:text-slate-600">✕</button>}
              </div>
            </div>
          )}

          {page === 0 && searchText.trim() && (
            <div className="flex gap-1 px-4 pb-2">
              <button onClick={() => setSearchTab('contacts')} className={`rounded-full px-3 py-1 text-xs transition-colors ${searchTab === 'contacts' ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-500 dark:bg-gray-800'}`}>搜索好友</button>
              <button onClick={() => setSearchTab('messages')} className={`rounded-full px-3 py-1 text-xs transition-colors ${searchTab === 'messages' ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-500 dark:bg-gray-800'}`}>搜索聊天记录</button>
            </div>
          )}
        </header>
      )}

      <style>{`.pager-snap::-webkit-scrollbar{display:none}`}</style>
      <div
        ref={pagerRef}
        className="pager-snap flex flex-1 snap-x snap-mandatory overflow-x-auto overflow-y-hidden"
        style={{ scrollBehavior: 'auto', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        onScroll={handleScroll}
      >
        <div className="h-full shrink-0 snap-start snap-always overflow-hidden" style={{ width: '100%', minWidth: '100%' }}>
          <div className={`h-full flex-col overflow-hidden md:flex ${paramId ? 'md:w-80 md:border-r md:border-gray-200 md:dark:border-gray-700' : ''} ${isChatOpen ? 'hidden md:flex' : 'flex'}`}>
            <ConversationList searchText={searchText} searchTab={searchTab} />
          </div>
        </div>

        <div className="h-full shrink-0 snap-start snap-always overflow-hidden" style={{ width: '100%', minWidth: '100%' }}>
          <SpacesHub onOpenAlbum={() => switchPage(2)} />
        </div>

        <div className="h-full shrink-0 snap-start snap-always overflow-hidden" style={{ width: '100%', minWidth: '100%' }}>
          <CoupleAlbumPage onBack={() => switchPage(1)} />
        </div>
      </div>

      {paramId && (
        <div className="absolute inset-y-0 right-0 left-1/2 hidden flex-1 flex-col md:flex">
          {searchError ? (
            <div className="flex flex-1 flex-col items-center justify-center">
              <p className="mb-3 text-4xl">⌕</p>
              <p className="text-sm text-gray-400">{searchError}</p>
              <button onClick={() => nav('/')} className="mt-3 text-sm text-primary-500 hover:underline">返回首页</button>
            </div>
          ) : (
            <ChatWindow {...getChatWindowProps()} onBack={handleBackToList} initialOrbit={searchParams.get('orbit') === '1'} focusMessageId={searchParams.get('focus') || undefined} />
          )}
        </div>
      )}

      {!isChatOpen && (
        <div className="flex shrink-0 justify-center gap-2 border-t border-gray-100/60 bg-white/80 py-2.5 backdrop-blur-md dark:border-gray-800/60 dark:bg-gray-900/80">
          {[0, 1, 2].map(i => (
            <button
              key={i}
              onClick={() => switchPage(i)}
              className={`rounded-full transition-all duration-300 ${page === i ? 'h-1.5 w-6 bg-primary-500' : 'h-1.5 w-1.5 bg-gray-300 dark:bg-gray-600'}`}
            />
          ))}
        </div>
      )}

      <AnimatePresence>
        {isChatOpen && (
          <motion.div className="fixed inset-0 z-50 bg-white dark:bg-gray-950 md:hidden" initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', stiffness: 150, damping: 20, mass: 0.8 }}>
            {searchError ? (
              <div className="flex h-full flex-col items-center justify-center">
                <p className="mb-3 text-4xl">⌕</p>
                <p className="text-sm text-gray-400">{searchError}</p>
                <button onClick={() => nav('/')} className="mt-3 text-sm text-primary-500 hover:underline">返回首页</button>
              </div>
            ) : (
              <ChatWindow {...getChatWindowProps()} onBack={handleBackToList} initialOrbit={searchParams.get('orbit') === '1'} focusMessageId={searchParams.get('focus') || undefined} />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
