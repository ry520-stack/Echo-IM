import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useToast } from '../contexts/ToastContext';

interface DelayedMsg {
  id: string;
  receiverId: string | null;
  groupId: string | null;
  content: string;
  sendAt: string;
}

export default function TimeCapsulePage() {
  const nav = useNavigate();
  const toast = useToast();
  const [items, setItems] = useState<DelayedMsg[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [content, setContent] = useState('');
  const [sendAt, setSendAt] = useState('');
  const [receiverId, setReceiverId] = useState('');
  const [posting, setPosting] = useState(false);

  const fetchItems = async () => {
    try { setItems(await api<DelayedMsg[]>('GET', '/api/delayed')); } catch { /* */ }
    finally { setLoading(false); }
  };
  useEffect(() => { fetchItems(); }, []);

  const create = async () => {
    if (!content.trim() || !sendAt) return;
    setPosting(true);
    try {
      await api('POST', '/api/delayed', { content: content.trim(), sendAt: new Date(sendAt).toISOString(), receiverId: receiverId || undefined });
      toast('回声胶囊已就绪', 'success');
      setShowNew(false); setContent(''); setSendAt(''); setReceiverId('');
      fetchItems();
    } catch (e: any) { toast(e.message || '创建失败', 'error'); }
    finally { setPosting(false); }
  };

  const cancel = async (id: string) => {
    try { await api('DELETE', `/api/delayed/${id}`); fetchItems(); toast('已取消', 'info'); }
    catch (e: any) { toast(e.message || '取消失败', 'error'); }
  };

  return (
    <div className="flex h-full overflow-y-auto flex-col bg-gray-50 dark:bg-gray-950">
      <header className="flex items-center gap-3 border-b border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-900 shrink-0">
        <button onClick={() => nav('/')} className="text-sm text-primary-500 hover:underline">← 返回</button>
        <h1 className="flex-1 text-lg font-bold text-gray-900 dark:text-gray-100">回声胶囊</h1>
        <button onClick={() => setShowNew(true)} className="text-xl p-1 text-amber-500 hover:scale-110 transition-transform">⏳</button>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading ? (
          <p className="text-center text-sm text-gray-400 py-8">加载中...</p>
        ) : items.length === 0 && !showNew ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400">
            <span className="text-6xl mb-4 opacity-30">⏳</span>
            <p className="text-sm">暂无定时消息</p>
            <button onClick={() => setShowNew(true)} className="mt-3 text-sm text-primary-500 hover:underline">创建回声胶囊</button>
          </div>
        ) : (
          <>
            {items.map(item => (
              <div key={item.id} className="rounded-2xl bg-white dark:bg-gray-900 p-4 border border-gray-100 dark:border-gray-800">
                <p className="text-sm text-gray-700 dark:text-gray-300">{item.content}</p>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-gray-400">⏰ {new Date(item.sendAt).toLocaleString('zh-CN')}</span>
                  <button onClick={() => cancel(item.id)} className="text-xs text-red-400 hover:underline">取消发送</button>
                </div>
              </div>
            ))}
          </>
        )}

        {/* New capsule form */}
        {showNew && (
          <div className="rounded-2xl bg-white dark:bg-gray-900 p-4 border border-amber-200 dark:border-amber-800">
            <textarea value={content} onChange={e => setContent(e.target.value)} rows={3} placeholder="写给未来的消息..."
              className="w-full resize-none rounded-xl bg-gray-50 dark:bg-gray-800 px-4 py-2.5 text-sm" />
            <div className="mt-2 space-y-2">
              <input type="datetime-local" value={sendAt} onChange={e => setSendAt(e.target.value)}
                className="w-full rounded-xl bg-gray-50 dark:bg-gray-800 px-4 py-2 text-sm" />
              <input type="text" value={receiverId} onChange={e => setReceiverId(e.target.value)} placeholder="接收人 Echo ID (可选，留空=私密日记)"
                className="w-full rounded-xl bg-gray-50 dark:bg-gray-800 px-4 py-2 text-sm" />
            </div>
            <div className="flex gap-2 mt-3">
              <button onClick={() => setShowNew(false)} className="flex-1 rounded-xl bg-gray-100 dark:bg-gray-800 py-2 text-sm">取消</button>
              <button onClick={create} disabled={posting} className="flex-1 rounded-xl bg-amber-500 text-white py-2 text-sm font-medium disabled:opacity-50">
                {posting ? '创建中...' : '⏳ 放入胶囊'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
