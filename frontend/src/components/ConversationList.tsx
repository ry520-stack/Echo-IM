import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { api } from '../api/client';
import { useNotification } from '../hooks/useNotification';
import { useBackground } from '../hooks/useBackground';
import { assetUrl } from '../utils/assetUrl';

interface Peer {
  id: string; username: string; nickname: string; avatar: string;
  digitalId: number; lastSeenAt: string; status: string; alias: string;
  isGroup?: boolean; memberCount?: number; blockedByMe?: boolean;
}
interface LastMessage { id: string; content: string; type: string; createdAt: string; senderId: string; }
interface Conversation { type?: 'user' | 'group'; peer: Peer; lastMessage: LastMessage | null; unreadCount: number; lastTime: string; }
interface Friend { id: string; peer: Peer; alias: string; isPinned: boolean; createdAt: string; chatStreak?: number; }

const PINNED_KEY = 'echo-pinned-chats';
const ARCHIVED_KEY = 'echo-archived-chats';
const accentBorderClass: Record<string, string> = {
  purple: 'border-l-primary-500',
  blue: 'border-l-blue-600',
  black: 'border-l-gray-900 dark:border-l-gray-100',
};
function getPinned(): Set<string> { try { return new Set(JSON.parse(localStorage.getItem(PINNED_KEY) || '[]')); } catch { return new Set(); } }
function getArchived(): Set<string> { try { return new Set(JSON.parse(localStorage.getItem(ARCHIVED_KEY) || '[]')); } catch { return new Set(); } }

export default function ConversationList({ searchText, searchTab }: { searchText: string; searchTab: 'contacts' | 'messages' }) {
  const { user } = useAuth();
  const { socket, connected, onlineUsers } = useSocket();
  const nav = useNavigate();
  const { id: chatId } = useParams();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const { permission, requestPermission } = useNotification(false);
  const { getBg } = useBackground();
  const [showPermAsk, setShowPermAsk] = useState(false);
  const [loading, setLoading] = useState(true);
  const [msgResults, setMsgResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [pinned, setPinned] = useState<Set<string>>(getPinned());
  const [accentColor, setAccentColor] = useState(() => localStorage.getItem('echo-accent-color') || 'purple');
  const [archived, setArchived] = useState<Set<string>>(getArchived());
  const [friends, setFriends] = useState<Friend[]>([]);
  const [userResults, setUserResults] = useState<Peer[]>([]);
  const [chatStreaks, setChatStreaks] = useState<Record<string, number>>({});

  // 长按 / 滑动状态
  const [swipeId, setSwipeId] = useState<string | null>(null);
  const [swipeX, setSwipeX] = useState(0);
  const swipeXRef = useRef(0);
  const touchStartRef = useRef<{ x: number; y: number; time: number }>({ x: 0, y: 0, time: 0 });
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressJustFired = useRef(false);
  const [contextMenu, setContextMenu] = useState<{ id: string; cardRect: DOMRect } | null>(null);

  // 聊天记录搜索（debounced）
  useEffect(() => {
    if (searchTab !== 'messages' || !searchText.trim()) { setMsgResults([]); return; }
    const timer = setTimeout(async () => {
      setSearching(true);
      try { setMsgResults(await api<any[]>('GET', `/api/messages/search?q=${encodeURIComponent(searchText.trim())}`)); }
      catch { setMsgResults([]); }
      finally { setSearching(false); }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchText, searchTab]);

  useEffect(() => {
    if (searchTab !== 'contacts' || !searchText.trim()) {
      setFriends([]);
      setUserResults([]);
      return;
    }
    let cancelled = false;
    const q = searchText.trim();
    Promise.all([
      api<Friend[]>('GET', '/api/friends').catch(() => []),
      api<Peer[]>('GET', `/api/users/search?q=${encodeURIComponent(q)}`).catch(() => []),
    ]).then(([friendData, users]) => {
      if (cancelled) return;
      setFriends(friendData);
      setUserResults(users.filter(p => p.id !== user?.id));
    });
    return () => { cancelled = true; };
  }, [searchText, searchTab, user?.id]);

  useEffect(() => {
    const asked = localStorage.getItem('echo-notif-asked');
    if (permission === 'default' && !asked) setShowPermAsk(true);
  }, [permission]);

  const handlePermAgree = () => { requestPermission(); localStorage.setItem('echo-notif-asked', '1'); setShowPermAsk(false); };
  useEffect(() => {
    const syncAccent = () => setAccentColor(localStorage.getItem('echo-accent-color') || 'purple');
    window.addEventListener('storage', syncAccent);
    window.addEventListener('echo-accent-color-change', syncAccent);
    return () => {
      window.removeEventListener('storage', syncAccent);
      window.removeEventListener('echo-accent-color-change', syncAccent);
    };
  }, []);

  const togglePin = (peerId: string) => {
    setPinned(prev => { const next = new Set(prev); if (next.has(peerId)) next.delete(peerId); else next.add(peerId); localStorage.setItem(PINNED_KEY, JSON.stringify([...next])); return next; });
  };
  const toggleArchive = (peerId: string) => {
    setArchived(prev => { const next = new Set(prev); if (next.has(peerId)) next.delete(peerId); else next.add(peerId); localStorage.setItem(ARCHIVED_KEY, JSON.stringify([...next])); return next; });
  };

  const handleTouchStart = (e: React.TouchEvent, peerId: string) => {
    touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, time: Date.now() };
    // 同步作用域内提前获取卡片 DOM（React 合成事件在 setTimeout 中已失效）
    const cardNode = (e.currentTarget as HTMLElement).closest('[data-conv-card]') as HTMLElement;
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = setTimeout(() => {
      longPressJustFired.current = true;
      if (cardNode) setContextMenu({ id: peerId, cardRect: cardNode.getBoundingClientRect() });
    }, 500);
  };

  const handleTouchMove = (e: React.TouchEvent, peerId: string) => {
    const dx = e.touches[0].clientX - touchStartRef.current.x;
    const dy = Math.abs(e.touches[0].clientY - touchStartRef.current.y);
    if (Math.abs(dx) > 10 || dy > 10) {
      if (longPressTimerRef.current) { clearTimeout(longPressTimerRef.current); longPressTimerRef.current = null; }
    }
    if (dx > 10 && Math.abs(dx) > dy) {
      e.preventDefault();
      setSwipeId(peerId);
      const clamped = Math.min(160, dx); swipeXRef.current = clamped; setSwipeX(clamped);
    }
  };

  const handleTouchEnd = (_e: React.TouchEvent, peerId: string) => {
    if (longPressTimerRef.current) { clearTimeout(longPressTimerRef.current); longPressTimerRef.current = null; }
    if (swipeXRef.current > 100) togglePin(peerId);
    swipeXRef.current = 0; setSwipeId(null); setSwipeX(0);
  };

  const handleTouchCancel = () => {
    if (longPressTimerRef.current) { clearTimeout(longPressTimerRef.current); longPressTimerRef.current = null; }
  };

  const fetchConversations = useCallback(async () => {
    try { setConversations(await api<Conversation[]>('GET', '/api/messages/conversations')); }
    catch { /* */ } finally { setLoading(false); }
  }, []);

  const fetchChatStreaks = useCallback(() => {
    api<Friend[]>('GET', '/api/friends')
      .then(items => setChatStreaks(Object.fromEntries(items.map(item => [item.peer.id, item.chatStreak || 0]))))
      .catch(() => {});
  }, []);
  useEffect(() => { fetchConversations(); fetchChatStreaks(); }, [fetchConversations, fetchChatStreaks]);
  useEffect(() => { const onVisible = () => { if (document.visibilityState === 'visible') fetchConversations(); }; document.addEventListener('visibilitychange', onVisible); return () => document.removeEventListener('visibilitychange', onVisible); }, [fetchConversations]);

  // 长按定时器卸载清理
  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    };
  }, []);

  const matchPeer = (peer: Peer, q: string) => {
    const s = q.toLowerCase();
    return (peer.alias && peer.alias.toLowerCase().includes(s))
      || peer.nickname?.toLowerCase().includes(s)
      || peer.username?.toLowerCase().includes(s)
      || String(peer.digitalId || '').includes(s)
      || (peer.isGroup && peer.status?.toLowerCase().includes(s));
  };

  const filteredConversations = searchText.trim() && searchTab === 'contacts'
    ? conversations.filter(c => matchPeer(c.peer, searchText.trim()))
    : conversations;

  const contactSearchResults = searchText.trim() && searchTab === 'contacts'
    ? [
        ...filteredConversations,
        ...friends
          .filter(f => matchPeer(f.peer, searchText.trim()))
          .filter(f => !filteredConversations.some(c => c.peer.id === f.peer.id))
          .map(f => ({
            type: 'user' as const,
            peer: { ...f.peer, alias: f.alias || f.peer.alias },
            lastMessage: null,
            unreadCount: 0,
            lastTime: f.createdAt,
          })),
        ...userResults
          .filter(peer => matchPeer(peer, searchText.trim()))
          .filter(peer => !filteredConversations.some(c => c.peer.id === peer.id))
          .filter(peer => !friends.some(f => f.peer.id === peer.id))
          .map(peer => ({
            type: 'user' as const,
            peer: { ...peer, alias: '' },
            lastMessage: null,
            unreadCount: 0,
            lastTime: '',
          })),
      ]
    : filteredConversations;

  useEffect(() => {
    if (!socket) return;

    interface IncomingMsg {
      id: string; senderId: string; receiverId?: string; groupId?: string;
      content: string; type: string; createdAt: string;
      sender?: { nickname?: string; username: string; avatar?: string };
    }

    const handleMessage = (msg: IncomingMsg) => {
      const targetId = msg.groupId || (msg.senderId === user?.id ? msg.receiverId : msg.senderId);
      if (!targetId) return;
      setConversations(prev => {
        const exists = prev.find(c => c.peer.id === targetId);
        const content = msg.type === 'emoji' ? '[表情]' : msg.type === 'image' ? '[图片]' : msg.type === 'voice' ? '[语音]' : msg.type === 'video' ? '[视频]' : msg.type === 'call' ? (msg.content || '[通话]') : msg.content;
        const lastMsg = { id: msg.id, content, type: msg.type, createdAt: msg.createdAt, senderId: msg.senderId };
        if (exists) {
          const isCurrentChat = chatId === targetId || (!exists.peer.isGroup && chatId === exists.peer.digitalId.toString());
          const unreadInc = (msg.senderId !== user?.id && !isCurrentChat) ? 1 : 0;
          return prev.map(c => c.peer.id === targetId ? { ...c, lastMessage: lastMsg, unreadCount: c.unreadCount + unreadInc, lastTime: msg.createdAt } : c).sort((a, b) => new Date(b.lastTime).getTime() - new Date(a.lastTime).getTime());
        }
        fetchConversations(); return prev;
      });
    };
    socket.on('message:receive', handleMessage);
    socket.on('group:updated', fetchConversations);
    socket.on('relationship:updated', fetchConversations);
    socket.on('friend:removed', fetchConversations);
    return () => {
      socket.off('message:receive', handleMessage);
      socket.off('group:updated', fetchConversations);
      socket.off('relationship:updated', fetchConversations);
      socket.off('friend:removed', fetchConversations);
    };
  }, [socket, user?.id, chatId, fetchConversations]);

  const getDisplayName = (peer: Peer) => peer.alias || peer.nickname || peer.username;
  const getLastSeenText = (peer: Peer) => {
    if (peer.blockedByMe) return '';
    if (onlineUsers.has(peer.id)) return '在线';
    if (!peer.lastSeenAt) return '';
    const diff = Date.now() - new Date(peer.lastSeenAt).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return '刚刚在线'; if (minutes < 60) return `${minutes}分钟前在线`;
    const hours = Math.floor(minutes / 60); if (hours < 24) return `${hours}小时前在线`;
    return `${Math.floor(hours / 24)}天前在线`;
  };
  const formatLastMsg = (msg: LastMessage | null) => {
    if (!msg) return '';
    if (msg.type === 'emoji') return '[表情]';
    if (msg.type === 'image') return '[图片]';
    if (msg.type === 'voice') return '[语音]';
    if (msg.type === 'video') return '[视频]';
    if (msg.type === 'call') return msg.content || '[通话]';
    return msg.content.length > 20 ? msg.content.slice(0, 20) + '...' : msg.content;
  };

  const formatSearchMsg = (msg: any) => {
    if (msg.type === 'emoji') return '[表情]';
    if (msg.type === 'image') return '[图片]';
    if (msg.type === 'voice') return '[语音]';
    if (msg.type === 'video') return '[视频]';
    if (msg.type === 'call') return msg.content || '[通话]';
    return msg.content;
  };

  const bgUrl = getBg('conversation');
  const hasBg = !!bgUrl;

  return (
    <div className={`relative flex h-full flex-col overflow-hidden ${hasBg ? '' : 'bg-white dark:bg-gray-950'}`}>
      {hasBg && <div className="absolute inset-0 bg-cover bg-center bg-no-repeat z-0" style={{ backgroundImage: `url(${assetUrl(bgUrl)})` }} />}
      {hasBg && <div className="absolute inset-0 bg-black/30 dark:bg-black/50 z-[1]" />}

      {/* 连接状态 */}
      {!connected && (
        <div className={`${hasBg ? 'relative z-10' : ''} mx-3 mt-2 mb-1 rounded-lg px-3 py-1.5 text-xs text-amber-600 dark:text-amber-400 ${hasBg ? 'bg-amber-50/80 backdrop-blur-sm dark:bg-amber-900/40' : 'bg-amber-50 dark:bg-amber-900/20'}`}>
          未连接，消息将无法实时接收
        </div>
      )}

      {showPermAsk && (
        <div className="relative z-10 mx-3 mb-2 rounded-xl bg-primary-50/80 backdrop-blur-sm dark:bg-primary-900/40 px-4 py-3 border border-primary-100/50 dark:border-primary-800/50">
          <p className="text-xs text-primary-700 dark:text-primary-300 mb-2">Echo 想要向你发送星际回声（通知）</p>
          <div className="flex gap-2">
            <button onClick={handlePermAgree} className="rounded-lg bg-primary-500 px-3 py-1 text-xs text-white font-medium">同意</button>
            <button onClick={() => setShowPermAsk(false)} className="rounded-lg bg-gray-200 dark:bg-gray-700 px-3 py-1 text-xs text-gray-500">暂不</button>
          </div>
        </div>
      )}

      {/* 聊天记录搜索结果 */}
      {searchTab === 'messages' && searchText.trim() ? (
        <div className="relative z-10 flex-1 overflow-y-auto flex flex-col px-3">
          {searching ? (
            <p className="text-xs text-gray-400 text-center py-4">搜索中...</p>
          ) : msgResults.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-4">未找到相关消息</p>
          ) : msgResults.map((msg: any) => (
            <div key={msg.id} onClick={() => nav(`/chat/${msg.groupId || (msg.senderId === user?.id ? msg.receiverId : msg.senderId)}?focus=${msg.id}`)} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer mb-1">
              <p className="text-xs text-gray-500 truncate">{msg.group?.name ? `${msg.group.name} · ` : ''}{msg.sender?.nickname || msg.sender?.username}</p>
              <p className="text-sm text-gray-700 dark:text-gray-300 truncate">{formatSearchMsg(msg)}</p>
            </div>
          ))}
        </div>
      ) : (
        /* 会话列表 */
        <div className="relative z-10 flex-1 overflow-y-auto flex flex-col">
          {loading ? (
            <div className="flex-1 flex items-center justify-center"><p className="text-sm tracking-wide text-slate-400">加载中...</p></div>
          ) : (() => {
            const visibleCount = conversations.filter(c => !archived.has(c.peer.id)).length;
            if (visibleCount === 0 && !searchText.trim()) {
              return (
                <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
                  <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-3xl bg-white/50 backdrop-blur-xl text-5xl dark:bg-white/10 shadow-sm">💬</div>
                  <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">欢迎, {user?.nickname || user?.username}</h2>
                  <div className="mt-4 inline-flex items-center gap-3 rounded-2xl bg-gray-100/80 px-5 py-2.5 dark:bg-gray-800/80">
                    <span className="text-xs tracking-widest text-gray-400 font-medium uppercase">ECHO ID</span>
                    <span className="font-mono text-lg font-bold tracking-wider text-gray-800 dark:text-gray-100 select-all">{user?.digitalId}</span>
                  </div>
                  <p className="mt-5 text-sm tracking-wide text-gray-400">搜索 ECHO ID 添加好友，开始聊天</p>
                </div>
              );
            }
            if (contactSearchResults.length === 0) {
              return <div className="flex-1 flex items-center justify-center"><p className="text-sm tracking-wide text-slate-400">没有匹配的好友</p></div>;
            }
            return [...contactSearchResults]
              .sort((a, b) => (pinned.has(a.peer.id) ? -1 : 0) - (pinned.has(b.peer.id) ? -1 : 0))
              .filter(c => !archived.has(c.peer.id) || searchText.trim())
              .map((conv) => {
                const isActive = chatId === conv.peer.id || (!conv.peer.isGroup && chatId === conv.peer.digitalId.toString());
                const isOnline = !conv.peer.isGroup && !conv.peer.blockedByMe && onlineUsers.has(conv.peer.id);
                const isPinned = pinned.has(conv.peer.id);
                const isSwiping = swipeId === conv.peer.id;
                const streak = conv.peer.isGroup ? 0 : (chatStreaks[conv.peer.id] || 0);
                const streakTone = streak >= 90 ? 'bg-rose-50 text-rose-500 ring-rose-100 dark:bg-rose-950/25 dark:ring-rose-900/40' : streak >= 30 ? 'bg-amber-50 text-amber-600 ring-amber-100 dark:bg-amber-950/25 dark:ring-amber-900/40' : streak >= 7 ? 'bg-violet-50 text-violet-500 ring-violet-100 dark:bg-violet-950/25 dark:ring-violet-900/40' : 'bg-slate-100 text-slate-500 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700';
                return (
                  <div key={conv.peer.id} data-conv-card className="relative overflow-hidden select-none">
                    <div className="absolute inset-y-0 left-0 flex items-center pointer-events-none">
                      <div className="h-full bg-gradient-to-r from-purple-500/10 to-transparent" style={{ width: '100px' }} />
                    </div>
                    <div
                      onClick={() => {
                        if (longPressJustFired.current) { longPressJustFired.current = false; return; }
                        if (contextMenu) { setContextMenu(null); return; }
                        if (Math.abs(swipeXRef.current) < 5) {
                          setConversations(prev => prev.map(c => c.peer.id === conv.peer.id ? { ...c, unreadCount: 0 } : c));
                          nav(`/chat/${conv.peer.id}`);
                        }
                      }}
                      onTouchStart={(e) => handleTouchStart(e, conv.peer.id)}
                      onTouchMove={(e) => handleTouchMove(e, conv.peer.id)}
                      onTouchEnd={(e) => handleTouchEnd(e, conv.peer.id)}
                      onTouchCancel={handleTouchCancel}
                      style={{ touchAction: 'pan-y', ...(isSwiping ? { transform: `translateX(${swipeX}px)`, transition: 'none' } : { transform: 'translateX(0)', transition: 'transform 0.3s ease' }) }}
                  className={`relative flex cursor-pointer items-center gap-3 px-3 py-2.5 transition-colors select-none ${hasBg ? `backdrop-blur-md ${isActive ? 'bg-white/70 dark:bg-white/10' : 'bg-white/40 hover:bg-white/60 dark:bg-white/5 dark:hover:bg-white/10'} border-b border-white/10 dark:border-white/5` : `hover:bg-gray-100 dark:hover:bg-gray-800/50 ${isActive ? 'bg-primary-50 dark:bg-primary-900/20' : ''}`} ${isPinned ? `border-l-2 ${accentBorderClass[accentColor] || accentBorderClass.purple}` : ''}`}
                    >
                      <div className="relative shrink-0">
                        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-100 text-lg font-bold text-primary-600 dark:bg-primary-900/30 dark:text-primary-400">
                          {conv.peer.avatar ? <img src={assetUrl(conv.peer.avatar)} alt="" className="h-full w-full rounded-xl object-cover" /> : getDisplayName(conv.peer)[0]?.toUpperCase() || '?'}
                        </div>
                        {isOnline && <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-green-500 dark:border-gray-900 animate-pulse ring-2 ring-green-500/30" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between">
                          <span className="flex min-w-0 items-center gap-1 text-sm font-medium text-gray-800 dark:text-gray-200">
                            <span className="truncate">{getDisplayName(conv.peer)}</span>
                            {streak >= 3 && <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none ring-1 ${streakTone}`}>{`${streak}天`}</span>}
                          </span>
                          {conv.lastMessage && <span className="ml-2 shrink-0 text-[10px] text-gray-400">{formatTime(conv.lastMessage.createdAt)}</span>}
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-500 dark:text-gray-400 truncate">{formatLastMsg(conv.lastMessage)}</span>
                          {conv.unreadCount > 0 && <span className="ml-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary-500 px-1.5 text-[10px] font-bold text-white">{conv.unreadCount > 99 ? '99+' : conv.unreadCount}</span>}
                        </div>
                        <p className="text-[10px] text-gray-400 mt-0.5">{getLastSeenText(conv.peer)}{conv.peer.status && isOnline && ` · ${conv.peer.status}`}</p>
                      </div>
                    </div>
                  </div>
                );
              });
          })()}
        </div>
      )}

      {/* ═══ 上下文菜单（锚定卡片 + 边界检测 + 毛玻璃）═══ */}
      {contextMenu && (() => {
        const { cardRect } = contextMenu;
        const menuH = 120;
        const menuW = 160;
        // 优先在卡片下方弹出，空间不足则弹到上方
        const spaceBelow = window.innerHeight - cardRect.bottom;
        const top = spaceBelow > menuH + 8
          ? cardRect.bottom + 4
          : cardRect.top - menuH - 4;
        // X 居中于卡片，不超出屏幕
        const left = Math.min(Math.max(cardRect.left + cardRect.width / 2 - menuW / 2, 8), window.innerWidth - menuW - 8);

        return (
          <div className="fixed inset-0 z-[60] select-none" onClick={() => setContextMenu(null)}>
            <div
              className="absolute rounded-2xl border border-white/20 bg-white/60 backdrop-blur-xl shadow-2xl py-1.5 overflow-hidden dark:border-gray-600/30 dark:bg-gray-800/60 dark:backdrop-blur-xl"
              style={{ left, top, minWidth: menuW, backdropFilter: 'blur(20px) saturate(1.8)', WebkitBackdropFilter: 'blur(20px) saturate(1.8)' }}
            >
              <button onClick={(e) => { e.stopPropagation(); const peer = conversations.find(c => c.peer.id === contextMenu.id)?.peer; if (peer) { const key = 'echo-favorites'; const favs = JSON.parse(localStorage.getItem(key) || '[]'); if (!favs.find((f: any) => f.id === peer.id)) { favs.unshift({ id: peer.id, peerId: peer.id, peerName: peer.nickname || peer.username, peerAvatar: peer.avatar, peerDigitalId: peer.digitalId, addedAt: new Date().toISOString() }); localStorage.setItem(key, JSON.stringify(favs)); window.dispatchEvent(new Event('gravity-updated')); } } setContextMenu(null); }}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-amber-500 hover:bg-white/50 dark:hover:bg-white/10 transition-colors">
                <span>✦</span> Add to Gravity
              </button>
              <button onClick={(e) => { e.stopPropagation(); togglePin(contextMenu.id); setContextMenu(null); }}
                className="flex w-full items-center px-4 py-2.5 text-sm text-gray-700 hover:bg-white/50 dark:text-gray-300 dark:hover:bg-white/10 transition-colors">
                {pinned.has(contextMenu.id) ? '取消置顶' : '置顶'}
              </button>
              <button onClick={(e) => { e.stopPropagation(); toggleArchive(contextMenu.id); setContextMenu(null); }}
                className="flex w-full items-center px-4 py-2.5 text-sm text-gray-700 hover:bg-white/50 dark:text-gray-300 dark:hover:bg-white/10 transition-colors">
                {archived.has(contextMenu.id) ? '取消隐藏' : '隐藏'}
              </button>
              <button onClick={async (e) => {
                e.stopPropagation();
                const id = contextMenu.id;
                try {
                  await api('POST', '/api/messages/clear', { peerId: id });
                  setConversations(prev => prev.filter(c => c.peer.id !== id));
                } catch { /* ignore */ }
                setContextMenu(null);
              }}
                className="flex w-full items-center px-4 py-2.5 text-sm text-red-500 hover:bg-red-50/50 dark:hover:bg-red-900/20 transition-colors">
                删除会话
              </button>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

function formatTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}
