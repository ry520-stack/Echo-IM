import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../contexts/SocketContext';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import Modal from '../components/Modal';
import { api } from '../api/client';

interface Peer {
  id: string;
  username: string;
  nickname: string;
  avatar: string;
  digitalId: number;
  lastSeenAt: string;
  status: string;
}

interface Friend {
  id: string;
  peer: Peer;
  alias: string;
  isPinned: boolean;
  createdAt: string;
}

interface FriendRequest {
  id: string;
  from: Peer;
  alias: string;
  createdAt: string;
}

export default function FriendsPage() {
  const nav = useNavigate();
  const { socket } = useSocket();
  const toast = useToast();
  const { user } = useAuth();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Peer[]>([]);
  const [searching, setSearching] = useState(false);
  const [activeTab, setActiveTab] = useState<'friends' | 'requests'>('friends');
  const [error, setError] = useState('');

  // Delete confirmation modal
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  // Add friend modal (custom geek UI)
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addFriendInput, setAddFriendInput] = useState('');

  const fetchFriends = async () => {
    try {
      const data = await api<Friend[]>('GET', '/api/friends');
      setFriends(data);
    } catch { /* offline */ }
  };

  const fetchRequests = async () => {
    try {
      const data = await api<FriendRequest[]>('GET', '/api/friends/pending');
      setRequests(data);
    } catch { /* offline */ }
  };

  useEffect(() => {
    fetchFriends();
    fetchRequests();
  }, []);

  useEffect(() => {
    if (!socket) return;
    const refreshRequests = () => fetchRequests();
    const refreshRelationships = () => {
      fetchFriends();
      fetchRequests();
    };
    socket.on('friend:request', refreshRequests);
    socket.on('friend:accepted', refreshRelationships);
    socket.on('friend:removed', refreshRelationships);
    socket.on('relationship:updated', refreshRelationships);
    return () => {
      socket.off('friend:request', refreshRequests);
      socket.off('friend:accepted', refreshRelationships);
      socket.off('friend:removed', refreshRelationships);
      socket.off('relationship:updated', refreshRelationships);
    };
  }, [socket]);

  const searchUsers = async () => {
    const q = searchQuery.trim();
    if (!q) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    setError('');
    try {
      const results = await api<Peer[]>('GET', `/api/users/search?q=${encodeURIComponent(q)}`);
      setSearchResults(results);
    } catch (e: any) {
      setError(e.message || '搜索失败');
    } finally {
      setSearching(false);
    }
  };

  const sendRequest = async (peerId: string) => {
    try {
      const res = await api<{ status: string; message: string }>('POST', '/api/friends/request', { peerId });
      toast(res.message || '好友申请已发送', 'success');
      setSearchResults(prev => prev.filter(p => p.id !== peerId));
      fetchFriends();
    } catch (e: any) {
      toast(e.message || '发送失败', 'error');
    }
  };

  const acceptRequest = async (requestId: string) => {
    try {
      await api('PATCH', `/api/friends/${requestId}/accept`);
      fetchRequests();
      fetchFriends();
      toast('已同意好友申请', 'success');
    } catch (e: any) { toast(e.message || '操作失败', 'error'); }
  };

  const rejectRequest = async (requestId: string) => {
    try {
      await api('PATCH', `/api/friends/${requestId}/reject`);
      fetchRequests();
    } catch (e: any) { toast(e.message || '操作失败', 'error'); }
  };

  const confirmDelete = (friendshipId: string, name: string) => {
    setDeleteTarget({ id: friendshipId, name });
    setDeleteModalOpen(true);
  };

  const removeFriend = async () => {
    if (!deleteTarget) return;
    setDeleteModalOpen(false);
    try {
      await api('DELETE', `/api/friends/${deleteTarget.id}`);
      fetchFriends();
      toast('已删除好友', 'success');
    } catch (e: any) { toast(e.message || '删除失败', 'error'); }
    setDeleteTarget(null);
  };

  const togglePin = async (friendshipId: string) => {
    try {
      await api('PUT', `/api/friends/${friendshipId}/pin`);
      fetchFriends();
    } catch (e: any) { toast(e.message || '操作失败', 'error'); }
  };

  const blockFriend = async (userId: string) => {
    if (!window.confirm('\u786e\u5b9a\u62c9\u9ed1\u8be5\u7528\u6237\u5417\uff1f\u62c9\u9ed1\u540e\u53cc\u65b9\u5c06\u65e0\u6cd5\u4e92\u53d1\u79c1\u804a\u6d88\u606f\u3002')) return;
    try {
      await api('POST', '/api/blocks/' + userId);
      toast('已拉黑', 'success');
      fetchFriends();
    } catch (e: any) { toast(e.message || '操作失败', 'error'); }
  };

  // Add friend via modal
  const openAddModal = () => {
    setAddFriendInput('');
    setAddModalOpen(true);
  };

  const addFriendFromModal = async () => {
    const q = addFriendInput.trim();
    if (!q) return;
    try {
      const results = await api<Peer[]>('GET', `/api/users/search?q=${encodeURIComponent(q)}`);
      const candidates = results.filter(p => p.id !== user?.id && !friends.some(f => f.peer.id === p.id));
      const exact = /^\d{6}$/.test(q) ? candidates.find(p => String(p.digitalId) === q) : undefined;
      const peer = exact || (candidates.length === 1 ? candidates[0] : null);
      if (!peer) {
        setSearchQuery(q);
        setSearchResults(candidates);
        setAddModalOpen(false);
        toast(candidates.length > 1 ? '找到多个用户，请在搜索结果里选择添加' : '未找到该用户', candidates.length > 1 ? 'success' : 'error');
        return;
      }
      const res = await api<{ status: string; message: string }>('POST', '/api/friends/request', { peerId: peer.id });
      toast(res.message || '好友申请已发送', 'success');
      setAddModalOpen(false);
      fetchFriends();
    } catch (e: any) {
      toast(e.message || '发送失败', 'error');
    }
  };

  const getDisplayName = (p: Peer) => p.nickname || p.username;

  return (
    <div className="flex h-full overflow-y-auto flex-col bg-gray-50 dark:bg-gray-950">
      <header className="flex items-center gap-3 border-b border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-900">
        <button onClick={() => nav('/')} className="text-sm text-primary-500 hover:underline">← 返回</button>
        <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">好友</h1>
      </header>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
        <button
          onClick={() => setActiveTab('friends')}
          className={`flex-1 py-2.5 text-sm font-medium ${activeTab === 'friends' ? 'border-b-2 border-primary-500 text-primary-500' : 'text-gray-500'}`}
        >
          好友 ({friends.length})
        </button>
        <button
          onClick={() => setActiveTab('requests')}
          className={`flex-1 py-2.5 text-sm font-medium ${activeTab === 'requests' ? 'border-b-2 border-primary-500 text-primary-500' : 'text-gray-500'}`}
        >
          新申请 {requests.length > 0 && `(${requests.length})`}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {/* Search & add friend */}
        <div className="mb-4 flex gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && searchUsers()}
            placeholder="搜索 Echo ID 或用户名"
            className="flex-1 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          />
          <button
            onClick={searchUsers}
            disabled={searching}
            className="rounded-xl bg-primary-500 px-4 py-2 text-sm font-medium text-white hover:bg-primary-600 disabled:opacity-50"
          >
            {searching ? '...' : '搜索'}
          </button>
          <button
            onClick={openAddModal}
            className="rounded-xl border border-primary-300 px-3 py-2 text-sm font-medium text-primary-500 hover:bg-primary-50 dark:border-primary-700 dark:hover:bg-primary-900/20"
          >
            + 添加
          </button>
        </div>

        {searchResults.length > 0 && (
          <div className="mb-4 rounded-2xl border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900">
            <p className="mb-2 text-xs text-gray-500">搜索结果</p>
            {searchResults.map(peer => {
              const isSelf = peer.id === user?.id;
              const isAlreadyFriend = friends.some(f => f.peer.id === peer.id);
              return (
                <div key={peer.id} className="flex items-center justify-between py-2 border-b border-gray-50 dark:border-gray-800 last:border-0">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-100 text-sm font-bold text-primary-600 dark:bg-primary-900/30">
                      {getDisplayName(peer)[0]?.toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{getDisplayName(peer)}</p>
                      <p className="text-xs text-gray-400">ID: {peer.digitalId}</p>
                    </div>
                  </div>
                  {isSelf ? (
                    <span className="text-xs text-gray-400">你自己</span>
                  ) : isAlreadyFriend ? (
                    <span className="text-xs text-gray-400">已添加</span>
                  ) : (
                    <button
                      onClick={() => sendRequest(peer.id)}
                      className="rounded-lg bg-primary-50 px-3 py-1 text-xs font-medium text-primary-600 hover:bg-primary-100 dark:bg-primary-900/30 dark:text-primary-400"
                    >
                      添加
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {activeTab === 'requests' && (
          <div className="space-y-2">
            {requests.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-400">暂无好友申请</p>
            ) : (
              requests.map(req => (
                <div key={req.id} className="flex items-center justify-between rounded-xl bg-white p-3 dark:bg-gray-900">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-100 text-sm font-bold text-primary-600">
                      {getDisplayName(req.from)[0]?.toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{getDisplayName(req.from)}</p>
                      <p className="text-xs text-gray-400">ID: {req.from.digitalId}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => acceptRequest(req.id)}
                      className="rounded-lg bg-primary-500 px-3 py-1 text-xs text-white hover:bg-primary-600"
                    >
                      同意
                    </button>
                    <button
                      onClick={() => rejectRequest(req.id)}
                      className="rounded-lg bg-gray-100 px-3 py-1 text-xs text-gray-500 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400"
                    >
                      拒绝
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'friends' && (
          <div className="space-y-1">
            {friends.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-400">暂无好友</p>
            ) : (
              friends.map(f => (
                <div
                  key={f.id}
                  className="flex items-center justify-between rounded-xl p-3 hover:bg-gray-100 dark:hover:bg-gray-800/50"
                >
                  <div
                    className="flex flex-1 items-center gap-3 cursor-pointer"
                    onClick={() => nav(`/chat/${f.peer.digitalId}`)}
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-100 text-sm font-bold text-primary-600 dark:bg-primary-900/30">
                      {getDisplayName(f.peer)[0]?.toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                        {f.alias || getDisplayName(f.peer)}
                        {f.isPinned && <span className="ml-1 text-amber-500">📌</span>}
                      </p>
                      <p className="text-xs text-gray-400">{f.peer.status || `ID: ${f.peer.digitalId}`}</p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => togglePin(f.id)}
                      className="rounded-lg px-2 py-1 text-xs text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                      title={f.isPinned ? '取消置顶' : '置顶'}
                    >
                      📌
                    </button>
                    <button
                      onClick={() => blockFriend(f.peer.id)}
                      className="rounded-lg px-2 py-1 text-xs text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20"
                    >
                      拉黑
                    </button>
                    <button
                      onClick={() => confirmDelete(f.id, f.alias || getDisplayName(f.peer))}
                      className="rounded-lg px-2 py-1 text-xs text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                      删除
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Delete confirmation modal */}
      <Modal
        open={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="删除好友"
        actions={
          <>
            <button
              onClick={() => setDeleteModalOpen(false)}
              className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
            >
              取消
            </button>
            <button
              onClick={removeFriend}
              className="rounded-lg bg-red-500 px-4 py-2 text-sm text-white hover:bg-red-600"
            >
              确认删除
            </button>
          </>
        }
      >
        <p>确定要删除好友 <span className="text-white font-medium">{deleteTarget?.name}</span> 吗？</p>
      </Modal>

      {/* Add friend modal — geek UI */}
      <Modal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        title="添加好友"
        actions={
          <>
            <button
              onClick={() => setAddModalOpen(false)}
              className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
            >
              取消
            </button>
            <button
              onClick={addFriendFromModal}
              className="rounded-lg bg-primary-500 px-4 py-2 text-sm text-white hover:bg-primary-600"
            >
              搜索并添加
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-slate-400 text-xs">输入对方的 Echo ID 或用户名</p>
          <input
            type="text"
            value={addFriendInput}
            onChange={(e) => setAddFriendInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addFriendFromModal()}
            placeholder="Echo ID 或用户名"
            autoFocus
            className="w-full rounded-lg border-0 border-b-2 border-slate-700 bg-transparent px-1 py-2 text-sm text-white placeholder-slate-500 outline-none transition-colors focus:border-primary-500"
          />
        </div>
      </Modal>
    </div>
  );
}
