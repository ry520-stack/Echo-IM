import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../api/client';
import { useToast } from '../contexts/ToastContext';
import { assetUrl } from '../utils/assetUrl';
import Modal from '../components/Modal';

interface FriendGroup {
  id: string;
  name: string;
  color: string;
  members: { peerId: string; peer: { id: string; username: string; nickname: string; avatar: string } }[];
}

interface Friend {
  id: string;
  peer: { id: string; username: string; nickname: string; avatar: string; digitalId: number };
  alias: string;
}

const PRESET_COLORS = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#06b6d4', '#8b5cf6', '#ef4444', '#84cc16'];

export default function StarZoneManagePage() {
  const nav = useNavigate();
  const toast = useToast();
  const [groups, setGroups] = useState<FriendGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#6366f1');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<FriendGroup | null>(null);
  const [addingToId, setAddingToId] = useState<string | null>(null);
  const [friendSearch, setFriendSearch] = useState('');
  const [searchResults, setSearchResults] = useState<Friend['peer'][]>([]);
  const [searching, setSearching] = useState(false);

  const fetchGroups = async () => {
    try {
      setGroups(await api<FriendGroup[]>('GET', '/api/friend-groups'));
    } catch {
      toast('星域加载失败', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchGroups(); }, []);

  const createGroup = async () => {
    if (!newName.trim()) return;
    try {
      await api('POST', '/api/friend-groups', { name: newName.trim(), color: newColor });
      setNewName('');
      setNewColor('#6366f1');
      setShowCreate(false);
      fetchGroups();
      toast('星域已创建', 'success');
    } catch (e: any) {
      toast(e.message || '创建失败', 'error');
    }
  };

  const updateGroup = async (groupId: string) => {
    if (!editName.trim()) return;
    try {
      await api('PATCH', `/api/friend-groups/${groupId}`, { name: editName.trim(), color: editColor });
      setEditingId(null);
      fetchGroups();
      toast('星域已更新', 'success');
    } catch (e: any) {
      toast(e.message || '更新失败', 'error');
    }
  };

  const deleteGroup = async () => {
    if (!deleteTarget) return;
    try {
      await api('DELETE', `/api/friend-groups/${deleteTarget.id}`);
      setDeleteTarget(null);
      fetchGroups();
      toast('星域已删除', 'info');
    } catch (e: any) {
      toast(e.message || '删除失败', 'error');
    }
  };

  const removeMember = async (groupId: string, peerId: string) => {
    try {
      await api('DELETE', `/api/friend-groups/${groupId}/members/${peerId}`);
      fetchGroups();
    } catch (e: any) {
      toast(e.message || '移除失败', 'error');
    }
  };

  const searchFriends = async () => {
    if (!friendSearch.trim()) return;
    setSearching(true);
    try {
      const friends = await api<Friend[]>('GET', '/api/friends');
      const q = friendSearch.trim().toLowerCase();
      setSearchResults(
        friends
          .map(f => f.peer)
          .filter(p =>
            p.nickname?.toLowerCase().includes(q) ||
            p.username?.toLowerCase().includes(q) ||
            String(p.digitalId).includes(q)
          ),
      );
    } catch {
      toast('搜索失败', 'error');
    } finally {
      setSearching(false);
    }
  };

  const addMember = async (groupId: string, peerId: string) => {
    try {
      await api('POST', `/api/friend-groups/${groupId}/members`, { peerId });
      fetchGroups();
      setSearchResults(prev => prev.filter(p => p.id !== peerId));
      toast('已加入星域', 'success');
    } catch (e: any) {
      toast(e.message || '添加失败', 'error');
    }
  };

  const colorPicker = (value: string, onChange: (color: string) => void) => (
    <div className="flex gap-2">
      {PRESET_COLORS.map(color => (
        <button
          key={color}
          type="button"
          onClick={() => onChange(color)}
          className={`h-8 w-8 rounded-full transition-transform ${value === color ? 'scale-110 ring-2 ring-gray-400 ring-offset-2' : ''}`}
          style={{ backgroundColor: color }}
          aria-label={color}
        />
      ))}
    </div>
  );

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-gray-50 dark:bg-gray-950">
      <header className="flex shrink-0 items-center gap-3 border-b border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-900">
        <button onClick={() => nav(-1)} className="text-sm text-primary-500">← 返回</button>
        <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">星域管理</h1>
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        <button
          onClick={() => setShowCreate(true)}
          className="w-full rounded-xl border-2 border-dashed border-gray-300 py-3 text-sm text-gray-500 transition-colors hover:border-primary-400 hover:text-primary-500 dark:border-gray-600"
        >
          + 新建星域
        </button>

        {loading ? (
          <p className="py-8 text-center text-sm text-gray-400">加载中...</p>
        ) : groups.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-400">暂无星域</p>
        ) : (
          groups.map(group => (
            <div key={group.id} className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
              <div className="flex items-center gap-3 p-4" onClick={() => setExpandedId(expandedId === group.id ? null : group.id)}>
                <span className="h-4 w-4 shrink-0 rounded-full" style={{ backgroundColor: group.color }} />
                <span className="flex-1 text-sm font-semibold text-gray-800 dark:text-gray-200">{group.name}</span>
                <span className="text-xs text-gray-400">{group.members.length} 人</span>
                <button onClick={(e) => { e.stopPropagation(); setEditingId(group.id); setEditName(group.name); setEditColor(group.color); }} className="px-1 text-xs text-gray-400 hover:text-primary-500">编辑</button>
                <button onClick={(e) => { e.stopPropagation(); setDeleteTarget(group); }} className="px-1 text-xs text-gray-400 hover:text-red-500">删除</button>
              </div>

              <AnimatePresence initial={false}>
                {expandedId === group.id && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                    <div className="space-y-2 border-t border-gray-100 px-4 py-3 dark:border-gray-800">
                      {group.members.length === 0 ? (
                        <p className="py-2 text-xs text-gray-400">暂无成员</p>
                      ) : (
                        group.members.map(member => (
                          <div key={member.peerId} className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                              <div className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-lg bg-primary-100 text-xs font-bold text-primary-600 dark:bg-primary-900/30">
                                {member.peer.avatar ? <img src={assetUrl(member.peer.avatar)} alt="" className="h-full w-full object-cover" /> : (member.peer.nickname || member.peer.username)[0]?.toUpperCase()}
                              </div>
                              <span className="text-sm text-gray-700 dark:text-gray-300">{member.peer.nickname || member.peer.username}</span>
                            </div>
                            <button onClick={() => removeMember(group.id, member.peerId)} className="text-xs text-red-400 hover:text-red-500">移除</button>
                          </div>
                        ))
                      )}

                      {addingToId === group.id ? (
                        <div className="space-y-2 border-t border-gray-100 pt-2 dark:border-gray-800">
                          <div className="flex gap-2">
                            <input value={friendSearch} onChange={(e) => setFriendSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && searchFriends()} placeholder="搜索好友..." className="flex-1 rounded-lg bg-gray-50 px-3 py-1.5 text-xs dark:bg-gray-800 dark:text-gray-200" autoFocus />
                            <button onClick={searchFriends} disabled={searching} className="rounded-lg bg-primary-500 px-3 py-1.5 text-xs text-white">{searching ? '...' : '搜索'}</button>
                            <button onClick={() => { setAddingToId(null); setSearchResults([]); setFriendSearch(''); }} className="rounded-lg px-2 py-1.5 text-xs text-gray-400">取消</button>
                          </div>
                          {searchResults.map(peer => (
                            <div key={peer.id} className="flex items-center justify-between gap-2 py-1">
                              <span className="text-xs text-gray-700 dark:text-gray-300">{peer.nickname || peer.username}</span>
                              <button onClick={() => addMember(group.id, peer.id)} className="rounded-lg bg-primary-100 px-2 py-0.5 text-xs text-primary-600 dark:bg-primary-900/30 dark:text-primary-400">添加</button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <button onClick={() => setAddingToId(group.id)} className="text-xs text-primary-500">+ 添加成员</button>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))
        )}
      </div>

      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="新建星域"
        actions={
          <>
            <button onClick={() => setShowCreate(false)} className="rounded-xl px-4 py-2 text-sm text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800">取消</button>
            <button onClick={createGroup} className="rounded-xl bg-primary-500 px-4 py-2 text-sm font-medium text-white hover:bg-primary-600">创建</button>
          </>
        }
      >
        <div className="space-y-3">
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="星域名称" className="w-full rounded-xl bg-gray-50 px-4 py-2.5 text-sm dark:bg-gray-800 dark:text-gray-200" />
          {colorPicker(newColor, setNewColor)}
        </div>
      </Modal>

      <Modal
        open={Boolean(editingId)}
        onClose={() => setEditingId(null)}
        title="编辑星域"
        actions={
          <>
            <button onClick={() => setEditingId(null)} className="rounded-xl px-4 py-2 text-sm text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800">取消</button>
            <button onClick={() => editingId && updateGroup(editingId)} className="rounded-xl bg-primary-500 px-4 py-2 text-sm font-medium text-white hover:bg-primary-600">保存</button>
          </>
        }
      >
        <div className="space-y-3">
          <input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="星域名称" className="w-full rounded-xl bg-gray-50 px-4 py-2.5 text-sm dark:bg-gray-800 dark:text-gray-200" />
          {colorPicker(editColor, setEditColor)}
        </div>
      </Modal>

      <Modal
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="删除星域"
        actions={
          <>
            <button onClick={() => setDeleteTarget(null)} className="rounded-xl px-4 py-2 text-sm text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800">取消</button>
            <button onClick={deleteGroup} className="rounded-xl bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600">删除</button>
          </>
        }
      >
        <p>删除后会移除此星域的成员关系，不会删除好友。是否继续？</p>
      </Modal>
    </div>
  );
}
