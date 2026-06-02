import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

interface FavItem {
  id: string;
  peerDigitalId: number;
  peerName: string;
  peerAvatar: string;
}

const FAV_KEY = 'echo-favorites';

function getFavorites(): FavItem[] {
  try { return JSON.parse(localStorage.getItem(FAV_KEY) || '[]'); } catch { return []; }
}

export default function FavoritesPage() {
  const nav = useNavigate();
  const [items] = useState<FavItem[]>(getFavorites());

  const touchRef = useRef({ x: 0, y: 0 });
  const handleTouchStart = (e: React.TouchEvent) => {
    touchRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - touchRef.current.x;
    const dy = Math.abs(e.changedTouches[0].clientY - touchRef.current.y);
    if (dx > 60 && Math.abs(dx) > dy) {
      nav('/');
    }
  };

  return (
    <div
      className="flex h-full overflow-y-auto flex-col bg-gray-50 dark:bg-gray-950"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className="flex-1 overflow-y-auto">
        {items.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <span className="text-6xl opacity-20">✦</span>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {items.map(item => (
              <div
                key={item.id}
                onClick={() => nav(`/chat/${item.peerDigitalId}`)}
                className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-gray-900 active:bg-gray-50 dark:active:bg-gray-800/50 cursor-pointer"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-lg font-bold text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
                  {item.peerAvatar ? <img src={item.peerAvatar} alt="" className="h-full w-full rounded-2xl object-cover" /> : (item.peerName || '?')[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{item.peerName}</p>
                </div>
                <span className="text-lg">✦</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
