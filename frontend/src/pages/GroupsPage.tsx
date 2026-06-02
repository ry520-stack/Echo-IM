import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, Crown, Shield, UserMinus, Users } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import Modal from '../components/Modal';
import { api, getServerUrl } from '../api/client';
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

interface Member {
  userId: string;
  role: string;
  alias?: string;
  remark?: string;
  user: Peer;
}

interface Group {
  id: string;
  name: string;
  avatar?: string;
  notice?: string;
  creatorId: string;
  role: string;
  alias?: string;
  remark?: string;
  memberCount: number;
  messageCount?: number;
  members: Member[];
  createdAt: string;
}

const roleLabel = (role: string) => role === 'owner' ? '群主' : role === 'admin' ? '管理员' : '成员';
const displayName = (member: Member) => member.alias || member.user.nickname || member.user.username;
const friendName = (friend: Friend) => friend.alias || friend.peer.nickname || friend.peer.username;

export default function GroupsPage() {
  const nav = useNavigate();
  const toast = useToast();
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [notice, setNotice] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeGroup, setActiveGroup] = useState<Group | null>(null);
  const [myAlias, setMyAlias] = useState('');
  const [myRemark, setMyRemark] = useState('');

  const fetchGroups = async () => {
    try {
      const data = await api<Group[]>('GET', '/api/groups');
      setGroups(data);
    } catch {
      /* offline */
    } finally {
      setLoading(false);
    }
  };

  const fetchFriends = async () => {
    try {
      setFriends(await api<Friend[]>('GET', '/api/friends'));
    } catch {
      /* offline */
    }
  };

  useEffect(() => {
    fetchGroups();
    fetchFriends();
  }, []);

  const availableFriends = useMemo(() => {
    const existing = new Set(activeGroup?.members.map(member => member.userId) || []);
    return friends.filter(friend => !existing.has(friend.peer.id));
  }, [friends, activeGroup]);

  const resetCreate = () => {
    setGroupName('');
    setNotice('');
    setAvatarUrl('');
    setSelectedIds(new Set());
  };

  const uploadAvatar = async (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    const token = localStorage.getItem('echo-token');
    const res = await fetch(`${getServerUrl()}/api/upload/chat-image`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body: fd,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || '上传失败');
    setAvatarUrl(data.url);
  };

  const createGroup = async () => {
    if (!groupName.trim()) return toast('请输入群名称', 'error');
    try {
      const group = await api<Group>('POST', '/api/groups', {
        name: groupName.trim(),
        avatar: avatarUrl || undefined,
        notice: notice.trim() || undefined,
        memberIds: Array.from(selectedIds),
      });
      setCreateOpen(false);
      resetCreate();
      await fetchGroups();
      toast('群聊已创建', 'success');
      nav(`/chat/${group.id}`);
    } catch (e: any) {
      toast(e.message || '创建失败', 'error');
    }
  };

  const openDetail = async (group: Group) => {
    try {
      const detail = await api<Group>('GET', `/api/groups/${group.id}`);
      setActiveGroup(detail);
      setGroupName(detail.name);
      setNotice(detail.notice || '');
      setAvatarUrl(detail.avatar || '');
      setMyAlias(detail.alias || '');
      setMyRemark(detail.remark || '');
      setSelectedIds(new Set());
      setDetailOpen(true);
    } catch (e: any) {
      toast(e.message || '读取群资料失败', 'error');
    }
  };

  const saveGroupProfile = async () => {
    if (!activeGroup) return;
    try {
      await api('PATCH', `/api/groups/${activeGroup.id}/profile`, {
        name: groupName.trim(),
        notice: notice.trim() || null,
        avatar: avatarUrl || null,
      });
      await refreshActiveGroup(activeGroup.id);
      await fetchGroups();
      toast('群资料已保存', 'success');
    } catch (e: any) {
      toast(e.message || '保存失败', 'error');
    }
  };

  const saveMyProfile = async () => {
    if (!activeGroup) return;
    try {
      await api('PATCH', `/api/groups/${activeGroup.id}/my-profile`, {
        alias: myAlias.trim() || null,
        remark: myRemark.trim() || null,
      });
      await refreshActiveGroup(activeGroup.id);
      await fetchGroups();
      toast('我的群资料已保存', 'success');
    } catch (e: any) {
      toast(e.message || '保存失败', 'error');
    }
  };

  const refreshActiveGroup = async (groupId: string) => {
    const detail = await api<Group>('GET', `/api/groups/${groupId}`);
    setActiveGroup(detail);
  };

  const addMembers = async () => {
    if (!activeGroup || selectedIds.size === 0) return;
    try {
      await api('POST', `/api/groups/${activeGroup.id}/members`, { memberIds: Array.from(selectedIds) });
      setSelectedIds(new Set());
      await refreshActiveGroup(activeGroup.id);
      await fetchGroups();
      toast('成员已加入', 'success');
    } catch (e: any) {
      toast(e.message || '添加失败', 'error');
    }
  };

  const memberAction = async (member: Member, action: 'admin' | 'member' | 'remove' | 'transfer') => {
    if (!activeGroup) return;
    if (action === 'remove' && !window.confirm('\u786e\u5b9a\u5c06\u8be5\u6210\u5458\u79fb\u51fa\u7fa4\u804a\u5417\uff1f')) return;
    if (action === 'transfer' && !window.confirm('\u786e\u5b9a\u8f6c\u8ba9\u7fa4\u4e3b\u5417\uff1f')) return;
    try {
      if (action === 'remove') await api('DELETE', `/api/groups/${activeGroup.id}/members/${member.userId}`);
      if (action === 'admin' || action === 'member') await api('PATCH', `/api/groups/${activeGroup.id}/members/${member.userId}/role`, { role: action });
      if (action === 'transfer') await api('POST', `/api/groups/${activeGroup.id}/transfer-owner`, { targetUserId: member.userId });
      await refreshActiveGroup(activeGroup.id);
      await fetchGroups();
      toast('操作已完成', 'success');
    } catch (e: any) {
      toast(e.message || '操作失败', 'error');
    }
  };

  const leaveOrDismiss = async () => {
    if (!activeGroup) return;
    const confirmation = activeGroup.role === 'owner'
      ? '\u786e\u5b9a\u89e3\u6563\u7fa4\u804a\u5417\uff1f\u6b64\u64cd\u4f5c\u65e0\u6cd5\u64a4\u9500\u3002'
      : '\u786e\u5b9a\u9000\u51fa\u7fa4\u804a\u5417\uff1f';
    if (!window.confirm(confirmation)) return;
    try {
      if (activeGroup.role === 'owner') await api('DELETE', `/api/groups/${activeGroup.id}`);
      else await api('POST', `/api/groups/${activeGroup.id}/leave`);
      setDetailOpen(false);
      setActiveGroup(null);
      await fetchGroups();
      toast(activeGroup.role === 'owner' ? '群聊已解散' : '已退出群聊', 'success');
    } catch (e: any) {
      toast(e.message || '操作失败', 'error');
    }
  };

  const toggleSelected = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-gray-50 dark:bg-gray-950">
      <header className="flex items-center justify-between border-b border-gray-100 bg-white px-4 py-3 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center gap-3">
          <button onClick={() => nav('/')} className="rounded-xl p-1.5 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800">←</button>
          <div>
            <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">群聊</h1>
            <p className="text-xs text-gray-400">创建群、拉好友、管理群资料</p>
          </div>
        </div>
        <button onClick={() => { resetCreate(); setCreateOpen(true); }} className="rounded-xl bg-primary-500 px-3 py-2 text-xs font-semibold text-white">创建</button>
      </header>

      <main className="flex-1 p-4">
        {loading ? (
          <p className="py-10 text-center text-sm text-gray-400">加载中...</p>
        ) : groups.length === 0 ? (
          <div className="mt-12 text-center text-gray-400">
            <Users className="mx-auto mb-3" size={36} />
            <p className="text-sm">暂无群聊</p>
          </div>
        ) : (
          <div className="space-y-3">
            {groups.map(group => (
              <div key={group.id} className="overflow-hidden rounded-2xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900">
                <button onClick={() => nav(`/chat/${group.id}`)} className="flex w-full items-center gap-3 p-4 text-left">
                  <Avatar name={group.name} url={group.avatar} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-gray-900 dark:text-gray-100">{group.name}</p>
                    <p className="mt-0.5 text-xs text-gray-400">{group.memberCount} 人 · {roleLabel(group.role)}</p>
                  </div>
                  <span className="text-xs text-gray-300">进入</span>
                </button>
                <div className="flex items-center justify-between border-t border-gray-50 px-4 py-2 dark:border-gray-800">
                  <div className="flex -space-x-2">
                    {group.members.slice(0, 6).map(member => <SmallAvatar key={member.userId} name={displayName(member)} url={member.user.avatar} />)}
                  </div>
                  <button onClick={() => openDetail(group)} className="rounded-lg px-2 py-1 text-xs text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20">管理</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="创建群聊" actions={<ModalActions onCancel={() => setCreateOpen(false)} onConfirm={createGroup} confirmText="创建" />}>
        <GroupForm
          name={groupName}
          notice={notice}
          avatarUrl={avatarUrl}
          onName={setGroupName}
          onNotice={setNotice}
          onPickAvatar={() => avatarInputRef.current?.click()}
        />
        <FriendPicker friends={friends} selectedIds={selectedIds} onToggle={toggleSelected} />
        <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && uploadAvatar(e.target.files[0]).catch(err => toast(err.message, 'error'))} />
      </Modal>

      <Modal
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        title={activeGroup ? `${activeGroup.name} · 群管理` : '群管理'}
        actions={<ModalActions onCancel={() => setDetailOpen(false)} onConfirm={saveGroupProfile} confirmText="保存群资料" />}
      >
        {activeGroup && (
          <div className="space-y-5">
            <GroupForm
              name={groupName}
              notice={notice}
              avatarUrl={avatarUrl}
              onName={setGroupName}
              onNotice={setNotice}
              onPickAvatar={() => avatarInputRef.current?.click()}
            />

            <section>
              <h3 className="mb-2 text-sm font-bold text-gray-800 dark:text-gray-200">我的群资料</h3>
              <input value={myAlias} onChange={e => setMyAlias(e.target.value)} placeholder="我在本群的昵称" className="mb-2 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100" />
              <input value={myRemark} onChange={e => setMyRemark(e.target.value)} placeholder="群备注，仅自己可见" className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100" />
              <button onClick={saveMyProfile} className="mt-2 rounded-xl bg-gray-100 px-3 py-2 text-xs font-semibold text-gray-600 dark:bg-gray-800 dark:text-gray-300">保存我的资料</button>
            </section>

            <section>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200">拉好友进群</h3>
                <button onClick={addMembers} className="text-xs text-primary-500">添加选中</button>
              </div>
              <FriendPicker friends={availableFriends} selectedIds={selectedIds} onToggle={toggleSelected} compact />
            </section>

            <section>
              <h3 className="mb-2 text-sm font-bold text-gray-800 dark:text-gray-200">成员管理</h3>
              <div className="max-h-72 space-y-2 overflow-y-auto">
                {activeGroup.members.map(member => (
                  <div key={member.userId} className="flex items-center gap-3 rounded-xl bg-gray-50 p-2 dark:bg-gray-900">
                    <SmallAvatar name={displayName(member)} url={member.user.avatar} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-800 dark:text-gray-200">{displayName(member)}</p>
                      <p className="text-xs text-gray-400">{roleLabel(member.role)}</p>
                    </div>
                    {activeGroup.role === 'owner' && member.role !== 'owner' && (
                      <div className="flex gap-1">
                        <IconButton title={member.role === 'admin' ? '取消管理员' : '设为管理员'} onClick={() => memberAction(member, member.role === 'admin' ? 'member' : 'admin')}>
                          {member.role === 'admin' ? <Shield size={14} /> : <Crown size={14} />}
                        </IconButton>
                        <IconButton title="转让群主" onClick={() => memberAction(member, 'transfer')}><Crown size={14} /></IconButton>
                        <IconButton title="移出群聊" danger onClick={() => memberAction(member, 'remove')}><UserMinus size={14} /></IconButton>
                      </div>
                    )}
                    {activeGroup.role === 'admin' && member.role === 'member' && (
                      <IconButton title={'\u79fb\u51fa\u7fa4\u804a'} danger onClick={() => memberAction(member, 'remove')}><UserMinus size={14} /></IconButton>
                    )}
                  </div>
                ))}
              </div>
            </section>

            <button onClick={leaveOrDismiss} className="w-full rounded-2xl bg-red-50 py-3 text-sm font-semibold text-red-500 dark:bg-red-900/20">
              {activeGroup.role === 'owner' ? '解散群聊' : '退出群聊'}
            </button>
          </div>
        )}
        <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && uploadAvatar(e.target.files[0]).catch(err => toast(err.message, 'error'))} />
      </Modal>
    </div>
  );
}

function GroupForm({ name, notice, avatarUrl, onName, onNotice, onPickAvatar }: {
  name: string;
  notice: string;
  avatarUrl: string;
  onName: (v: string) => void;
  onNotice: (v: string) => void;
  onPickAvatar: () => void;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-3">
        <button onClick={onPickAvatar} className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-emerald-500 text-xl font-bold text-white">
          {avatarUrl ? <img src={assetUrl(avatarUrl)} alt="" className="h-full w-full object-cover" /> : <Camera size={22} />}
        </button>
        <div className="flex-1">
          <input value={name} onChange={e => onName(e.target.value)} placeholder="群聊名称" className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100" />
          <p className="mt-1 text-xs text-gray-400">头像、群名、公告由群主或管理员维护</p>
        </div>
      </div>
      <textarea value={notice} onChange={e => onNotice(e.target.value)} placeholder="群公告" rows={3} className="w-full resize-none rounded-xl border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100" />
    </section>
  );
}

function FriendPicker({ friends, selectedIds, onToggle, compact = false }: { friends: Friend[]; selectedIds: Set<string>; onToggle: (id: string) => void; compact?: boolean }) {
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const filtered = q
    ? friends.filter(friend => {
      const fields = [
        friend.alias,
        friend.peer.nickname,
        friend.peer.username,
        String(friend.peer.digitalId || ''),
      ];
      return fields.some(value => value?.toLowerCase().includes(q));
    })
    : friends;

  if (!friends.length) return <p className="rounded-xl bg-gray-50 py-4 text-center text-sm text-gray-400 dark:bg-gray-900">暂无可选择好友</p>;
  return (
    <div className="space-y-2">
      <input
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="搜索备注、昵称、用户名或 Echo ID"
        className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
      />
      <div className="flex items-center justify-between text-[11px] text-gray-400">
        <span>已选 {selectedIds.size} 人</span>
        {query && <span>{filtered.length} 个匹配</span>}
      </div>
      {filtered.length === 0 ? (
        <p className="rounded-xl bg-gray-50 py-4 text-center text-sm text-gray-400 dark:bg-gray-900">没有匹配的好友</p>
      ) : (
        <div className={`grid ${compact ? 'grid-cols-2' : 'grid-cols-3'} gap-2`}>
          {filtered.map(friend => {
            const checked = selectedIds.has(friend.peer.id);
            return (
              <button key={friend.peer.id} onClick={() => onToggle(friend.peer.id)} className={`flex items-center gap-2 rounded-xl border p-2 text-left ${checked ? 'border-primary-400 bg-primary-50 dark:bg-primary-900/20' : 'border-gray-100 bg-gray-50 dark:border-gray-800 dark:bg-gray-900'}`}>
                <SmallAvatar name={friendName(friend)} url={friend.peer.avatar} />
                <span className="min-w-0 flex-1 truncate text-xs text-gray-700 dark:text-gray-300">{friendName(friend)}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Avatar({ name, url }: { name: string; url?: string }) {
  return (
    <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-emerald-500 text-lg font-bold text-white">
      {url ? <img src={assetUrl(url)} alt="" className="h-full w-full object-cover" /> : name[0]?.toUpperCase()}
    </div>
  );
}

function SmallAvatar({ name, url }: { name: string; url?: string }) {
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gray-200 text-xs font-bold text-gray-500 ring-2 ring-white dark:bg-gray-700 dark:ring-gray-900">
      {url ? <img src={assetUrl(url)} alt="" className="h-full w-full object-cover" /> : name[0]?.toUpperCase()}
    </span>
  );
}

function IconButton({ children, title, danger, onClick }: { children: ReactNode; title: string; danger?: boolean; onClick: () => void }) {
  return (
    <button title={title} onClick={onClick} className={`rounded-lg p-2 ${danger ? 'text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20' : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`}>
      {children}
    </button>
  );
}

function ModalActions({ onCancel, onConfirm, confirmText }: { onCancel: () => void; onConfirm: () => void; confirmText: string }) {
  return (
    <>
      <button onClick={onCancel} className="rounded-xl px-4 py-2 text-sm text-gray-500 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800">取消</button>
      <button onClick={onConfirm} className="rounded-xl bg-primary-500 px-4 py-2 text-sm font-semibold text-white">{confirmText}</button>
    </>
  );
}
