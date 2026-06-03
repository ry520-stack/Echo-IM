import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CalendarHeart,
  Camera,
  Check,
  ChevronDown,
  Heart,
  ImagePlus,
  MapPin,
  Music,
  PawPrint,
  RefreshCw,
  Send,
  Settings,
  Sparkles,
  Trash2,
  Umbrella,
  X,
} from 'lucide-react';
import { api, getServerUrl } from '../api/client';
import { assetUrl } from '../utils/assetUrl';
import { useSocket } from '../contexts/SocketContext';
import { useToast } from '../contexts/ToastContext';
import RelationshipCarePanel from './RelationshipCarePanel';

interface Friend {
  id: string;
  peer: { id: string; username: string; nickname: string; avatar: string; digitalId: number };
  alias: string;
}

interface Weather {
  city?: string;
  weather?: string;
  temperature?: string;
  winddirection?: string;
  windpower?: string;
}

interface Summary {
  status: 'none' | 'pending' | 'active';
  pendingForMe?: boolean;
  bondedAt?: string;
  metAt?: string;
  datingAt?: string;
  countdownAt?: string;
  countdownTitle?: string;
  unlockAt?: string;
  canUnbind?: boolean;
  myCityName?: string;
  peerCityName?: string;
  myWeather?: Weather | null;
  peerWeather?: Weather | null;
  weatherAlert?: string;
  distanceKm?: number | null;
  peer?: { id: string; username: string; nickname: string; avatar: string; digitalId: number };
  pet?: { name: string; level: number; coins: number; activity: string; skin?: string } | null;
  myCycle?: { periodStart?: string; cycleLength?: number; periodLength?: number; shareWithPartner?: boolean } | null;
  peerCycle?: { isPeriodActive?: boolean; nextPeriodAt?: string } | null;
}

interface CoupleItem {
  id: string;
  type: 'photo' | 'footprint' | 'song' | 'praise' | 'grudge';
  title: string;
  content: string;
  images: string;
  cityName: string;
  happenedAt?: string;
  createdAt: string;
}

const MEMORY_TABS = [
  { key: 'photo', label: '相册', Icon: Camera },
  { key: 'footprint', label: '足迹', Icon: MapPin },
  { key: 'song', label: '情歌', Icon: Music },
  { key: 'praise', label: '夸夸', Icon: Sparkles },
  { key: 'grudge', label: '记仇', Icon: Trash2 },
] as const;

function displayName(peer?: Summary['peer']) {
  return peer?.nickname || peer?.username || '对方';
}

function dateInput(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function duration(value?: string) {
  if (!value) return '尚未设置';
  const hours = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 3_600_000));
  return `${Math.floor(hours / 24)} 天 ${hours % 24} 小时`;
}

function countdown(value?: string) {
  if (!value) return '尚未设置';
  const hours = Math.ceil((new Date(value).getTime() - Date.now()) / 3_600_000);
  return hours >= 0 ? `${Math.floor(hours / 24)} 天 ${hours % 24} 小时` : '已到达';
}

function imagesOf(item: CoupleItem) {
  try { return JSON.parse(item.images || '[]') as string[]; } catch { return []; }
}

function songUrl(item: CoupleItem) {
  return [item.content, item.title].find(value => /^https?:\/\//i.test((value || '').trim()))?.trim() || '';
}

function WeatherCard({ label, city, weather }: { label: string; city?: string; weather?: Weather | null }) {
  return (
    <div className="rounded-[24px] border border-white/80 bg-white/85 p-4 shadow-sm backdrop-blur dark:border-white/10 dark:bg-gray-900/80">
      <p className="text-xs text-gray-400">{label} · {city || '未设置城市'}</p>
      <p className="mt-2 text-xl font-bold text-gray-900 dark:text-white">
        {weather ? `${weather.weather || '--'} ${weather.temperature || '--'}°C` : '暂无天气'}
      </p>
      {weather?.winddirection && <p className="mt-1 text-xs text-gray-400">{weather.winddirection}风 {weather.windpower || ''}级</p>}
    </div>
  );
}

export default function RelationshipSpaceContent() {
  const { socket } = useSocket();
  const toast = useToast();
  const [summary, setSummary] = useState<Summary>({ status: 'none' });
  const [friends, setFriends] = useState<Friend[]>([]);
  const [selectedPeerId, setSelectedPeerId] = useState('');
  const [friendPickerOpen, setFriendPickerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [section, setSection] = useState<'home' | 'memory' | 'care' | 'settings'>('home');
  const [memoryTab, setMemoryTab] = useState<CoupleItem['type']>('photo');
  const [items, setItems] = useState<CoupleItem[]>([]);
  const [form, setForm] = useState({ metAt: '', datingAt: '', countdownAt: '', countdownTitle: '', cityName: '' });
  const [itemForm, setItemForm] = useState({ title: '', content: '', cityName: '', happenedAt: '', images: [] as string[] });
  const [decisionOptions, setDecisionOptions] = useState('火锅、电影、散步、奶茶');
  const [decisionResult, setDecisionResult] = useState('');

  const load = useCallback(async () => {
    setSummary(await api<Summary>('GET', '/api/couples'));
  }, []);

  const loadItems = useCallback(async () => {
    setItems(await api<CoupleItem[]>('GET', '/api/couples/items'));
  }, []);

  useEffect(() => { load().catch(() => setSummary({ status: 'none' })); }, [load]);
  useEffect(() => { if (summary.status === 'active') loadItems().catch(() => setItems([])); }, [loadItems, summary.status]);
  useEffect(() => { if (summary.status === 'none') api<Friend[]>('GET', '/api/friends').then(setFriends).catch(() => setFriends([])); }, [summary.status]);
  useEffect(() => {
    if (!socket) return;
    const refresh = () => { load(); loadItems().catch(() => {}); };
    socket.on('couple:updated', refresh);
    return () => { socket.off('couple:updated', refresh); };
  }, [load, loadItems, socket]);
  useEffect(() => {
    setForm({
      metAt: dateInput(summary.metAt),
      datingAt: dateInput(summary.datingAt),
      countdownAt: dateInput(summary.countdownAt),
      countdownTitle: summary.countdownTitle || '',
      cityName: summary.myCityName || '',
    });
  }, [summary]);

  const act = async (request: () => Promise<unknown>, message: string) => {
    setBusy(true);
    try {
      await request();
      await load();
      toast(message, 'success');
    } catch (error: any) {
      toast(error.message || '操作失败', 'error');
    } finally {
      setBusy(false);
    }
  };

  const peerName = useMemo(() => displayName(summary.peer), [summary.peer]);
  const selectedFriend = friends.find(friend => friend.peer.id === selectedPeerId);
  const visibleItems = items.filter(item => item.type === memoryTab);

  const uploadPhoto = async (file: File) => {
    setBusy(true);
    try {
      const data = new FormData();
      data.append('file', file);
      const token = localStorage.getItem('echo-token');
      const response = await fetch(`${getServerUrl()}/api/upload/chat-image`, { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : undefined, body: data });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || '上传失败');
      setItemForm(current => ({ ...current, images: [...current.images, result.url].slice(0, 9) }));
    } catch (error: any) {
      toast(error.message || '上传失败', 'error');
    } finally {
      setBusy(false);
    }
  };

  const createItem = () => act(async () => {
    await api('POST', '/api/couples/items', { ...itemForm, type: memoryTab });
    setItemForm({ title: '', content: '', cityName: '', happenedAt: '', images: [] });
    await loadItems();
  }, '已保存到关系空间');

  const archiveItem = (id: string) => act(async () => {
    await api('DELETE', `/api/couples/items/${id}`);
    await loadItems();
  }, '内容已归档');

  if (summary.status === 'none') {
    return (
      <div className="h-full overflow-y-auto bg-gradient-to-b from-rose-50 via-white to-white px-5 py-8 dark:from-rose-950/20 dark:via-gray-950 dark:to-gray-950">
        <div className="mx-auto max-w-md text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[28px] bg-white text-rose-500 shadow-xl shadow-rose-200/50 dark:bg-gray-900"><Heart size={36} /></div>
          <h2 className="mt-5 text-2xl font-black text-gray-950 dark:text-white">开启关系空间</h2>
          <p className="mt-2 text-sm leading-6 text-gray-500">邀请一位好友确认后，共享纪念日、天气、宠物、相册、足迹和关怀功能。</p>
          <button onClick={() => setFriendPickerOpen(true)} className="mt-6 flex w-full items-center gap-3 rounded-[24px] bg-white px-4 py-4 text-left shadow-lg shadow-rose-100/70 dark:bg-gray-900 dark:shadow-none">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-rose-100 text-rose-500">
              {selectedFriend?.peer.avatar ? <img src={assetUrl(selectedFriend.peer.avatar)} alt="" className="h-full w-full object-cover" /> : selectedFriend ? (selectedFriend.alias || selectedFriend.peer.nickname || selectedFriend.peer.username)[0] : <Heart size={18} />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-bold text-gray-900 dark:text-white">{selectedFriend ? selectedFriend.alias || selectedFriend.peer.nickname || selectedFriend.peer.username : '选择一位好友'}</span>
              <span className="mt-1 block text-xs text-gray-400">{selectedFriend ? `Echo ID: ${selectedFriend.peer.digitalId}` : '申请需要对方确认'}</span>
            </span>
            <ChevronDown size={18} className="text-gray-300" />
          </button>
          <button disabled={!selectedPeerId || busy} onClick={() => act(() => api('POST', '/api/couples/request', { peerId: selectedPeerId }), '情侣绑定申请已发送')} className="mt-3 w-full rounded-2xl bg-rose-500 py-3 text-sm font-bold text-white disabled:opacity-40">发送邀请</button>
        </div>

        {friendPickerOpen && (
          <div className="fixed inset-0 z-[80] flex items-end justify-center" onClick={() => setFriendPickerOpen(false)}>
            <div className="absolute inset-0 bg-black/35 backdrop-blur-sm" />
            <div className="relative max-h-[70dvh] w-full max-w-lg overflow-hidden rounded-t-[28px] bg-white shadow-2xl dark:bg-gray-900" onClick={event => event.stopPropagation()}>
              <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 dark:border-gray-800">
                <div><h3 className="text-base font-bold text-gray-900 dark:text-white">选择好友</h3><p className="mt-0.5 text-xs text-gray-400">一个人同时只能绑定一位情侣</p></div>
                <button onClick={() => setFriendPickerOpen(false)} className="rounded-full p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"><X size={18} /></button>
              </div>
              <div className="max-h-[calc(70dvh-76px)] space-y-1 overflow-y-auto px-4 py-3">
                {friends.map(friend => {
                  const name = friend.alias || friend.peer.nickname || friend.peer.username;
                  const selected = selectedPeerId === friend.peer.id;
                  return (
                    <button key={friend.peer.id} onClick={() => { setSelectedPeerId(friend.peer.id); setFriendPickerOpen(false); }} className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition-colors ${selected ? 'bg-rose-50 dark:bg-rose-950/30' : 'hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-rose-100 text-sm font-bold text-rose-500">{friend.peer.avatar ? <img src={assetUrl(friend.peer.avatar)} alt="" className="h-full w-full object-cover" /> : name[0]}</span>
                      <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-gray-800 dark:text-gray-100">{name}</span><span className="mt-0.5 block text-xs text-gray-400">Echo ID: {friend.peer.digitalId}</span></span>
                      {selected && <Check size={18} className="text-rose-500" />}
                    </button>
                  );
                })}
                {friends.length === 0 && <p className="py-8 text-center text-sm text-gray-400">暂无可邀请的好友</p>}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (summary.status === 'pending') {
    return (
      <div className="flex h-full items-center justify-center bg-gradient-to-b from-rose-50 to-white px-5 dark:from-rose-950/20 dark:to-gray-950">
        <div className="w-full max-w-md rounded-[28px] bg-white/90 p-6 text-center shadow-xl backdrop-blur dark:bg-gray-900/90">
          <Heart className="mx-auto text-rose-500" size={34} />
          <h2 className="mt-4 text-lg font-bold text-gray-900 dark:text-white">情侣绑定申请</h2>
          <p className="mt-2 text-sm text-gray-500">{summary.pendingForMe ? `${peerName} 邀请你进入关系空间` : `已向 ${peerName} 发出申请，等待对方确认`}</p>
          {summary.pendingForMe && (
            <div className="mt-5 flex gap-3">
              <button disabled={busy} onClick={() => act(() => api('POST', '/api/couples/respond', { accept: false }), '已拒绝申请')} className="flex-1 rounded-2xl bg-gray-100 py-3 text-sm text-gray-600 dark:bg-gray-800 dark:text-gray-300">拒绝</button>
              <button disabled={busy} onClick={() => act(() => api('POST', '/api/couples/respond', { accept: true }), '情侣空间已开启')} className="flex-1 rounded-2xl bg-rose-500 py-3 text-sm font-bold text-white">同意</button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-[radial-gradient(circle_at_top,#ffe4ec_0,#fff7f9_34%,#ffffff_70%)] px-4 py-5 dark:bg-gray-950">
      <div className="mx-auto max-w-lg space-y-4">
        <section className="overflow-hidden rounded-[32px] bg-zinc-950 text-white shadow-2xl shadow-rose-200/60 dark:shadow-none">
          <div className="relative p-5">
            <div className="absolute -right-10 -top-10 h-36 w-36 rounded-full bg-rose-500 blur-3xl" />
            <div className="absolute bottom-0 right-10 h-28 w-28 rounded-full bg-fuchsia-500 blur-3xl" />
            <div className="relative flex items-center gap-3">
              <div className="h-14 w-14 overflow-hidden rounded-2xl bg-white/15">
                {summary.peer?.avatar ? <img src={assetUrl(summary.peer.avatar)} className="h-full w-full object-cover" alt="" /> : <div className="flex h-full w-full items-center justify-center text-xl font-bold">{peerName[0]}</div>}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-white/55">关系空间</p>
                <h2 className="truncate text-2xl font-black">你和 {peerName}</h2>
              </div>
            </div>
            <div className="relative mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-3xl bg-white/10 p-4"><p className="text-xs text-white/55">相识时长</p><p className="mt-1 text-lg font-bold">{duration(summary.metAt)}</p></div>
              <div className="rounded-3xl bg-white/10 p-4"><p className="text-xs text-white/55">相恋时长</p><p className="mt-1 text-lg font-bold">{duration(summary.datingAt || summary.bondedAt)}</p></div>
            </div>
            <div className="relative mt-3 rounded-3xl bg-white/10 p-4">
              <p className="text-xs text-white/55">{summary.countdownTitle || '下一个纪念日'}</p>
              <p className="mt-1 text-xl font-black">{countdown(summary.countdownAt)}</p>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-4 gap-2 rounded-[26px] bg-white/80 p-2 shadow-sm backdrop-blur dark:bg-gray-900/80">
          {[
            ['home', '首页', CalendarHeart],
            ['memory', '回忆', Camera],
            ['care', '关怀', Umbrella],
            ['settings', '设置', Settings],
          ].map(([key, label, Icon]: any) => (
            <button key={key} onClick={() => setSection(key)} className={`flex flex-col items-center gap-1 rounded-2xl py-2 text-xs transition-colors ${section === key ? 'bg-rose-500 text-white shadow-lg shadow-rose-200' : 'text-gray-400'}`}>
              <Icon size={16} />
              {label}
            </button>
          ))}
        </div>

        {section === 'home' && (
          <>
            {summary.weatherAlert && <div className="flex gap-2 rounded-[24px] bg-amber-50 p-4 text-sm text-amber-700 dark:bg-amber-950/30 dark:text-amber-300"><Umbrella className="shrink-0" size={18} />{summary.weatherAlert}</div>}
            <section className="grid grid-cols-2 gap-3">
              <WeatherCard label="我的天气" city={summary.myCityName} weather={summary.myWeather} />
              <WeatherCard label={`${peerName}的天气`} city={summary.peerCityName} weather={summary.peerWeather} />
            </section>
            {summary.distanceKm != null && <p className="text-center text-xs text-gray-400">两座城市中心相距约 {summary.distanceKm} 公里</p>}
            <section className="rounded-[28px] border border-white/80 bg-white/85 p-4 shadow-sm backdrop-blur dark:border-white/10 dark:bg-gray-900/80">
              <div className="flex items-center gap-2 text-base font-bold text-gray-900 dark:text-white"><PawPrint size={18} className="text-amber-500" />共同宠物</div>
              <p className="mt-2 text-sm text-gray-500">{summary.pet ? `${summary.pet.name} · Lv.${summary.pet.level} · ${summary.pet.coins} 金币 · ${summary.pet.activity}` : '还没有共同宠物，可在聊天中发起领养。'}</p>
            </section>
            <div className="grid grid-cols-2 gap-3">
              <button disabled={busy} onClick={() => act(() => api('POST', '/api/couples/sos'), 'SOS 已发送')} className="flex items-center justify-center gap-2 rounded-[24px] bg-rose-500 py-4 text-sm font-bold text-white"><Send size={16} />SOS 想你</button>
              <button onClick={() => setSection('settings')} className="flex items-center justify-center gap-2 rounded-[24px] bg-white py-4 text-sm font-bold text-gray-600 shadow-sm dark:bg-gray-900 dark:text-gray-300"><Settings size={16} />空间设置</button>
            </div>
          </>
        )}

        {section === 'memory' && (
          <section className="rounded-[28px] border border-white/80 bg-white/85 p-4 shadow-sm backdrop-blur dark:border-white/10 dark:bg-gray-900/80">
            <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
              {MEMORY_TABS.map(({ key, label, Icon }) => <button key={key} onClick={() => setMemoryTab(key)} className={`flex shrink-0 items-center gap-1 rounded-full px-3 py-2 text-xs ${memoryTab === key ? 'bg-rose-500 text-white' : 'bg-gray-100 text-gray-500 dark:bg-gray-800'}`}><Icon size={13} />{label}</button>)}
            </div>
            {(memoryTab === 'photo' || memoryTab === 'footprint') && <label className="mb-3 flex cursor-pointer items-center justify-center gap-2 rounded-2xl bg-rose-50 py-3 text-sm font-semibold text-rose-500 dark:bg-rose-950/30"><ImagePlus size={16} />添加照片<input type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && uploadPhoto(e.target.files[0])} /></label>}
            {itemForm.images.length > 0 && <div className="mb-3 flex gap-2 overflow-x-auto">{itemForm.images.map(url => <img key={url} src={assetUrl(url)} alt="" className="h-16 w-16 rounded-xl object-cover" />)}</div>}
            <div className="space-y-2">
              <input value={itemForm.title} onChange={e => setItemForm({ ...itemForm, title: e.target.value })} placeholder={memoryTab === 'song' ? '歌曲名或链接' : memoryTab === 'footprint' ? '旅行标题' : '标题'} className="w-full rounded-2xl bg-gray-100 px-3 py-2.5 text-sm outline-none dark:bg-gray-800 dark:text-gray-200" />
              {memoryTab === 'footprint' && <input value={itemForm.cityName} onChange={e => setItemForm({ ...itemForm, cityName: e.target.value })} placeholder="去过的城市" className="w-full rounded-2xl bg-gray-100 px-3 py-2.5 text-sm outline-none dark:bg-gray-800 dark:text-gray-200" />}
              <textarea value={itemForm.content} onChange={e => setItemForm({ ...itemForm, content: e.target.value })} placeholder={memoryTab === 'song' ? '填写可播放的音频链接或歌曲备注' : memoryTab === 'praise' ? '写一句想夸对方的话' : memoryTab === 'grudge' ? '记录这件事，之后可以归档' : '备注'} className="min-h-20 w-full rounded-2xl bg-gray-100 px-3 py-2.5 text-sm outline-none dark:bg-gray-800 dark:text-gray-200" />
              {(memoryTab === 'photo' || memoryTab === 'footprint') && <input type="date" value={itemForm.happenedAt} onChange={e => setItemForm({ ...itemForm, happenedAt: e.target.value })} className="w-full rounded-2xl bg-gray-100 px-3 py-2.5 text-sm outline-none dark:bg-gray-800 dark:text-gray-200" />}
              <button disabled={busy || (!itemForm.title && !itemForm.content && itemForm.images.length === 0)} onClick={createItem} className="w-full rounded-2xl bg-rose-500 py-3 text-sm font-bold text-white disabled:opacity-40">保存</button>
            </div>
            <div className="mt-4 space-y-2">
              {visibleItems.map(item => (
                <div key={item.id} className="rounded-2xl bg-gray-50 p-3 dark:bg-gray-800/70">
                  {imagesOf(item).length > 0 && <div className="mb-2 flex gap-2 overflow-x-auto">{imagesOf(item).map(url => <img key={url} src={assetUrl(url)} alt="" className="h-20 w-20 rounded-xl object-cover" />)}</div>}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{item.title || item.cityName || '未命名记录'}</p>
                      <p className="mt-1 whitespace-pre-wrap text-xs text-gray-500">{item.content}</p>
                      {memoryTab === 'song' && songUrl(item) && <audio className="mt-2 h-9 w-full" controls preload="none" src={songUrl(item)} />}
                      {item.happenedAt && <p className="mt-1 text-[11px] text-gray-400">{new Date(item.happenedAt).toLocaleDateString()}</p>}
                    </div>
                    <button onClick={() => archiveItem(item.id)} className="shrink-0 text-gray-300 hover:text-red-400"><Trash2 size={15} /></button>
                  </div>
                </div>
              ))}
              {visibleItems.length === 0 && <p className="py-4 text-center text-xs text-gray-400">还没有记录</p>}
            </div>
          </section>
        )}

        {section === 'care' && (
          <>
            <RelationshipCarePanel myCycle={summary.myCycle} peerCycle={summary.peerCycle} currentSkin={summary.pet?.skin} onRefresh={() => load()} />
            <section className="rounded-[28px] border border-white/80 bg-white/85 p-4 shadow-sm backdrop-blur dark:border-white/10 dark:bg-gray-900/80">
              <p className="text-sm font-bold text-gray-900 dark:text-white">决定机器</p>
              <p className="mt-1 text-xs text-gray-400">选择困难时，让关系空间帮你们随机决定。</p>
              <input value={decisionOptions} onChange={e => setDecisionOptions(e.target.value)} className="mt-3 w-full rounded-2xl bg-gray-100 px-3 py-2.5 text-sm outline-none dark:bg-gray-800 dark:text-gray-200" />
              <button onClick={() => {
                const options = decisionOptions.split(/[,，、]/).map(value => value.trim()).filter(Boolean);
                setDecisionResult(options.length ? options[Math.floor(Math.random() * options.length)] : '请先填写候选项');
              }} className="mt-2 w-full rounded-2xl bg-violet-500 py-3 text-sm font-bold text-white">帮我们决定</button>
              {decisionResult && <p className="mt-3 rounded-2xl bg-violet-50 p-3 text-center text-sm font-bold text-violet-600 dark:bg-violet-950/30">结果：{decisionResult}</p>}
            </section>
          </>
        )}

        {section === 'settings' && (
          <section className="space-y-3 rounded-[28px] border border-white/80 bg-white/85 p-4 shadow-sm backdrop-blur dark:border-white/10 dark:bg-gray-900/80">
            <input value={form.cityName} onChange={e => setForm({ ...form, cityName: e.target.value })} placeholder="我的城市名称，例如：杭州" className="w-full rounded-2xl bg-gray-100 px-3 py-2.5 text-sm outline-none dark:bg-gray-800 dark:text-gray-200" />
            <label className="block text-xs text-gray-400">相识时间<input type="datetime-local" value={form.metAt} onChange={e => setForm({ ...form, metAt: e.target.value })} className="mt-1 w-full rounded-2xl bg-gray-100 px-3 py-2.5 text-sm text-gray-700 outline-none dark:bg-gray-800 dark:text-gray-200" /></label>
            <label className="block text-xs text-gray-400">相恋时间<input type="datetime-local" value={form.datingAt} onChange={e => setForm({ ...form, datingAt: e.target.value })} className="mt-1 w-full rounded-2xl bg-gray-100 px-3 py-2.5 text-sm text-gray-700 outline-none dark:bg-gray-800 dark:text-gray-200" /></label>
            <input value={form.countdownTitle} onChange={e => setForm({ ...form, countdownTitle: e.target.value })} placeholder="倒计时标题，例如：周年纪念日" className="w-full rounded-2xl bg-gray-100 px-3 py-2.5 text-sm outline-none dark:bg-gray-800 dark:text-gray-200" />
            <input type="datetime-local" value={form.countdownAt} onChange={e => setForm({ ...form, countdownAt: e.target.value })} className="w-full rounded-2xl bg-gray-100 px-3 py-2.5 text-sm text-gray-700 outline-none dark:bg-gray-800 dark:text-gray-200" />
            <button disabled={busy} onClick={() => act(() => api('PATCH', '/api/couples', form), '关系空间设置已保存')} className="w-full rounded-2xl bg-rose-500 py-3 text-sm font-bold text-white">保存设置</button>
            <button disabled={!summary.canUnbind || busy} onClick={() => {
              if (window.confirm('解除情侣关系后，关系空间将关闭。确定继续？') && window.confirm('请再次确认：真的要解除情侣关系吗？')) act(() => api('POST', '/api/couples/unbind'), '情侣关系已解除');
            }} className="w-full rounded-2xl py-2 text-xs text-red-500 disabled:text-gray-400">
              {summary.canUnbind ? '解除情侣关系' : `绑定 90 天内不可主动解除 · ${summary.unlockAt ? new Date(summary.unlockAt).toLocaleString() : ''}`}
            </button>
            <button disabled={busy} onClick={() => {
              if (window.confirm('仅在拉黑或账号注销等特殊情况下使用。确定申请强制解除？')) act(() => api('POST', '/api/couples/force-unbind'), '情侣关系已强制解除');
            }} className="w-full rounded-2xl py-1 text-xs text-gray-400">特殊情况强制解除</button>
          </section>
        )}

        <button onClick={() => load()} className="mx-auto flex items-center gap-1 py-2 text-xs text-gray-400"><RefreshCw size={13} />刷新空间</button>
      </div>
    </div>
  );
}
