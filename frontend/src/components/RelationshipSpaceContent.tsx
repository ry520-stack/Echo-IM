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
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { useToast } from '../contexts/ToastContext';
import RelationshipCarePanel from './RelationshipCarePanel';

interface Friend {
  id: string;
  peer: { id: string; username: string; nickname: string; avatar: string; digitalId: number };
  alias: string;
}
interface Weather { city?: string; weather?: string; temperature?: string; winddirection?: string; windpower?: string }
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
  peer?: { id: string; username: string; nickname: string; avatar: string; digitalId: number; gender?: string };
  myGender?: string;
  peerGender?: string;
  myLabel?: string;
  peerLabel?: string;
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
}

const H = '\u2665';
const S = {
  coupleSpace: '\u60c5\u4fa3\u7a7a\u95f4',
  openCoupleSpace: '\u5f00\u542f\u60c5\u4fa3\u7a7a\u95f4',
  intro: '\u9080\u8bf7\u4e00\u4f4d\u597d\u53cb\u786e\u8ba4\u540e\uff0c\u5171\u4eab\u7eaa\u5ff5\u65e5\u3001\u5929\u6c14\u3001\u5ba0\u7269\u3001\u76f8\u518c\u3001\u8db3\u8ff9\u548c\u5173\u6000\u529f\u80fd\u3002',
  chooseFriend: '\u9009\u62e9\u4e00\u4f4d\u597d\u53cb',
  needConfirm: '\u7533\u8bf7\u9700\u8981\u5bf9\u65b9\u786e\u8ba4',
  sendInvite: '\u53d1\u9001\u9080\u8bf7',
  selectFriend: '\u9009\u62e9\u597d\u53cb',
  onePartner: '\u4e00\u4e2a\u4eba\u540c\u65f6\u53ea\u80fd\u7ed1\u5b9a\u4e00\u4f4d\u60c5\u4fa3',
  noFriend: '\u6682\u65e0\u53ef\u9080\u8bf7\u7684\u597d\u53cb',
  pendingTitle: '\u60c5\u4fa3\u7ed1\u5b9a\u7533\u8bf7',
  reject: '\u62d2\u7edd',
  accept: '\u540c\u610f',
  acceptMsg: '\u60c5\u4fa3\u7a7a\u95f4\u5df2\u5f00\u542f',
  belong: '\u5c5e\u4e8e\u4f60\u4eec\u7684\u5c0f\u4e16\u754c',
  husband: '\u8001\u516c',
  wife: '\u5ab3\u5987\u513f',
  sweet: '\u751c\u871c\u8fde\u63a5\u4e2d',
  met: '\u76f8\u8bc6\u65f6\u957f',
  dating: '\u76f8\u604b\u65f6\u957f',
  nextDay: '\u4e0b\u4e00\u4e2a\u7eaa\u5ff5\u65e5',
  unset: '\u5c1a\u672a\u8bbe\u7f6e',
  arrived: '\u5df2\u5230\u8fbe',
  home: '\u9996\u9875',
  memory: '\u56de\u5fc6',
  care: '\u5173\u6000',
  settings: '\u8bbe\u7f6e',
  myWeather: '\u6211\u7684\u5929\u6c14',
  noCity: '\u672a\u8bbe\u7f6e\u57ce\u5e02',
  noWeather: '\u6682\u65e0\u5929\u6c14',
  distance: '\u4e24\u5ea7\u57ce\u5e02\u4e2d\u5fc3\u76f8\u8ddd\u7ea6',
  km: '\u516c\u91cc',
  pet: '\u5171\u540c\u5ba0\u7269',
  noPet: '\u8fd8\u6ca1\u6709\u5171\u540c\u5ba0\u7269\uff0c\u53ef\u5728\u804a\u5929\u4e2d\u53d1\u8d77\u9886\u517b\u3002',
  coins: '\u91d1\u5e01',
  sos: 'SOS \u60f3\u4f60',
  album: '\u76f8\u518c',
  footprint: '\u8db3\u8ff9',
  song: '\u60c5\u6b4c',
  praise: '\u5938\u5938',
  grudge: '\u8bb0\u4ec7',
  addPhoto: '\u6dfb\u52a0\u7167\u7247',
  save: '\u4fdd\u5b58',
  saved: '\u5df2\u4fdd\u5b58\u5230\u60c5\u4fa3\u7a7a\u95f4',
  archived: '\u5185\u5bb9\u5df2\u5f52\u6863',
  noRecord: '\u8fd8\u6ca1\u6709\u8bb0\u5f55',
  title: '\u6807\u9898',
  note: '\u5907\u6ce8',
  city: '\u53bb\u8fc7\u7684\u57ce\u5e02',
  decision: '\u51b3\u5b9a\u673a\u5668',
  decisionTip: '\u9009\u62e9\u56f0\u96be\u65f6\uff0c\u8ba9\u60c5\u4fa3\u7a7a\u95f4\u5e2e\u4f60\u4eec\u968f\u673a\u51b3\u5b9a\u3002',
  decide: '\u5e2e\u6211\u4eec\u51b3\u5b9a',
  result: '\u7ed3\u679c',
  cityPlaceholder: '\u6211\u7684\u57ce\u5e02\u540d\u79f0\uff0c\u4f8b\u5982\uff1a\u676d\u5dde',
  saveSettings: '\u4fdd\u5b58\u8bbe\u7f6e',
  settingsSaved: '\u60c5\u4fa3\u7a7a\u95f4\u8bbe\u7f6e\u5df2\u4fdd\u5b58',
  roleSelf: '\u6211\u7684\u79f0\u547c',
  rolePeer: '\u5bf9\u65b9\u79f0\u547c',
  albumPage: '\u60c5\u4fa3\u76f8\u518c',
  openAlbum: '\u6253\u5f00\u60c5\u4fa3\u76f8\u518c',
  originalUpload: '\u539f\u56fe\u4e0a\u4f20\uff0c\u4e0d\u538b\u7f29\u753b\u8d28',
  noPhoto: '\u8fd8\u6ca1\u6709\u7167\u7247',
  close: '\u5173\u95ed',
  unbind: '\u89e3\u9664\u60c5\u4fa3\u5173\u7cfb',
  forceUnbind: '\u7279\u6b8a\u60c5\u51b5\u5f3a\u5236\u89e3\u9664',
  refresh: '\u5237\u65b0\u60c5\u4fa3\u7a7a\u95f4',
};

const MEMORY_TABS = [
  { key: 'photo', label: S.album, Icon: Camera },
  { key: 'footprint', label: S.footprint, Icon: MapPin },
  { key: 'song', label: S.song, Icon: Music },
  { key: 'praise', label: S.praise, Icon: Sparkles },
  { key: 'grudge', label: S.grudge, Icon: Trash2 },
] as const;

function nameOf(peer?: Summary['peer']) {
  return peer?.nickname || peer?.username || '\u5bf9\u65b9';
}
function dateInput(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}
function duration(value?: string) {
  if (!value) return S.unset;
  const hours = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 3_600_000));
  return `${Math.floor(hours / 24)} \u5929 ${hours % 24} \u5c0f\u65f6`;
}
function countdown(value?: string) {
  if (!value) return S.unset;
  const hours = Math.ceil((new Date(value).getTime() - Date.now()) / 3_600_000);
  return hours >= 0 ? `${Math.floor(hours / 24)} \u5929 ${hours % 24} \u5c0f\u65f6` : S.arrived;
}
function defaultRole(gender?: string) {
  if (gender === 'male') return S.husband;
  if (gender === 'female') return S.wife;
  return '\u4eb2\u7231\u7684';
}
function imagesOf(item: CoupleItem) {
  try { return JSON.parse(item.images || '[]') as string[]; } catch { return []; }
}
function songUrl(item: CoupleItem) {
  return [item.content, item.title].find(value => /^https?:\/\//i.test((value || '').trim()))?.trim() || '';
}
function decodeMaybeEscaped(value?: string) {
  const text = value || '';
  if (!text.includes('\\u')) return text;
  try { return JSON.parse(`"${text.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`); } catch { return text; }
}
function WeatherCard({ label, city, weather }: { label: string; city?: string; weather?: Weather | null }) {
  const wind = decodeMaybeEscaped(weather?.winddirection);
  const windpower = decodeMaybeEscaped(weather?.windpower);
  const weatherText = decodeMaybeEscaped(weather?.weather);
  return (
    <div className="rounded-[24px] border border-white/80 bg-white/85 p-4 shadow-sm backdrop-blur dark:border-white/10 dark:bg-gray-900/80">
      <p className="text-xs text-gray-400">{label} · {city || S.noCity}</p>
      <p className="mt-2 text-xl font-bold text-gray-900 dark:text-white">
        {weather ? `${weatherText || '--'} ${weather.temperature || '--'}°C` : S.noWeather}
      </p>
      {wind && <p className="mt-1 text-xs text-gray-400">{wind}风 {windpower || ''}级</p>}
    </div>
  );
}
export default function RelationshipSpaceContent() {
  const { user } = useAuth();
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
  const [decisionOptions, setDecisionOptions] = useState('\u706b\u9505\u3001\u7535\u5f71\u3001\u6563\u6b65\u3001\u5976\u8336');
  const [decisionResult, setDecisionResult] = useState('');
  const [albumOpen, setAlbumOpen] = useState(false);
  const [selfRole, setSelfRole] = useState(S.husband);
  const [peerRole, setPeerRole] = useState(S.wife);
  const [gender, setGender] = useState('');

  const load = useCallback(async () => setSummary(await api<Summary>('GET', '/api/couples')), []);
  const loadItems = useCallback(async () => setItems(await api<CoupleItem[]>('GET', '/api/couples/items')), []);
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
    setGender(summary.myGender || user?.gender || '');
    setSelfRole(summary.myLabel || defaultRole(summary.myGender || user?.gender));
    setPeerRole(summary.peerLabel || defaultRole(summary.peerGender || summary.peer?.gender));
  }, [summary, user?.gender]);

  const act = async (request: () => Promise<unknown>, message: string) => {
    setBusy(true);
    try { await request(); await load(); toast(message, 'success'); }
    catch (error: any) { toast(error.message || '\u64cd\u4f5c\u5931\u8d25', 'error'); }
    finally { setBusy(false); }
  };

  const peerName = useMemo(() => nameOf(summary.peer), [summary.peer]);
  const selectedFriend = friends.find(friend => friend.peer.id === selectedPeerId);
  const visibleItems = items.filter(item => item.type === memoryTab);
  const albumPhotos = items.filter(item => item.type === 'photo').flatMap(item => imagesOf(item).map(url => ({ url, item })));

  const uploadPhoto = async (file: File) => {
    setBusy(true);
    try {
      const data = new FormData();
      data.append('file', file);
      const token = localStorage.getItem('echo-token');
      const response = await fetch(`${getServerUrl()}/api/upload/chat-image`, { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : undefined, body: data });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || '\u4e0a\u4f20\u5931\u8d25');
      setItemForm(current => ({ ...current, images: [...current.images, result.url].slice(0, 9) }));
    } catch (error: any) {
      toast(error.message || '\u4e0a\u4f20\u5931\u8d25', 'error');
    } finally {
      setBusy(false);
    }
  };
  const createItem = () => act(async () => {
    await api('POST', '/api/couples/items', { ...itemForm, type: memoryTab });
    setItemForm({ title: '', content: '', cityName: '', happenedAt: '', images: [] });
    await loadItems();
  }, S.saved);
  const archiveItem = (id: string) => act(async () => {
    await api('DELETE', `/api/couples/items/${id}`);
    await loadItems();
  }, S.archived);

  if (summary.status === 'none') {
    return (
      <div className="h-full overflow-y-auto bg-gradient-to-b from-rose-50 via-white to-white px-5 py-8 dark:from-rose-950/20 dark:via-gray-950 dark:to-gray-950">
        <div className="mx-auto max-w-md text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[28px] bg-white text-rose-500 shadow-xl shadow-rose-200/50 dark:bg-gray-900"><Heart size={36} /></div>
          <h2 className="mt-5 text-2xl font-black text-gray-950 dark:text-white">{S.openCoupleSpace}</h2>
          <p className="mt-2 text-sm leading-6 text-gray-500">{S.intro}</p>
          <button onClick={() => setFriendPickerOpen(true)} className="mt-6 flex w-full items-center gap-3 rounded-[24px] bg-white px-4 py-4 text-left shadow-lg shadow-rose-100/70 dark:bg-gray-900 dark:shadow-none">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-rose-100 text-rose-500">
              {selectedFriend?.peer.avatar ? <img src={assetUrl(selectedFriend.peer.avatar)} alt="" className="h-full w-full object-cover" /> : selectedFriend ? (selectedFriend.alias || selectedFriend.peer.nickname || selectedFriend.peer.username)[0] : <Heart size={18} />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-bold text-gray-900 dark:text-white">{selectedFriend ? selectedFriend.alias || selectedFriend.peer.nickname || selectedFriend.peer.username : S.chooseFriend}</span>
              <span className="mt-1 block text-xs text-gray-400">{selectedFriend ? `Echo ID: ${selectedFriend.peer.digitalId}` : S.needConfirm}</span>
            </span>
            <ChevronDown size={18} className="text-gray-300" />
          </button>
          <button disabled={!selectedPeerId || busy} onClick={() => act(() => api('POST', '/api/couples/request', { peerId: selectedPeerId }), '\u60c5\u4fa3\u7ed1\u5b9a\u7533\u8bf7\u5df2\u53d1\u9001')} className="mt-3 w-full rounded-2xl bg-rose-500 py-3 text-sm font-bold text-white disabled:opacity-40">{S.sendInvite}</button>
        </div>
        {friendPickerOpen && (
          <div className="fixed inset-0 z-[80] flex items-end justify-center" onClick={() => setFriendPickerOpen(false)}>
            <div className="absolute inset-0 bg-black/35 backdrop-blur-sm" />
            <div className="relative max-h-[70dvh] w-full max-w-lg overflow-hidden rounded-t-[28px] bg-white shadow-2xl dark:bg-gray-900" onClick={event => event.stopPropagation()}>
              <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 dark:border-gray-800">
                <div><h3 className="text-base font-bold text-gray-900 dark:text-white">{S.selectFriend}</h3><p className="mt-0.5 text-xs text-gray-400">{S.onePartner}</p></div>
                <button onClick={() => setFriendPickerOpen(false)} className="rounded-full p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"><X size={18} /></button>
              </div>
              <div className="max-h-[calc(70dvh-76px)] space-y-1 overflow-y-auto px-4 py-3">
                {friends.map(friend => {
                  const friendName = friend.alias || friend.peer.nickname || friend.peer.username;
                  const selected = selectedPeerId === friend.peer.id;
                  return (
                    <button key={friend.peer.id} onClick={() => { setSelectedPeerId(friend.peer.id); setFriendPickerOpen(false); }} className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition-colors ${selected ? 'bg-rose-50 dark:bg-rose-950/30' : 'hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-rose-100 text-sm font-bold text-rose-500">{friend.peer.avatar ? <img src={assetUrl(friend.peer.avatar)} alt="" className="h-full w-full object-cover" /> : friendName[0]}</span>
                      <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-gray-800 dark:text-gray-100">{friendName}</span><span className="mt-0.5 block text-xs text-gray-400">Echo ID: {friend.peer.digitalId}</span></span>
                      {selected && <Check size={18} className="text-rose-500" />}
                    </button>
                  );
                })}
                {friends.length === 0 && <p className="py-8 text-center text-sm text-gray-400">{S.noFriend}</p>}
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
          <h2 className="mt-4 text-lg font-bold text-gray-900 dark:text-white">{S.pendingTitle}</h2>
          <p className="mt-2 text-sm text-gray-500">{summary.pendingForMe ? `${peerName} \u9080\u8bf7\u4f60\u8fdb\u5165${S.coupleSpace}` : `\u5df2\u5411 ${peerName} \u53d1\u51fa\u7533\u8bf7\uff0c\u7b49\u5f85\u5bf9\u65b9\u786e\u8ba4`}</p>
          {summary.pendingForMe && <div className="mt-5 flex gap-3"><button disabled={busy} onClick={() => act(() => api('POST', '/api/couples/respond', { accept: false }), '\u5df2\u62d2\u7edd\u7533\u8bf7')} className="flex-1 rounded-2xl bg-gray-100 py-3 text-sm text-gray-600 dark:bg-gray-800 dark:text-gray-300">{S.reject}</button><button disabled={busy} onClick={() => act(() => api('POST', '/api/couples/respond', { accept: true }), S.acceptMsg)} className="flex-1 rounded-2xl bg-rose-500 py-3 text-sm font-bold text-white">{S.accept}</button></div>}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-[radial-gradient(circle_at_top,#ffe4ec_0,#fff7f9_34%,#ffffff_70%)] px-4 py-5 dark:bg-gray-950">
      <div className="mx-auto max-w-lg space-y-4">
        <section className="overflow-hidden rounded-[34px] bg-gradient-to-br from-rose-400 via-pink-400 to-fuchsia-500 text-white shadow-2xl shadow-rose-200/70 dark:shadow-none">
          <div className="relative p-5">
            <div className="absolute left-8 top-8 text-lg opacity-30 animate-pulse">{H}</div>
            <div className="absolute right-10 top-16 text-2xl opacity-25 animate-bounce">{H}</div>
            <div className="absolute bottom-20 left-1/2 text-sm opacity-30 animate-pulse">{H}</div>
            <div className="absolute -right-12 -top-12 h-44 w-44 rounded-full bg-white/25 blur-3xl" />
            <div className="absolute -bottom-16 left-8 h-40 w-40 rounded-full bg-fuchsia-300/35 blur-3xl" />
            <div className="relative text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/70">{S.coupleSpace}</p>
              <h2 className="mt-1 text-2xl font-black">{S.belong}</h2>
            </div>
            <div className="relative mt-5 flex items-center justify-between gap-3">
              <div className="flex min-w-0 flex-1 flex-col items-center">
                <div className="h-20 w-20 overflow-hidden rounded-[28px] border-4 border-white/70 bg-white/25 shadow-xl">{user?.avatar ? <img src={assetUrl(user.avatar)} className="h-full w-full object-cover" alt="" /> : <div className="flex h-full w-full items-center justify-center text-2xl font-black">{(user?.nickname || user?.username || '\u6211')[0]}</div>}</div>
                <p className="mt-2 max-w-full truncate text-sm font-bold">{user?.nickname || user?.username || '\u6211'}</p>
                <span className="mt-1 rounded-full bg-white/20 px-3 py-1 text-[11px] font-semibold">{selfRole}</span>
              </div>
              <div className="flex shrink-0 flex-col items-center"><div className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-3xl text-rose-500 shadow-xl shadow-rose-500/20">{H}</div><p className="mt-2 text-[11px] text-white/75">{S.sweet}</p></div>
              <div className="flex min-w-0 flex-1 flex-col items-center">
                <div className="h-20 w-20 overflow-hidden rounded-[28px] border-4 border-white/70 bg-white/25 shadow-xl">{summary.peer?.avatar ? <img src={assetUrl(summary.peer.avatar)} className="h-full w-full object-cover" alt="" /> : <div className="flex h-full w-full items-center justify-center text-2xl font-black">{peerName[0]}</div>}</div>
                <p className="mt-2 max-w-full truncate text-sm font-bold">{peerName}</p>
                <span className="mt-1 rounded-full bg-white/20 px-3 py-1 text-[11px] font-semibold">{peerRole}</span>
              </div>
            </div>
            <div className="relative mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-3xl bg-white/20 p-4 backdrop-blur"><p className="text-xs text-white/70">{S.met}</p><p className="mt-1 text-lg font-bold">{duration(summary.metAt)}</p></div>
              <div className="rounded-3xl bg-white/20 p-4 backdrop-blur"><p className="text-xs text-white/70">{S.dating}</p><p className="mt-1 text-lg font-bold">{duration(summary.datingAt || summary.bondedAt)}</p></div>
            </div>
            <div className="relative mt-3 rounded-3xl bg-white/20 p-4 backdrop-blur"><p className="text-xs text-white/70">{summary.countdownTitle || S.nextDay}</p><p className="mt-1 text-xl font-black">{countdown(summary.countdownAt)}</p></div>
          </div>
        </section>

        <div className="grid grid-cols-4 gap-2 rounded-[26px] bg-white/80 p-2 shadow-sm backdrop-blur dark:bg-gray-900/80">
          {[['home', S.home, CalendarHeart], ['memory', S.memory, Camera], ['care', S.care, Umbrella], ['settings', S.settings, Settings]].map(([key, label, Icon]: any) => (
            <button key={key} onClick={() => setSection(key)} className={`flex flex-col items-center gap-1 rounded-2xl py-2 text-xs transition-colors ${section === key ? 'bg-rose-500 text-white shadow-lg shadow-rose-200' : 'text-gray-400'}`}><Icon size={16} />{label}</button>
          ))}
        </div>

        {section === 'home' && (
          <>
            {summary.weatherAlert && <div className="flex gap-2 rounded-[24px] bg-amber-50 p-4 text-sm text-amber-700 dark:bg-amber-950/30 dark:text-amber-300"><Umbrella className="shrink-0" size={18} />{summary.weatherAlert}</div>}
            <section className="grid grid-cols-2 gap-3"><WeatherCard label={S.myWeather} city={summary.myCityName} weather={summary.myWeather} /><WeatherCard label={`${peerName}\u7684\u5929\u6c14`} city={summary.peerCityName} weather={summary.peerWeather} /></section>
            {summary.distanceKm != null && <p className="text-center text-xs text-gray-400">{S.distance} {summary.distanceKm} {S.km}</p>}
            <section className="rounded-[28px] border border-white/80 bg-white/85 p-4 shadow-sm backdrop-blur dark:border-white/10 dark:bg-gray-900/80"><div className="flex items-center gap-2 text-base font-bold text-gray-900 dark:text-white"><PawPrint size={18} className="text-amber-500" />{S.pet}</div><p className="mt-2 text-sm text-gray-500">{summary.pet ? `${summary.pet.name} · Lv.${summary.pet.level} · ${summary.pet.coins} ${S.coins} · ${summary.pet.activity}` : S.noPet}</p></section>
            <div className="grid grid-cols-2 gap-3"><button disabled={busy} onClick={() => act(() => api('POST', '/api/couples/sos'), 'SOS \u5df2\u53d1\u9001')} className="flex items-center justify-center gap-2 rounded-[24px] bg-rose-500 py-4 text-sm font-bold text-white"><Send size={16} />{S.sos}</button><button onClick={() => setSection('settings')} className="flex items-center justify-center gap-2 rounded-[24px] bg-white py-4 text-sm font-bold text-gray-600 shadow-sm dark:bg-gray-900 dark:text-gray-300"><Settings size={16} />{S.settings}</button></div>
          </>
        )}

        {section === 'memory' && (
          <section className="rounded-[28px] border border-white/80 bg-white/85 p-4 shadow-sm backdrop-blur dark:border-white/10 dark:bg-gray-900/80">
            <div className="mb-3 flex gap-2 overflow-x-auto pb-1">{MEMORY_TABS.map(({ key, label, Icon }) => <button key={key} onClick={() => setMemoryTab(key)} className={`flex shrink-0 items-center gap-1 rounded-full px-3 py-2 text-xs ${memoryTab === key ? 'bg-rose-500 text-white' : 'bg-gray-100 text-gray-500 dark:bg-gray-800'}`}><Icon size={13} />{label}</button>)}</div>
            {memoryTab === 'photo' && <button onClick={() => setAlbumOpen(true)} className="mb-3 flex w-full items-center justify-between rounded-2xl bg-gradient-to-r from-rose-500 to-fuchsia-500 px-4 py-3 text-left text-sm font-bold text-white shadow-lg shadow-rose-200/60"><span>{S.openAlbum}</span><span className="text-xs font-medium text-white/75">{albumPhotos.length} photos</span></button>}
            {memoryTab === 'photo' && <p className="mb-2 text-xs text-gray-400">{S.originalUpload}</p>}
            {(memoryTab === 'photo' || memoryTab === 'footprint') && <label className="mb-3 flex cursor-pointer items-center justify-center gap-2 rounded-2xl bg-rose-50 py-3 text-sm font-semibold text-rose-500 dark:bg-rose-950/30"><ImagePlus size={16} />{S.addPhoto}<input type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && uploadPhoto(e.target.files[0])} /></label>}
            {itemForm.images.length > 0 && <div className="mb-3 flex gap-2 overflow-x-auto">{itemForm.images.map(url => <img key={url} src={assetUrl(url)} alt="" className="h-16 w-16 rounded-xl object-cover" />)}</div>}
            <div className="space-y-2"><input value={itemForm.title} onChange={e => setItemForm({ ...itemForm, title: e.target.value })} placeholder={memoryTab === 'song' ? `${S.song}${S.title}` : S.title} className="w-full rounded-2xl bg-gray-100 px-3 py-2.5 text-sm outline-none dark:bg-gray-800 dark:text-gray-200" />{memoryTab === 'footprint' && <input value={itemForm.cityName} onChange={e => setItemForm({ ...itemForm, cityName: e.target.value })} placeholder={S.city} className="w-full rounded-2xl bg-gray-100 px-3 py-2.5 text-sm outline-none dark:bg-gray-800 dark:text-gray-200" />}<textarea value={itemForm.content} onChange={e => setItemForm({ ...itemForm, content: e.target.value })} placeholder={S.note} className="min-h-20 w-full rounded-2xl bg-gray-100 px-3 py-2.5 text-sm outline-none dark:bg-gray-800 dark:text-gray-200" />{(memoryTab === 'photo' || memoryTab === 'footprint') && <input type="date" value={itemForm.happenedAt} onChange={e => setItemForm({ ...itemForm, happenedAt: e.target.value })} className="w-full rounded-2xl bg-gray-100 px-3 py-2.5 text-sm outline-none dark:bg-gray-800 dark:text-gray-200" />}<button disabled={busy || (!itemForm.title && !itemForm.content && itemForm.images.length === 0)} onClick={createItem} className="w-full rounded-2xl bg-rose-500 py-3 text-sm font-bold text-white disabled:opacity-40">{S.save}</button></div>
            <div className="mt-4 space-y-2">{visibleItems.map(item => <div key={item.id} className="rounded-2xl bg-gray-50 p-3 dark:bg-gray-800/70">{imagesOf(item).length > 0 && <div className="mb-2 flex gap-2 overflow-x-auto">{imagesOf(item).map(url => <img key={url} src={assetUrl(url)} alt="" className="h-20 w-20 rounded-xl object-cover" />)}</div>}<div className="flex items-start justify-between gap-2"><div className="min-w-0 flex-1"><p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{item.title || item.cityName || '\u672a\u547d\u540d\u8bb0\u5f55'}</p><p className="mt-1 whitespace-pre-wrap text-xs text-gray-500">{item.content}</p>{memoryTab === 'song' && songUrl(item) && <audio className="mt-2 h-9 w-full" controls preload="none" src={songUrl(item)} />}{item.happenedAt && <p className="mt-1 text-[11px] text-gray-400">{new Date(item.happenedAt).toLocaleDateString()}</p>}</div><button onClick={() => archiveItem(item.id)} className="shrink-0 text-gray-300 hover:text-red-400"><Trash2 size={15} /></button></div></div>)}{visibleItems.length === 0 && <p className="py-4 text-center text-xs text-gray-400">{S.noRecord}</p>}</div>
          </section>
        )}

        {section === 'care' && (
          <>
            <RelationshipCarePanel myCycle={summary.myCycle} peerCycle={summary.peerCycle} currentSkin={summary.pet?.skin} onRefresh={() => load()} />
            <section className="rounded-[28px] border border-white/80 bg-white/85 p-4 shadow-sm backdrop-blur dark:border-white/10 dark:bg-gray-900/80">
              <p className="text-sm font-bold text-gray-900 dark:text-white">{S.decision}</p>
              <p className="mt-1 text-xs text-gray-400">{S.decisionTip}</p>
              <input value={decisionOptions} onChange={e => setDecisionOptions(e.target.value)} className="mt-3 w-full rounded-2xl bg-gray-100 px-3 py-2.5 text-sm outline-none dark:bg-gray-800 dark:text-gray-200" />
              <button onClick={() => { const options = decisionOptions.split(/[,，、]/).map(value => value.trim()).filter(Boolean); setDecisionResult(options.length ? options[Math.floor(Math.random() * options.length)] : '\u8bf7\u5148\u586b\u5199\u5019\u9009\u9879'); }} className="mt-2 w-full rounded-2xl bg-violet-500 py-3 text-sm font-bold text-white">{S.decide}</button>
              {decisionResult && <p className="mt-3 rounded-2xl bg-violet-50 p-3 text-center text-sm font-bold text-violet-600 dark:bg-violet-950/30">{S.result}: {decisionResult}</p>}
            </section>
          </>
        )}

        {section === 'settings' && (
          <section className="space-y-3 rounded-[28px] border border-white/80 bg-white/85 p-4 shadow-sm backdrop-blur dark:border-white/10 dark:bg-gray-900/80">
            <input value={form.cityName} onChange={e => setForm({ ...form, cityName: e.target.value })} placeholder={S.cityPlaceholder} className="w-full rounded-2xl bg-gray-100 px-3 py-2.5 text-sm outline-none dark:bg-gray-800 dark:text-gray-200" />
            <select value={gender} onChange={e => setGender(e.target.value)} className="w-full rounded-2xl bg-gray-100 px-3 py-2.5 text-sm outline-none dark:bg-gray-800 dark:text-gray-200">
              <option value="">性别未设置</option>
              <option value="male">男</option>
              <option value="female">女</option>
              <option value="other">其他</option>
            </select>
            <div className="grid grid-cols-2 gap-2">
              <input value={selfRole} onChange={e => setSelfRole(e.target.value)} placeholder={S.roleSelf} className="w-full rounded-2xl bg-gray-100 px-3 py-2.5 text-sm outline-none dark:bg-gray-800 dark:text-gray-200" />
              <input value={peerRole} onChange={e => setPeerRole(e.target.value)} placeholder={S.rolePeer} className="w-full rounded-2xl bg-gray-100 px-3 py-2.5 text-sm outline-none dark:bg-gray-800 dark:text-gray-200" />
            </div>
            <label className="block text-xs text-gray-400">{S.met}<input type="datetime-local" value={form.metAt} onChange={e => setForm({ ...form, metAt: e.target.value })} className="mt-1 w-full rounded-2xl bg-gray-100 px-3 py-2.5 text-sm text-gray-700 outline-none dark:bg-gray-800 dark:text-gray-200" /></label>
            <label className="block text-xs text-gray-400">{S.dating}<input type="datetime-local" value={form.datingAt} onChange={e => setForm({ ...form, datingAt: e.target.value })} className="mt-1 w-full rounded-2xl bg-gray-100 px-3 py-2.5 text-sm text-gray-700 outline-none dark:bg-gray-800 dark:text-gray-200" /></label>
            <input value={form.countdownTitle} onChange={e => setForm({ ...form, countdownTitle: e.target.value })} placeholder={S.nextDay} className="w-full rounded-2xl bg-gray-100 px-3 py-2.5 text-sm outline-none dark:bg-gray-800 dark:text-gray-200" />
            <input type="datetime-local" value={form.countdownAt} onChange={e => setForm({ ...form, countdownAt: e.target.value })} className="w-full rounded-2xl bg-gray-100 px-3 py-2.5 text-sm text-gray-700 outline-none dark:bg-gray-800 dark:text-gray-200" />
            <button disabled={busy} onClick={() => act(() => api('PATCH', '/api/couples', { ...form, gender, myLabel: selfRole, peerLabel: peerRole }), S.settingsSaved)} className="w-full rounded-2xl bg-rose-500 py-3 text-sm font-bold text-white">{S.saveSettings}</button>
            <button disabled={!summary.canUnbind || busy} onClick={() => { if (window.confirm('\u89e3\u9664\u60c5\u4fa3\u5173\u7cfb\u540e\uff0c\u60c5\u4fa3\u7a7a\u95f4\u5c06\u5173\u95ed\u3002\u786e\u5b9a\u7ee7\u7eed\uff1f') && window.confirm('\u8bf7\u518d\u6b21\u786e\u8ba4\uff1a\u771f\u7684\u8981\u89e3\u9664\u60c5\u4fa3\u5173\u7cfb\u5417\uff1f')) act(() => api('POST', '/api/couples/unbind'), '\u60c5\u4fa3\u5173\u7cfb\u5df2\u89e3\u9664'); }} className="w-full rounded-2xl py-2 text-xs text-red-500 disabled:text-gray-400">{summary.canUnbind ? S.unbind : `\u7ed1\u5b9a 90 \u5929\u5185\u4e0d\u53ef\u4e3b\u52a8\u89e3\u9664 · ${summary.unlockAt ? new Date(summary.unlockAt).toLocaleString() : ''}`}</button>
            <button disabled={busy} onClick={() => { if (window.confirm('\u4ec5\u5728\u62c9\u9ed1\u6216\u8d26\u53f7\u6ce8\u9500\u7b49\u7279\u6b8a\u60c5\u51b5\u4e0b\u4f7f\u7528\u3002\u786e\u5b9a\u7533\u8bf7\u5f3a\u5236\u89e3\u9664\uff1f')) act(() => api('POST', '/api/couples/force-unbind'), '\u60c5\u4fa3\u5173\u7cfb\u5df2\u5f3a\u5236\u89e3\u9664'); }} className="w-full rounded-2xl py-1 text-xs text-gray-400">{S.forceUnbind}</button>
          </section>
        )}
        {albumOpen && (
          <div className="fixed inset-0 z-[90] overflow-y-auto bg-white dark:bg-gray-950">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-100 bg-white/90 px-4 py-4 backdrop-blur dark:border-gray-800 dark:bg-gray-950/90">
              <button onClick={() => setAlbumOpen(false)} className="flex items-center gap-1 text-sm font-semibold text-gray-500"><X size={18} />{S.close}</button>
              <h2 className="text-lg font-black text-gray-900 dark:text-white">{S.albumPage}</h2>
              <label className="flex cursor-pointer items-center gap-1 rounded-full bg-rose-500 px-3 py-2 text-xs font-bold text-white">
                <ImagePlus size={14} />{S.addPhoto}
                <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && uploadPhoto(e.target.files[0])} />
              </label>
            </div>
            <div className="mx-auto max-w-lg p-4">
              <div className="mb-4 rounded-[28px] bg-gradient-to-r from-rose-500 to-fuchsia-500 p-5 text-white shadow-xl shadow-rose-200/60">
                <p className="text-xs text-white/75">{S.originalUpload}</p>
                <p className="mt-1 text-2xl font-black">{albumPhotos.length} photos</p>
              </div>
              {albumPhotos.length === 0 ? (
                <p className="py-20 text-center text-sm text-gray-400">{S.noPhoto}</p>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {albumPhotos.map(({ url, item }, index) => (
                    <a key={`${item.id}-${url}-${index}`} href={assetUrl(url)} target="_blank" rel="noreferrer" className="group overflow-hidden rounded-[24px] bg-gray-100 shadow-sm">
                      <img src={assetUrl(url)} alt={item.title || S.albumPage} className="aspect-[3/4] w-full object-cover transition-transform duration-300 group-active:scale-95" />
                      {(item.title || item.happenedAt) && <div className="p-2 text-xs text-gray-500"><p className="truncate font-semibold text-gray-700">{item.title || S.albumPage}</p>{item.happenedAt && <p>{new Date(item.happenedAt).toLocaleDateString()}</p>}</div>}
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
        <button onClick={() => load()} className="mx-auto flex items-center gap-1 py-2 text-xs text-gray-400"><RefreshCw size={13} />{S.refresh}</button>
      </div>
    </div>
  );
}

