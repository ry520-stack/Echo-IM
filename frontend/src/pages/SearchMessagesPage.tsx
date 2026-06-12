import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CalendarDays, Search } from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../contexts/AuthContext';

interface Sender {
  id: string; username: string; nickname: string; avatar: string;
}
interface SearchResult {
  id: string; senderId: string; receiverId: string | null; groupId: string | null;
  content: string; type: string; createdAt: string; sender: Sender;
}

function formatMessage(msg: SearchResult) {
  if (msg.type === 'emoji') return '[表情]';
  if (msg.type === 'image') return '[图片]';
  if (msg.type === 'voice') return '[语音]';
  if (msg.type === 'video') return '[视频]';
  if (msg.type === 'call') return msg.content || '[通话]';
  return msg.content;
}

export default function SearchMessagesPage() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const { user } = useAuth();
  const peerId = params.get('peerId') || '';
  const groupId = params.get('groupId') || '';
  const title = params.get('title') || '';
  const scoped = !!peerId || !!groupId;
  const [query, setQuery] = useState('');
  const [date, setDate] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);

  const doSearch = async (nextDate = date) => {
    if (!query.trim() && !nextDate) return;
    const sp = new URLSearchParams();
    if (query.trim()) sp.set('q', query.trim());
    if (nextDate) sp.set('date', nextDate);
    if (peerId) sp.set('peerId', peerId);
    if (groupId) sp.set('groupId', groupId);

    setSearching(true);
    setSearched(true);
    try {
      setResults(await api<SearchResult[]>('GET', `/api/messages/search?${sp.toString()}`));
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  const highlight = (text: string) => {
    const q = query.trim();
    if (!q || text.startsWith('[')) return text;
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
    return parts.map((part, i) =>
      part.toLowerCase() === q.toLowerCase()
        ? <mark key={i} className="rounded bg-yellow-200 px-0.5 dark:bg-yellow-700/50">{part}</mark>
        : <span key={i}>{part}</span>
    );
  };

  const openResult = (msg: SearchResult) => {
    if (msg.groupId) {
      nav(`/chat/${msg.groupId}?focus=${msg.id}`);
      return;
    }
    const targetId = msg.senderId === user?.id ? msg.receiverId : msg.senderId;
    if (targetId) nav(`/chat/${targetId}?focus=${msg.id}`);
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-gray-50 dark:bg-gray-950">
      <header className="flex items-center gap-3 border-b border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-900">
        <button onClick={() => nav(-1)} className="text-sm text-primary-500 hover:underline">返回</button>
        <div className="min-w-0">
          <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">消息搜索</h1>
          {scoped && <p className="truncate text-xs text-gray-400">{title || '当前聊天'}</p>}
        </div>
      </header>
      <div className="p-4">
        <div className="mb-3 flex gap-2">
          <div className="flex flex-1 items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 dark:border-gray-600 dark:bg-gray-800">
            <Search size={15} className="text-gray-400" />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && doSearch()}
              placeholder={scoped ? '搜索当前聊天记录...' : '搜索聊天记录关键词...'}
              autoFocus
              className="min-w-0 flex-1 bg-transparent text-sm outline-none dark:text-gray-100"
            />
          </div>
          <button onClick={() => doSearch()} disabled={searching || (!query.trim() && !date)}
            className="rounded-xl bg-primary-500 px-4 py-2 text-sm font-medium text-white hover:bg-primary-600 disabled:opacity-50">
            {searching ? '...' : '搜索'}
          </button>
        </div>

        <label className="mb-4 flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 dark:border-gray-600 dark:bg-gray-800">
          <CalendarDays size={15} className="text-gray-400" />
          <input
            type="date"
            value={date}
            onChange={e => { setDate(e.target.value); doSearch(e.target.value); }}
            className="flex-1 bg-transparent text-sm text-gray-700 outline-none dark:text-gray-100"
          />
        </label>

        {searched && (
          <div className="space-y-2">
            {results.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-400">未找到相关消息</p>
            ) : (
              results.map(msg => {
                const displayName = msg.sender.nickname || msg.sender.username;
                const time = new Date(msg.createdAt).toLocaleString('zh-CN');
                const text = formatMessage(msg);
                const content = text.length > 80 ? text.slice(0, 80) + '...' : text;
                return (
                  <div key={msg.id} onClick={() => openResult(msg)}
                    className="cursor-pointer rounded-xl border border-gray-200 bg-white p-3 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:hover:bg-gray-800/50">
                    <div className="mb-1 flex items-center gap-2">
                      <span className="text-xs font-medium text-primary-500">{displayName}</span>
                      <span className="text-[10px] text-gray-400">{time}</span>
                    </div>
                    <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-300">
                      {highlight(content)}
                    </p>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}
