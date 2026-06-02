import { useEffect, useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import { api } from '../api/client';
import { assetUrl } from '../utils/assetUrl';

interface Peer {
  id: string;
  username: string;
  nickname: string;
  avatar: string;
  digitalId: number;
}

interface Friend {
  id: string;
  peer: Peer;
  alias: string;
}

function loadGravityIds() {
  try {
    const items = JSON.parse(localStorage.getItem('echo-favorites') || '[]') as any[];
    return new Set(items.map(item => item.peerId || item.id).filter(Boolean));
  } catch {
    return new Set<string>();
  }
}

export default function CatchFriendsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open) return;

    setSelected(new Set());
    setSearch('');
    setLoading(true);
    api<Friend[]>('GET', '/api/friends')
      .then(setFriends)
      .catch(() => setFriends([]))
      .finally(() => setLoading(false));
  }, [open]);

  const existing = useMemo(() => loadGravityIds(), [open]);

  if (!open) return null;

  const filtered = search.trim()
    ? friends.filter(friend => {
        const keyword = search.trim().toLowerCase();
        const name = friend.alias || friend.peer.nickname || friend.peer.username;
        return (
          name.toLowerCase().includes(keyword) ||
          String(friend.peer.digitalId).includes(keyword)
        );
      })
    : friends;

  const toggle = (peerId: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(peerId)) next.delete(peerId);
      else next.add(peerId);
      return next;
    });
  };

  const handleConfirm = () => {
    const favorites: any[] = (() => {
      try { return JSON.parse(localStorage.getItem('echo-favorites') || '[]'); } catch { return []; }
    })();
    const existingIds = new Set(favorites.map(item => item.peerId || item.id));

    for (const friend of friends) {
      if (!selected.has(friend.peer.id) || existingIds.has(friend.peer.id)) continue;
      favorites.push({
        id: friend.peer.id,
        peerId: friend.peer.id,
        peerName: friend.alias || friend.peer.nickname || friend.peer.username,
        peerAvatar: friend.peer.avatar,
        peerDigitalId: friend.peer.digitalId,
        addedAt: new Date().toISOString(),
      });
    }

    localStorage.setItem('echo-favorites', JSON.stringify(favorites));
    window.dispatchEvent(new Event('gravity-updated'));
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative flex max-h-[80vh] w-full max-w-lg flex-col rounded-t-3xl bg-white dark:bg-gray-900"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 pb-3 pt-5">
          <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">捕捉好友到引力圈</h2>
          <button onClick={onClose} className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300">
            <X size={20} />
          </button>
        </div>

        <div className="px-5 pb-3">
          <div className="flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 dark:bg-zinc-800">
            <Search size={16} className="text-slate-400" />
            <input
              type="text"
              placeholder="搜索好友..."
              className="flex-1 bg-transparent text-sm text-gray-700 outline-none placeholder:text-slate-400 dark:text-gray-300"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-4">
          {loading ? (
            <p className="py-8 text-center text-sm text-gray-400">加载中...</p>
          ) : filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-400">没有好友</p>
          ) : (
            <div className="space-y-1">
              {filtered.map(friend => {
                const peer = friend.peer;
                const name = friend.alias || peer.nickname || peer.username;
                const isInGravity = existing.has(peer.id);
                const isSelected = selected.has(peer.id);

                return (
                  <div
                    key={friend.id}
                    onClick={() => !isInGravity && toggle(peer.id)}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors ${
                      isInGravity
                        ? 'cursor-default opacity-45'
                        : isSelected
                          ? 'cursor-pointer bg-primary-50 dark:bg-primary-900/20'
                          : 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800'
                    }`}
                  >
                    <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors ${
                      isInGravity
                        ? 'border-gray-300 bg-gray-200 dark:border-gray-600 dark:bg-gray-700'
                        : isSelected
                          ? 'border-primary-500 bg-primary-500'
                          : 'border-gray-300 dark:border-gray-600'
                    }`}>
                      {(isSelected || isInGravity) && <span className="text-xs font-bold text-white">✓</span>}
                    </div>

                    <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-primary-100 text-sm font-bold text-primary-600 dark:bg-primary-900/30 dark:text-primary-400">
                      {peer.avatar ? (
                        <img src={assetUrl(peer.avatar)} alt="" className="h-full w-full object-cover" />
                      ) : (
                        name[0]?.toUpperCase()
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-800 dark:text-gray-200">{name}</p>
                      <p className="text-xs text-gray-400">{isInGravity ? '已在引力圈' : `ID: ${peer.digitalId}`}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="border-t border-gray-100 px-5 pb-6 pt-2 dark:border-gray-800">
          <button
            onClick={handleConfirm}
            disabled={selected.size === 0}
            className="w-full rounded-xl bg-primary-500 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-600 disabled:cursor-default disabled:opacity-40"
          >
            {selected.size > 0 ? `捕捉 ${selected.size} 位好友` : '选择好友'}
          </button>
        </div>
      </div>
    </div>
  );
}
