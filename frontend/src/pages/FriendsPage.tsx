import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { useToast } from '../contexts/ToastContext';
import Modal from '../components/Modal';
import { api } from '../api/client';
import { assetUrl } from '../utils/assetUrl';

interface Peer {
  id: string;
  username: string;
  nickname: string;
  avatar: string;
  digitalId: number;
  status: string;
}
interface Friend {
  id: string;
  peer: Peer;
  alias: string;
}
interface FriendRequest {
  id: string;
  from: Peer;
}

const T = {
  back: '\u2190 \u8fd4\u56de',
  friends: '\u597d\u53cb',
  requests: '\u65b0\u7533\u8bf7',
  searchPlaceholder: '\u641c\u7d22 Echo ID \u6216\u7528\u6237\u540d',
  search: '\u641c\u7d22',
  add: '\u6dfb\u52a0',
  addFriend: '\u6dfb\u52a0\u597d\u53cb',
  results: '\u641c\u7d22\u7ed3\u679c',
  self: '\u4f60\u81ea\u5df1',
  added: '\u5df2\u6dfb\u52a0',
  noRequests: '\u6682\u65e0\u597d\u53cb\u7533\u8bf7',
  noFriends: '\u6682\u65e0\u597d\u53cb',
  accept: '\u540c\u610f',
  reject: '\u62d2\u7edd',
  block: '\u62c9\u9ed1',
  delete: '\u5220\u9664',
  cancel: '\u53d6\u6d88',
  confirmDelete: '\u786e\u8ba4\u5220\u9664',
  deleteFriend: '\u5220\u9664\u597d\u53cb',
  deleteQuestion: '\u786e\u5b9a\u8981\u5220\u9664\u597d\u53cb',
  inputHint: '\u8f93\u5165\u5bf9\u65b9\u7684 Echo ID \u6216\u7528\u6237\u540d',
  searchAndAdd: '\u641c\u7d22\u5e76\u6dfb\u52a0',
  sendOk: '\u597d\u53cb\u7533\u8bf7\u5df2\u53d1\u9001',
  acceptOk: '\u5df2\u540c\u610f\u597d\u53cb\u7533\u8bf7',
  deletedOk: '\u5df2\u5220\u9664\u597d\u53cb',
  blockedOk: '\u5df2\u62c9\u9ed1',
  opFail: '\u64cd\u4f5c\u5931\u8d25',
  sendFail: '\u53d1\u9001\u5931\u8d25',
  deleteFail: '\u5220\u9664\u5931\u8d25',
  notFound: '\u672a\u627e\u5230\u8be5\u7528\u6237',
  multiple: '\u627e\u5230\u591a\u4e2a\u7528\u6237\uff0c\u8bf7\u5728\u641c\u7d22\u7ed3\u679c\u91cc\u9009\u62e9\u6dfb\u52a0',
};

export default function FriendsPage() {
  const nav = useNavigate();
  const { socket } = useSocket();
  const toast = useToast();
  const { user } = useAuth();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [activeTab, setActiveTab] = useState<'friends' | 'requests'>('friends');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Peer[]>([]);
  const [searching, setSearching] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addFriendInput, setAddFriendInput] = useState('');

  const fetchFriends = async () => {
    try { setFriends(await api<Friend[]>('GET', '/api/friends')); } catch { /* offline */ }
  };
  const fetchRequests = async () => {
    try { setRequests(await api<FriendRequest[]>('GET', '/api/friends/pending')); } catch { /* offline */ }
  };
  const refresh = () => { fetchFriends(); fetchRequests(); };

  useEffect(() => { refresh(); }, []);
  useEffect(() => {
    if (!socket) return;
    socket.on('friend:request', fetchRequests);
    socket.on('friend:accepted', refresh);
    socket.on('friend:removed', refresh);
    socket.on('relationship:updated', refresh);
    return () => {
      socket.off('friend:request', fetchRequests);
      socket.off('friend:accepted', refresh);
      socket.off('friend:removed', refresh);
      socket.off('relationship:updated', refresh);
    };
  }, [socket]);

  const displayName = (peer: Peer) => peer.nickname || peer.username;
  const avatar = (peer: Peer, size = 'h-10 w-10') => (
    <div className={`flex ${size} shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-primary-100 text-sm font-bold text-primary-600 dark:bg-primary-900/30`}>
      {peer.avatar ? <img src={assetUrl(peer.avatar)} alt="" className="h-full w-full object-cover" /> : displayName(peer)[0]?.toUpperCase()}
    </div>
  );

  const searchUsers = async (value = searchQuery) => {
    const q = value.trim();
    if (!q) { setSearchResults([]); return []; }
    setSearching(true);
    try {
      const results = await api<Peer[]>('GET', `/api/users/search?q=${encodeURIComponent(q)}`);
      setSearchResults(results);
      return results;
    } catch (error: any) {
      toast(error.message || T.opFail, 'error');
      return [];
    } finally {
      setSearching(false);
    }
  };

  const sendRequest = async (peerId: string) => {
    try {
      const res = await api<{ message?: string }>('POST', '/api/friends/request', { peerId });
      toast(res.message || T.sendOk, 'success');
      setSearchResults(prev => prev.filter(peer => peer.id !== peerId));
      fetchFriends();
    } catch (error: any) {
      toast(error.message || T.sendFail, 'error');
    }
  };
  const acceptRequest = async (requestId: string) => {
    try { await api('PATCH', `/api/friends/${requestId}/accept`); refresh(); toast(T.acceptOk, 'success'); }
    catch (error: any) { toast(error.message || T.opFail, 'error'); }
  };
  const rejectRequest = async (requestId: string) => {
    try { await api('PATCH', `/api/friends/${requestId}/reject`); fetchRequests(); }
    catch (error: any) { toast(error.message || T.opFail, 'error'); }
  };
  const blockFriend = async (peerId: string) => {
    if (!window.confirm('\u786e\u5b9a\u62c9\u9ed1\u8be5\u7528\u6237\u5417\uff1f\u62c9\u9ed1\u540e\u53cc\u65b9\u5c06\u65e0\u6cd5\u4e92\u53d1\u79c1\u804a\u6d88\u606f\u3002')) return;
    try { await api('POST', `/api/blocks/${peerId}`); toast(T.blockedOk, 'success'); fetchFriends(); }
    catch (error: any) { toast(error.message || T.opFail, 'error'); }
  };
  const removeFriend = async () => {
    if (!deleteTarget) return;
    setDeleteModalOpen(false);
    try { await api('DELETE', `/api/friends/${deleteTarget.id}`); toast(T.deletedOk, 'success'); fetchFriends(); }
    catch (error: any) { toast(error.message || T.deleteFail, 'error'); }
    setDeleteTarget(null);
  };
  const addFriendFromModal = async () => {
    const q = addFriendInput.trim();
    if (!q) return;
    const results = await searchUsers(q);
    const candidates = results.filter(peer => peer.id !== user?.id && !friends.some(friend => friend.peer.id === peer.id));
    const exact = /^\d{6}$/.test(q) ? candidates.find(peer => String(peer.digitalId) === q) : undefined;
    const peer = exact || (candidates.length === 1 ? candidates[0] : null);
    if (!peer) {
      setSearchQuery(q);
      setSearchResults(candidates);
      setAddModalOpen(false);
      toast(candidates.length > 1 ? T.multiple : T.notFound, candidates.length > 1 ? 'success' : 'error');
      return;
    }
    await sendRequest(peer.id);
    setAddModalOpen(false);
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-gray-50 dark:bg-gray-950">
      <header className="flex items-center gap-4 border-b border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-900">
        <button onClick={() => nav('/')} className="text-sm text-primary-500 hover:underline">{T.back}</button>
        <h1 className="text-xl font-black text-gray-900 dark:text-gray-100">{T.friends}</h1>
      </header>

      <div className="flex border-b border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
        <button onClick={() => setActiveTab('friends')} className={`flex-1 py-3 text-sm font-semibold ${activeTab === 'friends' ? 'border-b-2 border-primary-500 text-primary-500' : 'text-gray-500'}`}>{T.friends} ({friends.length})</button>
        <button onClick={() => setActiveTab('requests')} className={`flex-1 py-3 text-sm font-semibold ${activeTab === 'requests' ? 'border-b-2 border-primary-500 text-primary-500' : 'text-gray-500'}`}>{T.requests}{requests.length > 0 && ` (${requests.length})`}</button>
      </div>

      <main className="flex-1 overflow-y-auto p-4">
        <div className="mb-5 flex gap-2">
          <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && searchUsers()} placeholder={T.searchPlaceholder} className="min-w-0 flex-1 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100" />
          <button onClick={() => searchUsers()} disabled={searching} className="rounded-2xl bg-primary-500 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{searching ? '...' : T.search}</button>
          <button onClick={() => { setAddFriendInput(''); setAddModalOpen(true); }} className="rounded-2xl border border-primary-300 px-3 py-2 text-sm font-bold text-primary-500 dark:border-primary-700">+ {T.add}</button>
        </div>

        {searchResults.length > 0 && (
          <section className="mb-5 rounded-3xl bg-white p-3 shadow-sm dark:bg-gray-900">
            <p className="mb-2 px-1 text-xs text-gray-400">{T.results}</p>
            {searchResults.map(peer => {
              const isSelf = peer.id === user?.id;
              const already = friends.some(friend => friend.peer.id === peer.id);
              return (
                <div key={peer.id} className="flex items-center justify-between gap-3 border-b border-gray-50 py-3 last:border-0 dark:border-gray-800">
                  <div className="flex min-w-0 items-center gap-3">{avatar(peer, 'h-11 w-11')}<div className="min-w-0"><p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">{displayName(peer)}</p><p className="text-xs text-gray-400">ID: {peer.digitalId}</p></div></div>
                  {isSelf ? <span className="text-xs text-gray-400">{T.self}</span> : already ? <span className="text-xs text-gray-400">{T.added}</span> : <button onClick={() => sendRequest(peer.id)} className="rounded-xl bg-primary-50 px-3 py-1.5 text-xs font-bold text-primary-600 dark:bg-primary-900/30">{T.add}</button>}
                </div>
              );
            })}
          </section>
        )}

        {activeTab === 'requests' && (
          <section className="space-y-2">
            {requests.length === 0 ? <p className="py-10 text-center text-sm text-gray-400">{T.noRequests}</p> : requests.map(req => (
              <div key={req.id} className="flex items-center justify-between gap-3 rounded-2xl bg-white p-3 dark:bg-gray-900">
                <div className="flex min-w-0 items-center gap-3">{avatar(req.from, 'h-11 w-11')}<div className="min-w-0"><p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">{displayName(req.from)}</p><p className="text-xs text-gray-400">ID: {req.from.digitalId}</p></div></div>
                <div className="flex gap-2"><button onClick={() => acceptRequest(req.id)} className="rounded-xl bg-primary-500 px-3 py-1.5 text-xs font-bold text-white">{T.accept}</button><button onClick={() => rejectRequest(req.id)} className="rounded-xl bg-gray-100 px-3 py-1.5 text-xs text-gray-500 dark:bg-gray-800">{T.reject}</button></div>
              </div>
            ))}
          </section>
        )}

        {activeTab === 'friends' && (
          <section className="space-y-2">
            {friends.length === 0 ? <p className="py-10 text-center text-sm text-gray-400">{T.noFriends}</p> : friends.map(friend => (
              <div key={friend.id} className="flex items-center justify-between gap-3 rounded-2xl bg-white/70 p-3 dark:bg-gray-900/70">
                <button onClick={() => nav(`/chat/${friend.peer.digitalId}`)} className="flex min-w-0 flex-1 items-center gap-3 text-left">{avatar(friend.peer)}<span className="min-w-0"><span className="block truncate text-sm font-semibold text-gray-900 dark:text-gray-100">{friend.alias || displayName(friend.peer)}</span><span className="block truncate text-xs text-gray-400">{friend.peer.status || `ID: ${friend.peer.digitalId}`}</span></span></button>
                <div className="flex gap-1"><button onClick={() => blockFriend(friend.peer.id)} className="rounded-xl px-2 py-1 text-xs text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20">{T.block}</button><button onClick={() => { setDeleteTarget({ id: friend.id, name: friend.alias || displayName(friend.peer) }); setDeleteModalOpen(true); }} className="rounded-xl px-2 py-1 text-xs text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20">{T.delete}</button></div>
              </div>
            ))}
          </section>
        )}
      </main>

      <Modal open={deleteModalOpen} onClose={() => setDeleteModalOpen(false)} title={T.deleteFriend} actions={<><button onClick={() => setDeleteModalOpen(false)} className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800">{T.cancel}</button><button onClick={removeFriend} className="rounded-lg bg-red-500 px-4 py-2 text-sm text-white hover:bg-red-600">{T.confirmDelete}</button></>}>
        <p>{T.deleteQuestion} <span className="font-medium text-white">{deleteTarget?.name}</span>？</p>
      </Modal>

      <Modal open={addModalOpen} onClose={() => setAddModalOpen(false)} title={T.addFriend} actions={<><button onClick={() => setAddModalOpen(false)} className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800">{T.cancel}</button><button onClick={addFriendFromModal} className="rounded-lg bg-primary-500 px-4 py-2 text-sm text-white hover:bg-primary-600">{T.searchAndAdd}</button></>}>
        <div className="space-y-3"><p className="text-xs text-slate-400">{T.inputHint}</p><input value={addFriendInput} onChange={e => setAddFriendInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && addFriendFromModal()} placeholder={T.searchPlaceholder} autoFocus className="w-full rounded-lg border-0 border-b-2 border-slate-700 bg-transparent px-1 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-primary-500" /></div>
      </Modal>
    </div>
  );
}
