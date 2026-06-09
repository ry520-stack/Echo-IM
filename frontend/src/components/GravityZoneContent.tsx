import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { useBackground } from '../hooks/useBackground';
import GravityLockedCard from './GravityLockedCard';
import { assetUrl } from '../utils/assetUrl';
import { api } from '../api/client';

const GRAVITY_KEY = 'echo-favorites';
const GRAVITY_PINNED_KEY = 'echo-gravity-pinned';

function loadGravityItems() {
  try { return JSON.parse(localStorage.getItem(GRAVITY_KEY) || '[]'); } catch { return []; }
}

function loadPinnedIds(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(GRAVITY_PINNED_KEY) || '[]')); } catch { return new Set(); }
}

export default function GravityZoneContent({ searchText }: { searchText: string }) {
  const nav = useNavigate();
  const { theme } = useTheme();
  const { getBg } = useBackground();
  const isDark = theme === 'dark';
  const bgUrl = getBg('gravity');
  const [items, setItems] = useState<any[]>(loadGravityItems);
  const [chatStreaks, setChatStreaks] = useState<Record<string, number>>({});
  const [pinned, setPinned] = useState<Set<string>>(loadPinnedIds);
  const [ctxMenu, setCtxMenu] = useState<{ id: string; cardRect: DOMRect } | null>(null);
  const lockRef = useRef(false);

  useEffect(() => {
    const syncData = () => setItems(loadGravityItems());
    window.addEventListener('gravity-updated', syncData);
    window.addEventListener('storage', syncData);
    return () => {
      window.removeEventListener('gravity-updated', syncData);
      window.removeEventListener('storage', syncData);
    };
  }, []);

  useEffect(() => {
    api<Array<{ peer: { id: string }; chatStreak?: number }>>('GET', '/api/friends')
      .then(friends => setChatStreaks(Object.fromEntries(friends.map(friend => [friend.peer.id, friend.chatStreak || 0]))))
      .catch(() => {});
  }, []);

  const lock = () => {
    lockRef.current = true;
    setTimeout(() => { lockRef.current = false; }, 300);
  };

  const removeFromGravity = (id: string) => {
    const next = items.filter(item => item.id !== id && item.peerId !== id);
    setItems(next);
    localStorage.setItem(GRAVITY_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event('gravity-updated'));
    setCtxMenu(null);
  };

  const togglePin = (id: string) => {
    setPinned(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      localStorage.setItem(GRAVITY_PINNED_KEY, JSON.stringify([...next]));
      return next;
    });
    setCtxMenu(null);
  };

  const keyword = searchText.trim().toLowerCase();
  const filtered = keyword
    ? items.filter(item => item.peerName?.toLowerCase().includes(keyword) || String(item.peerDigitalId || '').includes(keyword))
    : items;

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden" style={{ background: isDark ? '#05050a' : '#f8fafc' }}>
      {bgUrl && (
        <>
          <div className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: `url(${assetUrl(bgUrl)})` }} />
          <div className="absolute inset-0 z-[1] bg-black/30 dark:bg-black/50" />
        </>
      )}

      <div className="relative z-10 flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="flex h-full flex-1 items-center justify-center">
            <p className="text-sm tracking-wide text-slate-400">
              {keyword ? '没有匹配的好友' : '引力圈为空，点击“捕捉”添加好友'}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3 px-4 pb-8 pt-4">
            {[...filtered]
              .sort((a, b) => (pinned.has(a.id) ? -1 : 0) - (pinned.has(b.id) ? -1 : 0))
              .map((item: any) => (
                <div key={item.id} data-gravity-card>
                  <GravityLockedCard
                    name={item.peerName}
                    avatar={item.peerAvatar}
                    chatStreak={chatStreaks[item.peerId] || 0}
                    isDark={isDark}
                    isPinned={pinned.has(item.id)}
                    onClick={() => {
                      if (!lockRef.current) nav(`/chat/${item.peerDigitalId}`);
                    }}
                    onLongPress={(targetNode) => {
                      lock();
                      const card = (targetNode as HTMLElement)?.closest('[data-gravity-card]') as HTMLElement;
                      if (card) setCtxMenu({ id: item.id, cardRect: card.getBoundingClientRect() });
                    }}
                  />
                </div>
              ))}
          </div>
        )}
      </div>

      {ctxMenu && (() => {
        const { cardRect } = ctxMenu;
        const menuHeight = 90;
        const menuWidth = 160;
        const spaceBelow = window.innerHeight - cardRect.bottom;
        const top = spaceBelow > menuHeight + 8 ? cardRect.bottom + 4 : cardRect.top - menuHeight - 4;
        const left = Math.min(Math.max(cardRect.left + cardRect.width / 2 - menuWidth / 2, 8), window.innerWidth - menuWidth - 8);

        return (
          <div className="fixed inset-0 z-[60] select-none" onClick={() => { lock(); setCtxMenu(null); }}>
            <div
              className="absolute overflow-hidden rounded-2xl border border-white/20 bg-white/70 py-1.5 shadow-2xl backdrop-blur-xl dark:border-gray-600/30 dark:bg-gray-800/70"
              style={{ left, top, minWidth: menuWidth }}
            >
              <button
                onClick={(e) => { e.stopPropagation(); togglePin(ctxMenu.id); }}
                className="flex w-full items-center px-4 py-2.5 text-sm text-blue-500 transition-colors hover:bg-white/50 dark:hover:bg-white/10"
              >
                {pinned.has(ctxMenu.id) ? '取消置顶' : '置顶'}
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); removeFromGravity(ctxMenu.id); }}
                className="flex w-full items-center px-4 py-2.5 text-sm text-red-500 transition-colors hover:bg-red-50/50 dark:hover:bg-red-900/20"
              >
                移出引力圈
              </button>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
