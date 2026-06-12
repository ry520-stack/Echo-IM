import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Image, Clock, Send, Smile, Trash2, PawPrint, Camera, Cookie, Backpack, Store, Heart, Gift, Sparkles, ShowerHead, Dumbbell, Compass, Footprints, Brush, Shield, Music, BookOpen, Briefcase } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { useToast } from '../contexts/ToastContext';
import { api, getServerUrl } from '../api/client';
import { compressEmoji, prepareChatImage } from '../utils/compressImage';
import { is5Plus } from '../utils/env';
import { useBackground } from '../hooks/useBackground';
import Modal from './Modal';
import PersonalOrbitView from './PersonalOrbitView';
import GroupOrbitView from './GroupOrbitView';
import GooeySwipe from './GooeySwipe';
import VoiceBubble from './VoiceBubble';
import FluidInput from './FluidInput';
import { Phone } from 'lucide-react';
import { useCall } from '../contexts/CallContext';
import { assetUrl } from '../utils/assetUrl';
import { useAudioRecorder } from '../hooks/useAudioRecorder';

interface Sender {
  id: string;
  username: string;
  nickname: string;
  avatar: string;
}

interface ReplyTo {
  id: string;
  content: string;
  type: string;
  sender: { id: string; username: string; nickname: string };
}

interface Message {
  id: string;
  senderId: string;
  receiverId: string | null;
  groupId: string | null;
  content: string;
  type: string;
  isRecalled: boolean;
  replyToId: string | null;
  replyTo: ReplyTo | null;
  createdAt: string;
  sender: Sender;
  readReceipts?: { userId: string; readAt: string }[];
}

interface Peer {
  id: string;
  username: string;
  nickname: string;
  avatar: string;
  digitalId: number;
  lastSeenAt: string;
  status: string;
  allowStrangerMessage?: boolean;
  readReceiptsEnabled?: boolean;
}

interface Props {
  peerId: string;
  peer: Peer | null;
  chatType: 'user' | 'group';
  groupName?: string;
  groupAvatar?: string;
  onBack?: () => void;
  initialOrbit?: boolean;
  focusMessageId?: string;
}

interface PetBond {
  id: string;
  status: 'pending' | 'active' | 'rejected';
  requestedBy: string;
  pendingForMe: boolean;
  name: string;
  avatar: string;
  level: number;
  experience: number;
  intimacy: number;
  coins?: number;
  biscuits?: number;
  activity?: string;
  activityUntil?: string | null;
  education?: string;
  job?: string;
  todayMessageCount?: number;
  todayMutual?: boolean;
  streakDays?: number;
  repairCards?: number;
  repairableDay?: string | null;
  mood?: 'happy' | 'sad' | 'sick';
  dailyTasks?: Array<{ target: number; label: string; bonusExperience: number; completed: boolean }>;
  achievementTasks?: Array<{ key: string; label: string; progress: number; target: number; unit: string; completed: boolean }>;
}

type PetAction =
  | 'check-in'
  | 'buy-biscuit'
  | 'buy-snack-box'
  | 'buy-repair-card'
  | 'buy-study-kit'
  | 'buy-date-pack'
  | 'feed'
  | 'study'
  | 'work'
  | 'sleep'
  | 'cuddle'
  | 'play'
  | 'walk'
  | 'clean'
  | 'bath'
  | 'train'
  | 'explore'
  | 'dance'
  | 'guard';

const PET_STAGES = [
  { level: 10, name: '星辉伙伴', color: 'from-fuchsia-400 to-violet-500', glow: 'shadow-fuchsia-500/30' },
  { level: 6, name: '活力伙伴', color: 'from-violet-400 to-indigo-500', glow: 'shadow-violet-500/25' },
  { level: 3, name: '成长伙伴', color: 'from-amber-400 to-orange-500', glow: 'shadow-amber-500/25' },
  { level: 1, name: '幼年伙伴', color: 'from-yellow-300 to-amber-400', glow: 'shadow-amber-500/20' },
];
const PET_EXP_PER_LEVEL = 120;

const petStage = (level: number) => PET_STAGES.find(stage => level >= stage.level) || PET_STAGES[PET_STAGES.length - 1];

const petStatusMark = (pet: PetBond, action: string) => {
  if (action === 'sleep' || pet.activity === 'sleep') return 'Z';
  if (pet.activity === 'study') return '书';
  if (pet.activity === 'work') return '工';
  if (pet.activity === 'walk') return '走';
  if (pet.activity === 'bath' || pet.activity === 'clean') return '净';
  if (pet.activity === 'train') return '训';
  if (pet.activity === 'explore') return '探';
  if (action === 'feed') return '饱';
  if (action === 'laugh') return '乐';
  if (pet.mood === 'sick') return '病';
  if (pet.mood === 'sad') return '想';
  return '伴';
};

const ERROR_MAP: Record<string, string> = {
  blocked: '对方已将你拉黑，或你已拉黑对方',
  'stranger messages disabled': '对方未开启陌生人消息',
  '消息已发出，但被对方拒收了': '消息已发出，但被对方拒收了',
  '对方开启了好友验证，你还不是他（她）好友': '对方开启了好友验证，你还不是他（她）好友',
};

const accentRingClass: Record<string, string> = {
  purple: 'ring-primary-500',
  blue: 'ring-blue-600',
  black: 'ring-gray-900 dark:ring-gray-100',
};

export default function ChatWindow({ peerId, peer, chatType, groupName, groupAvatar, onBack, initialOrbit = false, focusMessageId }: Props) {
  const { user } = useAuth();
  const { socket, connected, isUserOnline } = useSocket();
  const toast = useToast();
  const isGroup = chatType === 'group';
  const { getBg, getChatBg, setChatBg: saveChatBg, uploadAndGetUrl } = useBackground();
  const { startCall } = useCall();
  const { startRecord, stopRecord, stopRecordPath, isRecording: recorderActive } = useAudioRecorder();
  const [accentColor, setAccentColor] = useState(() => localStorage.getItem('echo-accent-color') || 'purple');
  const selectedRing = accentRingClass[accentColor] || accentRingClass.purple;
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [older, setOlder] = useState(false);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [typingUser, setTypingUser] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  type ActivePanel = null | 'emoji' | 'schedule' | 'more';
  const [activePanel, setActivePanel] = useState<ActivePanel>(null);
  const [scheduleTime, setScheduleTime] = useState('');
  const [scheduleContent, setScheduleContent] = useState('');
  const realPeerId = peer?.id || peerId;
  const [chatBg, setChatBg] = useState(() => getChatBg(realPeerId));
  const [showBgPicker, setShowBgPicker] = useState(false);
  const [bgUrlInput, setBgUrlInput] = useState('');
  const [emojis, setEmojis] = useState<{ id: string; imageUrl: string; name: string }[]>([]);
  const [emojiManageMode, setEmojiManageMode] = useState(false);
  const [emojiReorderingId, setEmojiReorderingId] = useState<string | null>(null);
  const [pet, setPet] = useState<PetBond | null>(null);
  const [petOpen, setPetOpen] = useState(false);
  const [petName, setPetName] = useState('');
  const [petBusy, setPetBusy] = useState(false);
  const [petAction, setPetAction] = useState<'idle' | 'poke' | 'feed' | 'laugh' | 'sleep'>('idle');
  const [petSide, setPetSide] = useState<'left' | 'right'>('right');
  const [petY, setPetY] = useState(104);
  const [petTab, setPetTab] = useState<'home' | 'shop' | 'bag'>('home');
  const petDraggingRef = useRef(false);
  const petMovedRef = useRef(false);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);

  useEffect(() => {
    if (!socket || isGroup) return;
    const handleRelationshipUpdated = (data: { action?: string; peerId?: string }) => {
      if (data.peerId !== realPeerId || data.action !== 'removed') return;
      toast('\u4f60\u4eec\u5df2\u4e0d\u662f\u597d\u53cb', 'error');
      onBack?.();
    };
    socket.on('relationship:updated', handleRelationshipUpdated);
    return () => {
      socket.off('relationship:updated', handleRelationshipUpdated);
    };
  }, [isGroup, onBack, realPeerId, socket, toast]);

  const fetchPet = useCallback(async () => {
    if (isGroup || !realPeerId) {
      setPet(null);
      return;
    }
    try {
      const next = await api<PetBond | null>('GET', `/api/pets/${realPeerId}`);
      setPet(next);
      setPetName(next?.name || '');
    } catch {
      setPet(null);
    }
  }, [isGroup, realPeerId]);

  useEffect(() => { fetchPet(); }, [fetchPet]);
  useEffect(() => {
    if (!socket || isGroup) return;
    const refreshPet = (data: { peerId?: string }) => {
      if (data.peerId === realPeerId) fetchPet();
    };
    const animatePet = (data: { peerId?: string; action?: 'poke' | 'feed' | 'laugh' | 'sleep' }) => {
      if (data.peerId !== realPeerId || !data.action) return;
      setPetAction(data.action);
      window.setTimeout(() => setPetAction('idle'), data.action === 'sleep' ? 5000 : 1800);
    };
    socket.on('pet:updated', refreshPet);
    socket.on('pet:interaction', animatePet);
    return () => {
      socket.off('pet:updated', refreshPet);
      socket.off('pet:interaction', animatePet);
    };
  }, [fetchPet, isGroup, realPeerId, socket]);

  const interactWithPet = (action: 'poke' | 'feed') => {
    if (!socket || !pet || pet.status !== 'active') return;
    socket.emit('pet:interact', { peerId: realPeerId, action });
  };

  const repairPetStreak = async () => {
    setPetBusy(true);
    try {
      const next = await api<PetBond>('POST', `/api/pets/${realPeerId}/repair`);
      setPet(next);
      toast('补签成功，连续互动已恢复', 'success');
    } catch (e: any) {
      toast(e.message || '补签失败', 'error');
    } finally {
      setPetBusy(false);
    }
  };

  const rejectPet = async () => {
    setPetBusy(true);
    try {
      await api('POST', `/api/pets/${realPeerId}/reject`);
      await fetchPet();
      toast('已拒绝共同领养邀请', 'success');
    } catch (e: any) {
      toast(e.message || '操作失败', 'error');
    } finally {
      setPetBusy(false);
    }
  };

  const runPetAction = async (action: PetAction) => {
    setPetBusy(true);
    try {
      const next = await api<PetBond>('POST', `/api/pets/${realPeerId}/action`, { action });
      setPet(next);
      if (action === 'feed') interactWithPet('feed');
      if (action === 'sleep') setPetAction('sleep');
      toast(action === 'check-in' ? '签到成功，金币 +8' : action === 'buy-biscuit' ? '饼干已放入背包' : '宠物状态已更新', 'success');
    } catch (e: any) {
      toast(e.message || '操作失败', 'error');
    } finally {
      setPetBusy(false);
    }
  };

  const adoptPet = async () => {
    setPetBusy(true);
    try {
      const next = await api<PetBond>('POST', `/api/pets/${realPeerId}/adopt`);
      setPet(next);
      setPetName(next.name);
      toast(next.status === 'active' ? '\u5171\u540c\u5ba0\u7269\u5df2\u9886\u517b' : '\u9886\u517b\u9080\u8bf7\u5df2\u53d1\u9001', 'success');
    } catch (e: any) {
      toast(e.message || '\u64cd\u4f5c\u5931\u8d25', 'error');
    } finally {
      setPetBusy(false);
    }
  };

  const savePet = async (avatar?: string) => {
    if (!pet || pet.status !== 'active') return;
    setPetBusy(true);
    try {
      const next = await api<PetBond>('PATCH', `/api/pets/${realPeerId}`, { name: petName.trim() || pet.name, ...(avatar !== undefined ? { avatar } : {}) });
      setPet(next);
      setPetName(next.name);
      toast('\u5ba0\u7269\u8d44\u6599\u5df2\u66f4\u65b0', 'success');
    } catch (e: any) {
      toast(e.message || '\u4fdd\u5b58\u5931\u8d25', 'error');
    } finally {
      setPetBusy(false);
    }
  };

  const uploadPetAvatar = async (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    const token = localStorage.getItem('echo-token');
    const res = await fetch(`${getServerUrl()}/api/upload/chat-image`, { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : undefined, body: fd });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '\u4e0a\u4f20\u5931\u8d25');
    await savePet(data.url);
  };

  const [emojiExpanded, setEmojiExpanded] = useState(false);
  const [emojiPage, setEmojiPage] = useState(0);
  const [emojiPageDirection, setEmojiPageDirection] = useState(0);
  const [emojiDragX, setEmojiDragX] = useState(0);
  const [emojiDragging, setEmojiDragging] = useState(false);
  const [emojiManageFlash, setEmojiManageFlash] = useState(false);
  const emojiDragIdRef = useRef<string | null>(null);
  const emojiMovedRef = useRef(false);
  const emojiLongPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const emojiPointerStartRef = useRef({ x: 0, y: 0 });
  const emojisRef = useRef<{ id: string; imageUrl: string; name: string }[]>([]);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [selectedEmojis, setSelectedEmojis] = useState<Set<string>>(new Set());
  const emojisCachedRef = useRef(false);
  const [showPersonalOrbit, setShowPersonalOrbit] = useState(() => !!initialOrbit && chatType !== 'group' && !!peer);
  const [showGroupOrbit, setShowGroupOrbit] = useState(false);
  const [inkDrops, setInkDrops] = useState<{ id: number; x: number }[]>([]);
  const dropCounter = useRef(0);
  const [msgContextMenu, setMsgContextMenu] = useState<{ msgId: string; x: number; y: number; isMine: boolean; createdAt: string; type?: string; content?: string } | null>(null);
  const msgLongPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mentionLongPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoCollapseRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const emojiSwipeRef = useRef({ sx: 0, sy: 0, active: false });

  // 10s auto-collapse timer
  useEffect(() => {
    if (!activePanel) return;
    if (activePanel === 'emoji') return;
    const reset = () => {
      if (autoCollapseRef.current) clearTimeout(autoCollapseRef.current);
      autoCollapseRef.current = setTimeout(() => setActivePanel(null), 10000);
    };
    reset();
    const onInteraction = () => reset();
    window.addEventListener('click', onInteraction);
    window.addEventListener('touchstart', onInteraction);
    return () => {
      window.removeEventListener('click', onInteraction);
      window.removeEventListener('touchstart', onInteraction);
      if (autoCollapseRef.current) clearTimeout(autoCollapseRef.current);
    };
  }, [activePanel]);

  const fetchEmojis = async (force = false) => {
    if (!force && emojisCachedRef.current && emojis.length > 0) return;
    try {
      const items = await api<any[]>('GET', '/api/emojis');
      setEmojis(applyEmojiOrder(items));
      emojisCachedRef.current = true;
    } catch { /* */ }
  };

  useEffect(() => { if (activePanel === 'emoji') fetchEmojis(); }, [activePanel]);
  useEffect(() => { fetchEmojis(); }, [peerId]);

  const emojiPageSize = emojiExpanded ? 12 : 4;
  const emojiMaxPage = Math.max(0, Math.ceil(emojis.length / emojiPageSize) - 1);
  const emojiPages = useMemo(() => {
    const pages: { id: string; imageUrl: string; name: string }[][] = [];
    for (let i = 0; i < emojis.length; i += emojiPageSize) pages.push(emojis.slice(i, i + emojiPageSize));
    return pages;
  }, [emojis, emojiPageSize]);

  const applyEmojiOrder = useCallback((items: { id: string; imageUrl: string; name: string }[]) => {
    try {
      const saved = JSON.parse(localStorage.getItem('echo-emoji-order') || '[]') as string[];
      if (!Array.isArray(saved) || saved.length === 0) return items;
      const rank = new Map(saved.map((id, index) => [id, index]));
      return [...items].sort((a, b) => {
        const ai = rank.has(a.id) ? rank.get(a.id)! : -1;
        const bi = rank.has(b.id) ? rank.get(b.id)! : -1;
        return ai - bi;
      });
    } catch {
      return items;
    }
  }, []);

  const reorderEmojis = (next: { id: string; imageUrl: string; name: string }[]) => {
    setEmojis(next);
    localStorage.setItem('echo-emoji-order', JSON.stringify(next.map(e => e.id)));
  };

  const moveEmojiById = (fromId: string, toId: string) => {
    if (fromId === toId) return;
    setEmojis(prev => {
      const from = prev.findIndex(e => e.id === fromId);
      const to = prev.findIndex(e => e.id === toId);
      if (from < 0 || to < 0 || from === to) return prev;
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      emojisRef.current = next;
      localStorage.setItem('echo-emoji-order', JSON.stringify(next.map(e => e.id)));
      return next;
    });
  };

  useEffect(() => {
    emojisRef.current = emojis;
  }, [emojis]);

  useEffect(() => {
    setEmojiPage(page => Math.min(page, emojiMaxPage));
  }, [emojiMaxPage]);

  useEffect(() => {
    const syncAccent = () => setAccentColor(localStorage.getItem('echo-accent-color') || 'purple');
    window.addEventListener('storage', syncAccent);
    window.addEventListener('echo-accent-color-change', syncAccent);
    return () => {
      window.removeEventListener('storage', syncAccent);
      window.removeEventListener('echo-accent-color-change', syncAccent);
    };
  }, []);

  const bottomRef = useRef<HTMLDivElement>(null);
  const topSentinelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sentinelObserverRef = useRef<IntersectionObserver | null>(null);
  const readyRef = useRef(false);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const bgFileInputRef = useRef<HTMLInputElement>(null);
  const albumFileInputRef = useRef<HTMLInputElement>(null);
  const shootPhotoRef = useRef<HTMLInputElement>(null);
  const shootVideoRef = useRef<HTMLInputElement>(null);
  const [showShootMenu, setShowShootMenu] = useState(false);
  const [emojiPreview, setEmojiPreview] = useState<string | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [groupAliases, setGroupAliases] = useState<Record<string, string>>({});
  const [liveGroupName, setLiveGroupName] = useState(groupName || '');
  const [liveGroupAvatar, setLiveGroupAvatar] = useState(groupAvatar || '');
  const [groupMemberCount, setGroupMemberCount] = useState(0);

  useEffect(() => {
    setLiveGroupName(groupName || '');
    setLiveGroupAvatar(groupAvatar || '');
  }, [groupAvatar, groupName]);

  const readReceiptKey = `echo-read-${peerId}`;
  const [readReceiptOn, setReadReceiptOn] = useState(() => {
    const global = localStorage.getItem('echo-read-receipt-global');
    const perChat = localStorage.getItem(readReceiptKey);
    if (perChat !== null) return perChat === 'true';
    if (global !== null) return global === 'true';
    return true;
  });
  const readReceiptRef = useRef(readReceiptOn);
  readReceiptRef.current = readReceiptOn;

  useEffect(() => {
    if (!initialOrbit || chatType === 'group' || !peer) return;
    setShowPersonalOrbit(true);
  }, [initialOrbit, chatType, peer]);

  useEffect(() => {
    if (!isGroup || !peerId) {
      setGroupAliases({});
      return;
    }
    const refreshGroupAliases = () => api<any>('GET', `/api/groups/${peerId}`).then(group => {
      const aliases: Record<string, string> = {};
      (group.members || []).forEach((member: any) => {
        aliases[member.userId] = member.alias || member.user?.nickname || member.user?.username || '';
      });
      setGroupAliases(aliases);
      setLiveGroupName(group.name || '');
      setLiveGroupAvatar(group.avatar || '');
      setGroupMemberCount(group.memberCount || group.members?.length || 0);
    }).catch(() => setGroupAliases({}));
    const handleGroupUpdated = (data: { groupId?: string; action?: string }) => {
      if (data.groupId !== peerId) return;
      if (data.action === 'dismissed' || data.action === 'access-revoked') {
        toast('\u4f60\u5df2\u4e0d\u5728\u8be5\u7fa4\u804a\u4e2d', 'error');
        onBack?.();
        return;
      }
      refreshGroupAliases();
    };
    refreshGroupAliases();
    socket?.on('group:updated', handleGroupUpdated);
    return () => {
      socket?.off('group:updated', handleGroupUpdated);
    };
  }, [isGroup, onBack, peerId, socket, toast]);

  useEffect(() => {
    if (chatType !== 'group' && peerId) {
      const ids = [peerId, peer?.digitalId ? String(peer.digitalId) : ''].filter(Boolean);
      localStorage.setItem('echo-active-chat-peer', ids.join(','));
    }
    return () => {
      const activeIds = (localStorage.getItem('echo-active-chat-peer') || '').split(',');
      if (activeIds.includes(peerId) || (peer?.digitalId && activeIds.includes(String(peer.digitalId)))) {
        localStorage.removeItem('echo-active-chat-peer');
      }
    };
  }, [chatType, peerId, peer?.digitalId]);

  const toggleReadReceipt = () => {
    const next = !readReceiptOn;
    setReadReceiptOn(next);
    localStorage.setItem(readReceiptKey, String(next));
    localStorage.setItem('echo-read-receipt-global', String(next));
    api('PUT', '/api/users/me', { readReceiptsEnabled: next }).catch(() => {});
  };

  const closePanels = () => {
    setActivePanel(null);
    setShowShootMenu(false);
  };

  const emitUploadedMessage = (url: string, type: 'image' | 'voice' | 'video') => {
    if (!socket || !user || !url) return;
    const tempId = `temp-${type}-${Date.now()}`;
    const optimisticMsg: Message = {
      id: tempId,
      senderId: user.id,
      receiverId: isGroup ? null : peerId,
      groupId: isGroup ? peerId : null,
      content: url,
      type,
      isRecalled: false,
      replyToId: replyTo?.id || null,
      replyTo: replyTo ? { id: replyTo.id, content: replyTo.content, type: replyTo.type, sender: replyTo.sender } : null,
      createdAt: new Date().toISOString(),
      sender: { id: user.id, username: user.username, nickname: user.nickname || user.username, avatar: user.avatar || '' },
    };
    setMessages(prev => [...prev, optimisticMsg]);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);

    socket.emit('message:send', {
      ...(isGroup ? { groupId: peerId } : { receiverId: peerId }),
      content: url,
      type,
      replyToId: replyTo?.id || undefined,
    }, (res: any) => {
      if (res?.error) {
        toast(ERROR_MAP[res.error] || res.error, 'error');
        setMessages(prev => prev.filter(m => m.id !== tempId));
      } else if (res?.ok && res.message) {
        setMessages(prev => prev.map(m => m.id === tempId ? { ...res.message, sender: optimisticMsg.sender } : m));
      }
    });
    setReplyTo(null);
  };

  const uploadPlusPath = (path: string, endpoint: string): Promise<{ url: string }> => {
    return new Promise((resolve, reject) => {
      const plus = (window as any).plus;
      if (!plus?.uploader) {
        reject(new Error('当前 App 不支持原生上传'));
        return;
      }
      const base = getServerUrl();
      const token = localStorage.getItem('echo-token');
      const upload = plus.uploader.createUpload(
        base + endpoint,
        { method: 'POST' },
        (task: any, status: number) => {
          if (status < 200 || status >= 300) {
            reject(new Error(`上传失败 (${status})`));
            return;
          }
          try {
            const data = JSON.parse(task.responseText || '{}');
            if (!data.url) throw new Error(data.error || '上传失败');
            resolve(data);
          } catch (e: any) {
            reject(new Error(e.message || '上传失败'));
          }
        },
      );
      if (token) upload.setRequestHeader('Authorization', `Bearer ${token}`);
      try {
        upload.addFile(path, { key: 'file' });
      } catch {
        try {
          upload.addFile(plus.io.convertLocalFileSystemURL(path), { key: 'file' });
        } catch {
          reject(new Error('读取本地文件失败'));
          return;
        }
      }
      upload.start();
    });
  };

  const sendPlusPath = async (path: string, endpoint: string, type: 'image' | 'voice' | 'video') => {
    try {
      toast('正在发送...', 'info');
      const data = await uploadPlusPath(path, endpoint);
      emitUploadedMessage(data.url, type);
    } catch (e: any) {
      toast(e.message || '发送失败', 'error');
    }
  };

  // 5+ 拍照
  const capturePhoto5Plus = () => {
    const plus = (window as any).plus;
    const camera = plus.camera.getCamera();
    camera.captureImage(
      (path: string) => {
        sendPlusPath(path, '/api/upload/chat-image', 'image');
      },
      (e: any) => {
        if (e.code !== 12) toast('无法打开相机，请检查权限', 'error');
      },
      { filename: '_doc/camera/', format: 'jpg' }
    );
  };

  // 5+ 拍视频
  const captureVideo5Plus = () => {
    const plus = (window as any).plus;
    const camera = plus.camera.getCamera();
    camera.startVideoCapture(
      (path: string) => {
        sendPlusPath(path, '/api/upload/video', 'video');
      },
      (e: any) => {
        if (e.code !== 12) toast('无法打开相机，请检查权限', 'error');
      },
      { filename: '_doc/camera/' }
    );
  };

  const sendImage = async (file: File) => {
    if (file.size > 30 * 1024 * 1024) { toast('图片不能超过 30MB', 'error'); return; }
    const tempId = 'temp-img-' + Date.now();
    const localUrl = URL.createObjectURL(file);
    const optimisticMsg: Message | null = socket && user ? {
      id: tempId,
      senderId: user.id,
      receiverId: isGroup ? null : peerId,
      groupId: isGroup ? peerId : null,
      content: localUrl,
      type: 'image',
      isRecalled: false,
      replyToId: replyTo?.id || null,
      replyTo: replyTo ? { id: replyTo.id, content: replyTo.content, type: replyTo.type, sender: replyTo.sender } : null,
      createdAt: new Date().toISOString(),
      sender: { id: user.id, username: user.username, nickname: user.nickname || user.username, avatar: user.avatar || '' },
    } : null;
    if (optimisticMsg) {
      setMessages(prev => [...prev, optimisticMsg]);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    }
    try {
      const uploadFile = await prepareChatImage(file);
      const base = getServerUrl();
      const token = localStorage.getItem('echo-token');
      const formData = new FormData();
      formData.append('file', uploadFile);
      const res = await fetch(base + '/api/upload/chat-image', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      if (socket && optimisticMsg) {
        setMessages(prev => prev.map(m => m.id === tempId ? { ...m, content: data.url } : m));
        socket.emit('message:send', {
          ...(isGroup ? { groupId: peerId } : { receiverId: peerId }),
          content: data.url,
          type: 'image',
          replyToId: replyTo?.id || undefined,
        }, (res: any) => {
          URL.revokeObjectURL(localUrl);
          if (res?.error) {
            toast(ERROR_MAP[res.error] || res.error, 'error');
            setMessages(prev => prev.filter(m => m.id !== tempId));
          } else if (res?.ok && res.message) {
            setMessages(prev => prev.map(m => m.id === tempId ? { ...res.message, sender: optimisticMsg.sender } : m));
          }
        });
      }
      setReplyTo(null);
    } catch (e: any) {
      if (e.message?.includes('已加入同步队列')) {
        toast('已开启离线模式，网络恢复后自动发送', 'info');
      } else {
        toast(e.message || '图片上传失败', 'error');
        URL.revokeObjectURL(localUrl);
        setMessages(prev => prev.filter(m => m.id !== tempId));
      }
    }
  };

  // 5+ App: 调用原生相册选择图片或视频
  const pickMedia5Plus = () => {
    const plus = (window as any).plus;
    plus.gallery.pick((path: string) => {
      plus.io.resolveLocalFileSystemURL(path, (entry: any) => {
        entry.file((file: any) => {
          const reader = new FileReader();
          reader.onload = () => {
            const mime = file.type || 'image/jpeg';
            const blob = new Blob([reader.result as ArrayBuffer], { type: mime });
            const f = new File([blob], file.name || `media_${Date.now()}`, { type: mime });
            if (mime.startsWith('video/')) sendVideo(f);
            else sendImage(f);
          };
          reader.readAsArrayBuffer(file);
        });
      });
    }, (e: any) => {
      if (e.code !== 12) toast('选择文件失败', 'error');
    });
  };

  // 5+ App: 上传录音文件（从 plus.io 路径读取）
  const collectAsEmoji = async (imageUrl: string) => {
    try {
      await api('POST', '/api/emojis', { imageUrl, name: '收藏' });
      toast('已收藏为表情', 'success');
    } catch (e: any) {
      toast(e.message || '收藏失败', 'error');
    }
  };

  const sendVideo = async (file: File) => {
    if (file.size > 50 * 1024 * 1024) { toast('视频不能超过 50MB', 'error'); return; }
    const tempId = 'temp-vid-' + Date.now();
    try {
      const base = getServerUrl();
      const token = localStorage.getItem('echo-token');
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(base + '/api/upload/video', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      if (socket) {
        const optimisticMsg: Message = {
          id: tempId,
          senderId: user!.id,
          receiverId: isGroup ? null : peerId,
          groupId: isGroup ? peerId : null,
          content: data.url,
          type: 'video',
          isRecalled: false,
          replyToId: replyTo?.id || null,
          replyTo: replyTo ? { id: replyTo.id, content: replyTo.content, type: replyTo.type, sender: replyTo.sender } : null,
          createdAt: new Date().toISOString(),
          sender: { id: user!.id, username: user!.username, nickname: user!.nickname || user!.username, avatar: user!.avatar || '' },
        };
        setMessages(prev => [...prev, optimisticMsg]);
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);

        socket.emit('message:send', {
          ...(isGroup ? { groupId: peerId } : { receiverId: peerId }),
          content: data.url,
          type: 'video',
          replyToId: replyTo?.id || undefined,
        }, (res: any) => {
          if (res?.error) {
            toast(ERROR_MAP[res.error] || res.error, 'error');
            setMessages(prev => prev.filter(m => m.id !== tempId));
          } else if (res?.ok && res.message) {
            setMessages(prev => prev.map(m => m.id === tempId ? { ...res.message, sender: optimisticMsg.sender } : m));
          }
        });
      }
      setReplyTo(null);
    } catch (e: any) {
      toast(e.message || '视频上传失败', 'error');
      setMessages(prev => prev.filter(m => m.id !== tempId));
    }
  };

  const fetchMessages = useCallback(async (before?: string) => {
    try {
      const endpoint = !before && focusMessageId
        ? `/api/messages/context/${focusMessageId}`
        : isGroup
          ? `/api/messages/group?groupId=${peerId}${before ? `&before=${before}` : ''}`
          : `/api/messages?userId=${peerId}${before ? `&before=${before}` : ''}`;
      const data = await api<Message[]>('GET', endpoint);
      if (before) {
        setMessages(prev => {
          const existingIds = new Set(prev.map(m => m.id));
          return [...data.filter(m => !existingIds.has(m.id)), ...prev];
        });
        setOlder(data.length >= 50);
      } else {
        setMessages(data);
        setOlder(data.length >= 50);
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            if (focusMessageId) {
              document.getElementById(`message-${focusMessageId}`)?.scrollIntoView({ block: 'center' });
              setHighlightedMessageId(focusMessageId);
              window.setTimeout(() => setHighlightedMessageId(null), 1800);
            } else {
              bottomRef.current?.scrollIntoView();
            }
          });
        });
      }
    } catch { /* offline */ } finally {
      setLoading(false);
      readyRef.current = true;
    }
  }, [peerId, isGroup, focusMessageId]);

  useEffect(() => {
    setMessages([]);
    setLoading(true);
    setOlder(false);
    setReplyTo(null);
    readyRef.current = false;
    fetchMessages();
    // Mark messages as read when opening chat
    if (peerId) {
      const globalReadReceipt = localStorage.getItem('echo-read-receipt-global') !== 'false';
      if (readReceiptRef.current && globalReadReceipt) {
        api('PUT', '/api/messages/read', isGroup ? { groupId: peerId } : { peerId }).catch(() => {});
      }
    }
  }, [peerId, fetchMessages, isGroup]);

  useEffect(() => {
    if (!topSentinelRef.current) return;
    sentinelObserverRef.current?.disconnect();

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && older && readyRef.current) {
          const oldest = messages[0];
          if (oldest) fetchMessages(oldest.createdAt);
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(topSentinelRef.current);
    sentinelObserverRef.current = observer;
    return () => observer.disconnect();
  }, [older, messages, fetchMessages]);

  useEffect(() => {
    const container = bottomRef.current?.parentElement;
    if (!container || !readyRef.current) return;
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 150;
    if (isNearBottom) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length]);

  useEffect(() => {
    const keepLatestVisible = () => {
      window.setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }), 80);
      window.setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'auto', block: 'end' }), 260);
    };
    window.visualViewport?.addEventListener('resize', keepLatestVisible);
    return () => window.visualViewport?.removeEventListener('resize', keepLatestVisible);
  }, []);


  // Socket message handling
  useEffect(() => {
    if (!socket) return;

    const handleReceive = (msg: Message) => {
      let relevant = false;
      if (isGroup) {
        relevant = msg.groupId === peerId;
      } else {
        relevant = (msg.senderId === peerId && msg.receiverId === user?.id) ||
                   (msg.senderId === user?.id && msg.receiverId === peerId);
      }

      if (relevant) {
        setMessages(prev => {
          // ID 去重
          if (prev.find(m => m.id === msg.id)) return prev;
          // 乐观更新回显去重：自己发的消息，内容+类型相同，2秒内视为重复
          if (msg.senderId === user?.id) {
            const isEcho = prev.some(m =>
              m.senderId === user?.id &&
              m.content === msg.content &&
              m.type === msg.type &&
              Math.abs(new Date(m.createdAt).getTime() - new Date(msg.createdAt).getTime()) < 2000
            );
            if (isEcho) {
              // 用真实消息替换临时消息
              return prev.map(m =>
                m.senderId === user?.id && m.content === msg.content && m.type === msg.type && m.id.startsWith('temp-')
                  ? { ...msg, sender: m.sender }
                  : m
              );
            }
          }
          return [...prev, msg].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        });
        if (!isGroup && msg.senderId === peerId && readReceiptRef.current) {
          socket.emit('message:read', { messageId: msg.id });
        }
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
      }
    };

    const handleTyping = (data: { userId: string; typing: boolean }) => {
      if (data.userId === peerId) {
        setTypingUser(data.typing ? getPeerName() : null);
      }
    };

    const handleReadUpdate = (data: { messageId: string; readBy: string; readAt: string }) => {
      setMessages(prev => prev.map(m => {
        if (m.id === data.messageId) {
          const receipts = m.readReceipts || [];
          if (receipts.some(r => r.userId === data.readBy)) return m;
          return { ...m, readReceipts: [...receipts, { userId: data.readBy, readAt: data.readAt }] };
        }
        return m;
      }));
    };

    const handleReadUpdateBatch = (data: { messageIds: string[]; readBy: string; readAt: string }) => {
      const idSet = new Set(data.messageIds);
      setMessages(prev => prev.map(m => {
        if (idSet.has(m.id)) {
          const receipts = m.readReceipts || [];
          if (receipts.some(r => r.userId === data.readBy)) return m;
          return { ...m, readReceipts: [...receipts, { userId: data.readBy, readAt: data.readAt }] };
        }
        return m;
      }));
    };

    // 撤回广播监听
    const handleRecalled = (data: { messageId: string }) => {
      setMessages(prev => prev.map(m => m.id === data.messageId ? { ...m, isRecalled: true } : m));
    };

    socket.on('message:receive', handleReceive);
    socket.on('message:recalled', handleRecalled);
    if (!isGroup) {
      socket.on('typing:update', handleTyping);
      socket.on('read:update', handleReadUpdate);
      socket.on('read:update_batch', handleReadUpdateBatch);
    }

    return () => {
      socket.off('message:receive', handleReceive);
      socket.off('message:recalled', handleRecalled);
      socket.off('typing:update', handleTyping);
      socket.off('read:update', handleReadUpdate);
      socket.off('read:update_batch', handleReadUpdateBatch);
    };
  }, [socket, peerId, user?.id, isGroup]);

  const sendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const content = input.trim();
    if (!content || !socket) return;

    // Optimistic: add temp message immediately
    const tempId = 'temp-' + Date.now();
    const optimisticMsg: Message = {
      id: tempId,
      senderId: user!.id,
      receiverId: isGroup ? null : peerId,
      groupId: isGroup ? peerId : null,
      content,
      type: 'text',
      isRecalled: false,
      replyToId: replyTo?.id || null,
      replyTo: replyTo ? { id: replyTo.id, content: replyTo.content, type: replyTo.type, sender: replyTo.sender } : null,
      createdAt: new Date().toISOString(),
      sender: { id: user!.id, username: user!.username, nickname: user!.nickname || user!.username, avatar: user!.avatar || '' },
    };
    setMessages(prev => [...prev, optimisticMsg]);

    socket.emit('message:send', {
      ...(isGroup ? { groupId: peerId } : { receiverId: peerId }),
      content,
      type: 'text',
      replyToId: replyTo?.id || undefined,
    }, (res: any) => {
      if (res?.error) {
        toast(res.error, 'error');
        // Mark as failed
        setMessages(prev => prev.map(m => m.id === tempId ? { ...m, content: m.content + ' ❌' } : m));
      } else if (res?.ok && res.message) {
        // Replace temp with real message
        setMessages(prev => prev.map(m => m.id === tempId ? { ...res.message, sender: optimisticMsg.sender } : m));
      }
    });

    setInput('');
    setReplyTo(null);
    inputRef.current?.focus();
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleTyping = () => {
    if (!socket || isGroup) return;
    socket.emit('typing:start', { receiverId: peerId });
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      socket.emit('typing:stop', { receiverId: peerId });
    }, 2000);
  };

  const recallMessage = async (msgId: string) => {
    try {
      await api('PUT', `/api/messages/${msgId}/recall`);
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, isRecalled: true, content: '' } : m));
      toast('已撤回', 'success');
    } catch (e: any) { toast(e.message || '撤回失败', 'error'); }
  };

  const getPeerName = () => {
    if (isGroup) return liveGroupName || '群聊';
    if (!peer) return '';
    return peer.nickname || peer.username;
  };

  const getSenderDisplayName = (msg: Message) => groupAliases[msg.senderId] || msg.sender.nickname || msg.sender.username;
  const getSenderAvatar = (msg: Message) => {
    if (isGroup) return msg.sender.avatar;
    if (msg.senderId === peerId) return peer?.avatar || msg.sender.avatar;
    return msg.sender.avatar;
  };

  // Voice recording (via useAudioRecorder hook)
  const stopRecordingRef = useRef(false); // 防止重复 stop

  const startRecording = async () => {
    try {
      await startRecord();
      setRecording(true);
      setRecordingDuration(0);
      stopRecordingRef.current = false;
      recordTimerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
    } catch {
      toast('无法访问麦克风，请检查权限或确保在安全协议(HTTPS)下运行', 'error');
    }
  };

  const cancelRecording = async () => {
    if (recordTimerRef.current) clearInterval(recordTimerRef.current);
    recordTimerRef.current = null;
    stopRecordingRef.current = false;
    setRecording(false);
    setRecordingDuration(0);
    await stopRecord().catch(() => {});
  };

  // 监听录音时长：60秒自动停止
  useEffect(() => {
    if (recordingDuration >= 60 && recording) {
      handleStopRecording();
    }
  }, [recordingDuration, recording]);

  const handleStopRecording = async () => {
    // 防止重复调用
    if (stopRecordingRef.current) return;
    stopRecordingRef.current = true;

    if (recordTimerRef.current) clearInterval(recordTimerRef.current);

    // 最短1秒检查
    if (recordingDuration < 1) {
      await stopRecord().catch(() => {});
      setRecording(false);
      setRecordingDuration(0);
      toast('录音时间太短', 'error');
      return;
    }

    setRecording(false);
    setRecordingDuration(0);
    try {
      if (is5Plus()) {
        const path = await stopRecordPath();
        await sendPlusPath(path, '/api/upload/voice', 'voice');
        return;
      }

      const file = await stopRecord();
      const base = getServerUrl();
      const token = localStorage.getItem('echo-token');
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(base + '/api/upload/voice', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      // 乐观更新
      if (socket && data.url) {
        const tempId = 'temp-voice-' + Date.now();
        const optimisticMsg: Message = {
          id: tempId,
          senderId: user!.id,
          receiverId: isGroup ? null : peerId,
          groupId: isGroup ? peerId : null,
          content: data.url,
          type: 'voice',
          isRecalled: false,
          replyToId: replyTo?.id || null,
          replyTo: replyTo ? { id: replyTo.id, content: replyTo.content, type: replyTo.type, sender: replyTo.sender } : null,
          createdAt: new Date().toISOString(),
          sender: { id: user!.id, username: user!.username, nickname: user!.nickname || user!.username, avatar: user!.avatar || '' },
        };
        setMessages(prev => [...prev, optimisticMsg]);
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);

        socket.emit('message:send', {
          ...(isGroup ? { groupId: peerId } : { receiverId: peerId }),
          content: data.url,
          type: 'voice',
          replyToId: replyTo?.id || undefined,
        }, (res: any) => {
          if (res?.error) {
            toast(res.error, 'error');
            setMessages(prev => prev.filter(m => m.id !== tempId));
          } else if (res?.ok && res.message) {
            setMessages(prev => prev.map(m => m.id === tempId ? { ...res.message, sender: optimisticMsg.sender } : m));
          }
        });
      }
      setReplyTo(null);
    } catch (e: any) {
      toast('语音发送失败', 'error');
    }
  };

  // Cleanup on unmount: stop recording if active
  useEffect(() => {
    return () => {
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      if (msgLongPressRef.current) clearTimeout(msgLongPressRef.current);
      if (emojiLongPressRef.current) clearTimeout(emojiLongPressRef.current);
      if (autoCollapseRef.current) clearTimeout(autoCollapseRef.current);
      if (recorderActive) {
        stopRecord().catch(() => {});
      }
    };
  }, [recorderActive, stopRecord]);

  // Chat background
  const uploadBgFile = async (file: File) => {
    try {
      const url = await uploadAndGetUrl(file);
      setChatBg(url);
      saveChatBg(realPeerId, url);
      setShowBgPicker(false);
      toast('背景已更新', 'success');
    } catch (e: any) { toast(e.message || '上传失败', 'error'); }
  };

  const setBgUrl = () => {
    const url = bgUrlInput.trim();
    setChatBg(url);
    saveChatBg(realPeerId, url);
    setShowBgPicker(false);
  };

  // Delayed message
  const scheduleDelayed = async () => {
    if (!scheduleContent.trim() || !scheduleTime) return;
    try {
      await api('POST', '/api/delayed', {
        ...(isGroup ? { groupId: peerId } : { receiverId: peerId }),
        content: scheduleContent.trim(),
        sendAt: new Date(scheduleTime).toISOString(),
      });
      setScheduleContent('');
      setScheduleTime('');
      setActivePanel(null);
      toast('定时消息已设置', 'success');
    } catch (e: any) { toast(e.message || '设置失败', 'error'); }
  };

  useEffect(() => {
    setChatBg(getChatBg(realPeerId));
    setShowBgPicker(false);
  }, [realPeerId, getChatBg]);

  // Effective background: per-chat > global chat bg
  const effectiveBg = chatBg || getBg('chat');

  const formatMsgTime = (iso: string) => {
    return new Date(iso).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  };

  const formatTimeDivider = (iso: string) => {
    const date = new Date(iso);
    const now = new Date();
    const sameDay = date.toDateString() === now.toDateString();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const prefix = sameDay
      ? '今天'
      : date.toDateString() === yesterday.toDateString()
        ? '昨天'
        : date.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'short' });
    return `${prefix} ${date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`;
  };

  const shouldShowTimeDivider = (msg: Message, index: number) => {
    if (index === 0) return true;
    const prev = messages[index - 1];
    const currentTime = new Date(msg.createdAt).getTime();
    const previousTime = new Date(prev.createdAt).getTime();
    const crossDay = new Date(msg.createdAt).toDateString() !== new Date(prev.createdAt).toDateString();
    return crossDay || currentTime - previousTime >= 10 * 60 * 1000;
  };

  const isRead = (msg: Message) => {
    // Symmetric: both users must have receipts enabled
    if (!readReceiptOn) return false;
    if (peer?.readReceiptsEnabled === false) return false;
    return msg.readReceipts?.some(r => r.userId === peerId);
  };

  // Swipe gestures (mobile) — must be before early return (Hook rules)
  const chatSwipeRef = useRef({ sx: 0, sy: 0, active: false });
  const chatGestureLocked = !!(
    activePanel
    || recording
    || petOpen
    || clearConfirmOpen
    || showBgPicker
    || emojiPreview
    || msgContextMenu
    || showPersonalOrbit
    || showGroupOrbit
    || showShootMenu
    || petDraggingRef.current
  );

  if (!peerId) {
    return (
      <div className="flex h-full items-center justify-center text-gray-400 dark:text-gray-500">
        <p className="text-sm">搜索 Echo ID 开始聊天</p>
      </div>
    );
  }
  const handleChatTouchStart = (e: React.TouchEvent) => {
    if (chatGestureLocked || (e.target as HTMLElement).closest('[data-chat-gesture-lock]')) {
      chatSwipeRef.current.active = false;
      return;
    }
    chatSwipeRef.current = { sx: e.touches[0].clientX, sy: e.touches[0].clientY, active: true };
  };
  const handleChatTouchEnd = (e: React.TouchEvent) => {
    if (!chatSwipeRef.current.active || chatGestureLocked) return;
    chatSwipeRef.current.active = false;
    const dx = e.changedTouches[0].clientX - chatSwipeRef.current.sx;
    const dy = Math.abs(e.changedTouches[0].clientY - chatSwipeRef.current.sy);
    if (Math.abs(dx) < 50 || Math.abs(dx) < dy) return;
    e.stopPropagation();
    if (dx > 50 && onBack) {
      onBack();
    } else if (dx < -50) {
      if (isGroup) setShowGroupOrbit(true);
      else if (peer) setShowPersonalOrbit(true);
    }
  };

  const handleEmojiTouchStart = (e: React.TouchEvent) => {
    e.stopPropagation();
    if (emojiManageMode && emojiExpanded) return;
    emojiSwipeRef.current = { sx: e.touches[0].clientX, sy: e.touches[0].clientY, active: true };
    setEmojiDragging(true);
    setEmojiDragX(0);
  };

  const handleEmojiTouchMove = (e: React.TouchEvent) => {
    e.stopPropagation();
    if (emojiManageMode && emojiExpanded) return;
    if (!emojiSwipeRef.current.active) return;
    const dx = e.touches[0].clientX - emojiSwipeRef.current.sx;
    const dy = Math.abs(e.touches[0].clientY - emojiSwipeRef.current.sy);
    if (Math.abs(dx) < dy) return;
    const atStart = emojiPage === 0 && dx > 0;
    const atEnd = emojiPage === emojiMaxPage && dx < 0;
    e.preventDefault();
    setEmojiDragX((atStart || atEnd) ? dx * 0.18 : dx * 0.68);
  };

  const handleEmojiTouchEnd = (e: React.TouchEvent) => {
    e.stopPropagation();
    if (emojiManageMode && emojiExpanded) return;
    const dx = e.changedTouches[0].clientX - emojiSwipeRef.current.sx;
    const dy = Math.abs(e.changedTouches[0].clientY - emojiSwipeRef.current.sy);
    emojiSwipeRef.current.active = false;
    setEmojiDragging(false);
    setEmojiDragX(0);
    if (Math.abs(dx) < 68 || Math.abs(dx) < dy) return;
    const direction = dx < 0 ? 1 : -1;
    setEmojiPageDirection(direction);
    setEmojiPage(page => Math.max(0, Math.min(emojiMaxPage, page + direction)));
  };

  const toggleEmojiSelected = (id: string) => {
    setSelectedEmojis(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const sendEmojiImage = (emoji: { id: string; imageUrl: string; name: string }) => {
    if (emojiManageMode) {
      toggleEmojiSelected(emoji.id);
      return;
    }
    if (!socket) return;
    const tempId = 'temp-' + Date.now();
    const optimisticMsg: Message = {
      id: tempId,
      senderId: user!.id,
      receiverId: isGroup ? null : peerId,
      groupId: isGroup ? peerId : null,
      content: emoji.imageUrl,
      type: 'emoji',
      isRecalled: false,
      replyToId: replyTo?.id || null,
      replyTo: replyTo ? { id: replyTo.id, content: replyTo.content, type: replyTo.type, sender: replyTo.sender } : null,
      createdAt: new Date().toISOString(),
      sender: { id: user!.id, username: user!.username, nickname: user!.nickname || user!.username, avatar: user!.avatar || '' },
    };
    setMessages(prev => [...prev, optimisticMsg]);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    socket.emit('message:send', {
      ...(isGroup ? { groupId: peerId } : { receiverId: peerId }),
      content: emoji.imageUrl, type: 'emoji',
      replyToId: replyTo?.id || undefined,
    }, (res: any) => {
      if (res?.error) {
        toast(ERROR_MAP[res.error] || res.error, 'error');
        setMessages(prev => prev.filter(m => m.id !== tempId));
      } else if (res?.ok && res.message) {
        setMessages(prev => prev.map(m => m.id === tempId ? { ...res.message, sender: optimisticMsg.sender } : m));
      }
    });
    setReplyTo(null);
  };

  const shootMenu = showShootMenu ? createPortal(
    <div className="fixed inset-0 z-[9997]" onClick={() => setShowShootMenu(false)}>
      <div
        className="absolute bottom-0 left-0 right-0 rounded-t-2xl border-t border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-800"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => {
            setShowShootMenu(false);
            if (is5Plus()) capturePhoto5Plus();
            else shootPhotoRef.current?.click();
          }}
          className="flex w-full items-center justify-center border-b border-gray-100 px-4 py-4 text-base text-gray-800 dark:border-gray-700 dark:text-gray-100"
        >
          拍照
        </button>
        <button
          type="button"
          onClick={() => {
            setShowShootMenu(false);
            if (is5Plus()) captureVideo5Plus();
            else shootVideoRef.current?.click();
          }}
          className="flex w-full items-center justify-center border-b border-gray-100 px-4 py-4 text-base text-gray-800 dark:border-gray-700 dark:text-gray-100"
        >
          拍视频
        </button>
        <button
          type="button"
          onClick={() => setShowShootMenu(false)}
          className="mt-2 flex w-full items-center justify-center px-4 py-4 text-base text-gray-500 dark:text-gray-300"
        >
          取消
        </button>
      </div>
    </div>,
    document.body,
  ) : null;

  return (
    <div className="app-no-callout flex h-full flex-col relative overflow-hidden"
      onTouchStart={handleChatTouchStart}
      onTouchEnd={handleChatTouchEnd}
      onContextMenu={(e) => e.preventDefault()}>
      {shootMenu}
      {!isGroup && pet?.status === 'active' && (
        <motion.div
          drag
          dragMomentum={false}
          dragElastic={0.05}
          dragSnapToOrigin
          data-chat-gesture-lock
          onTouchStart={(e) => { e.stopPropagation(); petDraggingRef.current = true; }}
          onTouchEnd={(e) => { e.stopPropagation(); petDraggingRef.current = false; }}
          onDragStart={() => { petMovedRef.current = true; }}
          whileDrag={{ scale: 1.08 }}
          onDragEnd={(_, info) => {
            setPetSide(info.point.x < window.innerWidth / 2 ? 'left' : 'right');
            setPetY(Math.max(72, Math.min(window.innerHeight - 230, info.point.y - 40)));
            window.setTimeout(() => { petMovedRef.current = false; }, 120);
          }}
          animate={{
            top: petY,
            left: petSide === 'left' ? 10 : 'auto',
            right: petSide === 'right' ? 10 : 'auto',
            y: petAction === 'laugh' ? [0, -14, 0, -10, 0] : petAction === 'poke' ? [0, -10, 2, -5, 0] : petAction === 'feed' ? [0, -6, 0] : [0, -3, 0],
            rotate: petAction === 'laugh' ? [0, -8, 8, -5, 0] : petAction === 'poke' ? [0, -10, 8, 0] : [0, 2, -2, 0],
          }}
          transition={{ type: 'spring', stiffness: 230, damping: 18 }}
          className="absolute z-30 flex w-20 touch-none select-none flex-col items-center"
        >
          <button
            type="button"
            onClick={() => { if (!petDraggingRef.current && !petMovedRef.current) { setPetTab('home'); setPetOpen(true); } }}
            className={`relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-[24px] border-2 border-white bg-gradient-to-br ${petStage(pet.level).color} text-xl font-bold text-white shadow-xl ${petStage(pet.level).glow}`}
            title="戳一戳宠物"
          >
            {pet.avatar ? <img src={assetUrl(pet.avatar)} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" /> : <PawPrint size={26} />}
            <span className="absolute bottom-1 right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-white/95 px-1 text-[10px] font-bold text-amber-600 shadow">
              {petStatusMark(pet, petAction)}
            </span>
          </button>
        </motion.div>
      )}
      {/* Chat background layer with GPU acceleration */}
      {effectiveBg && (
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-45 z-0"
          style={{ backgroundImage: `url(${assetUrl(effectiveBg)})`, willChange: 'transform', transform: 'translateZ(0)' }}
        />
      )}

      {/* Header — mobile back button, partner info, no palette */}
      <header className="flex items-center gap-3 border-b border-gray-100 px-3 py-2.5 dark:border-gray-800 relative z-10 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm shrink-0">
        {onBack && (
          <button onClick={onBack} className="rounded-xl p-1.5 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 shrink-0">
            ←
          </button>
        )}
        <button type="button" onClick={() => isGroup && setShowGroupOrbit(true)} className={`flex h-9 w-9 items-center justify-center rounded-xl text-base font-bold text-white shrink-0 ${
          isGroup ? 'bg-emerald-500' : 'bg-primary-500'
        }`}>
          {isGroup ? (liveGroupAvatar ? <img src={assetUrl(liveGroupAvatar)} alt="" className="h-full w-full rounded-xl object-cover" /> : (liveGroupName?.[0]?.toUpperCase() || 'G')) : (
            peer?.avatar ? <img src={assetUrl(peer.avatar)} alt="" onError={(e) => { e.currentTarget.style.display = 'none'; }} className="h-full w-full rounded-xl object-cover" /> :
            getPeerName()[0]?.toUpperCase() || '?'
          )}
        </button>
        <button type="button" onClick={() => isGroup && setShowGroupOrbit(true)} className="flex-1 min-w-0 text-left">
          <h2 className="text-lg font-semibold leading-tight text-gray-900 dark:text-gray-100 truncate">{getPeerName()}</h2>
          <p className="text-sm text-gray-500">
            {isGroup ? `${groupMemberCount} 人 · 查看群资料` :
             typingUser ? <span className="text-primary-500">正在输入...</span> :
             isUserOnline(peerId) ? <span className="text-green-500">在线</span> : '离线'}
          </p>
        </button>
        {!isGroup && pet?.status !== 'active' && (
          <button onClick={() => setPetOpen(true)}
            className="shrink-0 rounded-lg p-1.5 text-amber-500 transition-colors hover:bg-amber-50 dark:hover:bg-amber-900/20"
            title={'\u5171\u540c\u5ba0\u7269'}>
            {pet?.avatar ? <img src={assetUrl(pet.avatar)} alt="" className="h-[18px] w-[18px] rounded-md object-cover" /> : <PawPrint size={18} />}
          </button>
        )}
        {!isGroup && (
          <button onClick={() => startCall(peerId, { name: peer?.nickname || peer?.username || '对方', avatar: peer?.avatar || '' })}
            className="shrink-0 rounded-lg p-1.5 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            title="语音通话">
            <Phone size={18} />
          </button>
        )}
        {!isGroup && (
          <button onClick={toggleReadReceipt} className={`shrink-0 rounded-lg p-1.5 text-xs ${readReceiptOn ? 'text-primary-500' : 'text-gray-300'}`}
            title={readReceiptOn ? '已读回执：开' : '已读回执：关'}
          >{readReceiptOn ? '✓✓' : '✓'}</button>
        )}
        <button
          onClick={() => setClearConfirmOpen(true)}
          className="shrink-0 rounded-lg p-1.5 text-xs text-gray-400 transition-colors hover:text-red-500"
          title="清空聊天记录"
        >
          <Trash2 size={14} />
        </button>
      </header>

      {/* Message area */}
      <div
        ref={scrollContainerRef}
        className={`flex-1 overflow-y-auto overflow-x-hidden relative z-10 ${effectiveBg ? 'bg-transparent' : 'bg-gray-50 dark:bg-gray-950'}`}
        style={effectiveBg ? { backgroundImage: 'none' } : undefined}
        onClick={() => closePanels()}
      >

        <div ref={topSentinelRef} className="h-1" />
        {older && <div className="py-2 text-center"><span className="text-xs text-gray-400">加载更多消息...</span></div>}
        {loading ? (
          <div className="flex h-full items-center justify-center text-sm text-gray-400">加载中...</div>
        ) : messages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-gray-400" onClick={closePanels}>
            <div className="text-center">
              <p className="text-4xl mb-3">💬</p>
              <p>{isGroup ? '群聊中，发送第一条消息吧' : '发送第一条消息吧'}</p>
            </div>
          </div>
        ) : (
          <div className="px-3 py-3 space-y-2 relative z-[1] min-h-full">
            {messages.map((msg, index) => {
              const isMine = msg.senderId === user?.id;
              const isMediaMessage = msg.type === 'image' || msg.type === 'video';
              const timeDivider = shouldShowTimeDivider(msg, index) ? (
                <div key={`${msg.id}-time`} className="my-4 flex justify-center">
                  <span className="rounded-full bg-black/5 px-3 py-1 text-[11px] font-medium text-gray-400 dark:bg-white/10 dark:text-gray-500">
                    {formatTimeDivider(msg.createdAt)}
                  </span>
                </div>
              ) : null;
              const withTimeDivider = (node: ReactNode) => (
                <>
                  {timeDivider}
                  {node}
                </>
              );

              if (msg.type === 'pet') {
                return withTimeDivider(
                  <div key={msg.id} className="flex items-end gap-1.5 ml-1 msg-in">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-amber-100 text-sm font-bold text-amber-600 dark:bg-amber-900/30 dark:text-amber-300">
                      {pet?.avatar
                        ? <img src={assetUrl(pet.avatar)} alt="" className="h-full w-full object-cover" />
                        : (pet?.name || 'Echo Pet')[0]?.toUpperCase()}
                    </div>
                    <div className="min-w-0 max-w-[80%]">
                      <p className="mb-0.5 ml-1 text-[10px] text-amber-500">{pet?.name || 'Echo Pet'}</p>
                      <div className="rounded-2xl rounded-bl-md bg-white/95 px-3.5 py-2 text-sm text-gray-800 shadow-sm ring-1 ring-black/[0.03] dark:bg-gray-800/95 dark:text-gray-200 dark:ring-white/[0.04]">
                        {msg.content}
                      </div>
                    </div>
                  </div>
                );
              }

              if (msg.type === 'pet-adopt') {
                let event = 'requested';
                try { event = JSON.parse(msg.content).event || event; } catch { /* historical fallback */ }
                const pendingForMe = event === 'requested' && msg.senderId !== user?.id && pet?.status === 'pending' && pet.pendingForMe;
                const text = event === 'adopted'
                  ? '共同宠物已经领养成功'
                  : event === 'rejected'
                    ? '共同领养邀请已被拒绝'
                    : msg.senderId === user?.id ? '你发起了共同领养邀请' : '对方申请共同领养宠物';
                return withTimeDivider(
                  <div key={msg.id} className="mx-auto my-2 w-[92%] rounded-2xl border border-amber-200 bg-amber-50/95 p-3 text-amber-800 shadow-sm dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
                    <p className="text-xs font-semibold">共同宠物</p>
                    <p className="mt-1 text-sm">{text}</p>
                    {pendingForMe && (
                      <div className="mt-3 flex gap-2">
                        <button disabled={petBusy} onClick={adoptPet} className="rounded-xl bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">允许</button>
                        <button disabled={petBusy} onClick={rejectPet} className="rounded-xl bg-white px-3 py-1.5 text-xs font-semibold text-gray-500 disabled:opacity-50 dark:bg-gray-900 dark:text-gray-300">拒绝</button>
                      </div>
                    )}
                  </div>
                );
              }

              return withTimeDivider(
                <div
                  key={msg.id}
                  id={`message-${msg.id}`}
                  className={`flex flex-col rounded-2xl transition-colors duration-700 msg-in ${highlightedMessageId === msg.id ? 'bg-yellow-200/70 py-1 ring-2 ring-yellow-300 dark:bg-yellow-700/30 dark:ring-yellow-600' : ''} ${isMine ? 'items-end mr-1' : 'items-start ml-1'}`}
                >
                  {msg.replyTo && !msg.isRecalled && (
                    <div className={`mb-1 max-w-[75%] rounded-lg bg-gray-200/60 px-3 py-1.5 text-xs text-gray-500 dark:bg-gray-800 ${isMine ? 'text-right' : ''}`}>
                      <span className="font-medium text-primary-500">{msg.replyTo.sender.nickname || msg.replyTo.sender.username}:</span>{' '}
                      {msg.replyTo.type === 'emoji' ? '[表情]' : msg.replyTo.type === 'image' ? '[图片]' : msg.replyTo.type === 'video' ? '[视频]' : msg.replyTo.type === 'voice' ? '[语音]' : msg.replyTo.type === 'call' ? (msg.replyTo.content || '[通话]') : msg.replyTo.content.slice(0, 30)}
                    </div>
                  )}

                  <div className={`flex items-end gap-1.5 ${isMine ? 'max-w-[80%]' : 'max-w-[80%]'}`}>
                    {/* Reply button — left side for self messages */}
                    {isMine && !msg.isRecalled && (
                      <button
                        onClick={() => { setReplyTo(msg); inputRef.current?.focus(); }}
                        className="hidden rounded-full bg-gray-200/80 w-6 h-6 shrink-0 items-center justify-center text-[10px] text-gray-500 hover:bg-gray-300 group-hover:inline-flex dark:bg-gray-700 dark:text-gray-400"
                      >↩</button>
                    )}

                    {!isMine && !msg.isRecalled && (
                      <div
                        data-chat-gesture-lock
                        onTouchStart={(e) => {
                          if (!isGroup) return;
                          e.stopPropagation();
                          mentionLongPressRef.current = setTimeout(() => {
                            const name = getSenderDisplayName(msg);
                            setInput(prev => `${prev}${prev && !prev.endsWith(' ') ? ' ' : ''}@${name} `);
                            inputRef.current?.focus();
                            navigator.vibrate?.(20);
                          }, 500);
                        }}
                        onTouchEnd={(e) => { e.stopPropagation(); if (mentionLongPressRef.current) clearTimeout(mentionLongPressRef.current); mentionLongPressRef.current = null; }}
                        onTouchMove={() => { if (mentionLongPressRef.current) clearTimeout(mentionLongPressRef.current); mentionLongPressRef.current = null; }}
                        className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-primary-100 text-sm font-bold text-primary-500 dark:bg-primary-900/30"
                        title={isGroup ? '长按艾特' : undefined}
                      >
                        {getSenderAvatar(msg)
                          ? <img src={assetUrl(getSenderAvatar(msg)!)} alt="" className="h-full w-full object-cover" />
                          : getSenderDisplayName(msg)[0]?.toUpperCase() || '?'}
                      </div>
                    )}
                    <div className="min-w-0">
                      {isGroup && !isMine && !msg.isRecalled && (
                        <p className="mb-0.5 text-[10px] text-primary-400 ml-1">
                          {getSenderDisplayName(msg)}
                        </p>
                      )}

                      <div
                        className={`message-media group relative text-sm shadow-sm ${
                          msg.isRecalled
                            ? 'dm-collapse rounded-2xl px-3.5 py-2'
                            : isMine
                              ? `${isMediaMessage ? 'rounded-[18px] p-1' : 'rounded-2xl rounded-br-md px-3.5 py-2'} bg-primary-500 text-white shadow-primary-500/10`
                              : `${isMediaMessage ? 'rounded-[18px] p-1' : 'rounded-2xl rounded-bl-md px-3.5 py-2'} bg-white/95 text-gray-800 ring-1 ring-black/[0.03] dark:bg-gray-800/95 dark:text-gray-200 dark:ring-white/[0.04]`
                        }`}
                        onContextMenu={(e) => e.preventDefault()}
                        onTouchStart={(e) => {
                          if (msg.isRecalled) return;
                          e.preventDefault();
                          msgLongPressRef.current = setTimeout(() => {
                            setMsgContextMenu({ msgId: msg.id, x: e.touches[0].clientX, y: e.touches[0].clientY, isMine, createdAt: msg.createdAt, type: msg.type, content: msg.content });
                          }, 500);
                        }}
                        onTouchMove={() => { if (msgLongPressRef.current) { clearTimeout(msgLongPressRef.current); msgLongPressRef.current = null; } }}
                        onTouchEnd={() => { if (msgLongPressRef.current) { clearTimeout(msgLongPressRef.current); msgLongPressRef.current = null; } }}
                      >
                        {msg.isRecalled ? (
                          <span className="text-xs text-gray-400 dark:text-gray-500 italic">
                            {isMine ? '你撤回了一条消息' : '对方撤回了一条消息'}
                          </span>
                        ) : (
                          <>
                            {msg.type === 'emoji' ? (
                              <button
                                type="button"
                                onClick={() => collectAsEmoji(msg.content)}
                                className="rounded-2xl bg-transparent p-0"
                                title="收藏"
                              >
                                <img
                                  src={assetUrl(msg.content)}
                                  alt=""
                                  draggable={false}
                                  onContextMenu={(e) => e.preventDefault()}
                                  onDragStart={(e) => e.preventDefault()}
                                  className="max-h-[150px] max-w-[150px] object-contain"
                                  loading="lazy"
                                  onLoad={() => setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)}
                                />
                              </button>
                            ) : msg.type === 'image' ? (
                              <div className="relative">
                                <img src={assetUrl(msg.content)} alt="" draggable={false} onContextMenu={(e) => e.preventDefault()} onDragStart={(e) => e.preventDefault()} onClick={() => setEmojiPreview(assetUrl(msg.content))} className="max-h-[260px] max-w-[min(72vw,280px)] cursor-pointer rounded-2xl object-contain" loading="lazy" onLoad={() => setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)} />
                                <button
                                  onClick={() => collectAsEmoji(msg.content)}
                                  className="absolute -bottom-5 right-0 hidden rounded bg-gray-700 px-1.5 py-0.5 text-[10px] text-white group-hover:block hover:bg-gray-600"
                                  title="收藏为表情"
                                >
                                  ⭐收藏
                                </button>
                              </div>
                            ) : msg.type === 'video' ? (
                              <video
                                src={assetUrl(msg.content)}
                                controls
                                playsInline
                                draggable={false}
                                preload="metadata"
                                className="max-w-56 rounded-lg"
                              />
                            ) : msg.type === 'voice' ? (
                              <VoiceBubble src={assetUrl(msg.content)} />
                            ) : msg.type === 'call' ? (
                              <span className="text-xs text-gray-500 dark:text-gray-300">{msg.content || '[通话]'}</span>
                            ) : (
                              <span className="whitespace-pre-wrap break-words overflow-wrap-anywhere">{msg.content}</span>
                            )}

                            {isMine && !msg.isRecalled && (Date.now() - new Date(msg.createdAt).getTime() < 120000) && (
                              <button
                                onClick={() => recallMessage(msg.id)}
                                className="absolute -top-6 right-0 hidden rounded bg-gray-800 px-2 py-0.5 text-[10px] text-white group-hover:block"
                              >
                                撤回
                              </button>
                            )}
                          </>
                        )}

                      </div>
                      <div className={`mt-1 flex items-center gap-1 px-1 text-[10px] leading-none text-gray-400 ${isMine ? 'justify-end' : 'justify-start'}`}>
                        <span>{formatMsgTime(msg.createdAt)}</span>
                        {isMine && !msg.isRecalled && !isGroup && isRead(msg) && <span>已读</span>}
                      </div>
                    </div>

                    {/* Reply button — right side for peer messages */}
                    {!isMine && !msg.isRecalled && (
                      <button
                        onClick={() => { setReplyTo(msg); inputRef.current?.focus(); }}
                        className="hidden rounded-full bg-gray-200/80 w-6 h-6 shrink-0 items-center justify-center text-[10px] text-gray-500 hover:bg-gray-300 group-hover:inline-flex dark:bg-gray-700 dark:text-gray-400"
                      >↩</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {replyTo && (
        <div className="flex items-center gap-2 border-t border-gray-100 bg-gray-50 px-4 py-2 dark:border-gray-800 dark:bg-gray-900">
          <div className="flex-1 border-l-2 border-primary-400 pl-2 text-xs text-gray-500 dark:text-gray-400">
            <span className="font-medium text-primary-500">{replyTo.sender.nickname || replyTo.sender.username}:</span>{' '}
            {replyTo.type === 'emoji' ? '[表情]' : replyTo.type === 'image' ? '[图片]' : replyTo.type === 'video' ? '[视频]' : replyTo.type === 'voice' ? '[语音]' : replyTo.type === 'call' ? (replyTo.content || '[通话]') : replyTo.content.slice(0, 40)}
          </div>
          <button onClick={() => setReplyTo(null)} className="text-xs text-gray-400 hover:text-gray-600">✕</button>
        </div>
      )}

      {recording && (
        <div
          className="relative z-20 mx-3 mb-2 flex items-center gap-2 rounded-2xl border border-primary-100 bg-white/95 px-3 py-2 shadow-lg shadow-primary-500/10 backdrop-blur dark:border-primary-900/40 dark:bg-gray-900/95"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-500 text-xs font-semibold text-white shadow-sm">
            {recordingDuration}s
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{'\u6b63\u5728\u5f55\u97f3'}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{'\u70b9\u51fb\u53d1\u9001\u6216\u53d6\u6d88'}</p>
          </div>
          <button
            type="button"
            onClick={cancelRecording}
            className="rounded-xl bg-gray-100 px-3 py-1.5 text-sm text-gray-600 dark:bg-gray-800 dark:text-gray-200"
          >
            {'\u53d6\u6d88'}
          </button>
          <button
            type="button"
            onClick={handleStopRecording}
            className="rounded-xl bg-primary-500 px-3 py-1.5 text-sm font-medium text-white shadow-sm"
          >
            {'\u53d1\u9001'}
          </button>
        </div>
      )}

      {activePanel === 'schedule' && (
        <div className="border-t border-gray-100 bg-gray-50 px-4 py-3 dark:border-gray-800 dark:bg-gray-900">
              <div className="grid grid-cols-2 gap-2">
            <span className="text-xs text-gray-500">定时发送:</span>
            <input
              type="datetime-local"
              value={scheduleTime}
              onChange={(e) => setScheduleTime(e.target.value)}
              className="col-span-2 rounded-lg border border-gray-200 px-2 py-2 text-xs dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
            />
            <input
              type="text"
              value={scheduleContent}
              onChange={(e) => setScheduleContent(e.target.value)}
              placeholder="消息内容"
              className="col-span-2 rounded-lg border border-gray-200 px-2 py-2 text-xs dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
            />
            <button onClick={scheduleDelayed} className="rounded-lg bg-primary-500 px-2 py-1 text-xs text-white">确定</button>
            <button onClick={() => setActivePanel(null)} className="rounded-lg px-2 py-1 text-xs text-gray-400">取消</button>
          </div>
        </div>
      )}

      {/* Emoji panel */}
      {activePanel === 'emoji' && (
        <div
          className="border-t border-gray-100 bg-gray-50 px-4 py-3 dark:border-gray-800 dark:bg-gray-900"
          style={{ height: emojiExpanded ? '280px' : '128px', display: 'flex', flexDirection: 'column' }}
          onTouchStart={handleEmojiTouchStart}
          onTouchMove={handleEmojiTouchMove}
          onTouchEnd={handleEmojiTouchEnd}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mb-2 flex shrink-0 items-center justify-between">
            <span className="text-xs text-gray-500 dark:text-gray-400">表情包</span>
            <div className="flex items-center gap-2">
              {emojiManageMode && selectedEmojis.size > 0 && (
                <button
                  onClick={async () => {
                    const ids = Array.from(selectedEmojis);
                    try {
                      await api('DELETE', '/api/emojis/batch', { ids });
                      toast(`已删除 ${ids.length} 个表情`, 'success');
                      setSelectedEmojis(new Set());
                      fetchEmojis(true);
                    } catch { toast('删除失败', 'error'); }
                  }}
                  className="rounded-lg bg-red-500 px-3 py-1 text-xs text-white hover:bg-red-600"
                >
                  删除 ({selectedEmojis.size})
                </button>
              )}
              <button
                onClick={() => {
                  const next = !emojiManageMode;
                  setEmojiManageMode(next);
                  if (next) {
                    setEmojiExpanded(true);
                    setEmojiManageFlash(true);
                    window.setTimeout(() => setEmojiManageFlash(false), 1500);
                  }
                  setSelectedEmojis(new Set());
                }}
                className={`rounded-lg px-3 py-1 text-xs transition-colors ${emojiManageMode ? 'bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300' : 'bg-gray-200 dark:bg-gray-700 text-gray-500 hover:text-primary-500'}`}
              >
                {emojiManageMode ? '完成' : '管理'}
              </button>
              {!emojiManageMode && (
                <label className="cursor-pointer rounded-lg bg-primary-500 px-3 py-1 text-xs text-white hover:bg-primary-600">
                  + 上传
                  <input type="file" multiple accept="image/*,image/gif" className="hidden" onChange={async (e) => {
                    const files = e.target.files;
                    if (files) {
                      let uploaded = 0;
                      for (let i = 0; i < files.length; i++) {
                        try {
                          let uploadFile: File = files[i];
                          let compressOk = true;
                          if (uploadFile.type !== 'image/gif') { [uploadFile, compressOk] = await compressEmoji(files[i]); }
                          if (!compressOk) toast('压缩失败，已使用原图上传', 'info');
                          const base = getServerUrl();
                          const token = localStorage.getItem('echo-token');
                          const fd = new FormData(); fd.append('file', uploadFile);
                          const res = await fetch(base + '/api/upload/chat-image', { method: 'POST', headers: { 'Authorization': `Bearer ${token}` }, body: fd });
                          const data = await res.json();
                          if (res.ok) { await api('POST', '/api/emojis', { imageUrl: data.url, name: 'sticker' }); uploaded++; }
                          else { toast(data.error || '上传失败', 'error'); }
                        } catch (err: any) { toast(err.message || '上传失败', 'error'); }
                      }
                      if (uploaded > 0) {
                        setEmojiPage(0);
                        fetchEmojis(true);
                      }
                      if (uploaded < files.length) toast(`${files.length - uploaded} 个文件上传失败`, 'error');
                    }
                  }} />
                </label>
              )}
              <button
                onClick={() => { setEmojiPage(0); setEmojiExpanded(v => !v); }}
                className="rounded-lg bg-gray-200 px-3 py-1 text-xs text-gray-500 hover:text-primary-500 dark:bg-gray-700"
              >
                {emojiExpanded ? '收起' : '展开'}
              </button>
            </div>
          </div>
          {emojis.length === 0 ? (
            <span className="text-xs text-gray-400">上传表情包图片...</span>
          ) : (
            <div className={emojiManageMode && emojiExpanded ? 'flex-1 overflow-y-auto overflow-x-hidden' : 'flex-1 overflow-hidden'}>
              <AnimatePresence initial={false} mode="popLayout">
              <motion.div
                key={emojiManageMode && emojiExpanded ? 'manage' : `page-${emojiPage}`}
                initial={{ x: emojiPageDirection * 72, opacity: 0.72 }}
                animate={{ x: emojiDragging ? emojiDragX : 0, opacity: 1 }}
                exit={{ x: emojiPageDirection * -72, opacity: 0.72 }}
                transition={emojiDragging
                  ? { duration: 0 }
                  : { type: 'spring', stiffness: 190, damping: 24, mass: 0.9 }}
                className="grid h-full grid-cols-4 gap-2 overflow-y-auto px-0.5 pb-2"
                style={{ gridTemplateRows: emojiExpanded ? 'repeat(auto-fill, minmax(64px, 1fr))' : '1fr' }}
              >
                {(emojiManageMode && emojiExpanded ? emojis : (emojiPages[emojiPage] || [])).map(emoji => {
                  const selected = selectedEmojis.has(emoji.id);
                  return (
                    <div key={emoji.id} className="relative flex items-center justify-center" data-emoji-id={emoji.id}>
                      <img
                        src={assetUrl(emoji.imageUrl)}
                        alt=""
                        draggable={false}
                        loading="lazy"
                        onContextMenu={(e) => e.preventDefault()}
                        onDragStart={(e) => e.preventDefault()}
                        onPointerDown={(e) => {
                          if (!emojiManageMode || !emojiExpanded) return;
                          e.stopPropagation();
                          e.preventDefault();
                          const target = e.currentTarget;
                          const pointerId = e.pointerId;
                          try { target.setPointerCapture?.(pointerId); } catch {}
                          emojiPointerStartRef.current = { x: e.clientX, y: e.clientY };
                          emojiMovedRef.current = false;
                          if (emojiLongPressRef.current) clearTimeout(emojiLongPressRef.current);
                          emojiLongPressRef.current = setTimeout(() => {
                            emojiDragIdRef.current = emoji.id;
                            setEmojiReorderingId(emoji.id);
                            navigator.vibrate?.(20);
                          }, 450);
                        }}
                        onPointerMove={(e) => {
                          if (!emojiManageMode || !emojiExpanded) return;
                          e.stopPropagation();
                          if (!emojiDragIdRef.current) {
                            const dx = Math.abs(e.clientX - emojiPointerStartRef.current.x);
                            const dy = Math.abs(e.clientY - emojiPointerStartRef.current.y);
                            if ((dx > 8 || dy > 8) && emojiLongPressRef.current) {
                              clearTimeout(emojiLongPressRef.current);
                              emojiLongPressRef.current = null;
                            }
                            return;
                          }
                          e.preventDefault();
                          const target = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-emoji-id]') as HTMLElement | null;
                          const toId = target?.dataset.emojiId;
                          if (toId && toId !== emojiDragIdRef.current) {
                            moveEmojiById(emojiDragIdRef.current, toId);
                            emojiMovedRef.current = true;
                          }
                        }}
                        onPointerUp={(e) => {
                          if (emojiManageMode && emojiExpanded) {
                            e.stopPropagation();
                            if (emojiLongPressRef.current) clearTimeout(emojiLongPressRef.current);
                            emojiLongPressRef.current = null;
                            try { (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId); } catch {}
                            if (!emojiMovedRef.current) toggleEmojiSelected(emoji.id);
                            if (emojiMovedRef.current) api('PUT', '/api/emojis/order', { ids: emojisRef.current.map(item => item.id) }).catch(() => {});
                            emojiDragIdRef.current = null;
                            emojiMovedRef.current = false;
                            setEmojiReorderingId(null);
                          }
                        }}
                        onPointerCancel={() => {
                          if (emojiLongPressRef.current) clearTimeout(emojiLongPressRef.current);
                          emojiLongPressRef.current = null;
                          emojiDragIdRef.current = null;
                          emojiMovedRef.current = false;
                          setEmojiReorderingId(null);
                        }}
                        className={(emojiManageMode && selected ? `ring-1 ${selectedRing} ` : emojiManageMode && emojiManageFlash ? `ring-1 ${selectedRing} animate-pulse ` : 'ring-1 ring-transparent ') + (emojiManageMode && emojiExpanded ? 'touch-none select-none ' : '') + (emojiReorderingId === emoji.id ? 'scale-95 opacity-70 ' : '') + 'h-16 w-16 min-w-[64px] min-h-[64px] cursor-pointer rounded-xl object-contain transition-all hover:opacity-80'}
                        onClick={() => {
                          if (emojiManageMode && emojiExpanded) return;
                          sendEmojiImage(emoji);
                        }}
                      />
                    </div>
                  );
                })}
              </motion.div>
              </AnimatePresence>
            </div>
          )}
        </div>
      )}

      <motion.form layout onSubmit={sendMessage} transition={{ type: 'spring', stiffness: 200, damping: 25 }}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        className="relative flex w-full min-w-0 items-end gap-2 border-t border-gray-100 bg-white/95 px-3 py-2.5 shadow-[0_-8px_24px_rgba(15,23,42,0.04)] backdrop-blur-xl dark:border-zinc-800/70 dark:bg-zinc-900/90 group/input"
        style={{ minHeight: '62px', paddingBottom: 'calc(0.65rem + env(safe-area-inset-bottom, 0px))' }}>
        {/* Toggle button */}
        <button
          type="button"
          onClick={() => { setActivePanel(activePanel === 'more' ? null : 'more'); setShowShootMenu(false); }}
          className={`h-10 w-10 rounded-xl p-2 shrink-0 transition-all duration-300 ${activePanel === 'more' ? 'bg-primary-50 text-primary-500 dark:bg-primary-900/20' : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800'}`}
          title={activePanel === 'more' ? '收起' : '展开'}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            style={{ transform: activePanel === 'more' ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.3s ease' }}>
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>

        {/* 左侧功能按钮组 */}
        <AnimatePresence initial={false}>
          {activePanel === 'more' && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 'auto', opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              className="flex items-center gap-1 shrink-0 origin-left">
              {/* 相册：图片+视频 */}
              <button
                type="button"
                onClick={() => albumFileInputRef.current?.click()}
                className="flex items-center justify-center w-9 h-9 rounded-lg text-gray-400 hover:text-primary-500 transition-colors"
                title="相册"
              >
                <Image size={18} strokeWidth={1.5} />
              </button>
              <input
                ref={albumFileInputRef}
                type="file"
                accept="image/*,video/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  if (f.type.startsWith('image/')) sendImage(f);
                  else if (f.type.startsWith('video/')) sendVideo(f);
                  e.target.value = '';
                }}
              />
              {/* 拍摄：弹子菜单 */}
              {/* 定时 */}
              <button
                type="button"
                onClick={() => setActivePanel('schedule')}
                className="flex items-center justify-center w-9 h-9 rounded-lg transition-colors text-gray-400 hover:text-primary-500"
                title="定时发送"
              >
                <Clock size={18} strokeWidth={1.5} />
              </button>
              {/* 表情 */}
              <button
                type="button"
                onClick={() => { setEmojiPage(0); setActivePanel('emoji'); }}
                className="flex items-center justify-center w-9 h-9 rounded-lg transition-colors text-gray-400 hover:text-primary-500"
                title="表情包"
              >
                <Smile size={18} strokeWidth={1.5} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 二合一流体输入框（光球 + 麦克风） */}
        <div className="relative flex min-w-0 flex-1 items-center">
          <FluidInput
            ref={inputRef as any}
            value={input}
            isRecording={recording}
            micHint={recording ? '录音中' : '录音'}
            onMicClick={() => {
              if (recording) return;
              startRecording();
            }}
            onChange={(e) => {
              setInput(e.target.value);
              handleTyping();
              if (inkDrops.length < 3) {
                const id = dropCounter.current++;
                setInkDrops(prev => [...prev, { id, x: 20 + Math.random() * 60 }]);
                setTimeout(() => setInkDrops(prev => prev.filter(d => d.id !== id)), 800);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            rows={1}
            onFocus={() => {
              setActivePanel(null);
              setShowShootMenu(false);
              window.setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }), 120);
              window.setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'auto', block: 'end' }), 320);
            }}
            onInput={(e) => {
              const el = e.currentTarget;
              el.style.height = 'auto';
              el.style.height = Math.min(el.scrollHeight, 120) + 'px';
            }}
            style={{ maxHeight: '120px' }}
          />
        </div>

        {/* 发送按钮 */}
        <button
          type="submit"
          disabled={!input.trim()}
          className="shrink-0 flex h-11 items-center gap-1.5 rounded-2xl bg-primary-500 px-4 text-sm font-bold text-white shadow-sm shadow-primary-500/25 transition-all hover:bg-primary-600 active:scale-95 disabled:opacity-30 disabled:active:scale-100"
        >
          <Send size={16} strokeWidth={2.5} />
          <span className="text-xs">发送</span>
        </button>
      </motion.form>

      {/* Message context menu */}
      {msgContextMenu && (() => {
        const m = msgContextMenu;
        const within2min = (Date.now() - new Date(m.createdAt).getTime()) < 120000;
        return (
          <div className="fixed inset-0 z-[70]" onClick={() => setMsgContextMenu(null)}>
            <div className="absolute rounded-2xl border border-gray-200 bg-white/95 backdrop-blur-xl shadow-2xl py-1.5 min-w-[120px] overflow-hidden dark:border-gray-700 dark:bg-gray-800/95"
              style={{ left: Math.min(m.x - 60, window.innerWidth - 140), top: Math.min(m.y - 80, window.innerHeight - 160) }}>
              <button onClick={(e) => { e.stopPropagation(); setReplyTo(messages.find(msg => msg.id === m.msgId) || null); setMsgContextMenu(null); inputRef.current?.focus(); }}
                className="flex w-full items-center px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700">
                引用
              </button>
              {m.type === 'image' && m.content && (
                <>
                  <button onClick={(e) => { e.stopPropagation();
                    const a = document.createElement('a'); a.href = assetUrl(m.content!); a.download = `echo-${Date.now()}.jpg`;
                    document.body.appendChild(a); a.click(); document.body.removeChild(a);
                    setMsgContextMenu(null);
                  }}
                    className="flex w-full items-center px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700">
                    保存图片
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); collectAsEmoji(m.content!); setMsgContextMenu(null); }}
                    className="flex w-full items-center px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700">
                    收藏为表情
                  </button>
                </>
              )}
              {m.type === 'emoji' && m.content && (
                <button onClick={(e) => { e.stopPropagation(); collectAsEmoji(m.content!); setMsgContextMenu(null); }}
                  className="flex w-full items-center px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700">
                  收藏
                </button>
              )}
              <button onClick={(e) => { e.stopPropagation();
                setMessages(prev => prev.filter(msg => msg.id !== m.msgId));
                setMsgContextMenu(null);
              }}
                className="flex w-full items-center px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20">
                删除
              </button>
              {m.isMine && within2min && (
                <button onClick={(e) => { e.stopPropagation(); recallMessage(m.msgId); setMsgContextMenu(null); }}
                  className="flex w-full items-center px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700">
                  撤回
                </button>
              )}
            </div>
          </div>
        );
      })()}

      {/* Image preview modal */}
      <Modal open={petOpen} onClose={() => setPetOpen(false)} title={'\u5171\u540c\u5ba0\u7269'}>
        {!pet ? (
          <div className="space-y-3">
            <p>{'\u4f60\u4eec\u8fd8\u6ca1\u6709\u5171\u540c\u5ba0\u7269\u3002\u53d1\u8d77\u9080\u8bf7\u540e\uff0c\u9700\u8981\u5bf9\u65b9\u786e\u8ba4\u624d\u4f1a\u6b63\u5f0f\u9886\u517b\u3002'}</p>
            <button disabled={petBusy} onClick={adoptPet} className="w-full rounded-xl bg-amber-500 py-2 text-sm font-semibold text-white disabled:opacity-50">{'\u53d1\u8d77\u9886\u517b\u9080\u8bf7'}</button>
          </div>
        ) : pet.status === 'pending' ? (
          <div className="space-y-3">
            <p>{pet.pendingForMe ? '\u5bf9\u65b9\u9080\u8bf7\u4f60\u4e00\u8d77\u9886\u517b\u5ba0\u7269\u3002' : '\u9886\u517b\u9080\u8bf7\u5df2\u53d1\u9001\uff0c\u7b49\u5f85\u5bf9\u65b9\u786e\u8ba4\u3002'}</p>
            {pet.pendingForMe && <div className="flex gap-2"><button disabled={petBusy} onClick={adoptPet} className="flex-1 rounded-xl bg-amber-500 py-2 text-sm font-semibold text-white disabled:opacity-50">允许</button><button disabled={petBusy} onClick={rejectPet} className="flex-1 rounded-xl bg-gray-100 py-2 text-sm font-semibold text-gray-500 disabled:opacity-50 dark:bg-gray-800 dark:text-gray-300">拒绝</button></div>}
          </div>
        ) : pet.status === 'rejected' ? (
          <div className="space-y-3">
            <p>上一次共同领养邀请已被拒绝。你可以重新发起邀请。</p>
            <button disabled={petBusy} onClick={adoptPet} className="w-full rounded-xl bg-amber-500 py-2 text-sm font-semibold text-white disabled:opacity-50">重新发起邀请</button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              {([
                ['home', Heart, '陪伴'],
                ['shop', Store, '宠物商店'],
                ['bag', Backpack, '背包'],
              ] as const).map(([tab, Icon, label]) => (
                <button key={tab} type="button" onClick={() => setPetTab(tab)} className={`flex flex-col items-center gap-1 rounded-xl px-2 py-2 text-[11px] ${petTab === tab ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' : 'bg-gray-50 text-gray-400 dark:bg-gray-800'}`}>
                  <Icon size={16} /> {label}
                </button>
              ))}
            </div>
            {petTab === 'shop' ? (
              <div className="space-y-2">
                <p className="text-xs text-gray-400">宠物商店将用于限时皮肤和互动道具。当前先开放体验道具。</p>
                <div className="flex items-center justify-between rounded-xl bg-amber-50 p-3 dark:bg-amber-950/20">
                  <div><p className="font-semibold text-amber-700 dark:text-amber-300">饼干试吃装</p><p className="text-[11px] text-amber-500">免费体验 · 触发双方同步动画</p></div>
                  <button disabled={petBusy} type="button" onClick={() => runPetAction('buy-biscuit')} className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">5 金币购买</button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    ['buy-snack-box', Gift, '零食盒', '3 个饼干 · +2 经验', '12 金币'],
                    ['buy-study-kit', Sparkles, '学习套装', '+10 经验', '16 金币'],
                    ['buy-date-pack', Heart, '陪伴礼包', '+4 亲密 · +4 经验', '18 金币'],
                    ['buy-repair-card', Backpack, '补签卡', '恢复中断互动', '30 金币'],
                  ] as const).map(([action, Icon, title, desc, price]) => (
                    <button key={action} disabled={petBusy} type="button" onClick={() => runPetAction(action)} className="rounded-xl bg-white p-3 text-left shadow-sm ring-1 ring-gray-100 disabled:opacity-50 dark:bg-gray-900 dark:ring-gray-800">
                      <span className="flex items-center gap-2 text-xs font-semibold text-gray-800 dark:text-gray-100"><Icon size={15} /> {title}</span>
                      <span className="mt-1 block text-[11px] text-gray-400">{desc}</span>
                      <span className="mt-2 inline-flex rounded-full bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-600 dark:bg-amber-950/30">{price}</span>
                    </button>
                  ))}
                </div>
                <div className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-gray-100 dark:bg-gray-900 dark:ring-gray-800">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-sm font-bold text-gray-900 dark:text-gray-100">宠物服务</p>
                    <span className="text-[11px] text-gray-400">消耗体力，提升状态</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {([
                      ['feed', Cookie, '喂食'],
                      ['cuddle', Heart, '抱抱'],
                      ['play', Sparkles, '玩耍'],
                      ['walk', Footprints, '散步'],
                      ['clean', Brush, '清洁'],
                      ['bath', ShowerHead, '洗澡'],
                      ['train', Dumbbell, '训练'],
                      ['explore', Compass, '探险'],
                      ['dance', Music, '跳舞'],
                      ['guard', Shield, '守护'],
                      ['study', BookOpen, '上学'],
                      ['work', Briefcase, '打工'],
                    ] as const).map(([action, Icon, label]) => (
                      <button
                        key={action}
                        disabled={petBusy || (action === 'feed' && !pet.biscuits)}
                        type="button"
                        onClick={() => runPetAction(action)}
                        className="flex flex-col items-center gap-1 rounded-xl bg-gray-50 px-2 py-2 text-[11px] font-semibold text-gray-700 disabled:opacity-50 dark:bg-gray-800 dark:text-gray-200"
                      >
                        <Icon size={15} /> {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : petTab === 'bag' ? (
              <div className="space-y-2">
                <p className="text-xs text-gray-400">体验道具会触发双方同步互动。后续可继续扩展共享库存。</p>
                <button type="button" disabled={petBusy || !pet.biscuits} onClick={() => runPetAction('feed')} className="flex w-full items-center justify-between rounded-xl bg-amber-50 p-3 text-left disabled:opacity-50 dark:bg-amber-950/20">
                  <span className="flex items-center gap-2 font-semibold text-amber-700 dark:text-amber-300"><Cookie size={16} /> 饼干</span>
                  <span className="text-xs text-amber-500">{`${pet.biscuits || 0} 个 · 喂给宠物`}</span>
                </button>
                <button type="button" onClick={() => interactWithPet('poke')} className="flex w-full items-center justify-between rounded-xl bg-violet-50 p-3 text-left dark:bg-violet-950/20">
                  <span className="font-semibold text-violet-700 dark:text-violet-300">互动玩具</span>
                  <span className="text-xs text-violet-500">戳一戳</span>
                </button>
              </div>
            ) : (
              <>
            <div className="flex items-center gap-3">
              <label className={`flex h-16 w-16 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br ${petStage(pet.level).color} text-white shadow-lg ${petStage(pet.level).glow}`}>
                {pet.avatar ? <img src={assetUrl(pet.avatar)} alt="" className="h-full w-full object-cover" /> : <Camera size={20} />}
                <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && uploadPetAvatar(e.target.files[0]).catch(err => toast(err.message, 'error'))} />
              </label>
              <div className="min-w-0 flex-1">
                <input value={petName} onChange={e => setPetName(e.target.value)} maxLength={20} className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800" />
                <p className="mt-1 text-xs text-gray-400">{`${petStage(pet.level).name} \u00b7 \u7b49\u7ea7 ${pet.level} \u00b7 \u4eb2\u5bc6\u5ea6 ${pet.intimacy}`}</p>
              </div>
              <button disabled={petBusy} onClick={() => savePet()} className="rounded-xl bg-gray-100 px-3 py-2 text-xs dark:bg-gray-800">{'\u4fdd\u5b58'}</button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-xl bg-amber-50 p-3 dark:bg-amber-950/20"><p className="text-[11px] text-amber-500">金币</p><p className="mt-1 font-bold text-amber-700 dark:text-amber-300">{pet.coins || 0}</p></div>
              <div className="rounded-xl bg-violet-50 p-3 dark:bg-violet-950/20"><p className="text-[11px] text-violet-500">学历</p><p className="mt-1 truncate font-bold text-violet-700 dark:text-violet-300">{pet.education || '幼儿园'}</p></div>
              <div className="rounded-xl bg-sky-50 p-3 dark:bg-sky-950/20"><p className="text-[11px] text-sky-500">职业</p><p className="mt-1 truncate font-bold text-sky-700 dark:text-sky-300">{pet.job || '还没有工作'}</p></div>
            </div>
            <div className="grid grid-cols-4 gap-2">
              <button disabled={petBusy} onClick={() => runPetAction('check-in')} className="rounded-xl bg-amber-500 px-2 py-2 text-xs font-semibold text-white disabled:opacity-50">签到</button>
              <button disabled={petBusy} onClick={() => runPetAction('study')} className="rounded-xl bg-violet-500 px-2 py-2 text-xs font-semibold text-white disabled:opacity-50">上学</button>
              <button disabled={petBusy} onClick={() => runPetAction('work')} className="rounded-xl bg-sky-500 px-2 py-2 text-xs font-semibold text-white disabled:opacity-50">工作</button>
              <button disabled={petBusy} onClick={() => runPetAction('sleep')} className="rounded-xl bg-indigo-500 px-2 py-2 text-xs font-semibold text-white disabled:opacity-50">睡觉</button>
            </div>
            <p className="rounded-xl bg-gray-50 px-3 py-2 text-xs text-gray-500 dark:bg-gray-800 dark:text-gray-300">{`当前状态：${pet.activity === 'study' ? '正在上学' : pet.activity === 'work' ? '正在工作' : pet.activity === 'sleep' ? '正在睡觉' : '自由活动'}`}</p>
            <div className="grid grid-cols-3 gap-2">
              {([
                ['cuddle', Heart, '抱抱'],
                ['play', Sparkles, '玩耍'],
                ['walk', Footprints, '散步'],
                ['clean', Brush, '清洁'],
                ['bath', ShowerHead, '洗澡'],
                ['train', Dumbbell, '训练'],
                ['explore', Compass, '探险'],
                ['dance', Music, '跳舞'],
                ['guard', Shield, '守护'],
              ] as const).map(([action, Icon, label]) => (
                <button key={action} disabled={petBusy} onClick={() => runPetAction(action)} className="flex items-center justify-center gap-1 rounded-xl bg-gray-50 px-2 py-2 text-xs font-semibold text-gray-700 disabled:opacity-50 dark:bg-gray-800 dark:text-gray-200">
                  <Icon size={14} /> {label}
                </button>
              ))}
            </div>
            <div className={`rounded-2xl px-3 py-3 text-xs ${pet.mood === 'sick' ? 'bg-red-50 text-red-500 dark:bg-red-950/20' : pet.mood === 'sad' ? 'bg-blue-50 text-blue-500 dark:bg-blue-950/20' : 'bg-green-50 text-green-600 dark:bg-green-950/20'}`}>
              {pet.mood === 'sick' ? '已经很久没有聊天了，宠物有点生病。' : pet.mood === 'sad' ? '超过 24 小时没有聊天，宠物正在想你们。' : '宠物状态很好，继续保持互动。'}
            </div>
            <div className="flex items-center justify-between rounded-2xl bg-amber-50 px-3 py-3 text-xs text-amber-700 dark:bg-amber-950/20 dark:text-amber-300">
              <div>
                <p className="font-semibold">{`补签卡 ${pet.repairCards || 0} 张`}</p>
                <p className="mt-0.5 text-[11px] opacity-75">{pet.repairableDay ? `可恢复 ${pet.repairableDay} 的中断` : '中断一天后可使用补签卡恢复连续互动'}</p>
              </div>
              {pet.repairableDay && (
                <button disabled={petBusy || !pet.repairCards} onClick={repairPetStreak} className="rounded-xl bg-amber-500 px-3 py-2 font-semibold text-white disabled:opacity-50">
                  补签
                </button>
              )}
            </div>
            <div className="rounded-xl bg-amber-50 p-3 dark:bg-amber-950/20">
              <div className="flex items-center justify-between text-xs text-amber-700 dark:text-amber-300">
                <span>{`\u6210\u957f\u7ecf\u9a8c ${pet.experience % PET_EXP_PER_LEVEL}/${PET_EXP_PER_LEVEL}`}</span>
                <span>{`\u8ddd\u79bb\u4e0b\u4e00\u7ea7 ${PET_EXP_PER_LEVEL - (pet.experience % PET_EXP_PER_LEVEL)} \u7ecf\u9a8c`}</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-amber-100 dark:bg-amber-900/30">
                <div className="h-full rounded-full bg-amber-500 transition-all" style={{ width: `${((pet.experience % PET_EXP_PER_LEVEL) / PET_EXP_PER_LEVEL) * 100}%` }} />
              </div>
              <p className="mt-3 text-xs leading-5 text-amber-700 dark:text-amber-300">{'\u4f60\u4eec\u6bcf\u53d1\u9001 1 \u6761\u79c1\u804a\uff0c\u5ba0\u7269\u589e\u52a0 1 \u7ecf\u9a8c\u3002\u6bcf 20 \u7ecf\u9a8c\u5347 1 \u7ea7\uff0c\u6bcf 5 \u6761\u6d88\u606f\u989d\u5916\u589e\u52a0 1 \u4eb2\u5bc6\u5ea6\u3002'}</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-gray-50 p-3 dark:bg-gray-800/70">
                <p className="text-[11px] text-gray-400">{'\u4eca\u65e5\u804a\u5929'}</p>
                <p className="mt-1 text-lg font-bold text-gray-800 dark:text-gray-100">{pet.todayMessageCount || 0}</p>
              </div>
              <div className="rounded-xl bg-gray-50 p-3 dark:bg-gray-800/70">
                <p className="text-[11px] text-gray-400">{'\u8fde\u7eed\u4e92\u52a8'}</p>
                <p className="mt-1 text-lg font-bold text-gray-800 dark:text-gray-100">{`${pet.streakDays || 0} \u5929`}</p>
              </div>
            </div>
            <div className="rounded-xl border border-gray-100 p-3 dark:border-gray-800">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold text-gray-700 dark:text-gray-200">{'\u4eca\u65e5\u5171\u540c\u4efb\u52a1'}</p>
                <span className={`text-[11px] ${pet.todayMutual ? 'text-green-500' : 'text-gray-400'}`}>{pet.todayMutual ? '\u53cc\u65b9\u5df2\u4e92\u52a8' : '\u7b49\u5f85\u53cc\u65b9\u4e92\u52a8'}</span>
              </div>
              <div className="space-y-2">
                {(pet.dailyTasks || []).map(task => (
                  <div key={task.target} className="flex items-center gap-2 text-xs">
                    <span className={task.completed ? 'text-green-500' : 'text-gray-300'}>{task.completed ? '\u2713' : '\u25cb'}</span>
                    <span className="min-w-0 flex-1 text-gray-600 dark:text-gray-300">{`${task.label} \u00b7 ${task.target} \u6761\u79c1\u804a`}</span>
                    <span className="text-amber-500">{`+${task.bonusExperience} \u7ecf\u9a8c`}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-gray-100 p-3 dark:border-gray-800">
              <p className="mb-2 text-xs font-semibold text-gray-700 dark:text-gray-200">共同成就</p>
              <div className="space-y-2">
                {(pet.achievementTasks || []).map(task => (
                  <div key={task.key} className="flex items-center gap-2 text-xs">
                    <span className={task.completed ? 'text-green-500' : 'text-gray-300'}>{task.completed ? '\u2713' : '\u25cb'}</span>
                    <span className="min-w-0 flex-1 text-gray-600 dark:text-gray-300">{task.label}</span>
                    <span className="text-gray-400">{`${Math.min(task.progress, task.target)}/${task.target} ${task.unit}`}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-xl bg-violet-50 p-3 text-xs leading-5 text-violet-700 dark:bg-violet-950/20 dark:text-violet-300">
              {'\u6210\u957f\u9636\u6bb5\uff1a1 \u7ea7\u5e7c\u5e74 \u2192 3 \u7ea7\u6210\u957f \u2192 6 \u7ea7\u6d3b\u529b \u2192 10 \u7ea7\u661f\u8f89\u3002\u6bcf\u5929\u5b8c\u6210\u5171\u540c\u4efb\u52a1\uff0c\u53ef\u4ee5\u66f4\u5feb\u5347\u7ea7\u3002'}
            </div>
              </>
            )}
          </div>
        )}
      </Modal>

      {emojiPreview && (
        <div className="fixed inset-0 z-[80] bg-black/70 flex items-center justify-center" onClick={() => setEmojiPreview(null)}>
          <img src={emojiPreview} alt="" className="max-w-[96vw] max-h-[86vh] object-contain rounded-xl shadow-2xl" onClick={(e) => e.stopPropagation()} />
        </div>
      )}

      {/* Personal Orbit View — fullscreen overlay */}
      <Modal
        open={clearConfirmOpen}
        onClose={() => setClearConfirmOpen(false)}
        title="清空聊天记录"
        actions={
          <>
            <button
              type="button"
              onClick={() => setClearConfirmOpen(false)}
              className="rounded-xl px-4 py-2 text-sm text-gray-500 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              取消
            </button>
            <button
              type="button"
              onClick={async () => {
                try {
                  if (isGroup) {
                    await api('POST', '/api/messages/clear', { groupId: peerId });
                  } else {
                    await api('POST', '/api/messages/clear', { peerId });
                  }
                  setMessages([]);
                  setClearConfirmOpen(false);
                  toast('聊天记录已清空', 'success');
                } catch (err: any) {
                  toast(err.message || '清空失败', 'error');
                }
              }}
              className="rounded-xl bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600"
            >
              清空
            </button>
          </>
        }
      >
        <p>是否清空,不可恢复</p>
      </Modal>

      {showPersonalOrbit && peer && (
        <PersonalOrbitView
          peerId={peer.id}
          peerName={getPeerName()}
          peer={peer}
          onClose={() => setShowPersonalOrbit(false)}
        />
      )}
      {showGroupOrbit && isGroup && (
        <GroupOrbitView
          groupId={peerId}
          groupName={liveGroupName}
          onClose={() => setShowGroupOrbit(false)}
        />
      )}
    </div>
  );
}
