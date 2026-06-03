import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import ConversationList from '../components/ConversationList';
import ChatWindow from '../components/ChatWindow';
import SidebarDrawer from '../components/SidebarDrawer';
import RelationshipSpaceContent from '../components/RelationshipSpaceContent';
import { api } from '../api/client';

interface Peer {
  id: string; username: string; nickname: string; avatar: string;
  digitalId: number; lastSeenAt: string; status: string; presence?: 'online' | 'busy' | 'away' | 'dnd';
  allowStrangerMessage?: boolean;
}
interface GroupInfo {
  id: string; name: string; creatorId: string; role: string; memberCount: number;
  avatar?: string; notice?: string;
}
type ChatTarget = { type: 'user'; peer: Peer } | { type: 'group'; group: GroupInfo } | null;

/** 绾挎€ф彃鍊?*/
function lerp(a: number, b: number, t: number) { return a + (b - a) * Math.max(0, Math.min(1, t)); }

export default function ChatPage() {
  const { user } = useAuth();
  const { connected } = useSocket();
  const { id: paramId } = useParams();
  const [searchParams] = useSearchParams();
  const nav = useNavigate();
  const [target, setTarget] = useState<ChatTarget>(null);
  const [searchError, setSearchError] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [page, setPage] = useState(0);
  const [showChatMobile, setShowChatMobile] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [searchTab, setSearchTab] = useState<'contacts' | 'messages'>('contacts');

  // 鈹€鈹€鈹€ Refs 鈹€鈹€鈹€
  const pagerRef = useRef<HTMLDivElement>(null);
  const edgeSwipeRef = useRef({ x: 0, tracking: false });

  // 鍔ㄧ敾鍏冪礌 refs锛堢洿鎺?DOM 鎿嶄綔锛岄浂 setState锛?
  const echoTitleRef = useRef<HTMLSpanElement>(null);
  const gravTitleRef = useRef<HTMLSpanElement>(null);
  const echoBtnRef = useRef<HTMLButtonElement>(null);
  const gravBtnRef = useRef<HTMLButtonElement>(null);
  const echoSearchRef = useRef<HTMLDivElement>(null);
  const gravSearchRef = useRef<HTMLDivElement>(null);
  const echoTabsRef = useRef<HTMLDivElement>(null);

  // 鈹€鈹€鈹€ 婊氬姩椹卞姩鍔ㄧ敾锛堢函 DOM锛屼笉瑙﹀彂 React 娓叉煋锛夆攢鈹€鈹€
  const animFrameRef = useRef(0);
  useEffect(() => { return () => { cancelAnimationFrame(animFrameRef.current); }; }, []);
  const handleScroll = useCallback(() => {
    cancelAnimationFrame(animFrameRef.current);
    animFrameRef.current = requestAnimationFrame(() => {
      const el = pagerRef.current;
      if (!el) return;
      const p = el.scrollLeft / el.clientWidth; // 0 鈫?1

      // 鏍囬浜ゅ弶娣″叆娣″嚭 + 浣嶇Щ
      if (echoTitleRef.current) {
        echoTitleRef.current.style.opacity = String(lerp(1, 0, p * 2));
        echoTitleRef.current.style.transform = `translateX(${lerp(0, -16, p * 2)}px)`;
      }
      if (gravTitleRef.current) {
        gravTitleRef.current.style.opacity = String(lerp(0, 1, (p - 0.3) * 2));
        gravTitleRef.current.style.transform = `translateX(${lerp(16, 0, (p - 0.3) * 2)}px)`;
      }

      // 鎸夐挳浜ゅ弶
      if (echoBtnRef.current) {
        echoBtnRef.current.style.opacity = String(lerp(1, 0, p * 2));
        echoBtnRef.current.style.pointerEvents = p < 0.5 ? 'auto' : 'none';
      }
      if (gravBtnRef.current) {
        gravBtnRef.current.style.opacity = String(lerp(0, 1, (p - 0.3) * 2));
        gravBtnRef.current.style.pointerEvents = p > 0.5 ? 'auto' : 'none';
      }

      // 鎼滅储妗嗕氦鍙?
      if (echoSearchRef.current) {
        echoSearchRef.current.style.opacity = String(lerp(1, 0, p * 2));
        echoSearchRef.current.style.transform = `translateX(${lerp(0, -20, p * 2)}px)`;
        echoSearchRef.current.style.pointerEvents = p < 0.5 ? 'auto' : 'none';
      }
      if (gravSearchRef.current) {
        gravSearchRef.current.style.opacity = String(lerp(0, 1, (p - 0.3) * 2));
        gravSearchRef.current.style.transform = `translateX(${lerp(20, 0, (p - 0.3) * 2)}px)`;
        gravSearchRef.current.style.pointerEvents = p > 0.5 ? 'auto' : 'none';
      }

      // 鎼滅储 tabs锛堜粎棣栭〉锛?
      if (echoTabsRef.current) {
        echoTabsRef.current.style.opacity = String(lerp(1, 0, p * 2));
      }

      // 鍚屾椤电爜 state锛堜粎鍦ㄨ竟鐣屽垏鎹紝鐢ㄤ簬鏉′欢娓叉煋鎸夐挳/tabs锛?
      const newPage = p < 0.5 ? 0 : 1;
      setPage(prev => prev !== newPage ? newPage : prev);
    });
  }, []);

  // 鈹€鈹€鈹€ 绋嬪簭鍖栧垏椤?鈹€鈹€鈹€
  const switchPage = useCallback((idx: number) => {
    setPage(idx);
    setSearchText('');
    pagerRef.current?.scrollTo({ left: idx * pagerRef.current.clientWidth, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    if (searchParams.get('space') !== 'relationship') return;
    const timer = window.setTimeout(() => switchPage(1), 0);
    return () => window.clearTimeout(timer);
  }, [searchParams, switchPage]);

  // 鈹€鈹€鈹€ 璺敱鍙傛暟澶勭悊 鈹€鈹€鈹€
  useEffect(() => {
    if (!paramId) { setTarget(null); setSearchError(''); setShowChatMobile(false); return; }
    let cancelled = false;
    (async () => {
      try {
        const r = await api<Peer[]>('GET', `/api/users/search?q=${encodeURIComponent(paramId)}`);
        if (cancelled) return;
        const f = r.find(x => x.digitalId.toString() === paramId || x.id === paramId);
        if (f) { setTarget({ type: 'user', peer: f }); setSearchError(''); setShowChatMobile(true); return; }
      } catch {}
      try {
        const gs = await api<GroupInfo[]>('GET', '/api/groups');
        if (cancelled) return;
        const g = gs.find(x => x.id === paramId);
        if (g) { setTarget({ type: 'group', group: g }); setSearchError(''); setShowChatMobile(true); return; }
      } catch {}
      if (!cancelled) setSearchError(`鏈壘鍒? ${paramId}`);
    })();
    return () => { cancelled = true; };
  }, [paramId]);

  const getChatWindowProps = () => {
    if (!paramId) return { peerId: '', peer: null, chatType: 'user' as const };
    if (!target) return { peerId: paramId, peer: null, chatType: 'user' as const };
    if (target.type === 'user') return { peerId: target.peer.id, peer: target.peer, chatType: 'user' as const };
    return { peerId: target.group.id, peer: null, chatType: 'group' as const, groupName: target.group.name, groupAvatar: target.group.avatar };
  };

  const handleBackToList = () => { setShowChatMobile(false); nav('/'); };
  const isChatOpen = paramId && showChatMobile;

  return (
    <div className="w-full h-full overflow-hidden flex flex-col bg-gray-50 dark:bg-gray-950"
      onTouchStart={(e) => {
        if (isChatOpen) return;
        const x = e.touches[0].clientX;
        if (x < window.innerWidth * 0.15) edgeSwipeRef.current = { x, tracking: true };
        else edgeSwipeRef.current.tracking = false;
      }}
      onTouchEnd={(e) => {
        if (isChatOpen) return;
        const { x, tracking } = edgeSwipeRef.current;
        if (!tracking) return;
        if (e.changedTouches[0].clientX - x > 50) { e.stopPropagation(); setDrawerOpen(true); }
        edgeSwipeRef.current.tracking = false;
      }}>

      <SidebarDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />

      {/* 鈺愨晲鈺?鍥哄畾椤堕儴瀵艰埅鏍忥紙鍔ㄧ敾椹卞姩锛岄浂 setState锛夆晲鈺愨晲 */}
      {!isChatOpen && (
        <header className="shrink-0 border-b border-gray-100/60 bg-white/80 backdrop-blur-md dark:border-gray-800/60 dark:bg-gray-900/80">
          <div className="flex h-14 items-center gap-3 px-4">
            <button onClick={() => setDrawerOpen(true)} className="rounded-xl p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800">☰</button>

            {/* 鏍囬锛氬弻灞傚彔鍔犱氦鍙夋贰鍏?*/}
            <div className="flex flex-1 items-center gap-2 relative" style={{ minHeight: 28 }}>
              <span ref={echoTitleRef} className="absolute left-0 text-lg font-extrabold tracking-tight text-gray-900 dark:text-gray-100 select-none will-change-transform">
                Echo
              </span>
              <span ref={gravTitleRef} className="absolute left-0 text-lg font-extrabold tracking-tight text-gray-900 dark:text-gray-100 select-none will-change-transform" style={{ opacity: 0 }}>
                关系空间
              </span>
              {/* 缁跨偣鍥哄畾鍦ㄦ爣棰樺彸渚?*/}
              {page === 0 && <span className="ml-16 h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: connected ? '#22c55e' : '#d1d5db' }} />}
            </div>

            {/* 鎸夐挳浜ゅ弶 */}
            <div className="relative" style={{ minWidth: 72, minHeight: 30 }}>
              <button ref={echoBtnRef} onClick={() => nav('/friends')}
                className="absolute right-0 top-0 rounded-xl bg-primary-500 px-4 py-1.5 text-xs font-medium text-white hover:bg-primary-600 transition-colors">
                + 好友
              </button>
              <button ref={gravBtnRef} className="absolute right-0 top-0 px-1 py-1.5 text-xs text-rose-500" style={{ opacity: 0, pointerEvents: 'none' }}>♥ 双人空间</button>
            </div>
          </div>

          {/* 鎼滅储妗嗭細鍙屽眰鍙犲姞浜ゅ弶娣″叆 */}
          <div className="px-4 pb-2 relative" style={{ minHeight: 44 }}>
            {/* Echo 鎼滅储 */}
            <div ref={echoSearchRef} className="absolute inset-x-4 top-0 will-change-transform">
              <div className="flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 dark:bg-zinc-900/80 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]">
                <span className="text-slate-400 text-sm">🔍</span>
                <input type="text" placeholder="搜索好友或聊天记录..."
                  className="flex-1 bg-transparent text-sm text-gray-700 outline-none placeholder:text-slate-400 dark:text-gray-300"
                  value={searchText} onChange={(e) => setSearchText(e.target.value)} />
                {searchText && <button onClick={() => setSearchText('')} className="text-slate-400 hover:text-slate-600 text-xs">×</button>}
              </div>
            </div>
            {/* Relationship space summary */}
            <div ref={gravSearchRef} className="absolute inset-x-4 top-0 will-change-transform" style={{ opacity: 0, pointerEvents: 'none' }}>
              <div className="flex items-center gap-2 rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-500 dark:bg-rose-950/25 dark:text-rose-300">
                <span>♥</span>
                <span>共享纪念日、天气、宠物和双人回忆</span>
              </div>
            </div>
          </div>
          {page === 0 && searchText.trim() && (
            <div ref={echoTabsRef} className="flex gap-1 px-4 pb-2">
              <button onClick={() => setSearchTab('contacts')} className={`px-3 py-1 text-xs rounded-full transition-colors ${searchTab === 'contacts' ? 'bg-primary-500 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-500'}`}>{'\u641c\u7d22\u597d\u53cb'}</button>
              <button onClick={() => setSearchTab('messages')} className={`px-3 py-1 text-xs rounded-full transition-colors ${searchTab === 'messages' ? 'bg-primary-500 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-500'}`}>{'\u641c\u7d22\u804a\u5929\u8bb0\u5f55'}</button>
            </div>
          )}
        </header>
      )}

      {/* 鈺愨晲鈺?妯悜鍒嗛〉瀹瑰櫒锛坰croll-snap锛屽師鐢熸墜鍔匡級鈺愨晲鈺?*/}
      <style>{`.pager-snap::-webkit-scrollbar { display: none; }`}</style>
      <div
        ref={pagerRef}
        className="pager-snap flex-1 flex overflow-x-auto overflow-y-hidden snap-x snap-mandatory"
        style={{ scrollBehavior: 'auto', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        onScroll={handleScroll}
      >
        {/* 椤甸潰 0锛氫細璇濆垪琛?*/}
        <div className="snap-start snap-always shrink-0 h-full overflow-hidden" style={{ width: '100%', minWidth: '100%' }}>
          <div className={`h-full flex-col overflow-hidden md:flex ${paramId ? 'md:w-80 md:border-r md:border-gray-200 md:dark:border-gray-700' : ''} ${isChatOpen ? 'hidden md:flex' : 'flex'}`}>
            <ConversationList searchText={searchText} searchTab={searchTab} />
          </div>
        </div>

        {/* 椤甸潰 1锛氬紩鍔涘湀 */}
        <div className="snap-start snap-always shrink-0 h-full overflow-hidden" style={{ width: '100%', minWidth: '100%' }}>
          <RelationshipSpaceContent />
        </div>
      </div>

      {/* 妗岄潰绔亰澶╃獥鍙?*/}
      {paramId && (
        <div className="hidden md:flex flex-1 flex-col absolute inset-y-0 right-0 left-1/2">
          {searchError ? (
            <div className="flex flex-1 items-center justify-center"><p className="text-4xl mb-3">🔍</p><p className="text-sm text-gray-400">{searchError}</p><button onClick={() => nav('/')} className="mt-3 text-sm text-primary-500 hover:underline">返回首页</button></div>
          ) : (
            <ChatWindow {...getChatWindowProps()} onBack={handleBackToList} initialOrbit={searchParams.get('orbit') === '1'} focusMessageId={searchParams.get('focus') || undefined} />
          )}
        </div>
      )}

      {/* 鈺愨晲鈺?椤甸潰鎸囩ず鍣?鈺愨晲鈺?*/}
      {!isChatOpen && (
        <div className="flex justify-center gap-2 py-2.5 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-t border-gray-100/60 dark:border-gray-800/60 shrink-0">
          {[0, 1].map(i => (
            <button key={i} onClick={() => switchPage(i)}
              className={`rounded-full transition-all duration-300 ${page === i ? 'w-6 h-1.5 bg-primary-500' : 'w-1.5 h-1.5 bg-gray-300 dark:bg-gray-600'}`} />
          ))}
        </div>
      )}

      {/* 鈺愨晲鈺?绉诲姩绔亰澶╃獥鍙?鈺愨晲鈺?*/}
      <AnimatePresence>
        {isChatOpen && (
          <motion.div className="fixed inset-0 z-50 bg-white dark:bg-gray-950 md:hidden" initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', stiffness: 150, damping: 20, mass: 0.8 }}>
            {searchError ? (
              <div className="flex h-full items-center justify-center"><p className="text-4xl mb-3">🔍</p><p className="text-sm text-gray-400">{searchError}</p><button onClick={() => nav('/')} className="mt-3 text-sm text-primary-500 hover:underline">返回首页</button></div>
            ) : (
              <ChatWindow {...getChatWindowProps()} onBack={handleBackToList} initialOrbit={searchParams.get('orbit') === '1'} focusMessageId={searchParams.get('focus') || undefined} />
            )}
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
