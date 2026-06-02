import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trophy } from 'lucide-react';
import { api } from '../api/client';
import { assetUrl } from '../utils/assetUrl';

interface RankingItem {
  peer: { id: string; username: string; nickname: string; avatar: string; digitalId: number };
  echoValue: number;
  lastConnectionAt: string | null;
}

function formatRecent(value: string | null) {
  if (!value) return '暂无连接';
  const diff = Date.now() - new Date(value).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return '刚刚连接';
  if (min < 60) return `${min}分钟前`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour}小时前`;
  return new Date(value).toLocaleDateString('zh-CN');
}

export default function EchoRankingsPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<RankingItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<RankingItem[]>('GET', '/api/friends/echo-rankings')
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex h-full flex-col bg-gray-50 dark:bg-gray-950">
      <header className="flex items-center gap-3 border-b border-gray-100 bg-white px-4 py-3 dark:border-gray-800 dark:bg-gray-900">
        <button onClick={() => navigate(-1)} className="rounded-xl p-1.5 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800">←</button>
        <div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">回声排行</h1>
          <p className="text-xs text-gray-400">由聊天、动态互动和通话等行为累积</p>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="py-20 text-center text-sm text-gray-400">加载中...</div>
        ) : items.length === 0 ? (
          <div className="rounded-3xl bg-white py-20 text-center text-sm text-gray-400 dark:bg-gray-900">暂无排行</div>
        ) : (
          <div className="space-y-3">
            {items.map((item, index) => {
              const name = item.peer.nickname || item.peer.username;
              return (
                <button
                  key={item.peer.id}
                  onClick={() => navigate(`/chat/${item.peer.digitalId}?orbit=1`)}
                  className="flex w-full items-center gap-3 rounded-2xl bg-white p-3 text-left shadow-sm dark:bg-gray-900"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-sm font-bold text-gray-500 dark:bg-gray-800">
                    {index < 3 ? <Trophy size={16} className="text-amber-500" /> : index + 1}
                  </div>
                  <div className="h-12 w-12 shrink-0 overflow-hidden rounded-2xl bg-primary-500 text-white">
                    {item.peer.avatar ? <img src={assetUrl(item.peer.avatar)} alt="" className="h-full w-full object-cover" /> : (
                      <div className="flex h-full w-full items-center justify-center font-bold">{name[0]?.toUpperCase()}</div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">{name}</p>
                    <p className="text-xs text-gray-400">{formatRecent(item.lastConnectionAt)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-primary-500">{item.echoValue}</p>
                    <p className="text-[10px] text-gray-400">回声值</p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
