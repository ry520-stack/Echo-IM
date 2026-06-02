import { useCallback, useEffect, useMemo, useState } from 'react';
import { Camera, Check, Heart, MapPin, Music, PawPrint, RefreshCw, Send, ShieldAlert, Sparkles, Trash2, X } from 'lucide-react';
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

interface Summary {
  status: 'none' | 'pending' | 'active';
  requestedBy?: string;
  pendingForMe?: boolean;
  bondedAt?: string;
  metAt?: string;
  datingAt?: string;
  countdownAt?: string;
  countdownTitle?: string;
  unlockAt?: string;
  canUnbind?: boolean;
  myCityCode?: string;
  myCityName?: string;
  peerCityCode?: string;
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

const MODULES = [
  { key: 'photo', label: '共同相册', icon: Camera },
  { key: 'footprint', label: '城市足迹', icon: MapPin },
  { key: 'song', label: '情歌库', icon: Music },
  { key: 'praise', label: '夸夸卡', icon: Sparkles },
  { key: 'grudge', label: '记仇本', icon: Trash2 },
] as const;

interface Weather {
  city?: string;
  weather?: string;
  temperature?: string;
  winddirection?: string;
  windpower?: string;
}

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

function WeatherCard({ title, city, weather }: { title: string; city?: string; weather?: Weather | null }) {
  return (
    <div className="rounded-2xl bg-white/70 p-3 shadow-sm backdrop-blur dark:bg-gray-900/70">
      <p className="text-xs text-gray-400">{title} · {city || '未设置城市'}</p>
      <p className="mt-1 text-sm font-semibold text-gray-800 dark:text-gray-100">
        {weather ? `${weather.weather || '--'} ${weather.temperature || '--'}°C` : '暂无天气数据'}
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
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ metAt: '', datingAt: '', countdownAt: '', countdownTitle: '', cityName: '' });
  const [items, setItems] = useState<CoupleItem[]>([]);
  const [module, setModule] = useState<CoupleItem['type'] | 'decision'>('photo');
  const [itemForm, setItemForm] = useState({ title: '', content: '', cityName: '', happenedAt: '', images: [] as string[] });
  const [decisionOptions, setDecisionOptions] = useState('吃火锅,看电影,散步');
  const [decisionResult, setDecisionResult] = useState('');

  const load = useCallback(async () => {
    const next = await api<Summary>('GET', '/api/couples');
    setSummary(next);
  }, []);
  const loadItems = useCallback(async () => {
    setItems(await api<CoupleItem[]>('GET', '/api/couples/items'));
  }, []);

  useEffect(() => { load().catch(() => setSummary({ status: 'none' })); }, [load]);
  useEffect(() => { if (summary.status === 'active') loadItems().catch(() => setItems([])); }, [loadItems, summary.status]);
  useEffect(() => {
    if (summary.status !== 'none') return;
    api<Friend[]>('GET', '/api/friends').then(setFriends).catch(() => setFriends([]));
  }, [summary.status]);
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

  const act = async (request: () => Promise<any>, message: string) => {
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
  const visibleItems = items.filter(item => item.type === module);

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
    await api('POST', '/api/couples/items', { ...itemForm, type: module });
    setItemForm({ title: '', content: '', cityName: '', happenedAt: '', images: [] });
    await loadItems();
  }, '已保存到关系空间');

  const archiveItem = (id: string) => act(async () => {
    await api('DELETE', `/api/couples/items/${id}`);
    await loadItems();
  }, '内容已归档');

  if (summary.status === 'none') {
    return (
      <div className="flex h-full flex-col overflow-y-auto bg-gradient-to-b from-rose-50 to-white px-5 py-8 dark:from-rose-950/20 dark:to-gray-950">
        <div className="mx-auto flex max-w-md flex-col items-center text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-rose-100 text-rose-500 dark:bg-rose-950/50"><Heart size={36} /></div>
          <h2 className="mt-5 text-xl font-bold text-gray-900 dark:text-white">关系空间</h2>
          <p className="mt-2 text-sm leading-6 text-gray-500">绑定情侣后，共享纪念日、天气关怀、宠物状态和互动入口。每个人同时只能绑定一位情侣。</p>
          <button onClick={() => setFriendPickerOpen(true)} className="mt-6 flex w-full items-center gap-3 rounded-2xl border border-rose-100 bg-white/80 px-4 py-3 text-left shadow-sm backdrop-blur dark:border-rose-900/40 dark:bg-gray-900/80">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-rose-100 text-sm font-bold text-rose-500 dark:bg-rose-950/40">
              {selectedFriend?.peer.avatar ? <img src={assetUrl(selectedFriend.peer.avatar)} alt="" className="h-full w-full object-cover" /> : selectedFriend ? (selectedFriend.alias || selectedFriend.peer.nickname || selectedFriend.peer.username)[0] : <Heart size={18} />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-gray-800 dark:text-gray-100">{selectedFriend ? selectedFriend.alias || selectedFriend.peer.nickname || selectedFriend.peer.username : '选择一位好友'}</span>
              <span className="mt-0.5 block text-xs text-gray-400">{selectedFriend ? `Echo ID: ${selectedFriend.peer.digitalId}` : '发出邀请后，需要对方确认'}</span>
            </span>
            <span className="text-xs text-rose-400">选择</span>
          </button>
          <button disabled={!selectedPeerId || busy} onClick={() => act(() => api('POST', '/api/couples/request', { peerId: selectedPeerId }), '情侣绑定申请已发送')} className="mt-3 w-full rounded-xl bg-rose-500 py-3 text-sm font-semibold text-white disabled:opacity-40">
            发起情侣绑定申请
          </button>
          {friendPickerOpen && <div className="fixed inset-0 z-[80] flex items-end justify-center" onClick={() => setFriendPickerOpen(false)}>
            <div className="absolute inset-0 bg-black/35 backdrop-blur-sm" />
            <div className="relative max-h-[70dvh] w-full max-w-lg overflow-hidden rounded-t-3xl bg-white shadow-2xl dark:bg-gray-900" onClick={event => event.stopPropagation()}>
              <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 dark:border-gray-800">
                <div><h3 className="text-base font-bold text-gray-900 dark:text-white">选择情侣好友</h3><p className="mt-0.5 text-xs text-gray-400">每个人同时只能绑定一位情侣</p></div>
                <button onClick={() => setFriendPickerOpen(false)} className="rounded-full p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"><X size={18} /></button>
              </div>
              <div className="max-h-[calc(70dvh-76px)] space-y-1 overflow-y-auto px-4 py-3">
                {friends.map(friend => {
                  const name = friend.alias || friend.peer.nickname || friend.peer.username;
                  const selected = selectedPeerId === friend.peer.id;
                  return <button key={friend.peer.id} onClick={() => { setSelectedPeerId(friend.peer.id); setFriendPickerOpen(false); }} className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition-colors ${selected ? 'bg-rose-50 dark:bg-rose-950/30' : 'hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-rose-100 text-sm font-bold text-rose-500 dark:bg-rose-950/40">{friend.peer.avatar ? <img src={assetUrl(friend.peer.avatar)} alt="" className="h-full w-full object-cover" /> : name[0]}</span>
                    <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-gray-800 dark:text-gray-100">{name}</span><span className="mt-0.5 block text-xs text-gray-400">Echo ID: {friend.peer.digitalId}</span></span>
                    {selected && <Check size={18} className="text-rose-500" />}
                  </button>;
                })}
                {friends.length === 0 && <p className="py-8 text-center text-sm text-gray-400">暂无可邀请的好友</p>}
              </div>
            </div>
          </div>}
        </div>
      </div>
    );
  }

  if (summary.status === 'pending') {
    return (
      <div className="flex h-full items-center justify-center bg-gradient-to-b from-rose-50 to-white px-5 dark:from-rose-950/20 dark:to-gray-950">
        <div className="w-full max-w-md rounded-3xl bg-white/80 p-6 text-center shadow-xl backdrop-blur dark:bg-gray-900/80">
          <Heart className="mx-auto text-rose-500" size={34} />
          <h2 className="mt-4 text-lg font-bold text-gray-900 dark:text-white">情侣绑定申请</h2>
          <p className="mt-2 text-sm text-gray-500">{summary.pendingForMe ? `${peerName} 邀请你进入关系空间` : `已向 ${peerName} 发出申请，等待对方确认`}</p>
          {summary.pendingForMe && <div className="mt-5 flex gap-3">
            <button disabled={busy} onClick={() => act(() => api('POST', '/api/couples/respond', { accept: false }), '已拒绝申请')} className="flex-1 rounded-xl bg-gray-100 py-3 text-sm text-gray-600 dark:bg-gray-800 dark:text-gray-300">拒绝</button>
            <button disabled={busy} onClick={() => act(() => api('POST', '/api/couples/respond', { accept: true }), '情侣空间已开启')} className="flex-1 rounded-xl bg-rose-500 py-3 text-sm font-semibold text-white">同意</button>
          </div>}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-gradient-to-b from-rose-50 via-white to-slate-50 px-4 py-5 dark:from-rose-950/20 dark:via-gray-950 dark:to-gray-950">
      <div className="mx-auto max-w-lg space-y-4">
        <section className="rounded-3xl bg-gradient-to-br from-rose-500 to-fuchsia-500 p-5 text-white shadow-xl shadow-rose-500/20">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl bg-white/20 text-lg font-bold">
              {summary.peer?.avatar ? <img src={assetUrl(summary.peer.avatar)} className="h-full w-full object-cover" alt="" /> : peerName[0]}
            </div>
            <div><p className="text-xs text-white/70">关系空间</p><h2 className="text-lg font-bold">你和 {peerName}</h2></div>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-white/15 p-3"><p className="text-xs text-white/70">相识时长</p><p className="mt-1 text-sm font-semibold">{duration(summary.metAt)}</p></div>
            <div className="rounded-2xl bg-white/15 p-3"><p className="text-xs text-white/70">相恋时长</p><p className="mt-1 text-sm font-semibold">{duration(summary.datingAt || summary.bondedAt)}</p></div>
          </div>
          <div className="mt-3 rounded-2xl bg-white/15 p-3"><p className="text-xs text-white/70">{summary.countdownTitle || '下一个纪念日'}</p><p className="mt-1 text-sm font-semibold">{countdown(summary.countdownAt)}</p></div>
        </section>

        {summary.weatherAlert && <div className="flex gap-2 rounded-2xl bg-amber-50 p-3 text-sm text-amber-700 dark:bg-amber-950/30 dark:text-amber-300"><ShieldAlert className="shrink-0" size={18} />{summary.weatherAlert}</div>}
        <section className="grid grid-cols-2 gap-3">
          <WeatherCard title="我的天气" city={summary.myCityName} weather={summary.myWeather} />
          <WeatherCard title={`${peerName}的天气`} city={summary.peerCityName} weather={summary.peerWeather} />
        </section>
        {summary.distanceKm != null && <p className="text-center text-xs text-gray-400">两座城市中心相距约 {summary.distanceKm} 公里</p>}

        <section className="rounded-2xl bg-white/70 p-4 shadow-sm backdrop-blur dark:bg-gray-900/70">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-800 dark:text-gray-100"><PawPrint size={17} className="text-amber-500" />共同宠物</div>
          <p className="mt-2 text-sm text-gray-500">{summary.pet ? `${summary.pet.name} · Lv.${summary.pet.level} · ${summary.pet.coins} 金币 · ${summary.pet.activity}` : '还没有共同宠物，可在聊天中发起领养。'}</p>
        </section>

        <section className="rounded-2xl bg-white/70 p-3 shadow-sm backdrop-blur dark:bg-gray-900/70">
          <div className="flex gap-2 overflow-x-auto pb-2">
            {MODULES.map(({ key, label, icon: Icon }) => <button key={key} onClick={() => setModule(key)} className={`flex shrink-0 items-center gap-1 rounded-full px-3 py-2 text-xs ${module === key ? 'bg-rose-500 text-white' : 'bg-gray-100 text-gray-500 dark:bg-gray-800'}`}><Icon size={13} />{label}</button>)}
            <button onClick={() => setModule('decision')} className={`shrink-0 rounded-full px-3 py-2 text-xs ${module === 'decision' ? 'bg-rose-500 text-white' : 'bg-gray-100 text-gray-500 dark:bg-gray-800'}`}>决定机器</button>
          </div>

          {module === 'decision' ? <div className="space-y-3 pt-2">
            <p className="text-xs text-gray-400">用逗号分隔候选项，让系统随机决定。</p>
            <input value={decisionOptions} onChange={e => setDecisionOptions(e.target.value)} className="w-full rounded-xl bg-gray-100 px-3 py-2.5 text-sm outline-none dark:bg-gray-800 dark:text-gray-200" />
            <button onClick={() => {
              const options = decisionOptions.split(/[,，]/).map(value => value.trim()).filter(Boolean);
              setDecisionResult(options.length ? options[Math.floor(Math.random() * options.length)] : '请先填写候选项');
            }} className="w-full rounded-xl bg-violet-500 py-2.5 text-sm font-semibold text-white">帮我们决定</button>
            {decisionResult && <p className="rounded-xl bg-violet-50 p-3 text-center text-sm font-bold text-violet-600 dark:bg-violet-950/30">结果：{decisionResult}</p>}
          </div> : <div className="space-y-3 pt-2">
            {(module === 'photo' || module === 'footprint') && <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-rose-50 py-3 text-sm text-rose-500 dark:bg-rose-950/30"><Camera size={16} />添加照片<input type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && uploadPhoto(e.target.files[0])} /></label>}
            {itemForm.images.length > 0 && <div className="flex gap-2 overflow-x-auto">{itemForm.images.map(url => <img key={url} src={assetUrl(url)} alt="" className="h-16 w-16 rounded-xl object-cover" />)}</div>}
            <input value={itemForm.title} onChange={e => setItemForm({ ...itemForm, title: e.target.value })} placeholder={module === 'song' ? '歌曲名或链接' : module === 'footprint' ? '城市或旅行名称' : '标题'} className="w-full rounded-xl bg-gray-100 px-3 py-2.5 text-sm outline-none dark:bg-gray-800 dark:text-gray-200" />
            {module === 'footprint' && <input value={itemForm.cityName} onChange={e => setItemForm({ ...itemForm, cityName: e.target.value })} placeholder="去过的城市" className="w-full rounded-xl bg-gray-100 px-3 py-2.5 text-sm outline-none dark:bg-gray-800 dark:text-gray-200" />}
            <textarea value={itemForm.content} onChange={e => setItemForm({ ...itemForm, content: e.target.value })} placeholder={module === 'praise' ? '写一句想夸对方的话' : module === 'grudge' ? '记录这件事，之后可以归档' : '备注'} className="min-h-20 w-full rounded-xl bg-gray-100 px-3 py-2.5 text-sm outline-none dark:bg-gray-800 dark:text-gray-200" />
            {(module === 'photo' || module === 'footprint') && <input type="date" value={itemForm.happenedAt} onChange={e => setItemForm({ ...itemForm, happenedAt: e.target.value })} className="w-full rounded-xl bg-gray-100 px-3 py-2.5 text-sm outline-none dark:bg-gray-800 dark:text-gray-200" />}
            <button disabled={busy || (!itemForm.title && !itemForm.content && itemForm.images.length === 0)} onClick={createItem} className="w-full rounded-xl bg-rose-500 py-2.5 text-sm font-semibold text-white disabled:opacity-40">保存</button>
            <div className="space-y-2">
              {visibleItems.map(item => <div key={item.id} className="rounded-xl bg-gray-50 p-3 dark:bg-gray-800/70">
                {(() => { try { const images = JSON.parse(item.images) as string[]; return images.length ? <div className="mb-2 flex gap-2 overflow-x-auto">{images.map(url => <img key={url} src={assetUrl(url)} alt="" className="h-20 w-20 rounded-lg object-cover" />)}</div> : null; } catch { return null; } })()}
                <div className="flex items-start justify-between gap-2"><div><p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{item.title || item.cityName || '未命名记录'}</p><p className="mt-1 whitespace-pre-wrap text-xs text-gray-500">{item.content}</p>{item.happenedAt && <p className="mt-1 text-[11px] text-gray-400">{new Date(item.happenedAt).toLocaleDateString()}</p>}</div><button onClick={() => archiveItem(item.id)} className="shrink-0 text-gray-300 hover:text-red-400"><Trash2 size={15} /></button></div>
              </div>)}
              {visibleItems.length === 0 && <p className="py-4 text-center text-xs text-gray-400">还没有记录</p>}
            </div>
          </div>}
        </section>

        <RelationshipCarePanel myCycle={summary.myCycle} peerCycle={summary.peerCycle} currentSkin={summary.pet?.skin} onRefresh={() => load()} />

        <div className="grid grid-cols-2 gap-3">
          <button disabled={busy} onClick={() => act(() => api('POST', '/api/couples/sos'), 'SOS 已发送')} className="flex items-center justify-center gap-2 rounded-2xl bg-rose-500 py-3 text-sm font-semibold text-white"><Send size={16} />SOS 想你</button>
          <button onClick={() => setEditing(value => !value)} className="flex items-center justify-center gap-2 rounded-2xl bg-white py-3 text-sm font-semibold text-gray-600 shadow-sm dark:bg-gray-900 dark:text-gray-300"><MapPin size={16} />空间设置</button>
        </div>

        {editing && <section className="space-y-3 rounded-2xl bg-white/80 p-4 shadow-sm dark:bg-gray-900/80">
          <input value={form.cityName} onChange={e => setForm({ ...form, cityName: e.target.value })} placeholder="我的城市名称，例如：杭州" className="w-full rounded-xl bg-gray-100 px-3 py-2.5 text-sm outline-none dark:bg-gray-800 dark:text-gray-200" />
          <label className="block text-xs text-gray-400">相识时间<input type="datetime-local" value={form.metAt} onChange={e => setForm({ ...form, metAt: e.target.value })} className="mt-1 w-full rounded-xl bg-gray-100 px-3 py-2.5 text-sm text-gray-700 outline-none dark:bg-gray-800 dark:text-gray-200" /></label>
          <label className="block text-xs text-gray-400">相恋时间<input type="datetime-local" value={form.datingAt} onChange={e => setForm({ ...form, datingAt: e.target.value })} className="mt-1 w-full rounded-xl bg-gray-100 px-3 py-2.5 text-sm text-gray-700 outline-none dark:bg-gray-800 dark:text-gray-200" /></label>
          <input value={form.countdownTitle} onChange={e => setForm({ ...form, countdownTitle: e.target.value })} placeholder="倒计时标题，例如：周年纪念日" className="w-full rounded-xl bg-gray-100 px-3 py-2.5 text-sm outline-none dark:bg-gray-800 dark:text-gray-200" />
          <input type="datetime-local" value={form.countdownAt} onChange={e => setForm({ ...form, countdownAt: e.target.value })} className="w-full rounded-xl bg-gray-100 px-3 py-2.5 text-sm text-gray-700 outline-none dark:bg-gray-800 dark:text-gray-200" />
          <button disabled={busy} onClick={() => act(() => api('PATCH', '/api/couples', form), '关系空间设置已保存')} className="w-full rounded-xl bg-rose-500 py-2.5 text-sm font-semibold text-white">保存设置</button>
          <button disabled={!summary.canUnbind || busy} onClick={() => {
            if (window.confirm('解除情侣关系后，关系空间将关闭。确定继续？') && window.confirm('请再次确认：真的要解除情侣关系吗？')) act(() => api('POST', '/api/couples/unbind'), '情侣关系已解除');
          }} className="w-full rounded-xl py-2 text-xs text-red-500 disabled:text-gray-400">
            {summary.canUnbind ? '解除情侣关系' : `绑定 90 天内不可主动解除 · ${summary.unlockAt ? new Date(summary.unlockAt).toLocaleString() : ''}`}
          </button>
          <button disabled={busy} onClick={() => {
            if (window.confirm('仅在拉黑或账号注销等特殊情况下使用。确定申请强制解除？')) act(() => api('POST', '/api/couples/force-unbind'), '情侣关系已强制解除');
          }} className="w-full rounded-xl py-1 text-xs text-gray-400">特殊情况强制解除</button>
        </section>}
        <button onClick={() => load()} className="mx-auto flex items-center gap-1 py-2 text-xs text-gray-400"><RefreshCw size={13} />刷新空间</button>
      </div>
    </div>
  );
}
