import { useState, useEffect } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../api/client';
import { assetUrl } from '../utils/assetUrl';

export type PrivacyType = 'PUBLIC' | 'PRIVATE' | 'VISIBLE_TO' | 'INVISIBLE_TO';

export interface FriendGroup {
  id: string;
  name: string;
  color?: string;
  members: { peerId: string; peer: { id: string; nickname: string; username: string; avatar: string } }[];
}

interface FriendItem {
  id: string;
  peer: { id: string; username: string; nickname: string; avatar: string; digitalId: number };
}

interface StarZoneSelectorProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (privacyType: PrivacyType, selectedGroupIds: string[], hiddenUserIds: string[]) => void;
  onManageGroups: () => void;
}

const tabs: { key: PrivacyType; label: string }[] = [
  { key: 'PUBLIC', label: '公开' },
  { key: 'PRIVATE', label: '仅自己' },
  { key: 'VISIBLE_TO', label: '部分可见' },
  { key: 'INVISIBLE_TO', label: '不给谁看' },
];

export default function StarZoneSelector({ open, onClose, onConfirm, onManageGroups }: StarZoneSelectorProps) {
  const [mode, setMode] = useState<PrivacyType>('PUBLIC');
  const [selectedGroupIds, setSelectedGroupIds] = useState<Set<string>>(new Set());
  const [hiddenUserIds, setHiddenUserIds] = useState<Set<string>>(new Set());
  const [groups, setGroups] = useState<FriendGroup[]>([]);
  const [friends, setFriends] = useState<FriendItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open) return;
    setMode('PUBLIC');
    setSelectedGroupIds(new Set());
    setHiddenUserIds(new Set());
    setLoading(true);
    Promise.all([
      api<FriendGroup[]>('GET', '/api/friend-groups').catch(() => []),
      api<FriendItem[]>('GET', '/api/friends').catch(() => []),
    ]).then(([groupData, friendData]) => {
      setGroups(groupData);
      setFriends(friendData);
    }).finally(() => setLoading(false));
  }, [open]);

  if (!open) return null;

  const toggleSet = (setter: Dispatch<SetStateAction<Set<string>>>, id: string) => {
    setter(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectedPeopleCount = (() => {
    const peerIds = new Set<string>();
    for (const id of selectedGroupIds) {
      groups.find(g => g.id === id)?.members.forEach(m => peerIds.add(m.peerId));
    }
    hiddenUserIds.forEach(id => peerIds.add(id));
    return peerIds.size;
  })();

  const confirm = () => {
    if (mode === 'PUBLIC' || mode === 'PRIVATE') {
      onConfirm(mode, [], []);
      return;
    }
    onConfirm(mode, Array.from(selectedGroupIds), Array.from(hiddenUserIds));
  };

  const showGroups = mode === 'VISIBLE_TO' || mode === 'INVISIBLE_TO';
  const showHiddenFriends = mode === 'VISIBLE_TO' || mode === 'INVISIBLE_TO';

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        />

        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="relative flex max-h-[85vh] w-full max-w-md flex-col rounded-t-3xl bg-white shadow-2xl dark:bg-gray-900 sm:rounded-3xl"
        >
          <div className="border-b border-gray-100 px-5 pb-3 pt-5 dark:border-gray-800">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">谁可以看</h2>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">关闭</button>
            </div>
            <div className="grid grid-cols-4 gap-1 rounded-xl bg-gray-100 p-1 dark:bg-gray-800">
              {tabs.map(tab => (
                <button
                  key={tab.key}
                  onClick={() => {
                    setMode(tab.key);
                    setSelectedGroupIds(new Set());
                    setHiddenUserIds(new Set());
                  }}
                  className={`rounded-lg py-2 text-xs font-medium transition-colors ${
                    mode === tab.key ? 'bg-white text-primary-500 shadow-sm dark:bg-gray-700' : 'text-gray-500 dark:text-gray-400'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {loading ? (
              <p className="py-10 text-center text-sm text-gray-400">加载中...</p>
            ) : (
              <div className="space-y-5">
                {showGroups && (
                  <section>
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                        {mode === 'VISIBLE_TO' ? '可见星域' : '不可见星域'}
                      </p>
                      <button onClick={() => { onClose(); onManageGroups(); }} className="text-xs text-primary-500">管理星域</button>
                    </div>
                    {groups.length === 0 ? (
                      <button onClick={() => { onClose(); onManageGroups(); }} className="w-full rounded-xl border border-dashed border-gray-300 py-4 text-sm text-gray-400 dark:border-gray-700">
                        暂无星域，去创建
                      </button>
                    ) : (
                      <div className="space-y-2">
                        {groups.map(group => {
                          const checked = selectedGroupIds.has(group.id);
                          return (
                            <button
                              key={group.id}
                              onClick={() => toggleSet(setSelectedGroupIds, group.id)}
                              className={`flex w-full items-center gap-3 rounded-2xl p-3 text-left transition-colors ${
                                checked ? 'bg-primary-50 dark:bg-primary-900/20' : 'bg-gray-50 dark:bg-gray-800/50'
                              }`}
                            >
                              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: group.color || '#6366f1' }} />
                              <span className="flex-1 text-sm font-medium text-gray-800 dark:text-gray-200">{group.name}</span>
                              <span className="text-xs text-gray-400">{group.members.length} 人</span>
                              <span className={`h-5 w-5 rounded-md border-2 ${checked ? 'border-primary-500 bg-primary-500' : 'border-gray-300 dark:border-gray-600'}`}>
                                {checked && <span className="block text-center text-xs leading-4 text-white">✓</span>}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </section>
                )}

                {showHiddenFriends && (
                  <section>
                    <p className="mb-2 text-xs font-medium text-gray-500 dark:text-gray-400">
                      {mode === 'VISIBLE_TO' ? '单独排除好友' : '单独不可见好友'}
                    </p>
                    {friends.length === 0 ? (
                      <p className="rounded-xl bg-gray-50 py-4 text-center text-sm text-gray-400 dark:bg-gray-800/50">暂无好友</p>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        {friends.map(friend => {
                          const peer = friend.peer;
                          const checked = hiddenUserIds.has(peer.id);
                          return (
                            <button
                              key={peer.id}
                              onClick={() => toggleSet(setHiddenUserIds, peer.id)}
                              className={`flex items-center gap-2 rounded-xl p-2 text-left transition-colors ${
                                checked ? 'bg-red-50 dark:bg-red-900/20' : 'bg-gray-50 dark:bg-gray-800/50'
                              }`}
                            >
                              <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg bg-primary-100 text-xs font-bold text-primary-600 dark:bg-primary-900/30">
                                {peer.avatar ? <img src={assetUrl(peer.avatar)} alt="" className="h-full w-full object-cover" /> : (peer.nickname || peer.username)[0]?.toUpperCase()}
                              </span>
                              <span className="min-w-0 flex-1 truncate text-xs text-gray-700 dark:text-gray-300">{peer.nickname || peer.username}</span>
                              {checked && <span className="text-xs text-red-500">排除</span>}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </section>
                )}

                {mode === 'PUBLIC' && <p className="rounded-2xl bg-gray-50 p-4 text-sm text-gray-500 dark:bg-gray-800/50">所有好友都可以看到这条动态。</p>}
                {mode === 'PRIVATE' && <p className="rounded-2xl bg-gray-50 p-4 text-sm text-gray-500 dark:bg-gray-800/50">只有你自己可以看到这条动态。</p>}
              </div>
            )}
          </div>

          <div className="border-t border-gray-100 bg-gray-50/70 p-4 dark:border-gray-800 dark:bg-gray-900/70">
            <button
              onClick={confirm}
              className={`w-full rounded-xl py-3 text-sm font-bold text-white ${
                mode === 'INVISIBLE_TO' ? 'bg-red-500 hover:bg-red-600' : 'bg-primary-500 hover:bg-primary-600'
              }`}
            >
              确定{selectedPeopleCount > 0 ? ` (${selectedPeopleCount} 人)` : ''}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
