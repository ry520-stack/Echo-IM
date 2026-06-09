import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, Users, Home, Plus, Trash2, CheckCircle2, UserPlus } from 'lucide-react';
import RelationshipSpaceContent from './RelationshipSpaceContent';
import { api } from '../api/client';
import { assetUrl } from '../utils/assetUrl';
import { useToast } from '../contexts/ToastContext';

type SpaceType = 'couple' | 'friends' | 'family';

interface Props {
  onOpenAlbum?: () => void;
}

interface LocalSpaceItem {
  id: string;
  title: string;
  note: string;
  done: boolean;
  createdAt: string;
}

interface SpaceFriend {
  id: string;
  alias?: string;
  peer: {
    id: string;
    username: string;
    nickname?: string;
    avatar?: string;
    digitalId?: number;
  };
}

const CONFIG = {
  couple: { title: '情侣空间', subtitle: '纪念日、相册、关怀和想念', Icon: Heart, tone: 'from-rose-500 to-orange-400' },
  friends: { title: '朋友空间', subtitle: '一起玩、愿望清单和友情约定', Icon: Users, tone: 'from-sky-500 to-cyan-400' },
  family: { title: '家人空间', subtitle: '报平安、家庭清单和重要提醒', Icon: Home, tone: 'from-emerald-500 to-teal-400' },
} satisfies Record<SpaceType, { title: string; subtitle: string; Icon: typeof Heart; tone: string }>;

function loadItems(type: Exclude<SpaceType, 'couple'>) {
  try {
    return JSON.parse(localStorage.getItem(`echo-${type}-space-items`) || '[]') as LocalSpaceItem[];
  } catch {
    return [];
  }
}

function saveItems(type: Exclude<SpaceType, 'couple'>, items: LocalSpaceItem[]) {
  localStorage.setItem(`echo-${type}-space-items`, JSON.stringify(items));
}

function loadMemberIds(type: Exclude<SpaceType, 'couple'>) {
  try {
    return JSON.parse(localStorage.getItem(`echo-${type}-space-members`) || '[]') as string[];
  } catch {
    return [];
  }
}

function saveMemberIds(type: Exclude<SpaceType, 'couple'>, ids: string[]) {
  localStorage.setItem(`echo-${type}-space-members`, JSON.stringify(ids));
}

function loadPendingMemberIds(type: Exclude<SpaceType, 'couple'>) {
  try {
    return JSON.parse(localStorage.getItem(`echo-${type}-space-pending-members`) || '[]') as string[];
  } catch {
    return [];
  }
}

function savePendingMemberIds(type: Exclude<SpaceType, 'couple'>, ids: string[]) {
  localStorage.setItem(`echo-${type}-space-pending-members`, JSON.stringify(ids));
}

export default function SpacesHub({ onOpenAlbum }: Props) {
  const [active, setActive] = useState<SpaceType>('couple');

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[#f7f6fb] dark:bg-gray-950">
      <div className="shrink-0 px-4 pt-4">
        <div className="grid grid-cols-3 gap-2">
          {(Object.keys(CONFIG) as SpaceType[]).map((type) => {
            const item = CONFIG[type];
            const Icon = item.Icon;
            const selected = active === type;
            return (
              <button
                key={type}
                type="button"
                onClick={() => setActive(type)}
                className={`rounded-[22px] p-3 text-left shadow-sm ring-1 transition-all ${
                  selected ? 'bg-gray-950 text-white ring-gray-950 dark:bg-white dark:text-gray-950 dark:ring-white' : 'bg-white text-gray-500 ring-black/[0.04] dark:bg-gray-900 dark:ring-white/[0.05]'
                }`}
              >
                <span className={`mb-2 flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-br ${item.tone} text-white`}>
                  <Icon size={18} />
                </span>
                <span className="block truncate text-sm font-bold">{item.title}</span>
              </button>
            );
          })}
        </div>
      </div>

      {active === 'couple' ? (
        <div className="min-h-0 flex-1 overflow-hidden">
          <RelationshipSpaceContent onOpenAlbum={onOpenAlbum} />
        </div>
      ) : (
        <LocalSpace key={active} type={active} />
      )}
    </div>
  );
}

function LocalSpace({ type }: { type: Exclude<SpaceType, 'couple'> }) {
  const navigate = useNavigate();
  const toast = useToast();
  const config = CONFIG[type];
  const Icon = config.Icon;
  const [items, setItems] = useState(() => loadItems(type));
  const [friends, setFriends] = useState<SpaceFriend[]>([]);
  const [memberIds, setMemberIds] = useState<string[]>(() => loadMemberIds(type));
  const [pendingMemberIds, setPendingMemberIds] = useState<string[]>(() => loadPendingMemberIds(type));
  const [memberPickerOpen, setMemberPickerOpen] = useState(false);
  const [memberManageOpen, setMemberManageOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');

  const sync = (next: LocalSpaceItem[]) => {
    setItems(next);
    saveItems(type, next);
  };

  const add = () => {
    const clean = title.trim();
    if (!clean) return;
    sync([{ id: `${type}_${Date.now()}`, title: clean, note: note.trim(), done: false, createdAt: new Date().toISOString() }, ...items]);
    setTitle('');
    setNote('');
  };

  useEffect(() => {
    api<SpaceFriend[]>('GET', '/api/friends').then(setFriends).catch(() => setFriends([]));
  }, []);

  useEffect(() => {
    setItems(loadItems(type));
    setMemberIds(loadMemberIds(type));
    setPendingMemberIds(loadPendingMemberIds(type));
    setMemberPickerOpen(false);
    setMemberManageOpen(false);
    setTitle('');
    setNote('');
  }, [type]);

  const syncMembers = (next: string[]) => {
    const unique = Array.from(new Set(next));
    setMemberIds(unique);
    saveMemberIds(type, unique);
  };

  const syncPendingMembers = (next: string[]) => {
    const unique = Array.from(new Set(next));
    setPendingMemberIds(unique);
    savePendingMemberIds(type, unique);
  };

  const sendMemberInvite = (peerId: string) => {
    syncPendingMembers([...pendingMemberIds, peerId]);
    toast('绑定邀请已发送', 'success');
  };

  const acceptLocalInvite = (peerId: string) => {
    syncMembers([...memberIds, peerId]);
    syncPendingMembers(pendingMemberIds.filter(id => id !== peerId));
    toast('成员已绑定', 'success');
  };

  const members = memberIds
    .map(id => friends.find(friend => friend.peer.id === id))
    .filter((friend): friend is SpaceFriend => !!friend);
  const pendingMembers = pendingMemberIds
    .map(id => friends.find(friend => friend.peer.id === id))
    .filter((friend): friend is SpaceFriend => !!friend);
  const candidates = friends.filter(friend => !memberIds.includes(friend.peer.id) && !pendingMemberIds.includes(friend.peer.id));

  return (
    <main className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
      <section className={`rounded-[30px] bg-gradient-to-br ${config.tone} p-5 text-white shadow-lg shadow-black/5`}>
        <p className="text-xs font-semibold text-white/75">Echo Space</p>
        <div className="mt-4 flex items-end gap-3">
          <span className="flex h-14 w-14 items-center justify-center rounded-3xl bg-white/18">
            <Icon size={28} />
          </span>
          <div>
            <h2 className="text-2xl font-extrabold">{config.title}</h2>
            <p className="mt-1 text-sm text-white/80">{config.subtitle}</p>
          </div>
        </div>
      </section>

      <section className="mt-4 rounded-[26px] bg-white p-4 shadow-sm ring-1 ring-black/[0.04] dark:bg-gray-900 dark:ring-white/[0.05]">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-base font-bold text-gray-950 dark:text-gray-50">绑定成员</p>
            <p className="mt-1 text-xs text-gray-400">不限人数，可随时添加或移除</p>
          </div>
          <div className="flex gap-2">
            {members.length > 0 && (
              <button type="button" onClick={() => setMemberManageOpen(v => !v)} className="rounded-2xl bg-gray-100 px-3 text-xs font-semibold text-gray-500 dark:bg-gray-800">
                {memberManageOpen ? '完成' : '管理'}
              </button>
            )}
            <button
              type="button"
              onClick={() => setMemberPickerOpen(true)}
              className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gray-950 text-white dark:bg-white dark:text-gray-950"
            >
              <UserPlus size={18} />
            </button>
          </div>
        </div>
        {members.length ? (
          <div className="mt-4 flex gap-3 overflow-x-auto pb-1">
            {members.map(friend => {
              const name = friend.alias || friend.peer.nickname || friend.peer.username;
              return (
                <div key={friend.peer.id} className="relative shrink-0 text-center">
                  <button onClick={() => navigate(`/chat/${friend.peer.digitalId || friend.peer.id}`)} className="mx-auto flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl bg-gray-100 text-sm font-bold text-gray-500 dark:bg-gray-800">
                    {friend.peer.avatar ? <img src={assetUrl(friend.peer.avatar)} alt="" className="h-full w-full object-cover" /> : name[0]?.toUpperCase()}
                  </button>
                  <p className="mt-1 max-w-[72px] truncate text-xs text-gray-500">{name}</p>
                  {memberManageOpen && (
                    <button
                      type="button"
                      onClick={() => syncMembers(memberIds.filter(id => id !== friend.peer.id))}
                      className="mt-1 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-400 dark:bg-red-950/20"
                    >
                      移除
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <button type="button" onClick={() => setMemberPickerOpen(true)} className="mt-4 w-full rounded-2xl bg-gray-50 px-4 py-5 text-sm text-gray-400 dark:bg-gray-800">
            还没有绑定成员
          </button>
        )}
        {pendingMembers.length > 0 && (
          <div className="mt-4 rounded-2xl bg-amber-50 p-3 dark:bg-amber-950/20">
            <p className="mb-2 text-xs font-semibold text-amber-600">待确认邀请</p>
            <div className="space-y-2">
              {pendingMembers.map(friend => {
                const name = friend.alias || friend.peer.nickname || friend.peer.username;
                return (
                  <div key={friend.peer.id} className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-sm text-amber-700 dark:text-amber-300">{name}</span>
                    <button onClick={() => acceptLocalInvite(friend.peer.id)} className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-amber-600 dark:bg-gray-900">确认绑定</button>
                    <button onClick={() => syncPendingMembers(pendingMemberIds.filter(id => id !== friend.peer.id))} className="rounded-full px-2 py-1 text-xs text-amber-500">取消</button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      <section className="mt-4 rounded-[26px] bg-white p-4 shadow-sm ring-1 ring-black/[0.04] dark:bg-gray-900 dark:ring-white/[0.05]">
        <div className="grid gap-2">
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder={type === 'friends' ? '例如：周末一起吃饭' : '例如：今晚给爸妈报平安'} className="rounded-2xl bg-gray-100 px-4 py-3 text-sm outline-none dark:bg-gray-800" />
          <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="备注、地点、心情或约定内容" className="min-h-[72px] resize-none rounded-2xl bg-gray-100 px-4 py-3 text-sm outline-none dark:bg-gray-800" />
          <button onClick={add} className="flex items-center justify-center gap-2 rounded-2xl bg-gray-950 py-3 text-sm font-bold text-white dark:bg-white dark:text-gray-950">
            <Plus size={16} /> 添加记录
          </button>
        </div>
      </section>

      <section className="mt-4 space-y-2">
        {items.length === 0 ? (
          <div className="rounded-[26px] bg-white px-5 py-10 text-center shadow-sm ring-1 ring-black/[0.04] dark:bg-gray-900 dark:ring-white/[0.05]">
            <p className="font-bold text-gray-950 dark:text-gray-50">还没有记录</p>
            <p className="mt-2 text-sm text-gray-400">{type === 'friends' ? '把下一次一起做的事放进来。' : '把家里的重要小事放进来。'}</p>
          </div>
        ) : items.map(item => (
          <article key={item.id} className="flex gap-3 rounded-[24px] bg-white p-4 shadow-sm ring-1 ring-black/[0.04] dark:bg-gray-900 dark:ring-white/[0.05]">
            <button onClick={() => sync(items.map(next => next.id === item.id ? { ...next, done: !next.done } : next))} className={`mt-0.5 ${item.done ? 'text-emerald-500' : 'text-gray-300'}`}>
              <CheckCircle2 size={20} />
            </button>
            <div className="min-w-0 flex-1">
              <p className={`font-bold ${item.done ? 'text-gray-400 line-through' : 'text-gray-950 dark:text-gray-50'}`}>{item.title}</p>
              {item.note && <p className="mt-1 whitespace-pre-wrap text-sm leading-5 text-gray-500">{item.note}</p>}
            </div>
            <button onClick={() => sync(items.filter(next => next.id !== item.id))} className="text-gray-300 hover:text-red-500">
              <Trash2 size={17} />
            </button>
          </article>
        ))}
      </section>

      {memberPickerOpen && (
        <div className="fixed inset-0 z-[70] flex items-end bg-black/30 p-3 backdrop-blur-sm">
          <section className="max-h-[70vh] w-full overflow-hidden rounded-[28px] bg-white p-4 shadow-2xl dark:bg-gray-900">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-bold text-gray-950 dark:text-gray-50">添加成员</h3>
              <button onClick={() => setMemberPickerOpen(false)} className="text-sm text-gray-400">关闭</button>
            </div>
            <div className="max-h-[56vh] space-y-2 overflow-y-auto">
              {candidates.length ? candidates.map(friend => {
                const name = friend.alias || friend.peer.nickname || friend.peer.username;
                return (
                  <button
                    key={friend.peer.id}
                    onClick={() => sendMemberInvite(friend.peer.id)}
                    className="flex w-full items-center gap-3 rounded-2xl bg-gray-50 p-3 text-left dark:bg-gray-800"
                  >
                    <span className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl bg-white text-sm font-bold text-gray-500 dark:bg-gray-700">
                      {friend.peer.avatar ? <img src={assetUrl(friend.peer.avatar)} alt="" className="h-full w-full object-cover" /> : name[0]?.toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-gray-800 dark:text-gray-100">{name}</span>
                      {friend.peer.digitalId && <span className="block text-xs text-gray-400">Echo ID: {friend.peer.digitalId}</span>}
                    </span>
                    <span className="rounded-full bg-gray-950 px-3 py-1 text-xs font-semibold text-white dark:bg-white dark:text-gray-950">发送邀请</span>
                  </button>
                );
              }) : (
                <p className="py-8 text-center text-sm text-gray-400">没有可添加的好友</p>
              )}
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
