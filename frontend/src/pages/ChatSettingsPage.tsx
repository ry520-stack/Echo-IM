import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import { useToast } from '../contexts/ToastContext';
import { useBackground } from '../hooks/useBackground';
import { assetUrl } from '../utils/assetUrl';

interface Peer {
  id: string;
  username: string;
  nickname: string;
  avatar: string;
  digitalId: number;
}

interface FriendGroup {
  id: string;
  name: string;
  color: string;
  members: { peerId: string; peer: { id: string; nickname: string; username: string; avatar: string } }[];
}

export default function ChatSettingsPage() {
  const { userId } = useParams();
  const [searchParams] = useSearchParams();
  const nav = useNavigate();
  const toast = useToast();
  const [peer, setPeer] = useState<Peer | null>(null);
  const [alias, setAlias] = useState('');
  const [saving, setSaving] = useState(false);
  const { getChatBg, setChatBg, uploadAndGetUrl } = useBackground();
  const [bgUploading, setBgUploading] = useState(false);
  const bgInputRef = useRef<HTMLInputElement>(null);
  const currentBgUrl = peer ? getChatBg(peer.id) : '';
  const [groups, setGroups] = useState<FriendGroup[]>([]);
  const [groupMembership, setGroupMembership] = useState<Set<string>>(new Set());
  const backToOrbit = searchParams.get('from') === 'orbit';
  const [realMetAt, setRealMetAt] = useState('');

  useEffect(() => {
    if (!userId) return;
    api<Peer[]>('GET', `/api/users/search?q=${userId}`).then(r => {
      const p = r.find(x => x.digitalId.toString() === userId || x.id === userId);
      if (p) { setPeer(p); setAlias(p.nickname || ''); }
    }).catch(() => {});
  }, [userId]);

  useEffect(() => {
    api<FriendGroup[]>('GET', '/api/friend-groups')
      .then(groups => {
        setGroups(groups);
        if (peer) {
          const membership = new Set<string>();
          groups.forEach(g => {
            if (g.members.some(m => m.peerId === peer.id)) membership.add(g.id);
          });
          setGroupMembership(membership);
        }
      })
      .catch(() => {});
  }, [userId, peer]);

  useEffect(() => {
    if (!peer) return;
    api<any>('GET', `/api/friends/relationship/${peer.id}`)
      .then(summary => setRealMetAt(summary.realMetAt ? summary.realMetAt.slice(0, 10) : ''))
      .catch(() => {});
  }, [peer]);

  const saveAlias = async () => {
    if (!peer) return;
    setSaving(true);
    try {
      await api('PUT', `/api/users/me/alias/${peer.id}`, { alias });
      toast('备注已保存', 'success');
    } catch { toast('保存失败', 'error'); }
    finally { setSaving(false); }
  };

  const toggleGroup = async (groupId: string) => {
    if (!peer) return;
    const isMember = groupMembership.has(groupId);
    try {
      if (isMember) {
        await api('DELETE', `/api/friend-groups/${groupId}/members/${peer.id}`);
        setGroupMembership(prev => { const next = new Set(prev); next.delete(groupId); return next; });
      } else {
        await api('POST', `/api/friend-groups/${groupId}/members`, { peerId: peer.id });
        setGroupMembership(prev => new Set(prev).add(groupId));
      }
    } catch (e: any) { toast(e.message || '操作失败', 'error'); }
  };

  const saveRealMetAt = async () => {
    if (!peer) return;
    try {
      await api('PATCH', `/api/friends/relationship/${peer.id}`, { realMetAt: realMetAt || null });
      toast('现实相识时间已保存', 'success');
    } catch (e: any) {
      toast(e.message || '保存失败', 'error');
    }
  };

  if (!peer) return <div className="flex h-full items-center justify-center text-gray-400">加载中...</div>;

  return (
    <div className="flex h-full overflow-y-auto flex-col bg-gray-50 dark:bg-gray-950">
      <header className="flex items-center gap-3 border-b border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-900">
        <button onClick={() => { if (backToOrbit) nav(`/chat/${userId}?orbit=1`); else nav(-1); }} className="text-sm text-primary-500">← 返回</button>
        <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">好友设置</h1>
      </header>
      <div className="p-4 space-y-4">
        <div className="flex items-center gap-4 p-4 rounded-2xl bg-white dark:bg-gray-900">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-500 text-2xl font-bold text-white">
            {peer.avatar ? <img src={assetUrl(peer.avatar)} alt="" className="h-full w-full rounded-2xl object-cover" /> : peer.nickname?.[0] || peer.username[0]}
          </div>
          <div>
            <p className="text-base font-semibold text-gray-900 dark:text-gray-100">{peer.nickname || peer.username}</p>
            <p className="text-sm text-gray-400">ID: {peer.digitalId}</p>
          </div>
        </div>
        <div className="rounded-2xl bg-white dark:bg-gray-900 p-4 space-y-3">
          <label className="text-sm text-gray-600 dark:text-gray-400">设置备注</label>
          <input value={alias} onChange={e => setAlias(e.target.value)} className="w-full rounded-xl bg-gray-50 dark:bg-gray-800 px-4 py-2.5 text-sm" placeholder="输入备注..." />
          <button onClick={saveAlias} disabled={saving} className="w-full rounded-xl bg-primary-500 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{saving ? '保存中...' : '保存备注'}</button>
        </div>
        <div className="rounded-2xl bg-white dark:bg-gray-900 p-4 space-y-3">
          <label className="text-sm text-gray-600 dark:text-gray-400">现实相识时间</label>
          <input
            type="date"
            value={realMetAt}
            onChange={e => setRealMetAt(e.target.value)}
            className="w-full rounded-xl bg-gray-50 px-4 py-2.5 text-sm dark:bg-gray-800 dark:text-gray-100"
          />
          <button onClick={saveRealMetAt} className="w-full rounded-xl bg-gray-100 py-2.5 text-sm font-semibold text-gray-700 dark:bg-gray-800 dark:text-gray-200">保存现实相识时间</button>
        </div>
        <div className="rounded-2xl bg-white dark:bg-gray-900 p-4 space-y-3">
          <label className="text-sm text-gray-600 dark:text-gray-400">聊天背景</label>
          <div className="flex gap-3 items-center">
            <div className="w-20 h-20 rounded-xl bg-gray-100 dark:bg-gray-800 overflow-hidden">
              {currentBgUrl ? <img src={assetUrl(currentBgUrl)} alt="" className="w-full h-full object-cover" /> : <div className="flex items-center justify-center h-full text-2xl text-gray-300">🖼</div>}
            </div>
            <div className="flex flex-col gap-2 flex-1">
              <button onClick={() => bgInputRef.current?.click()} disabled={bgUploading} className="rounded-lg bg-primary-500 px-3 py-1.5 text-xs text-white">
                {bgUploading ? '上传中...' : '选择专属背景'}
              </button>
              {currentBgUrl && (
                <button onClick={async () => { if (peer) await setChatBg(peer.id, ''); toast('已恢复默认', 'info'); }} className="rounded-lg bg-red-100 dark:bg-red-900/30 px-3 py-1.5 text-xs text-red-500">
                  恢复默认
                </button>
              )}
              <input ref={bgInputRef} type="file" accept="image/*" className="hidden" onChange={async (e) => {
                const f = e.target.files?.[0]; if (!f) return;
                setBgUploading(true);
                try {
                  const url = await uploadAndGetUrl(f);
                  if (peer) await setChatBg(peer.id, url);
                  toast('专属背景设置成功', 'success');
                } catch (err: any) { toast(err.message || '上传失败', 'error'); }
                finally { setBgUploading(false); e.target.value = ''; }
              }} />
            </div>
          </div>
        </div>
        <div className="rounded-2xl bg-white dark:bg-gray-900 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm text-gray-600 dark:text-gray-400">星域分组</label>
            <button onClick={() => window.location.hash = '#/star-zones'} className="text-xs text-primary-500 hover:underline">管理星域</button>
          </div>
          {groups.length === 0 ? (
            <p className="text-xs text-gray-400 py-2">暂无星域分组，点击"管理星域"创建</p>
          ) : (
            groups.map(group => (
              <label key={group.id} className="flex items-center gap-3 p-2 rounded-lg bg-gray-50 dark:bg-gray-800 cursor-pointer">
                <input
                  type="checkbox"
                  className="w-4 h-4 accent-primary-500"
                  checked={groupMembership.has(group.id)}
                  onChange={() => toggleGroup(group.id)}
                />
                <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: group.color || '#6366f1' }} />
                <span className="text-sm text-gray-700 dark:text-gray-300">{group.name}</span>
              </label>
            ))
          )}
          <p className="text-xs text-gray-400">将此好友加入或移出星域</p>
        </div>
      </div>
    </div>
  );
}
