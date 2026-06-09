import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarDays, Search, Users, Crown, Shield, MessageCircle, Image as ImageIcon } from 'lucide-react';
import { api } from '../api/client';
import { assetUrl } from '../utils/assetUrl';
import { useSocket } from '../contexts/SocketContext';

interface GroupMember {
  userId: string;
  role: string;
  alias?: string;
  user: { username: string; nickname: string; avatar: string };
}

interface GroupDetail {
  id: string;
  name: string;
  avatar?: string;
  notice?: string;
  role: string;
  memberCount: number;
  messageCount: number;
  members: GroupMember[];
  createdAt: string;
}

export default function GroupOrbitView({ groupId, groupName, onClose }: { groupId: string; groupName?: string; onClose: () => void }) {
  const navigate = useNavigate();
  const { socket } = useSocket();
  const [group, setGroup] = useState<GroupDetail | null>(null);
  const swipeRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const refreshGroup = () => api<GroupDetail>('GET', `/api/groups/${groupId}`).then(setGroup).catch(() => {});
    const handleGroupUpdated = (data: { groupId?: string; action?: string }) => {
      if (data.groupId !== groupId) return;
      if (data.action === 'dismissed' || data.action === 'access-revoked') {
        onClose();
        return;
      }
      refreshGroup();
    };
    refreshGroup();
    socket?.on('group:updated', handleGroupUpdated);
    return () => {
      socket?.off('group:updated', handleGroupUpdated);
    };
  }, [groupId, onClose, socket]);

  const name = group?.name || groupName || '群聊';
  const owner = group?.members.find(m => m.role === 'owner');
  const admins = group?.members.filter(m => m.role === 'admin') || [];

  return (
    <div
      className="fixed inset-0 z-[70] overflow-y-auto bg-white dark:bg-gray-950"
      onTouchStart={(e) => {
        e.stopPropagation();
        swipeRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }}
      onTouchEnd={(e) => {
        e.stopPropagation();
        const dx = e.changedTouches[0].clientX - swipeRef.current.x;
        const dy = Math.abs(e.changedTouches[0].clientY - swipeRef.current.y);
        if (dx > 50 && dx > dy) onClose();
      }}
    >
      <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b border-gray-100 bg-white/90 px-4 backdrop-blur dark:border-gray-800 dark:bg-gray-950/90">
        <button onClick={onClose} className="rounded-xl p-1.5 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800">←</button>
        <h1 className="truncate text-lg font-bold text-gray-900 dark:text-gray-100">群资料</h1>
      </header>

      <main className="px-5 pb-10 pt-8">
        <section className="flex flex-col items-center">
          <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-3xl bg-emerald-500 text-4xl font-bold text-white shadow-lg shadow-emerald-500/20">
            {group?.avatar ? <img src={assetUrl(group.avatar)} alt="" className="h-full w-full object-cover" /> : name[0]?.toUpperCase()}
          </div>
          <h2 className="mt-4 max-w-full truncate text-3xl font-extrabold text-gray-900 dark:text-gray-100">{name}</h2>
          <p className="mt-2 text-sm text-gray-400">{group?.memberCount || 0} 人 · {group?.role === 'owner' ? '我是群主' : group?.role === 'admin' ? '我是管理员' : '我是成员'}</p>          {group?.notice && <p className="mt-4 w-full rounded-2xl bg-gray-50 p-4 text-sm leading-6 text-gray-600 dark:bg-gray-900 dark:text-gray-300">{group.notice}</p>}
          <div className="mt-5 grid w-full grid-cols-2 gap-3">
            <button onClick={() => navigate(`/search?groupId=${groupId}&title=${encodeURIComponent(name)}`)} className="flex items-center justify-center gap-2 rounded-2xl bg-gray-100 py-3 text-sm font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-200">
              <Search size={16} /> {'\u641c\u7d22\u804a\u5929\u8bb0\u5f55'}
            </button>
            <button onClick={() => navigate(`/search?groupId=${groupId}&title=${encodeURIComponent(name)}`)} className="flex items-center justify-center gap-2 rounded-2xl bg-gray-100 py-3 text-sm font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-200">
              <CalendarDays size={16} /> {'\u6309\u65e5\u671f\u67e5\u770b'}
            </button>
          </div>
        </section>

        <section className="mt-8">
          <h3 className="mb-3 text-base font-bold text-gray-900 dark:text-gray-100">群数据</h3>
          <div className="grid grid-cols-2 gap-3">
            <Info icon={<Users size={18} />} label="成员" value={`${group?.memberCount || 0} 人`} />
            <Info icon={<MessageCircle size={18} />} label="消息" value={`${group?.messageCount || 0} 条`} />
            <Info icon={<Crown size={18} />} label="群主" value={owner ? (owner.alias || owner.user.nickname || owner.user.username) : '暂无'} />
            <Info icon={<Shield size={18} />} label="管理员" value={admins.length ? `${admins.length} 人` : '暂无'} />
          </div>
        </section>

        <section className="mt-8">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">成员</h3>
            <span className="text-xs text-gray-400">{group?.memberCount || 0}</span>
          </div>
          <div className="grid grid-cols-5 gap-4">
            {(group?.members || []).slice(0, 20).map(member => {
              const display = member.alias || member.user.nickname || member.user.username;
              return (
                <div key={member.userId} className="min-w-0 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl bg-gray-100 text-sm font-bold text-gray-500 dark:bg-gray-800">
                    {member.user.avatar ? <img src={assetUrl(member.user.avatar)} alt="" className="h-full w-full object-cover" /> : display[0]?.toUpperCase()}
                  </div>
                  <p className="mt-1 truncate text-xs text-gray-500">{display}</p>
                </div>
              );
            })}
          </div>
        </section>

        <section className="mt-8">
          <h3 className="mb-3 text-base font-bold text-gray-900 dark:text-gray-100">群动态</h3>
          <div className="flex h-36 flex-col items-center justify-center rounded-3xl bg-gray-50 text-gray-300 dark:bg-gray-900">
            <ImageIcon size={28} />
            <p className="mt-2 text-sm">暂无动态</p>
          </div>
        </section>
      </main>
    </div>
  );
}

function Info({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900">
      <div className="mb-2 text-gray-400">{icon}</div>
      <p className="text-xs text-gray-400">{label}</p>
      <p className="mt-1 truncate text-base font-bold text-gray-900 dark:text-gray-100">{value}</p>
    </div>
  );
}
