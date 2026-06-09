import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { CalendarDays, Search, Settings, MessageCircle, Trophy } from 'lucide-react';
import { api } from '../api/client';
import { useSocket } from '../contexts/SocketContext';
import { assetUrl } from '../utils/assetUrl';
import FloatingStackGallery from './FloatingStackGallery';
import Modal from './Modal';

interface MomentData {
  id: string;
  userId: string;
  content: string;
  images: string;
  createdAt: string;
  user: { id: string; username: string; nickname: string; avatar: string };
  likes: { userId: string }[];
  _count: { likes: number; comments: number };
}

interface PeerInfo {
  avatar: string;
  nickname: string;
  username: string;
  digitalId: number;
}

interface StarGroup {
  id: string;
  name: string;
  color: string;
}

interface RelationshipSummary {
  friendSince: string;
  realMetAt: string | null;
  displayGroupId: string;
  displayGroup: StarGroup | null;
  groups: StarGroup[];
  echoValue: number;
  lastConnectionAt: string | null;
}

function parseImages(images: string): string[] {
  try { return (JSON.parse(images) as string[]).map(assetUrl); } catch { return []; }
}

function formatDate(value?: string | null) {
  if (!value) return '暂无';
  return new Date(value).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });
}

function formatRecent(value?: string | null) {
  if (!value) return '暂无';
  const diff = Date.now() - new Date(value).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return '刚刚';
  if (min < 60) return `${min}分钟前`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour}小时前`;
  return formatDate(value);
}

export default function PersonalOrbitView({
  peerId,
  peerName,
  peer,
  onClose,
}: {
  peerId: string;
  peerName: string;
  peer?: PeerInfo | null;
  onClose: () => void;
}) {
  const { isUserOnline } = useSocket();
  const navigate = useNavigate();
  const online = isUserOnline(peerId);
  const [moments, setMoments] = useState<MomentData[]>([]);
  const [summary, setSummary] = useState<RelationshipSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [showRealMetAt, setShowRealMetAt] = useState(false);
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const touchStartRef = useRef({ sx: 0, sy: 0 });

  const loadSummary = async () => {
    try {
      setSummary(await api<RelationshipSummary>('GET', `/api/friends/relationship/${peerId}`));
    } catch {
      setSummary(null);
    }
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([
        loadSummary(),
        api<{ moments: MomentData[] }>('GET', `/api/moments?page=1&userId=${peerId}`)
          .then(data => setMoments(data.moments || []))
          .catch(() => setMoments([])),
      ]);
      setLoading(false);
    })();
  }, [peerId]);

  const openSettings = () => {
    if (peer?.digitalId) navigate(`/chat/${peer.digitalId}/settings?from=orbit`);
  };

  const openMessageSearch = () => {
    navigate(`/search?peerId=${peerId}&title=${encodeURIComponent(peerName)}`);
  };

  const selectDisplayGroup = async (displayGroupId: string | null) => {
    const next = await api<RelationshipSummary>('PATCH', `/api/friends/relationship/${peerId}`, { displayGroupId });
    setSummary(next);
    setGroupModalOpen(false);
  };

  const dataCards = [
    { label: '展示分组', value: summary?.displayGroup?.name || '暂无', onClick: () => setGroupModalOpen(true) },
    {
      label: '认识时间',
      value: showRealMetAt ? formatDate(summary?.realMetAt) : formatDate(summary?.friendSince),
      onClick: () => setShowRealMetAt(v => !v),
      hint: showRealMetAt ? '现实相识' : 'Echo 相识',
    },
    { label: '回声值', value: summary ? String(summary.echoValue) : '暂无', onClick: () => navigate('/echo-rankings') },
    { label: '最近连接', value: online ? '当前在线' : formatRecent(summary?.lastConnectionAt) },
  ];

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[60] flex flex-col bg-white dark:bg-gray-950"
        initial={{ x: '100%' }}
        animate={{ x: 0, transition: { type: 'spring', stiffness: 200, damping: 25, mass: 0.8 } }}
        exit={{ x: '100%', transition: { type: 'spring', stiffness: 200, damping: 25, mass: 0.8 } }}
        onTouchStart={(e) => { touchStartRef.current = { sx: e.touches[0].clientX, sy: e.touches[0].clientY }; }}
        onTouchEnd={(e) => {
          const dx = e.changedTouches[0].clientX - touchStartRef.current.sx;
          const dy = Math.abs(e.changedTouches[0].clientY - touchStartRef.current.sy);
          if (dx > 50 && Math.abs(dx) > dy) {
            e.stopPropagation();
            onClose();
          }
        }}
      >
        <header className="flex shrink-0 items-center gap-3 border-b border-gray-100 px-4 py-3 dark:border-gray-800">
          <button onClick={onClose} className="rounded-xl p-1.5 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800">←</button>
          <h1 className="text-base font-semibold text-gray-900 dark:text-gray-100">与 {peerName} 的关系空间</h1>
        </header>

        <div className="flex-1 overflow-y-auto">
          <section className="px-4 pb-6 pt-8 text-center">
            <button
              onClick={openSettings}
              className="mx-auto mb-3 flex h-24 w-24 items-center justify-center overflow-hidden rounded-3xl bg-primary-500 text-4xl font-bold text-white"
            >
              {peer?.avatar ? <img src={assetUrl(peer.avatar)} alt="" className="h-full w-full object-cover" /> : peerName[0]?.toUpperCase() || '?'}
            </button>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">{peerName}</h2>
            <div className="mt-2 flex items-center justify-center gap-2 text-sm text-gray-400">
              <span className={`h-2 w-2 rounded-full ${online ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`} />
              <span>{online ? '在线' : '离线'}</span>
              {peer?.digitalId != null && <span>Echo ID: {peer.digitalId}</span>}
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button onClick={onClose} className="flex items-center justify-center gap-2 rounded-2xl bg-primary-500 py-3 text-sm font-medium text-white">
                <MessageCircle size={16} /> 发消息
              </button>
              <button onClick={openSettings} className="flex items-center justify-center gap-2 rounded-2xl bg-gray-100 py-3 text-sm font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-200">
                <Settings size={16} /> 资料设置
              </button>
              <button onClick={openMessageSearch} className="flex items-center justify-center gap-2 rounded-2xl bg-gray-100 py-3 text-sm font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-200">
                <Search size={16} /> {'\u641c\u7d22\u804a\u5929\u8bb0\u5f55'}
              </button>
              <button onClick={openMessageSearch} className="flex items-center justify-center gap-2 rounded-2xl bg-gray-100 py-3 text-sm font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-200">
                <CalendarDays size={16} /> {'\u6309\u65e5\u671f\u67e5\u770b'}
              </button>
            </div>
          </section>

          <section className="px-4 pb-6">
            <div className="mb-3 flex items-center justify-between px-1">
              <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-300">关系数据</h3>
              <button onClick={() => navigate('/echo-rankings')} className="flex items-center gap-1 text-xs text-primary-500">
                <Trophy size={13} /> 回声排行
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {dataCards.map(item => (
                <button
                  key={item.label}
                  onClick={item.onClick}
                  className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3 text-left dark:border-gray-800 dark:bg-gray-900"
                >
                  <p className="text-xs text-gray-400">{item.label}</p>
                  <p className="mt-1 text-sm font-medium text-gray-700 dark:text-gray-200">{item.value}</p>
                  {'hint' in item && item.hint && <p className="mt-1 text-[10px] text-gray-400">{item.hint}</p>}
                </button>
              ))}
            </div>
          </section>

          <section className="px-4 pb-8">
            <h3 className="mb-3 px-1 text-sm font-semibold text-gray-600 dark:text-gray-300">最近动态</h3>
            {loading ? (
              <div className="rounded-2xl bg-gray-50 py-12 text-center text-sm text-gray-400 dark:bg-gray-900">加载中...</div>
            ) : moments.length === 0 ? (
              <div className="rounded-2xl bg-gray-50 py-16 text-center text-sm text-gray-400 dark:bg-gray-900">暂无动态</div>
            ) : (
              <div className="space-y-3">
                {moments.map(moment => {
                  const imgs = parseImages(moment.images);
                  return (
                    <article key={moment.id} className="overflow-hidden rounded-2xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900">
                      <p className="px-4 pt-4 text-sm text-gray-700 dark:text-gray-300">{moment.content}</p>
                      {imgs.length > 0 && (
                        <div className="px-4 pb-4 pt-2">
                          {imgs.length === 1 ? (
                            <img src={imgs[0]} alt="" className="max-h-64 w-full rounded-xl object-cover" onClick={() => setLightbox(imgs[0])} />
                          ) : (
                            <FloatingStackGallery images={imgs} onPreview={setLightbox} />
                          )}
                        </div>
                      )}
                      <p className="px-4 pb-3 text-right text-[10px] text-gray-400">{formatDate(moment.createdAt)}</p>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        <Modal open={groupModalOpen} onClose={() => setGroupModalOpen(false)} title="选择展示分组">
          <div className="space-y-2">
            {summary?.groups.length ? summary.groups.map(group => (
              <button
                key={group.id}
                onClick={() => selectDisplayGroup(group.id)}
                className="flex w-full items-center gap-3 rounded-xl bg-gray-50 px-3 py-2 text-left text-gray-700 dark:bg-gray-800 dark:text-gray-200"
              >
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: group.color }} />
                <span className="flex-1">{group.name}</span>
                {summary.displayGroupId === group.id && <span className="text-xs text-primary-500">当前</span>}
              </button>
            )) : (
              <p className="py-4 text-center text-gray-400">暂无可选分组</p>
            )}
            <button onClick={() => selectDisplayGroup(null)} className="w-full rounded-xl px-3 py-2 text-left text-sm text-gray-400">不展示分组</button>
          </div>
        </Modal>

        {lightbox && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/95" onClick={() => setLightbox(null)}>
            <img src={lightbox} alt="" className="max-h-[90vh] max-w-[90vw] object-contain" />
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
