import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { assetUrl } from '../utils/assetUrl';
import { api, getServerUrl } from '../api/client';
import { prepareMomentImage } from '../utils/compressImage';
import FloatingStackGallery from '../components/FloatingStackGallery';
import PaginatedGridGallery from '../components/PaginatedGridGallery';
import StarZoneSelector, { type PrivacyType } from '../components/StarZoneSelector';
import Modal from '../components/Modal';

const MAX_MOMENT_IMAGES = 18;
const accentRingClass: Record<string, string> = {
  purple: 'ring-primary-500',
  blue: 'ring-blue-600',
  black: 'ring-gray-900 dark:ring-gray-100',
};

interface MomentUser {
  id: string;
  username: string;
  nickname: string;
  avatar: string;
}

interface MomentData {
  id: string;
  userId: string;
  content: string;
  images: string;
  galleryMode?: 'stack' | 'grid';
  coverIndex?: number;
  createdAt: string;
  user: MomentUser;
  likes: { userId: string }[];
  _count: { likes: number; comments: number };
}

interface CommentData {
  id: string;
  userId: string;
  content: string;
  createdAt: string;
  user: MomentUser;
}

export default function MomentsPage() {
  const { user } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const [accentColor, setAccentColor] = useState(() => localStorage.getItem('echo-accent-color') || 'purple');
  const selectedRing = accentRingClass[accentColor] || accentRingClass.purple;
  const [moments, setMoments] = useState<MomentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentsFor, setCommentsFor] = useState<string | null>(null);
  const [comments, setComments] = useState<CommentData[]>([]);
  const [commentText, setCommentText] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [lightbox, setLightbox] = useState<{ images: string[]; index: number } | null>(null);

  // Composer state
  const [showComposer, setShowComposer] = useState(false);
  const [newContent, setNewContent] = useState('');
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const uploadingCount = useRef(0);
  const [posting, setPosting] = useState(false);
  const [showDraftConfirm, setShowDraftConfirm] = useState(false);
  const [privacy, setPrivacy] = useState<PrivacyType>('PUBLIC');
  const [privacyGroups, setPrivacyGroups] = useState<string[]>([]);
  const [hiddenUserIds, setHiddenUserIds] = useState<string[]>([]);
  const [scheduleTime, setScheduleTime] = useState('');
  const [showStarZoneSelector, setShowStarZoneSelector] = useState(false);
  // Per-moment gallery mode + cover index
  const [galleryModes, setGalleryModes] = useState<Record<string, 'stack' | 'grid'>>(() => {
    try { return JSON.parse(localStorage.getItem('echo-gallery-modes') || '{}'); } catch { return {}; }
  });
  const [coverIndices, setCoverIndices] = useState<Record<string, number>>(() => {
    try { return JSON.parse(localStorage.getItem('echo-cover-indices') || '{}'); } catch { return {}; }
  });
  const [composerMode, setComposerMode] = useState<'stack' | 'grid'>('stack');
  const [coverIndex, setCoverIndex] = useState(0);
  const [coverPickMode, setCoverPickMode] = useState(false);
  const [draggingImageUrl, setDraggingImageUrl] = useState<string | null>(null);
  const deleteZoneRef = useRef<HTMLDivElement>(null);
  const momentDragUrlRef = useRef<string | null>(null);
  const momentLongPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const momentPointerStartRef = useRef({ x: 0, y: 0 });
  // Grid expand state per moment
  const [expandedGrids, setExpandedGrids] = useState<Set<string>>(new Set());
  const gridTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-collapse expanded grids after 10s
  useEffect(() => {
    if (expandedGrids.size > 0) {
      if (gridTimerRef.current) clearTimeout(gridTimerRef.current);
      gridTimerRef.current = setTimeout(() => setExpandedGrids(new Set()), 10000);
    }
    return () => { if (gridTimerRef.current) clearTimeout(gridTimerRef.current); };
  }, [expandedGrids]);

  useEffect(() => () => {
    if (momentLongPressRef.current) clearTimeout(momentLongPressRef.current);
  }, []);

  useEffect(() => {
    const syncAccent = () => setAccentColor(localStorage.getItem('echo-accent-color') || 'purple');
    window.addEventListener('storage', syncAccent);
    window.addEventListener('echo-accent-color-change', syncAccent);
    return () => {
      window.removeEventListener('storage', syncAccent);
      window.removeEventListener('echo-accent-color-change', syncAccent);
    };
  }, []);

  const fetchMoments = async (pageNum = 1) => {
    try {
      const data = await api<{ moments: MomentData[]; total: number; hasMore: boolean }>('GET', `/api/moments?page=${pageNum}`);
      if (pageNum === 1) {
        setMoments(data.moments);
      } else {
        setMoments(prev => [...prev, ...data.moments]);
      }
      setHasMore(data.hasMore);
    } catch { /* offline */ } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchMoments(); }, []);

  const uploadImage = async (file: File) => {
    uploadingCount.current += 1;
    setUploading(true);
    try {
      if (file.size > 30 * 1024 * 1024) {
        throw new Error('图片/GIF 不能超过 30MB');
      }
      const compressed = await prepareMomentImage(file);
      const base = getServerUrl();
      const token = localStorage.getItem('echo-token');
      const formData = new FormData();
      formData.append('file', compressed);
      const res = await fetch(base + '/api/upload/chat-image', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
      });
      const contentType = res.headers.get('content-type') || '';
      const data = contentType.includes('application/json')
        ? await res.json()
        : { error: (await res.text()).slice(0, 100) };
      if (!res.ok) throw new Error(data.error || '上传失败');
      setUploadedImages(prev => [...prev, data.url]);
    } catch (e: any) {
      toast(e.message || '上传失败', 'error');
    } finally {
      uploadingCount.current -= 1;
      if (uploadingCount.current === 0) setUploading(false);
    }
  };

  const removeImage = (i: number) => {
    setUploadedImages(prev => prev.filter((_, j) => j !== i));
    setCoverIndex(prev => {
      if (i === prev) return 0;
      if (i < prev) return Math.max(0, prev - 1);
      return prev;
    });
  };

  const reorderUploadedImages = (next: string[]) => {
    const coverUrl = uploadedImages[coverIndex] || next[0];
    setUploadedImages(next);
    setCoverIndex(Math.max(0, next.indexOf(coverUrl)));
  };

  const moveUploadedImage = (fromUrl: string, toUrl: string) => {
    if (fromUrl === toUrl) return;
    setUploadedImages(prev => {
      const from = prev.indexOf(fromUrl);
      const to = prev.indexOf(toUrl);
      if (from < 0 || to < 0 || from === to) return prev;
      const coverUrl = prev[coverIndex] || prev[0];
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      setCoverIndex(Math.max(0, next.indexOf(coverUrl)));
      return next;
    });
  };

  const handleImageDragEnd = (url: string, info: any) => {
    setDraggingImageUrl(null);
    const rect = deleteZoneRef.current?.getBoundingClientRect();
    if (!rect) return;
    const point = info?.point || {};
    const x = point.x ?? 0;
    const y = point.y ?? 0;
    if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
      const index = uploadedImages.indexOf(url);
      if (index >= 0) removeImage(index);
    }
  };

  const resetComposer = () => {
    setShowComposer(false);
    setShowDraftConfirm(false);
    setNewContent('');
    setUploadedImages([]);
    setCoverIndex(0);
    setCoverPickMode(false);
    setPrivacy('PUBLIC');
    setPrivacyGroups([]);
    setHiddenUserIds([]);
    setScheduleTime('');
    setComposerMode('stack');
  };

  const closeComposer = () => {
    if (newContent.trim() || uploadedImages.length > 0) {
      setShowDraftConfirm(true);
      return;
    }
    resetComposer();
  };

  const saveDraftAndClose = () => {
    localStorage.setItem('echo-draft', JSON.stringify({
      content: newContent,
      images: uploadedImages,
      privacy,
      scheduleTime,
    }));
    resetComposer();
  };

  const postMoment = async () => {
    if (!newContent.trim() && uploadedImages.length === 0) return;
    if (scheduleTime) {
      toast('动态定时发布还需要后端队列，暂时先不要选择定时时间', 'error');
      return;
    }
    setPosting(true);
    try {
      const result = await api<{ id: string }>('POST', '/api/moments', {
        content: newContent.trim(),
        images: uploadedImages,
        privacyType: privacy,
        targetGroupIds: privacyGroups,
        hiddenUserIds,
        galleryMode: composerMode,
        coverIndex,
        scheduledAt: scheduleTime || undefined,
      });
      if (result?.id) {
        const modes = { ...galleryModes, [result.id]: composerMode };
        setGalleryModes(modes);
        localStorage.setItem('echo-gallery-modes', JSON.stringify(modes));
        const covers = { ...coverIndices, [result.id]: coverIndex };
        setCoverIndices(covers);
        localStorage.setItem('echo-cover-indices', JSON.stringify(covers));
      }
      setNewContent('');
      setUploadedImages([]);
      setCoverIndex(0);
      setPrivacy('PUBLIC');
      setPrivacyGroups([]);
      setHiddenUserIds([]);
      setScheduleTime('');
      setComposerMode('stack');
      setShowComposer(false);
      setPosting(false);
      fetchMoments(1);
      toast(scheduleTime ? '定时动态已设置' : '动态已发布', 'success');
    } catch (e: any) {
      toast(e.message || '发布失败', 'error');
      setPosting(false);
    }
  };

  const toggleLike = async (momentId: string) => {
    try {
      const res = await api<{ liked: boolean }>('POST', `/api/moments/${momentId}/like`);
      setMoments(prev => prev.map(m => {
        if (m.id !== momentId) return m;
        const likes = m.likes || [];
        if (res.liked) {
          return { ...m, likes: [...likes, { userId: user!.id }], _count: { ...m._count, likes: m._count.likes + 1 } };
        }
        return { ...m, likes: likes.filter(l => l.userId !== user!.id), _count: { ...m._count, likes: m._count.likes - 1 } };
      }));
      if (res.liked) toast('收到新的共鸣', 'success');
    } catch { /* ignore */ }
  };

  const openComments = async (momentId: string) => {
    if (commentsFor === momentId) {
      setCommentsFor(null);
      return;
    }
    setCommentsFor(momentId);
    try {
      const data = await api<CommentData[]>('GET', `/api/moments/${momentId}/comments`);
      setComments(data);
    } catch { /* ignore */ }
  };

  const addComment = async (momentId: string) => {
    if (!commentText.trim()) return;
    try {
      await api('POST', `/api/moments/${momentId}/comments`, { content: commentText.trim() });
      setCommentText('');
      openComments(momentId);
      setMoments(prev => prev.map(m => {
        if (m.id !== momentId) return m;
        return { ...m, _count: { ...m._count, comments: m._count.comments + 1 } };
      }));
      toast('评论已发送', 'success');
    } catch (e: any) { toast(e.message || '评论失败', 'error'); }
  };

  const getDisplayName = (u: MomentUser) => u.nickname || u.username;
  const isLiked = (m: MomentData) => m.likes?.some(l => l.userId === user?.id);
  const parseImages = (images: string): string[] => {
    try { return (JSON.parse(images) as string[]).map(assetUrl); } catch { return []; }
  };

  const privacyLabel: Record<string, string> = { PUBLIC: '🌍 公开', PRIVATE: '🔒 仅自己可见', VISIBLE_TO: '👁️ 部分可见', INVISIBLE_TO: '🚫 不给谁看' };

  return (
    <div className="flex h-full overflow-y-auto flex-col bg-gray-50 dark:bg-gray-950">
      <header className="flex items-center gap-3 border-b border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-900 shrink-0">
        <button onClick={() => nav('/')} className="text-sm text-primary-500 hover:underline">← 返回</button>
        <h1 className="flex-1 text-lg font-bold text-gray-900 dark:text-gray-100">动态</h1>
        <button onClick={() => {
          const draft = localStorage.getItem('echo-draft');
          if (draft) {
            try { const d = JSON.parse(draft); setNewContent(d.content || ''); setUploadedImages(d.images || []); setPrivacy(d.privacy || 'PUBLIC'); setScheduleTime(d.scheduleTime || ''); localStorage.removeItem('echo-draft'); } catch {}
          }
          setShowComposer(true);
        }} className="text-xl p-1 text-primary-500 hover:scale-110 transition-transform">☄️</button>
      </header>

      <div className="flex-1 overflow-y-auto transform-gpu" style={{ willChange: 'transform' }}>
        <div className="p-4 space-y-4 pb-20">
          {loading ? (
            <p className="py-8 text-center text-sm text-gray-400">加载中...</p>
          ) : moments.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-400">暂无动态，添加好友后可见更多</p>
          ) : (
            <>
              {moments.map(moment => {
                const imgs = parseImages(moment.images);
                return (
                  <div key={moment.id} className="rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900 overflow-hidden">
                    <div className="flex items-center gap-3 p-4 pb-2">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-100 text-sm font-bold text-primary-600 dark:bg-primary-900/30">
                        {moment.user.avatar ? <img src={assetUrl(moment.user.avatar)} alt="" className="h-full w-full rounded-xl object-cover" /> : getDisplayName(moment.user)[0]?.toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{getDisplayName(moment.user)}</p>
                        <p className="text-xs text-gray-400">{new Date(moment.createdAt).toLocaleString('zh-CN')}</p>
                      </div>
                    </div>
                    <div className="px-4 pb-1">
                      <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words">{moment.content}</p>
                      {imgs.length > 0 && (
                        (moment.galleryMode || galleryModes[moment.id] || 'stack') === 'stack'
                          ? <FloatingStackGallery images={imgs} onPreview={(url, i) => setLightbox({ images: imgs, index: i })} />
                          : imgs.length === 1 ? (
                            <img src={imgs[0]} alt="" className="rounded-xl object-cover w-full max-h-64 cursor-pointer" onClick={() => setLightbox({ images: imgs, index: 0 })} />
                          ) : expandedGrids.has(moment.id) ? (
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }}>
                              <PaginatedGridGallery images={imgs} onPreview={(url, i) => setLightbox({ images: imgs, index: i })} />
                            </motion.div>
                          ) : (
                            <div className="relative cursor-pointer" onClick={() => setExpandedGrids(prev => new Set([...prev, moment.id]))}>
                              <img src={imgs[moment.coverIndex ?? coverIndices[moment.id] ?? 0] || imgs[0]} alt="" className="rounded-xl object-cover w-full max-h-72 shadow-lg" />
                              <div className="absolute top-2 right-2 bg-black/50 backdrop-blur-sm text-white/90 text-base w-8 h-8 rounded-full flex items-center justify-center">
                                ⊞
                              </div>
                            </div>
                          )
                      )}
                    </div>
                    <div className="flex items-center gap-4 border-t border-gray-100 px-4 py-2 dark:border-gray-800">
                      <button onClick={() => toggleLike(moment.id)} className={`flex items-center gap-1 text-xs ${isLiked(moment) ? 'text-red-500' : 'text-gray-400 hover:text-red-400'}`}>
                        {isLiked(moment) ? '❤️' : '🤍'} {moment._count.likes || 0}
                      </button>
                      <button onClick={() => openComments(moment.id)} className="flex items-center gap-1 text-xs text-gray-400 hover:text-primary-400">
                        💬 {moment._count.comments || 0}
                      </button>
                      {moment.userId === user?.id && (
                        <button onClick={async () => {
                          try { await api('DELETE', `/api/moments/${moment.id}`); fetchMoments(1); toast('已删除', 'info'); }
                          catch (e: any) { toast(e.message || '删除失败', 'error'); }
                        }} className="ml-auto text-[10px] text-gray-300 hover:text-red-400">
                          🗑
                        </button>
                      )}
                    </div>
                    {commentsFor === moment.id && (
                      <div className="border-t border-gray-100 bg-gray-50 px-4 py-3 dark:border-gray-800 dark:bg-gray-800/50">
                        {comments.length === 0 && <p className="text-xs text-gray-400 mb-2">暂无评论</p>}
                        {comments.map(c => (
                          <div key={c.id} className="mb-1.5 text-xs flex items-center gap-1">
                            <span className="font-medium text-primary-500">{getDisplayName(c.user)}</span>
                            <span className="text-gray-600 dark:text-gray-300">: {c.content}</span>
                            {c.userId === user?.id && (
                              <button onClick={async () => {
                                try { await api('DELETE', `/api/moments/${moment.id}/comments/${c.id}`); openComments(moment.id); toast('已删除', 'info'); }
                                catch (e: any) { toast(e.message || '删除失败', 'error'); }
                              }} className="text-[10px] text-gray-300 hover:text-red-400 ml-auto">✕</button>
                            )}
                          </div>
                        ))}
                        <div className="mt-2 flex gap-2">
                          <input type="text" value={commentText} onChange={(e) => setCommentText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addComment(moment.id)} placeholder="写评论..." className="flex-1 rounded-lg bg-white px-2 py-1 text-xs dark:bg-gray-700 dark:text-gray-200" />
                          <button onClick={() => addComment(moment.id)} className="rounded-lg bg-primary-500 px-2 py-1 text-xs text-white">发送</button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              {hasMore && (
                <button onClick={() => { const next = page + 1; setPage(next); fetchMoments(next); }} className="w-full rounded-xl bg-white py-2 text-sm text-primary-500 dark:bg-gray-900">
                  加载更多
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Composer Modal */}
      {showComposer && (
        <div className="fixed inset-0 z-50 flex flex-col h-screen bg-white dark:bg-gray-950" style={{ height: '100dvh' }} onClick={() => setShowComposer(false)}>
          {/* Loading overlay — non-dismissible */}
          {posting && (
            <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center pointer-events-auto" onClick={(e) => e.stopPropagation()}>
              <div className="text-white text-center"><span className="text-5xl animate-pulse">☄️</span><p className="mt-3 text-base font-medium">正在发射...</p></div>
            </div>
          )}
          <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-700 shrink-0" onClick={(e) => e.stopPropagation()}>
            <button onClick={closeComposer} className="text-sm text-gray-500">取消</button>
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">发动态</h2>
            <button onClick={postMoment} disabled={posting || (!newContent.trim() && uploadedImages.length === 0)} className="rounded-lg bg-primary-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-primary-600 disabled:opacity-50">
              {posting ? '...' : scheduleTime ? '定时发射' : '发布'}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 pb-32" onClick={(e) => e.stopPropagation()}>
            <textarea
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              placeholder="分享你的想法..."
              rows={5}
              className="w-full resize-none rounded-xl bg-gray-50 px-4 py-3 text-sm dark:bg-gray-800 dark:text-gray-100 placeholder:text-gray-400"
              autoFocus
            />

            {/* Images */}
            {uploadedImages.length > 0 && (
              <div className="mt-3 space-y-3">
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setCoverPickMode(v => !v)}
                    className={`rounded-xl px-3 py-1.5 text-xs font-medium transition-colors ${coverPickMode ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-300'}`}
                  >
                    {'\u9009\u62e9\u5c01\u9762'}
                  </button>
                  <span className="text-[11px] text-gray-400">{coverPickMode ? '\u70b9\u51fb\u4e00\u5f20\u8bbe\u4e3a\u5c01\u9762' : '\u957f\u6309\u62d6\u52a8\u8c03\u6574\u987a\u5e8f'}</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {uploadedImages.map((url, i) => (
                    <div
                      key={url}
                      data-moment-img={url}
                      className="relative aspect-square touch-none"
                      onPointerDown={(e) => {
                        if (coverPickMode) return;
                        const target = e.currentTarget;
                        const pointerId = e.pointerId;
                        momentPointerStartRef.current = { x: e.clientX, y: e.clientY };
                        if (momentLongPressRef.current) clearTimeout(momentLongPressRef.current);
                        momentLongPressRef.current = setTimeout(() => {
                          momentDragUrlRef.current = url;
                          setDraggingImageUrl(url);
                          try { target.setPointerCapture?.(pointerId); } catch {}
                        }, 450);
                      }}
                      onPointerMove={(e) => {
                        if (!momentDragUrlRef.current) {
                          const dx = Math.abs(e.clientX - momentPointerStartRef.current.x);
                          const dy = Math.abs(e.clientY - momentPointerStartRef.current.y);
                          if ((dx > 8 || dy > 8) && momentLongPressRef.current) {
                            clearTimeout(momentLongPressRef.current);
                            momentLongPressRef.current = null;
                          }
                          return;
                        }
                        e.preventDefault();
                        const target = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-moment-img]') as HTMLElement | null;
                        const toUrl = target?.dataset.momentImg;
                        if (toUrl && toUrl !== momentDragUrlRef.current) moveUploadedImage(momentDragUrlRef.current, toUrl);
                      }}
                      onPointerUp={(e) => {
                        if (momentLongPressRef.current) clearTimeout(momentLongPressRef.current);
                        momentLongPressRef.current = null;
                        try { (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId); } catch {}
                        if (momentDragUrlRef.current) handleImageDragEnd(momentDragUrlRef.current, { point: { x: e.clientX, y: e.clientY } });
                        momentDragUrlRef.current = null;
                        setDraggingImageUrl(null);
                      }}
                      onPointerCancel={() => {
                        if (momentLongPressRef.current) clearTimeout(momentLongPressRef.current);
                        momentLongPressRef.current = null;
                        momentDragUrlRef.current = null;
                        setDraggingImageUrl(null);
                      }}
                      onClick={() => {
                        if (!coverPickMode) return;
                        setCoverIndex(i);
                        setCoverPickMode(false);
                      }}
                    >
                      <img
                        src={assetUrl(url)}
                        alt=""
                        className={(i === coverIndex ? 'ring-1 ' + selectedRing + ' ' : coverPickMode ? 'ring-1 ring-primary-200 ' : 'ring-1 ring-gray-100 dark:ring-gray-800 ') + (draggingImageUrl === url ? 'scale-95 opacity-70 ' : '') + 'h-full w-full rounded-xl object-cover transition-all'}
                        onError={(e) => { (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="%23f0f0f0" width="100" height="100"/></svg>'; }}
                      />
                    </div>
                  ))}
                </div>
                <div
                  ref={deleteZoneRef}
                  className={`flex h-12 items-center justify-center rounded-2xl border border-dashed text-xs transition-colors ${draggingImageUrl ? 'border-red-300 bg-red-50 text-red-500 dark:border-red-800 dark:bg-red-950/30' : 'border-gray-200 bg-gray-50 text-gray-400 dark:border-gray-800 dark:bg-gray-900'}`}
                >
                  {'\u62d6\u5230\u8fd9\u91cc\u5220\u9664'}
                </div>
              </div>
            )}

            {uploadedImages.length < MAX_MOMENT_IMAGES && (
              <label className={`mt-3 flex items-center justify-center rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 h-24 cursor-pointer hover:border-primary-400 transition-colors ${uploading ? 'opacity-50' : ''}`}>
                <span className="text-sm text-gray-400">{uploading ? '上传中...' : '+ 添加图片'}</span>
                <input type="file" accept="image/*,image/gif" multiple className="hidden" onChange={(e) => { const files = e.target.files; if (files) { for (let i = 0; i < Math.min(files.length, MAX_MOMENT_IMAGES - uploadedImages.length); i++) uploadImage(files[i]); } }} />
              </label>
            )}

            {/* Privacy */}
            <div className="mt-4">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">谁可以看</p>
              <button type="button" onClick={() => setShowStarZoneSelector(true)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gray-100 dark:bg-gray-800 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                {privacyLabel[privacy]}
                {hiddenUserIds.length > 0 && <span className="text-red-500">排除 {hiddenUserIds.length} 人</span>}
                {privacyGroups.length > 0 && <span className="text-primary-500">({privacyGroups.length}个组)</span>}
              </button>
            </div>

            {/* Schedule */}
            <div className="mt-4">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">定时发送（可选）</p>
              <input
                type="datetime-local"
                value={scheduleTime}
                onChange={(e) => setScheduleTime(e.target.value)}
                className="w-full rounded-xl bg-gray-50 px-4 py-2.5 text-sm dark:bg-gray-800 dark:text-gray-200"
              />
            </div>

            {/* Gallery Mode */}
            <div className="mt-4">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">展示方式</p>
              <div className="flex gap-2">
                <button onClick={() => { setComposerMode('stack'); localStorage.setItem('echo-gallery-mode', 'stack'); }}
                  className={`flex-1 rounded-xl py-2.5 text-xs font-medium transition-colors ${composerMode === 'stack' ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'}`}>
                  悬浮堆叠
                </button>
                <button onClick={() => { setComposerMode('grid'); localStorage.setItem('echo-gallery-mode', 'grid'); }}
                  className={`flex-1 rounded-xl py-2.5 text-xs font-medium transition-colors ${composerMode === 'grid' ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'}`}>
                  宫格展开
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox with spring swipe navigation */}
      {lightbox && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-sm"
          onTouchStart={(e) => { (e.currentTarget as HTMLElement).dataset.lbx = String(e.touches[0].clientX); }}
          onTouchEnd={(e) => {
            const sx = Number((e.currentTarget as HTMLElement).dataset.lbx || '0');
            const dx = e.changedTouches[0].clientX - sx;
            if (Math.abs(dx) > 60) {
              e.stopPropagation();
              const dir = dx > 0 ? -1 : 1;
              const newIdx = (lightbox.index + dir + lightbox.images.length) % lightbox.images.length;
              setLightbox({ ...lightbox, index: newIdx });
            }
          }}
          onClick={() => setLightbox(null)}
        >
          <button onClick={() => setLightbox(null)} className="absolute top-4 right-4 z-10 rounded-full bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/20">✕</button>
          <a href={lightbox.images[lightbox.index]} download target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="absolute bottom-6 right-6 z-10 rounded-full bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/20">💾 保存</a>
          <span className="absolute top-4 left-4 z-10 bg-white/10 px-3 py-1 rounded-full text-xs text-white">{lightbox.index + 1}/{lightbox.images.length}</span>
          <AnimatePresence mode="wait">
            <motion.img
              key={lightbox.index}
              src={lightbox.images[lightbox.index]}
              alt=""
              className="max-h-[90vh] max-w-[90vw] object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, x: 60 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -60 }}
              transition={{ type: 'spring', stiffness: 150, damping: 20, mass: 0.8 }}
            />
          </AnimatePresence>
        </div>
      )}

      <StarZoneSelector
        open={showStarZoneSelector}
        onClose={() => setShowStarZoneSelector(false)}
        onManageGroups={() => nav('/star-zones')}
        onConfirm={(type, groupIds, excludedIds) => {
          setPrivacy(type);
          setPrivacyGroups(groupIds);
          setHiddenUserIds(excludedIds);
          setShowStarZoneSelector(false);
        }}
      />

      <Modal
        open={showDraftConfirm}
        onClose={() => setShowDraftConfirm(false)}
        title="保留草稿？"
        actions={
          <>
            <button
              onClick={resetComposer}
              className="rounded-xl px-4 py-2 text-sm text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              不保留
            </button>
            <button
              onClick={saveDraftAndClose}
              className="rounded-xl bg-primary-500 px-4 py-2 text-sm font-medium text-white hover:bg-primary-600"
            >
              保留草稿
            </button>
          </>
        }
      >
        这次编辑还没有发布，是否保存为草稿？
      </Modal>
    </div>
  );
}
