import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import imageCompression from 'browser-image-compression';
import {
  AlarmClock,
  Camera,
  ChevronLeft,
  CloudSun,
  Heart,
  Home,
  Images,
  MessageCircleHeart,
  Music2,
  Save,
  Settings,
  Siren,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { api, getServerUrl } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { useToast } from '../contexts/ToastContext';
import { assetUrl } from '../utils/assetUrl';

interface FriendItem {
  peer: { id: string; digitalId: number; nickname: string; username: string; avatar: string };
  alias: string;
}

interface CoupleSpace {
  id: string;
  status: 'none' | 'pending' | 'active' | 'pending-unbind';
  requestedBy: string;
  pendingForMe: boolean;
  unbindPending?: boolean;
  unbindPendingForMe?: boolean;
  canUnbind?: boolean;
  unlockAt?: string | null;
  peer: { id: string; digitalId: number; nickname: string; username: string; avatar: string };
  boundAt?: string;
  bondedAt?: string;
  metAt?: string;
  loveAt?: string;
  datingAt?: string;
  countdownTitle?: string;
  countdownAt?: string;
  myCity?: string;
  myCityName?: string;
  myLat?: number;
  myLon?: number;
  peerCity?: string;
  peerCityName?: string;
  peerLat?: number;
  peerLon?: number;
  myWeather?: Weather | null;
  peerWeather?: Weather | null;
}

interface Weather {
  temperature?: number | string;
  weatherCode?: number;
  weather?: string;
  windpower?: string;
  humidity?: string;
  city?: string;
  reporttime?: string;
}

interface AlbumPhoto {
  id: string;
  url: string;
  originalUrl?: string;
  previewUrl?: string;
  thumbUrl?: string;
  createdAt: string;
  width: number;
  height: number;
  description: string;
}

interface AlbumGroup {
  id: string;
  title: string;
  date: string;
  location: string;
  description: string;
  coverUrl: string;
  photos: AlbumPhoto[];
}

type AlbumType = 'couple' | 'friends' | 'family';

const ALBUM_KEYS: Record<AlbumType, string> = {
  couple: 'echo-couple-album-groups',
  friends: 'echo-friends-album-groups',
  family: 'echo-family-album-groups',
};

const ALBUM_TITLES: Record<AlbumType, string> = {
  couple: '情侣相册',
  friends: '朋友相册',
  family: '家庭相册',
};
function albumPreviewSrc(photo?: AlbumPhoto | null) {
  return assetUrl(photo?.thumbUrl || photo?.previewUrl || photo?.url || '');
}

function albumOriginalSrc(photo?: AlbumPhoto | null) {
  return assetUrl(photo?.originalUrl || photo?.url || photo?.previewUrl || photo?.thumbUrl || '');
}

const WEATHER_CACHE_KEY = 'echo-weather-cache-v1';
const DEFAULT_PEER_CITY = '曲阜';
const CITY_COORDS: Record<string, { lat: number; lon: number; city: string }> = {
  曲阜: { lat: 35.5969, lon: 116.9916, city: '曲阜' },
  济宁: { lat: 35.4146, lon: 116.5872, city: '济宁' },
  沈北新区: { lat: 41.9131, lon: 123.5264, city: '沈北新区' },
};
const SONG_KEY = 'echo-couple-songs';
type FeaturePage = 'songs' | 'praise' | 'ledger' | 'diary' | null;

type CachedWeather = Record<string, { day: string; value: Weather | null }>;

interface SongItem {
  id: string;
  title: string;
  artist: string;
  category: 'husband' | 'wife' | 'duet';
  createdBy: string;
  createdAt: string;
}

interface CoupleBookEntry {
  id: string;
  type: 'praise' | 'ledger' | 'diary';
  createdBy: string;
  targetId: string;
  time: string;
  location: string;
  reason: string;
  mood: string;
  media?: string[];
  visibility?: 'private' | 'partner';
  apology?: string;
  status: 'open' | 'forgive_requested' | 'forgiven' | 'rejected';
  createdAt: string;
}

interface CoupleItemDto {
  id: string;
  createdBy: string;
  type: string;
  title: string;
  content: string;
  images: string;
  cityName: string;
  happenedAt?: string | null;
  createdAt: string;
}

function display(peer: FriendItem['peer'] | CoupleSpace['peer'], alias = '') {
  return alias || peer.nickname || peer.username;
}

function durationParts(ms: number) {
  const abs = Math.max(0, Math.abs(ms));
  const minutesTotal = Math.floor(abs / 60000);
  const days = Math.floor(minutesTotal / 1440);
  const hours = Math.floor((minutesTotal % 1440) / 60);
  const minutes = minutesTotal % 60;
  return `${days}天 ${String(hours).padStart(2, '0')}时 ${String(minutes).padStart(2, '0')}分`;
}

function durationSince(value: string | undefined, now: number) {
  if (!value) return '0天 00时 00分';
  return durationParts(now - new Date(value).getTime());
}

function durationUntil(value: string | undefined, now: number) {
  if (!value) return '0天 00时 00分';
  return durationParts(new Date(value).getTime() - now);
}

function weatherLabel(code: number) {
  if (code >= 95) return '雷雨';
  if (code >= 71) return '降雪';
  if (code >= 51) return '有雨';
  if (code >= 45) return '有雾';
  if (code >= 1) return '多云';
  return '晴朗';
}

function getBondedAt(space: CoupleSpace) {
  return space.bondedAt || space.boundAt;
}

function getDatingAt(space: CoupleSpace) {
  return space.datingAt || space.loveAt;
}

function getMyCity(space: CoupleSpace) {
  return space.myCityName || space.myCity || '';
}

function getPeerCity(space: CoupleSpace) {
  return space.peerCityName || space.peerCity || DEFAULT_PEER_CITY;
}

function weatherText(weather: Weather | null) {
  if (!weather) return '';
  return weather.weather || (typeof weather.weatherCode === 'number' ? weatherLabel(weather.weatherCode) : '天气');
}

function weatherAdvice(weather: Weather | null) {
  if (!weather) return '';
  const text = weatherText(weather);
  const temp = Number(weather.temperature);
  const wind = Number(String(weather.windpower || '').replace(/[^\d.]/g, ''));
  if (/雨/.test(text)) return '今天下雨，记得带伞';
  if (/雪/.test(text)) return '今天降雪，路上慢一点';
  if (/雷/.test(text)) return '今天有雷雨，尽量少在室外停留';
  if (/雾|霾/.test(text)) return '今天空气不好，出门注意防护';
  if (!Number.isNaN(wind) && wind >= 5) return '今天风大，出门注意保暖';
  if (!Number.isNaN(temp) && temp >= 32) return '今天有点热，记得补水';
  if (!Number.isNaN(temp) && temp <= 3) return '今天降温，记得多穿点';
  return '';
}

function weatherDayKey() {
  return new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function readWeatherCache(key: string): Weather | null | undefined {
  try {
    const cache = JSON.parse(localStorage.getItem(WEATHER_CACHE_KEY) || '{}') as CachedWeather;
    const entry = cache[key];
    return entry?.day === weatherDayKey() ? entry.value : undefined;
  } catch {
    return undefined;
  }
}

function writeWeatherCache(key: string, value: Weather | null) {
  try {
    const cache = JSON.parse(localStorage.getItem(WEATHER_CACHE_KEY) || '{}') as CachedWeather;
    cache[key] = { day: weatherDayKey(), value };
    localStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Weather is optional UI data; ignore private mode/localStorage failures.
  }
}

async function geocodeCity(city: string) {
  const fallback = CITY_COORDS[city.trim()];
  if (fallback) return fallback;
  const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=zh&format=json`);
  const data = await res.json();
  const item = data.results?.[0];
  return item ? { lat: item.latitude as number, lon: item.longitude as number, city: item.name as string } : null;
}

async function loadWeather(lat?: number, lon?: number): Promise<Weather | null> {
  if (lat == null || lon == null) return null;
  const cacheKey = `coord:${lat.toFixed(4)},${lon.toFixed(4)}`;
  const cached = readWeatherCache(cacheKey);
  if (cached !== undefined) return cached;
  try {
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&timezone=Asia%2FShanghai`);
    const data = await res.json();
    const weather = data.current ? { temperature: data.current.temperature_2m, weatherCode: data.current.weather_code } : null;
    writeWeatherCache(cacheKey, weather);
    return weather;
  } catch {
    writeWeatherCache(cacheKey, null);
    return null;
  }
}

async function loadWeatherByCity(city: string): Promise<Weather | null> {
  const cacheKey = `city:${city.trim()}`;
  const cached = readWeatherCache(cacheKey);
  if (cached !== undefined) return cached;
  try {
    const result = await api<Weather | null>('GET', `/api/couples/weather?city=${encodeURIComponent(city.trim() || DEFAULT_PEER_CITY)}`);
    writeWeatherCache(cacheKey, result);
    return result;
  } catch {
    writeWeatherCache(cacheKey, null);
    return null;
  }
}

async function loadDistanceByCity(from: string, to: string): Promise<string> {
  if (!from.trim() || !to.trim()) return '';
  try {
    const result = await api<{ km?: number } | null>('GET', `/api/couples/distance?from=${encodeURIComponent(from.trim())}&to=${encodeURIComponent(to.trim())}`);
    return result?.km ? `相距约 ${result.km} km` : '';
  } catch {
    return '';
  }
}

function loadList<T>(key: string): T[] {
  try {
    return JSON.parse(localStorage.getItem(key) || '[]') as T[];
  } catch {
    return [];
  }
}

function saveList<T>(key: string, items: T[]) {
  localStorage.setItem(key, JSON.stringify(items));
}

function loadAlbumGroups(type: AlbumType = 'couple') {
  try {
    return JSON.parse(localStorage.getItem(ALBUM_KEYS[type]) || '[]') as AlbumGroup[];
  } catch {
    return [];
  }
}

function saveAlbumGroups(type: AlbumType, groups: AlbumGroup[]) {
  localStorage.setItem(ALBUM_KEYS[type], JSON.stringify(groups));
  window.dispatchEvent(new CustomEvent('echo-album-updated', { detail: { type } }));
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function readImageSize(url: string) {
  return new Promise<{ width: number; height: number }>((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth || 1, height: img.naturalHeight || 1 });
    img.onerror = () => resolve({ width: 1, height: 1 });
    img.src = url;
  });
}

function parseJsonSafe<T>(value: string | undefined, fallback: T): T {
  try {
    return JSON.parse(value || '') as T;
  } catch {
    return fallback;
  }
}

async function uploadCoupleMedia(file: File) {
  const formData = new FormData();
  formData.append('file', file);
  const token = localStorage.getItem('echo-token');
  const endpoint = file.type.startsWith('video/') ? '/api/upload/video' : '/api/upload/chat-image';
  const res = await fetch(`${getServerUrl()}${endpoint}`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: formData,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || '上传失败');
  return String(data.url || '');
}

function itemToBookEntry(item: CoupleItemDto): CoupleBookEntry {
  const data = parseJsonSafe<Partial<CoupleBookEntry>>(item.content, {});
  return {
    id: item.id,
    type: item.type as CoupleBookEntry['type'],
    createdBy: item.createdBy,
    targetId: data.targetId || '',
    time: item.happenedAt?.slice(0, 10) || data.time || item.createdAt.slice(0, 10),
    location: item.cityName || data.location || '',
    reason: data.reason || item.title || '',
    mood: data.mood || '',
    media: parseJsonSafe<string[]>(item.images, data.media || []),
    visibility: data.visibility || 'partner',
    apology: data.apology || '',
    status: data.status || 'open',
    createdAt: item.createdAt,
  };
}

export default function RelationshipSpaceContent({
  searchText = '',
  onOpenAlbum,
}: {
  searchText?: string;
  onOpenAlbum?: () => void;
}) {
  const nav = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const { socket } = useSocket();
  const [friends, setFriends] = useState<FriendItem[]>([]);
  const [space, setSpace] = useState<CoupleSpace | null>(null);
  const [busy, setBusy] = useState(false);
  const [metAt, setMetAt] = useState('');
  const [loveAt, setLoveAt] = useState('');
  const [countdownTitle, setCountdownTitle] = useState('');
  const [countdownAt, setCountdownAt] = useState('');
  const [city, setCity] = useState('');
  const [myWeather, setMyWeather] = useState<Weather | null>(null);
  const [peerWeather, setPeerWeather] = useState<Weather | null>(null);
  const [distanceText, setDistanceText] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const [featurePage, setFeaturePage] = useState<FeaturePage>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60000);
    return () => window.clearInterval(timer);
  }, []);

  const refresh = useCallback(async () => {
    const [friendItems, couple] = await Promise.all([
      api<FriendItem[]>('GET', '/api/friends').catch(() => []),
      api<CoupleSpace | null>('GET', '/api/couples').catch(() => null),
    ]);
    setFriends(friendItems);
    setSpace(couple);
    if (couple?.status === 'active') {
      const myCity = getMyCity(couple);
      const peerCity = getPeerCity(couple);
      setMetAt(couple.metAt?.slice(0, 16) || '');
      setLoveAt(getDatingAt(couple)?.slice(0, 16) || '');
      setCountdownTitle(couple.countdownTitle || '');
      setCountdownAt(couple.countdownAt?.slice(0, 16) || '');
      setCity(myCity);
      Promise.all([
        couple.myWeather ? Promise.resolve(couple.myWeather) : (myCity ? loadWeatherByCity(myCity) : loadWeather(couple.myLat, couple.myLon)),
        couple.peerWeather ? Promise.resolve(couple.peerWeather) : loadWeatherByCity(peerCity),
        loadDistanceByCity(myCity, peerCity),
      ]).then(([mine, peer, distance]) => {
        setMyWeather(mine);
        setPeerWeather(peer);
        setDistanceText(distance);
      });
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    if (!socket) return;
    const updated = () => refresh();
    socket.on('couple:updated', updated);
    return () => { socket.off('couple:updated', updated); };
  }, [refresh, socket]);

  const request = async (peerId: string) => {
    setBusy(true);
    try {
      setSpace(await api('POST', '/api/couples/request', { peerId }));
      toast('情侣空间邀请已发送', 'success');
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : '邀请失败', 'error');
    } finally {
      setBusy(false);
    }
  };

  const respond = async (accept: boolean) => {
    setBusy(true);
    try {
      setSpace(await api('POST', '/api/couples/respond', { accept }));
      toast(accept ? '情侣空间已绑定' : '已拒绝邀请', 'success');
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : '操作失败', 'error');
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    setBusy(true);
    try {
      setSpace(await api('PATCH', '/api/couples', {
        metAt: metAt || null,
        loveAt: loveAt || null,
        datingAt: loveAt || null,
        countdownTitle,
        countdownAt: countdownAt || null,
        city: city.trim(),
        cityName: city.trim(),
      }));
      toast('情侣空间已保存', 'success');
      refresh();
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : '保存失败', 'error');
    } finally {
      setBusy(false);
    }
  };

  const sos = async () => {
    try {
      await api('POST', '/api/couples/sos');
      toast('我想你了已发送给对方', 'success');
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : '发送失败', 'error');
    }
  };

  const requestUnbind = async () => {
    const ok = window.confirm(space?.canUnbind ? '确定解除情侣空间绑定？' : '绑定未满 90 天，将向对方发送解绑请求。继续吗？');
    if (!ok) return;
    setBusy(true);
    try {
      const next = await api<CoupleSpace>('POST', space?.canUnbind ? '/api/couples/unbind' : '/api/couples/unbind/request');
      setSpace(next);
      toast(space?.canUnbind ? '情侣空间已解除' : '解绑请求已发送', 'success');
      refresh();
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : '操作失败', 'error');
    } finally {
      setBusy(false);
    }
  };

  const respondUnbind = async (accept: boolean) => {
    setBusy(true);
    try {
      const next = await api<CoupleSpace>('POST', '/api/couples/unbind/respond', { accept });
      setSpace(next);
      toast(accept ? '已同意解除绑定' : '已拒绝解除绑定', 'success');
      refresh();
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : '操作失败', 'error');
    } finally {
      setBusy(false);
    }
  };

  const keyword = searchText.trim().toLowerCase();
  const uniqueFriends = useMemo(() => {
    const seen = new Set<string>();
    return friends.filter(item => {
      if (seen.has(item.peer.id)) return false;
      seen.add(item.peer.id);
      return true;
    });
  }, [friends]);
  const filteredFriends = uniqueFriends.filter(item => !keyword || display(item.peer, item.alias).toLowerCase().includes(keyword));

  if (!space || space.status === 'none') {
    return <BindEmptyState friends={filteredFriends} busy={busy} onRequest={request} />;
  }

  if (space.status === 'pending') {
    return <PendingState space={space} busy={busy} onRespond={respond} />;
  }

  if (featurePage) {
    return <CoupleFeaturePage type={featurePage} space={space} currentUserId={user?.id || ''} onBack={() => setFeaturePage(null)} />;
  }

  return (
    <div className="h-full overflow-y-auto bg-[#f6f5fb] px-4 pb-7 pt-4 dark:bg-gray-950">
      <SpaceHeader space={space} onOpenAlbum={onOpenAlbum} now={now} />
      <main className="mt-4 space-y-3">
        <section className="grid grid-cols-2 gap-3">
          <MetricCard label="相识" value={durationSince(space.metAt, now)} />
          <MetricCard label="相恋" value={durationSince(getDatingAt(space), now)} />
        </section>

        {space.countdownTitle && (
          <section className="rounded-[24px] bg-white p-4 shadow-sm ring-1 ring-black/[0.04] dark:bg-gray-900 dark:ring-white/[0.05]">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
              <AlarmClock size={16} className="text-rose-500" />
              {space.countdownTitle}
            </div>
            <p className="mt-2 text-2xl font-bold text-gray-950 dark:text-gray-50">{durationUntil(space.countdownAt, now)}</p>
          </section>
        )}

        <section className="grid grid-cols-2 gap-3">
          <WeatherCard title="我的天气" city={getMyCity(space)} weather={myWeather} />
          <WeatherCard title="对方天气" city={getPeerCity(space)} weather={peerWeather} />
        </section>

        {distanceText && (
          <section className="rounded-[24px] bg-white p-4 text-sm font-bold text-gray-900 shadow-sm ring-1 ring-black/[0.04] dark:bg-gray-900 dark:text-gray-50 dark:ring-white/[0.05]">
            {distanceText}
          </section>
        )}

        <button
          type="button"
          onClick={() => nav('/couple/leisure-home')}
          className="flex w-full items-center gap-4 rounded-[28px] bg-white p-4 text-left shadow-sm ring-1 ring-black/[0.04] transition active:scale-[0.99] dark:bg-gray-900 dark:ring-white/[0.05]"
        >
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[22px] bg-gradient-to-br from-rose-400 to-orange-300 text-white shadow-lg shadow-rose-300/30">
            <Home size={26} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-base font-black text-gray-950 dark:text-gray-50">情侣休闲小屋</span>
            <span className="mt-1 block truncate text-xs text-gray-500">一起装修我们的小家</span>
          </span>
          <span className="rounded-full bg-rose-50 px-3 py-1 text-xs font-bold text-rose-500 dark:bg-rose-950/20">进入</span>
        </button>

        <section className="grid grid-cols-4 gap-3">
          <QuietFeature icon={MessageCircleHeart} title="夸夸本" onClick={() => setFeaturePage('praise')} />
          <QuietFeature icon={Heart} title="记仇本" onClick={() => setFeaturePage('ledger')} />
          <QuietFeature icon={Music2} title="情歌" onClick={() => setFeaturePage('songs')} />
          <QuietFeature icon={Save} title="日记" onClick={() => setFeaturePage('diary')} />
        </section>

        <button onClick={sos} className="flex w-full items-center justify-center gap-2 rounded-[24px] bg-red-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-red-500/20">
          <Siren size={17} />
          我想你了
        </button>

        <SettingsPanel
          busy={busy}
          space={space}
          metAt={metAt}
          loveAt={loveAt}
          countdownTitle={countdownTitle}
          countdownAt={countdownAt}
          city={city}
          onMetAt={setMetAt}
          onLoveAt={setLoveAt}
          onCountdownTitle={setCountdownTitle}
          onCountdownAt={setCountdownAt}
          onCity={setCity}
          onSave={save}
          onUnbindRequest={requestUnbind}
          onUnbindRespond={respondUnbind}
        />
      </main>
    </div>
  );
}

function BindEmptyState({ friends, busy, onRequest }: { friends: FriendItem[]; busy: boolean; onRequest: (peerId: string) => void }) {
  const navigate = useNavigate();
  return (
    <div className="h-full overflow-y-auto bg-[#f6f5fb] px-4 py-5 dark:bg-gray-950">
      <section className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-black/[0.04] dark:bg-gray-900 dark:ring-white/[0.05]">
        <p className="text-base font-semibold text-gray-950 dark:text-gray-50">选择一位好友绑定</p>
      </section>
      <section className="mt-4 space-y-2">
        {friends.map(item => (
          <div
            key={item.peer.id}
            className="flex w-full items-center gap-3 rounded-2xl bg-white p-3 text-left shadow-sm ring-1 ring-black/[0.04] dark:bg-gray-900 dark:ring-white/[0.05]"
          >
            <button
              type="button"
              onClick={() => navigate(`/chat/${item.peer.digitalId}`)}
              className="flex min-w-0 flex-1 items-center gap-3 text-left"
            >
              <Avatar peer={item.peer} />
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-800 dark:text-gray-100">{display(item.peer, item.alias)}</span>
            </button>
            <button
              disabled={busy}
              type="button"
              onClick={() => onRequest(item.peer.id)}
              className="rounded-full bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-500 disabled:opacity-50 dark:bg-rose-950/20"
            >
              邀请
            </button>
          </div>
        ))}
      </section>
    </div>
  );
}

function PendingState({ space, busy, onRespond }: { space: CoupleSpace; busy: boolean; onRespond: (accept: boolean) => void }) {
  return (
    <div className="h-full overflow-y-auto bg-[#f6f5fb] px-4 py-5 dark:bg-gray-950">
      <section className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-black/[0.04] dark:bg-gray-900 dark:ring-white/[0.05]">
        <h2 className="text-lg font-bold text-gray-950 dark:text-gray-50">情侣空间邀请</h2>
        <p className="mt-2 text-sm leading-6 text-gray-500">{space.pendingForMe ? `${display(space.peer)} 邀请你绑定情侣空间` : '邀请已发送，等待对方确认'}</p>
        {space.pendingForMe && (
          <div className="mt-5 grid grid-cols-2 gap-2">
            <button disabled={busy} onClick={() => onRespond(true)} className="rounded-xl bg-rose-500 py-2.5 text-sm font-semibold text-white disabled:opacity-50">同意</button>
            <button disabled={busy} onClick={() => onRespond(false)} className="rounded-xl bg-gray-100 py-2.5 text-sm font-semibold text-gray-500 disabled:opacity-50 dark:bg-gray-800">拒绝</button>
          </div>
        )}
      </section>
    </div>
  );
}

function UnbindPanel({
  space,
  busy,
  onRequest,
  onRespond,
}: {
  space: CoupleSpace;
  busy: boolean;
  onRequest: () => void;
  onRespond: (accept: boolean) => void;
}) {
  if (space.unbindPendingForMe) {
    return (
      <section className="rounded-[24px] bg-white p-4 shadow-sm ring-1 ring-black/[0.04] dark:bg-gray-900 dark:ring-white/[0.05]">
        <p className="text-sm font-bold text-gray-950 dark:text-gray-50">对方申请解除情侣空间</p>
        <p className="mt-1 text-xs leading-5 text-gray-500">绑定未满 90 天，需要你同意后才会解除。</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button disabled={busy} onClick={() => onRespond(false)} className="rounded-2xl bg-gray-100 py-2.5 text-sm font-bold text-gray-600 disabled:opacity-50 dark:bg-gray-800 dark:text-gray-200">拒绝</button>
          <button disabled={busy} onClick={() => onRespond(true)} className="rounded-2xl bg-red-500 py-2.5 text-sm font-bold text-white disabled:opacity-50">同意解除</button>
        </div>
      </section>
    );
  }

  if (space.unbindPending) {
    return (
      <section className="rounded-[24px] bg-white p-4 text-sm text-gray-500 shadow-sm ring-1 ring-black/[0.04] dark:bg-gray-900 dark:ring-white/[0.05]">
        解绑请求已发送，等待对方处理。
      </section>
    );
  }

  return (
    <section className="rounded-[24px] bg-white p-4 shadow-sm ring-1 ring-black/[0.04] dark:bg-gray-900 dark:ring-white/[0.05]">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-bold text-gray-950 dark:text-gray-50">关系绑定</p>
          <p className="mt-1 text-xs leading-5 text-gray-500">
            {space.canUnbind ? '已满 90 天，可单方解除。' : '未满 90 天，需要对方同意后解除。'}
          </p>
        </div>
        <button disabled={busy} onClick={onRequest} className="shrink-0 rounded-2xl bg-gray-100 px-3 py-2 text-xs font-bold text-gray-600 disabled:opacity-50 dark:bg-gray-800 dark:text-gray-200">
          {space.canUnbind ? '解除' : '申请解绑'}
        </button>
      </div>
    </section>
  );
}

function SpaceHeader({ space, onOpenAlbum, now }: { space: CoupleSpace; onOpenAlbum?: () => void; now: number }) {
  return (
    <header className="overflow-hidden rounded-[30px] bg-gradient-to-br from-rose-400 via-pink-400 to-orange-300 p-5 text-white shadow-lg shadow-rose-300/20">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium text-white/75">Echo 情侣空间</p>
        <button onClick={onOpenAlbum} className="flex items-center gap-1 rounded-full bg-white/18 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur">
          <Images size={14} />
          相册
        </button>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <Avatar peer={space.peer} large />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-2xl font-bold">与你</h2>
          <p className="mt-1 text-xs text-white/80">已守护 {durationSince(getBondedAt(space), now)}</p>
        </div>
      </div>
    </header>
  );
}

export function CoupleAlbumPage({ onBack, initialType = 'couple' }: { onBack?: () => void; initialType?: AlbumType }) {
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [albumType, setAlbumType] = useState<AlbumType>(initialType);
  const [groups, setGroups] = useState<AlbumGroup[]>(() => loadAlbumGroups(initialType));
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [preview, setPreview] = useState<{ groupId: string; index: number } | null>(null);
  const [managing, setManaging] = useState(false);
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<Set<string>>(() => new Set());
  const [formOpen, setFormOpen] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [groupMode, setGroupMode] = useState<'existing' | 'new'>('new');
  const [targetGroupId, setTargetGroupId] = useState('');
  const [title, setTitle] = useState('日常碎片');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [location, setLocation] = useState(DEFAULT_PEER_CITY);
  const [description, setDescription] = useState('');
  const [cover, setCover] = useState(false);
  const [saving, setSaving] = useState(false);
  const activeGroup = groups.find(group => group.id === selectedGroupId) || null;
  const previewGroup = preview ? groups.find(group => group.id === preview.groupId) : null;
  const previewIndex = preview?.index ?? -1;
  const previewPhoto = previewGroup && previewIndex >= 0 ? previewGroup.photos[previewIndex] : null;
  const albumTitle = ALBUM_TITLES[albumType];

  const loadCurrentGroups = useCallback(async (type: AlbumType = albumType) => {
    if (type === 'couple') {
      const remote = await api<AlbumGroup[]>('GET', '/api/couples/album/groups').catch(() => []);
      setGroups(remote);
      return;
    }
    setGroups(loadAlbumGroups(type));
  }, [albumType]);

  const syncGroups = (next: AlbumGroup[]) => {
    setGroups(next);
    saveAlbumGroups(albumType, next);
  };

  const uploadAlbumBlob = async (file: Blob, name: string): Promise<string> => {
    const formData = new FormData();
    formData.append('file', file, name);
    const token = localStorage.getItem('echo-token');
    const res = await fetch(`${getServerUrl()}/api/upload/chat-image`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body: formData,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || '上传失败');
    return data.url;
  };

  const uploadAlbumFile = async (file: File): Promise<AlbumPhoto> => {
    const localUrl = URL.createObjectURL(file);
    const size = await readImageSize(localUrl).finally(() => URL.revokeObjectURL(localUrl));
    const thumbFile = await imageCompression(file, {
      maxWidthOrHeight: 640,
      maxSizeMB: 0.18,
      useWebWorker: true,
      initialQuality: 0.72,
    });
    const [url, thumbUrl] = await Promise.all([
      uploadAlbumBlob(file, file.name),
      uploadAlbumBlob(thumbFile, `thumb-${file.name.replace(/\.[^.]+$/, '')}.jpg`),
    ]);
    return {
      id: `photo_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      url,
      originalUrl: url,
      previewUrl: thumbUrl,
      thumbUrl,
      createdAt: new Date().toISOString(),
      width: size.width,
      height: size.height,
      description,
    };
  };

  useEffect(() => {
    loadCurrentGroups(albumType);
    setSelectedGroupId('');
    setSelectedPhotoIds(new Set());
    setManaging(false);
    setPreview(null);
  }, [albumType, loadCurrentGroups]);

  useEffect(() => {
    const refresh = (event: Event) => {
      const detail = (event as CustomEvent<{ type?: AlbumType }>).detail;
      if (!detail?.type || detail.type === albumType) loadCurrentGroups(albumType);
    };
    window.addEventListener('echo-album-updated', refresh);
    return () => window.removeEventListener('echo-album-updated', refresh);
  }, [albumType, loadCurrentGroups]);

  const openUpload = (groupId = '') => {
    setTargetGroupId(groupId || groups[0]?.id || '');
    setGroupMode(groupId || groups.length ? 'existing' : 'new');
    setFormOpen(true);
  };

  const onPickFiles = (files: FileList | null) => {
    const next = Array.from(files || []).filter(file => file.type.startsWith('image/'));
    if (!next.length) return;
    setPendingFiles(next);
    setFormOpen(true);
  };

  const saveUpload = async () => {
    if (!pendingFiles.length) {
      toast('请先选择照片', 'info');
      return;
    }
    if (groupMode === 'new' && !title.trim()) {
      toast('请输入标签名称', 'info');
      return;
    }
    if (groupMode === 'existing' && !targetGroupId) {
      toast('请选择标签', 'info');
      return;
    }

    setSaving(true);
    try {
      const photos: AlbumPhoto[] = [];
      for (const file of pendingFiles) {
        if (albumType === 'couple') {
          photos.push(await uploadAlbumFile(file));
        } else {
          const url = await fileToDataUrl(file);
          const size = await readImageSize(url);
          photos.push({
            id: `photo_${Date.now()}_${Math.random().toString(36).slice(2)}`,
            url,
            createdAt: new Date().toISOString(),
            width: size.width,
            height: size.height,
            description,
          });
        }
      }

      if (albumType === 'couple') {
        if (groupMode === 'new') {
          const group = await api<AlbumGroup>('POST', '/api/couples/album/groups', {
            title: title.trim(),
            date,
            location,
            description,
            coverUrl: cover ? photos[0]?.url || '' : '',
            photos,
          });
          setSelectedGroupId(group.id);
        } else {
          await api<AlbumGroup>('PATCH', `/api/couples/album/groups/${targetGroupId}`, {
            date,
            location,
            description,
            coverUrl: cover ? photos[0]?.url || '' : undefined,
          });
          await api<AlbumGroup>('POST', `/api/couples/album/groups/${targetGroupId}/photos`, { photos });
        }
        await loadCurrentGroups('couple');
      } else {
        let nextGroups: AlbumGroup[];
        if (groupMode === 'new') {
          const group: AlbumGroup = {
            id: `group_${Date.now()}`,
            title: title.trim(),
            date,
            location,
            description,
            coverUrl: cover ? photos[0]?.url || '' : '',
            photos,
          };
          nextGroups = [group, ...groups];
          setSelectedGroupId(group.id);
        } else {
          nextGroups = groups.map(group => group.id === targetGroupId
            ? {
              ...group,
              date: date || group.date,
              location: location || group.location,
              description: description || group.description,
              coverUrl: cover ? photos[0]?.url || group.coverUrl : group.coverUrl,
              photos: [...photos, ...group.photos],
            }
            : group);
        }
        syncGroups(nextGroups);
      }
      setPendingFiles([]);
      setFormOpen(false);
      setCover(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      toast('照片已保存', 'success');
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : '照片保存失败', 'error');
    } finally {
      setSaving(false);
    }
  };

  const updateGroup = async (groupId: string, patch: Partial<AlbumGroup>) => {
    if (albumType === 'couple') {
      const updated = await api<AlbumGroup>('PATCH', `/api/couples/album/groups/${groupId}`, patch).catch((e: Error) => {
        toast(e.message || '保存失败', 'error');
        return null;
      });
      if (updated) setGroups(prev => prev.map(group => group.id === groupId ? updated : group));
      return;
    }
    syncGroups(groups.map(group => group.id === groupId ? { ...group, ...patch } : group));
  };

  const deleteGroup = async (groupId: string) => {
    const group = groups.find(item => item.id === groupId);
    if (!group) return;
    const ok = window.confirm(`删除「${group.title}」标签？里面的照片也会一起删除。`);
    if (!ok) return;
    if (albumType === 'couple') {
      await api('DELETE', `/api/couples/album/groups/${groupId}`).catch((e: Error) => {
        toast(e.message || '删除失败', 'error');
        return null;
      });
      await loadCurrentGroups('couple');
    } else {
      syncGroups(groups.filter(item => item.id !== groupId));
    }
    setSelectedGroupId('');
    setSelectedPhotoIds(new Set());
    setManaging(false);
    setPreview(null);
    toast('标签已删除', 'success');
  };

  const deleteSelected = () => {
    if (!activeGroup || selectedPhotoIds.size === 0) return;
    if (albumType === 'couple') {
      api<AlbumGroup>('DELETE', `/api/couples/album/groups/${activeGroup.id}/photos`, { photoIds: [...selectedPhotoIds] })
        .then(updated => {
          setGroups(prev => prev.map(group => group.id === activeGroup.id ? updated : group));
          setSelectedPhotoIds(new Set());
          setManaging(false);
          toast('已删除选中照片', 'success');
        })
        .catch((e: Error) => toast(e.message || '删除失败', 'error'));
      return;
    }
    const next = groups.map(group => group.id === activeGroup.id
      ? { ...group, photos: group.photos.filter(photo => !selectedPhotoIds.has(photo.id)) }
      : group);
    syncGroups(next);
    setSelectedPhotoIds(new Set());
    setManaging(false);
    toast('已删除选中照片', 'success');
  };

  const togglePhoto = (photoId: string) => {
    setSelectedPhotoIds(prev => {
      const next = new Set(prev);
      if (next.has(photoId)) next.delete(photoId);
      else next.add(photoId);
      return next;
    });
  };

  return (
    <div className="h-full overflow-y-auto bg-[#f6f5fb] px-4 pb-7 pt-4 dark:bg-gray-950">
      <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={e => onPickFiles(e.target.files)} />
      <header className="flex items-center justify-between">
        <button onClick={activeGroup ? () => { setSelectedGroupId(''); setManaging(false); } : onBack} className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-gray-700 shadow-sm ring-1 ring-black/[0.04] dark:bg-gray-900 dark:text-gray-200 dark:ring-white/[0.05]">
          <ChevronLeft size={20} />
        </button>
        <div className="text-center">
          <p className="text-xs font-medium text-gray-400">Echo Album</p>
          <h2 className="text-lg font-bold text-gray-950 dark:text-gray-50">{activeGroup ? activeGroup.title : albumTitle}</h2>
        </div>
        <button onClick={() => fileInputRef.current?.click()} className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-950 text-white shadow-sm dark:bg-white dark:text-gray-950">
          <Camera size={18} />
        </button>
      </header>

      {!activeGroup && (
        <div className="mt-4 grid grid-cols-3 gap-2 rounded-2xl bg-white p-1 shadow-sm ring-1 ring-black/[0.04] dark:bg-gray-900 dark:ring-white/[0.05]">
          {(Object.keys(ALBUM_TITLES) as AlbumType[]).map(type => (
            <button
              key={type}
              type="button"
              onClick={() => setAlbumType(type)}
              className={`rounded-xl py-2 text-sm font-bold transition ${albumType === type ? 'bg-gray-950 text-white dark:bg-white dark:text-gray-950' : 'text-gray-400'}`}
            >
              {type === 'couple' ? '情侣' : type === 'friends' ? '朋友' : '家人'}
            </button>
          ))}
        </div>
      )}

      {activeGroup ? (
        <section className="mt-4 space-y-4">
          <GroupEditor group={activeGroup} onChange={(patch) => updateGroup(activeGroup.id, patch)} />
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-500">{activeGroup.photos.length} 张照片</p>
            <div className="flex gap-2">
              {managing && <button onClick={deleteSelected} className="rounded-full bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-500">删除</button>}
              <button onClick={() => deleteGroup(activeGroup.id)} className="rounded-full bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-500">删除标签</button>
              <button onClick={() => setManaging(!managing)} className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 shadow-sm ring-1 ring-black/[0.04] dark:bg-gray-900 dark:text-gray-200 dark:ring-white/[0.05]">{managing ? '完成' : '管理'}</button>
              <button onClick={() => openUpload(activeGroup.id)} className="rounded-full bg-gray-950 px-3 py-1.5 text-xs font-semibold text-white dark:bg-white dark:text-gray-950">添加照片</button>
            </div>
          </div>
          {activeGroup.photos.length ? (
            <div className="columns-2 gap-3 sm:columns-3">
              {activeGroup.photos.map((photo, index) => (
                <button
                  key={photo.id}
                  onClick={() => managing ? togglePhoto(photo.id) : setPreview({ groupId: activeGroup.id, index })}
                  onContextMenu={(e) => { e.preventDefault(); setManaging(true); togglePhoto(photo.id); }}
                  className="relative mb-3 block w-full break-inside-avoid overflow-hidden rounded-[22px] bg-white shadow-sm ring-1 ring-black/[0.04] dark:bg-gray-900 dark:ring-white/[0.05]"
                >
                  <img src={albumPreviewSrc(photo)} className="w-full object-cover" draggable={false} loading="lazy" decoding="async" />
                  {managing && <span className={`absolute right-2 top-2 h-6 w-6 rounded-full border-2 ${selectedPhotoIds.has(photo.id) ? 'border-rose-500 bg-rose-500' : 'border-white bg-black/20'}`} />}
                </button>
              ))}
            </div>
          ) : (
            <AlbumEmpty onAdd={() => fileInputRef.current?.click()} />
          )}
        </section>
      ) : (
        <section className="mt-4 space-y-3">
          {groups.length ? groups.map(group => (
            <button key={group.id} onClick={() => setSelectedGroupId(group.id)} className="w-full rounded-[28px] bg-white p-4 text-left shadow-sm ring-1 ring-black/[0.04] dark:bg-gray-900 dark:ring-white/[0.05]">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-lg font-bold text-gray-950 dark:text-gray-50">{group.title}</p>
                  <p className="mt-1 text-xs text-gray-500">{group.date || '未设置时间'} · {group.location || '未设置地点'} · 共 {group.photos.length} 张</p>
                </div>
                <span className="rounded-full bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-500 dark:bg-gray-800">管理</span>
              </div>
              {group.description && <p className="mt-3 line-clamp-2 text-sm text-gray-500">{group.description}</p>}
              <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
                {group.photos.slice(0, 1).map(photo => (
                  <img key={photo.id} src={albumPreviewSrc(photo)} className="h-44 w-full shrink-0 rounded-2xl object-cover shadow-sm" draggable={false} loading="lazy" decoding="async" />
                ))}
                {!group.photos.length && <div className="flex h-36 w-full items-center justify-center rounded-2xl bg-rose-50 text-sm text-rose-300 dark:bg-rose-950/20">还没有照片</div>}
              </div>
            </button>
          )) : (
            <AlbumEmpty onAdd={() => fileInputRef.current?.click()} />
          )}
        </section>
      )}

      {formOpen && (
        <div className="fixed inset-0 z-[70] flex items-end bg-black/35 p-3 backdrop-blur-sm">
          <section className="w-full rounded-[28px] bg-white p-4 shadow-2xl dark:bg-gray-900">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-gray-950 dark:text-gray-50">保存到{albumTitle}</h3>
              <button onClick={() => setFormOpen(false)} className="text-sm text-gray-400">关闭</button>
            </div>
            <div className="mt-4 space-y-3">
              {!!groups.length && (
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => setGroupMode('existing')} className={`rounded-xl py-2 text-sm font-semibold ${groupMode === 'existing' ? 'bg-gray-950 text-white dark:bg-white dark:text-gray-950' : 'bg-gray-100 text-gray-500 dark:bg-gray-800'}`}>已有标签</button>
                  <button onClick={() => setGroupMode('new')} className={`rounded-xl py-2 text-sm font-semibold ${groupMode === 'new' ? 'bg-gray-950 text-white dark:bg-white dark:text-gray-950' : 'bg-gray-100 text-gray-500 dark:bg-gray-800'}`}>新建标签</button>
                </div>
              )}
              {groupMode === 'existing' && !!groups.length ? (
                <Field label="选择标签">
                  <select value={targetGroupId} onChange={e => setTargetGroupId(e.target.value)} className="form-input">
                    {groups.map(group => <option key={group.id} value={group.id}>{group.title}</option>)}
                  </select>
                </Field>
              ) : (
                <Field label="标签名称">
                  <input value={title} onChange={e => setTitle(e.target.value)} className="form-input" />
                </Field>
              )}
              <div className="grid grid-cols-2 gap-2">
                <Field label="见面时间">
                  <input type="date" value={date} onChange={e => setDate(e.target.value)} className="form-input" />
                </Field>
                <Field label="见面地点">
                  <input value={location} onChange={e => setLocation(e.target.value)} className="form-input" />
                </Field>
              </div>
              <Field label="备注文案">
                <textarea value={description} onChange={e => setDescription(e.target.value)} className="form-input min-h-[76px] resize-none" placeholder="这天一起去吃了火锅" />
              </Field>
              <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                <input type="checkbox" checked={cover} onChange={e => setCover(e.target.checked)} />
                设为该标签封面
              </label>
              <button disabled={saving} onClick={saveUpload} className="w-full rounded-xl bg-rose-500 py-3 text-sm font-bold text-white disabled:opacity-60">{saving ? '保存中...' : '保存'}</button>
            </div>
          </section>
        </div>
      )}

      {previewPhoto && previewGroup && (
        <div className="fixed inset-0 z-[80] bg-black/92 p-4 text-white">
          <button onClick={() => setPreview(null)} className="absolute right-4 top-4 rounded-full bg-white/12 px-3 py-1.5 text-sm">关闭</button>
          <div className="flex h-full items-center justify-center">
            <img src={albumOriginalSrc(previewPhoto)} className="max-h-[78vh] max-w-full rounded-2xl object-contain" draggable={false} />
          </div>
          <div className="absolute inset-x-4 bottom-8 flex items-center justify-between">
            <button disabled={previewIndex <= 0} onClick={() => preview && setPreview({ groupId: preview.groupId, index: previewIndex - 1 })} className="rounded-full bg-white/12 px-4 py-2 disabled:opacity-30">上一张</button>
            <p className="text-sm text-white/70">{previewIndex + 1} / {previewGroup.photos.length}</p>
            <button disabled={previewIndex >= previewGroup.photos.length - 1} onClick={() => preview && setPreview({ groupId: preview.groupId, index: previewIndex + 1 })} className="rounded-full bg-white/12 px-4 py-2 disabled:opacity-30">下一张</button>
          </div>
        </div>
      )}

      <style>{`.form-input{width:100%;border-radius:0.75rem;background:#f3f4f6;padding:0.625rem 0.75rem;font-size:0.875rem;outline:none}.dark .form-input{background:#1f2937;color:#e5e7eb}`}</style>
    </div>
  );
}

function CoupleFeaturePage({ type, space, currentUserId, onBack }: { type: Exclude<FeaturePage, null>; space: CoupleSpace; currentUserId: string; onBack: () => void }) {
  if (type === 'songs') {
    return <SongBookPage onBack={onBack} />;
  }
  if (type === 'diary') {
    return <DiaryPage currentUserId={currentUserId} onBack={onBack} />;
  }
  return <CoupleBookPage type={type} space={space} currentUserId={currentUserId} onBack={onBack} />;
}

function SongBookPage({ onBack }: { onBack: () => void }) {
  const [songs, setSongs] = useState<SongItem[]>(() => loadList<SongItem>(SONG_KEY));
  const [filter, setFilter] = useState<'all' | SongItem['category']>('all');
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [category, setCategory] = useState<SongItem['category']>('duet');
  const filteredSongs = filter === 'all' ? songs : songs.filter(song => song.category === filter);

  const saveSong = () => {
    if (!title.trim()) return;
    const next = [{
      id: `song_${Date.now()}`,
      title: title.trim(),
      artist: artist.trim(),
      category,
      createdBy: 'me',
      createdAt: new Date().toISOString(),
    }, ...songs];
    setSongs(next);
    saveList(SONG_KEY, next);
    setTitle('');
    setArtist('');
  };

  const categoryLabel = (value: SongItem['category']) => value === 'husband' ? '老公' : value === 'wife' ? '媳妇儿' : '合唱';

  return (
    <div className="h-full overflow-y-auto bg-[#f6f5fb] px-4 pb-7 pt-4 dark:bg-gray-950">
      <FeatureHeader title="情歌" onBack={onBack} />
      <section className="mt-4 rounded-[28px] bg-white p-4 shadow-sm ring-1 ring-black/[0.04] dark:bg-gray-900 dark:ring-white/[0.05]">
        <div className="grid grid-cols-2 gap-2">
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="歌曲名" className="form-input" />
          <input value={artist} onChange={e => setArtist(e.target.value)} placeholder="歌手" className="form-input" />
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {(['husband', 'wife', 'duet'] as SongItem['category'][]).map(item => (
            <button key={item} onClick={() => setCategory(item)} className={`rounded-xl py-2 text-sm font-semibold ${category === item ? 'bg-gray-950 text-white dark:bg-white dark:text-gray-950' : 'bg-gray-100 text-gray-500 dark:bg-gray-800'}`}>{categoryLabel(item)}</button>
          ))}
        </div>
        <button onClick={saveSong} className="mt-3 w-full rounded-xl bg-rose-500 py-3 text-sm font-bold text-white">添加情歌</button>
      </section>
      <section className="mt-4">
        <div className="flex gap-2 overflow-x-auto pb-2">
          {[
            ['all', '全部'],
            ['husband', '老公'],
            ['wife', '媳妇儿'],
            ['duet', '合唱'],
          ].map(([key, label]) => (
            <button key={key} onClick={() => setFilter(key as typeof filter)} className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold ${filter === key ? 'bg-gray-950 text-white dark:bg-white dark:text-gray-950' : 'bg-white text-gray-500 shadow-sm ring-1 ring-black/[0.04] dark:bg-gray-900 dark:ring-white/[0.05]'}`}>{label}</button>
          ))}
        </div>
        <div className="space-y-2">
          {filteredSongs.map(song => (
            <article key={song.id} className="rounded-[22px] bg-white p-4 shadow-sm ring-1 ring-black/[0.04] dark:bg-gray-900 dark:ring-white/[0.05]">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-base font-bold text-gray-950 dark:text-gray-50">{song.title}</p>
                  <p className="mt-1 text-xs text-gray-500">{song.artist || '未填写歌手'}</p>
                </div>
                <span className="rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-500">{categoryLabel(song.category)}</span>
              </div>
            </article>
          ))}
          {!filteredSongs.length && <SoftEmpty title="还没有情歌" text="添加一首只属于你们的歌" />}
        </div>
      </section>
    </div>
  );
}

function CoupleBookPage({ type, space, currentUserId, onBack }: { type: 'praise' | 'ledger'; space: CoupleSpace; currentUserId: string; onBack: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [entries, setEntries] = useState<CoupleBookEntry[]>([]);
  const [time, setTime] = useState(() => new Date().toISOString().slice(0, 10));
  const [location, setLocation] = useState(DEFAULT_PEER_CITY);
  const [reason, setReason] = useState('');
  const [mood, setMood] = useState('');
  const [apology, setApology] = useState('');
  const [media, setMedia] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const visibleEntries = entries.filter(entry => entry.status !== 'rejected');
  const title = type === 'praise' ? '夸夸本' : '记仇本';
  const peerName = display(space.peer);

  const refresh = useCallback(() => {
    api<CoupleItemDto[]>('GET', `/api/couples/items?type=${type}`)
      .then(items => setEntries(items.map(itemToBookEntry)))
      .catch(() => setEntries([]));
  }, [type]);

  useEffect(() => { refresh(); }, [refresh]);

  const contentOf = (entry: Partial<CoupleBookEntry>) => JSON.stringify({
    targetId: entry.targetId,
    time: entry.time,
    location: entry.location,
    reason: entry.reason,
    mood: entry.mood,
    apology: entry.apology || '',
    status: entry.status || 'open',
    visibility: 'partner',
  });

  const pickMedia = async (files: FileList | null) => {
    const selected = Array.from(files || []).filter(file => file.type.startsWith('image/') || file.type.startsWith('video/'));
    if (!selected.length) return;
    setUploading(true);
    try {
      const urls: string[] = [];
      for (const file of selected) urls.push(await uploadCoupleMedia(file));
      setMedia(prev => [...prev, ...urls]);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : '上传失败');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const createEntry = async () => {
    if (!reason.trim()) return;
    const entry: Partial<CoupleBookEntry> = {
      type,
      createdBy: currentUserId || 'me',
      targetId: space.peer.id,
      time,
      location,
      reason: reason.trim(),
      mood: mood.trim(),
      media,
      status: 'open',
      createdAt: new Date().toISOString(),
    };
    const created = await api<CoupleItemDto>('POST', '/api/couples/items', {
      type,
      title: reason.trim(),
      content: contentOf(entry),
      images: media,
      location,
      time,
    });
    setEntries(prev => [itemToBookEntry(created), ...prev]);
    setReason('');
    setMood('');
    setMedia([]);
  };

  const patchEntry = async (id: string, patch: Partial<CoupleBookEntry>) => {
    const current = entries.find(entry => entry.id === id);
    if (!current) return;
    const next = { ...current, ...patch };
    const updated = await api<CoupleItemDto>('PATCH', `/api/couples/items/${id}`, {
      title: next.reason,
      content: contentOf(next),
      images: next.media || [],
      location: next.location,
      time: next.time,
    });
    setEntries(prev => prev.map(entry => entry.id === id ? itemToBookEntry(updated) : entry));
  };

  const deleteEntry = async (id: string) => {
    await api('DELETE', `/api/couples/items/${id}`);
    setEntries(prev => prev.filter(entry => entry.id !== id));
  };

  return (
    <div className="h-full overflow-y-auto bg-[#f6f5fb] px-4 pb-7 pt-4 dark:bg-gray-950">
      <input ref={fileRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={e => pickMedia(e.target.files)} />
      <FeatureHeader title={title} onBack={onBack} />
      <section className="mt-4 rounded-[28px] bg-white p-4 shadow-sm ring-1 ring-black/[0.04] dark:bg-gray-900 dark:ring-white/[0.05]">
        <div className="grid grid-cols-2 gap-2">
          <Field label="时间"><input type="date" value={time} onChange={e => setTime(e.target.value)} className="form-input" /></Field>
          <Field label="地址"><input value={location} onChange={e => setLocation(e.target.value)} className="form-input" /></Field>
        </div>
        <Field label={type === 'praise' ? '夸夸原因' : '记账原因'}><textarea value={reason} onChange={e => setReason(e.target.value)} className="form-input min-h-[76px] resize-none" placeholder={type === 'praise' ? `今天想夸夸${peerName}` : `今天给${peerName}记一笔`} /></Field>
        <Field label="心情"><input value={mood} onChange={e => setMood(e.target.value)} className="form-input" placeholder="开心 / 委屈 / 生气 / 想抱抱" /></Field>
        <MediaPreview media={media} onRemove={url => setMedia(prev => prev.filter(item => item !== url))} />
        <button onClick={() => fileRef.current?.click()} disabled={uploading} className="mt-3 rounded-xl bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-600 disabled:opacity-60 dark:bg-gray-800 dark:text-gray-300">{uploading ? '上传中...' : '添加图片/视频'}</button>
        <button onClick={createEntry} className="mt-3 w-full rounded-xl bg-rose-500 py-3 text-sm font-bold text-white">创建{title}</button>
      </section>
      <section className="mt-4 space-y-3">
        {visibleEntries.map(entry => {
          const mine = entry.createdBy === (currentUserId || 'me');
          return (
            <article key={entry.id} className="rounded-[24px] bg-white p-4 shadow-sm ring-1 ring-black/[0.04] dark:bg-gray-900 dark:ring-white/[0.05]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-gray-950 dark:text-gray-50">{entry.reason}</p>
                  <p className="mt-1 text-xs text-gray-500">{entry.time} · {entry.location} · {entry.mood || '未填写心情'}</p>
                </div>
                <span className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-500 dark:bg-gray-800">{entry.status === 'forgiven' ? '已原谅' : entry.status === 'forgive_requested' ? '待处理' : '进行中'}</span>
              </div>
              <MediaPreview media={entry.media || []} readonly />
              {entry.apology && <p className="mt-3 rounded-2xl bg-rose-50 px-3 py-2 text-sm text-rose-600 dark:bg-rose-950/20">{entry.apology}</p>}
              <div className="mt-3 flex flex-wrap gap-2">
                {!mine && entry.status === 'open' && (
                  <div className="w-full space-y-2">
                    <textarea value={apology} onChange={e => setApology(e.target.value)} className="form-input min-h-[64px] resize-none" placeholder="认错书，可选" />
                    <button onClick={() => patchEntry(entry.id, { status: 'forgive_requested', apology })} className="rounded-full bg-gray-950 px-4 py-2 text-xs font-semibold text-white dark:bg-white dark:text-gray-950">申请原谅</button>
                  </div>
                )}
                {mine && entry.status === 'forgive_requested' && (
                  <>
                    <button onClick={() => patchEntry(entry.id, { status: 'forgiven' })} className="rounded-full bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-600">原谅</button>
                    <button onClick={() => patchEntry(entry.id, { status: 'rejected' })} className="rounded-full bg-red-50 px-4 py-2 text-xs font-semibold text-red-500">拒绝</button>
                  </>
                )}
                {mine && <button onClick={() => deleteEntry(entry.id)} className="rounded-full bg-gray-100 px-4 py-2 text-xs font-semibold text-gray-500 dark:bg-gray-800">删除</button>}
              </div>
            </article>
          );
        })}
        {!visibleEntries.length && <SoftEmpty title={`还没有${title}`} text="创建一条属于你们的小记录" />}
      </section>
    </div>
  );
}

function DiaryPage({ currentUserId, onBack }: { currentUserId: string; onBack: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [entries, setEntries] = useState<CoupleBookEntry[]>([]);
  const [content, setContent] = useState('');
  const [mood, setMood] = useState('');
  const [visibility, setVisibility] = useState<'private' | 'partner'>('partner');
  const [media, setMedia] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  const refresh = useCallback(() => {
    api<CoupleItemDto[]>('GET', '/api/couples/items?type=diary')
      .then(items => setEntries(items.map(itemToBookEntry).filter(entry => entry.visibility !== 'private' || entry.createdBy === currentUserId)))
      .catch(() => setEntries([]));
  }, [currentUserId]);

  useEffect(() => { refresh(); }, [refresh]);

  const pickMedia = async (files: FileList | null) => {
    const selected = Array.from(files || []).filter(file => file.type.startsWith('image/') || file.type.startsWith('video/'));
    if (!selected.length) return;
    setUploading(true);
    try {
      const urls: string[] = [];
      for (const file of selected) urls.push(await uploadCoupleMedia(file));
      setMedia(prev => [...prev, ...urls]);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const saveDiary = async () => {
    if (!content.trim() && !media.length) return;
    const entry: Partial<CoupleBookEntry> = {
      type: 'diary',
      createdBy: currentUserId,
      reason: content.trim(),
      mood: mood.trim(),
      media,
      visibility,
      status: 'open',
      time: new Date().toISOString().slice(0, 10),
    };
    const created = await api<CoupleItemDto>('POST', '/api/couples/items', {
      type: 'diary',
      title: content.trim().slice(0, 40) || '日记',
      content: JSON.stringify(entry),
      images: media,
      time: entry.time,
    });
    setEntries(prev => [itemToBookEntry(created), ...prev]);
    setContent('');
    setMood('');
    setMedia([]);
  };

  const deleteDiary = async (id: string) => {
    await api('DELETE', `/api/couples/items/${id}`);
    setEntries(prev => prev.filter(entry => entry.id !== id));
  };

  return (
    <div className="h-full overflow-y-auto bg-[#f6f5fb] px-4 pb-7 pt-4 dark:bg-gray-950">
      <input ref={fileRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={e => pickMedia(e.target.files)} />
      <FeatureHeader title="日记" onBack={onBack} />
      <section className="mt-4 rounded-[28px] bg-white p-4 shadow-sm ring-1 ring-black/[0.04] dark:bg-gray-900 dark:ring-white/[0.05]">
        <Field label="今天想写点什么"><textarea value={content} onChange={e => setContent(e.target.value)} className="form-input min-h-[110px] resize-none" placeholder="写一段只属于今天的心情" /></Field>
        <Field label="心情"><input value={mood} onChange={e => setMood(e.target.value)} className="form-input" placeholder="开心 / 想念 / 难过 / 平静" /></Field>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button onClick={() => setVisibility('partner')} className={`rounded-xl py-2 text-sm font-semibold ${visibility === 'partner' ? 'bg-gray-950 text-white dark:bg-white dark:text-gray-950' : 'bg-gray-100 text-gray-500 dark:bg-gray-800'}`}>给另一半看</button>
          <button onClick={() => setVisibility('private')} className={`rounded-xl py-2 text-sm font-semibold ${visibility === 'private' ? 'bg-gray-950 text-white dark:bg-white dark:text-gray-950' : 'bg-gray-100 text-gray-500 dark:bg-gray-800'}`}>仅自己可见</button>
        </div>
        <MediaPreview media={media} onRemove={url => setMedia(prev => prev.filter(item => item !== url))} />
        <button onClick={() => fileRef.current?.click()} disabled={uploading} className="mt-3 rounded-xl bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-600 disabled:opacity-60 dark:bg-gray-800 dark:text-gray-300">{uploading ? '上传中...' : '添加图片/视频'}</button>
        <button onClick={saveDiary} className="mt-3 w-full rounded-xl bg-rose-500 py-3 text-sm font-bold text-white">保存日记</button>
      </section>
      <section className="mt-4 space-y-3">
        {entries.map(entry => (
          <article key={entry.id} className="rounded-[24px] bg-white p-4 shadow-sm ring-1 ring-black/[0.04] dark:bg-gray-900 dark:ring-white/[0.05]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="whitespace-pre-wrap text-sm font-semibold leading-6 text-gray-900 dark:text-gray-100">{entry.reason}</p>
                <p className="mt-1 text-xs text-gray-500">{entry.time} · {entry.mood || '未填写心情'} · {entry.visibility === 'private' ? '仅自己可见' : '双方可见'}</p>
              </div>
              {entry.createdBy === currentUserId && <button onClick={() => deleteDiary(entry.id)} className="shrink-0 rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-500 dark:bg-gray-800">删除</button>}
            </div>
            <MediaPreview media={entry.media || []} readonly />
          </article>
        ))}
        {!entries.length && <SoftEmpty title="还没有日记" text="写下第一条今天的心情" />}
      </section>
    </div>
  );
}

function MediaPreview({ media, onRemove, readonly = false }: { media: string[]; onRemove?: (url: string) => void; readonly?: boolean }) {
  if (!media.length) return null;
  return (
    <div className="mt-3 grid grid-cols-3 gap-2">
      {media.map(url => {
        const isVideo = /\.(mp4|mov|m4v|webm)$/i.test(url);
        return (
          <div key={url} className="relative overflow-hidden rounded-2xl bg-gray-100 dark:bg-gray-800">
            {isVideo ? <video src={assetUrl(url)} controls className="h-24 w-full object-cover" /> : <img src={assetUrl(url)} className="h-24 w-full object-cover" />}
            {!readonly && onRemove && <button onClick={() => onRemove(url)} className="absolute right-1 top-1 rounded-full bg-black/50 px-2 py-0.5 text-xs text-white">删</button>}
          </div>
        );
      })}
    </div>
  );
}

function FeatureHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <header className="flex items-center gap-3">
      <button onClick={onBack} className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-gray-700 shadow-sm ring-1 ring-black/[0.04] dark:bg-gray-900 dark:text-gray-200 dark:ring-white/[0.05]">
        <ChevronLeft size={20} />
      </button>
      <h2 className="text-lg font-bold text-gray-950 dark:text-gray-50">{title}</h2>
    </header>
  );
}

function SoftEmpty({ title, text }: { title: string; text: string }) {
  return (
    <section className="rounded-[24px] bg-white p-8 text-center shadow-sm ring-1 ring-black/[0.04] dark:bg-gray-900 dark:ring-white/[0.05]">
      <p className="text-base font-bold text-gray-950 dark:text-gray-50">{title}</p>
      <p className="mt-2 text-sm text-gray-500">{text}</p>
    </section>
  );
}

function AlbumEmpty({ onAdd }: { onAdd: () => void }) {
  return (
    <section className="rounded-[30px] bg-white px-6 py-12 text-center shadow-sm ring-1 ring-black/[0.04] dark:bg-gray-900 dark:ring-white/[0.05]">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-rose-50 text-rose-400 dark:bg-rose-950/30">
        <Images size={26} />
      </div>
      <h3 className="mt-5 text-lg font-bold text-gray-950 dark:text-gray-50">还没有照片</h3>
      <p className="mx-auto mt-2 max-w-[240px] text-sm leading-6 text-gray-500">去记录你们的第一张回忆吧</p>
      <button onClick={onAdd} className="mt-5 rounded-full bg-gray-950 px-5 py-2.5 text-sm font-semibold text-white dark:bg-white dark:text-gray-950">添加照片</button>
    </section>
  );
}

function GroupEditor({ group, onChange }: { group: AlbumGroup; onChange: (patch: Partial<AlbumGroup>) => void }) {
  return (
    <details className="rounded-[24px] bg-white p-4 shadow-sm ring-1 ring-black/[0.04] dark:bg-gray-900 dark:ring-white/[0.05]">
      <summary className="cursor-pointer list-none text-sm font-bold text-gray-950 dark:text-gray-50">{group.date || '未设置时间'} · {group.location || '未设置地点'}</summary>
      <div className="mt-4 space-y-3">
        <Field label="标签名称"><input value={group.title} onChange={e => onChange({ title: e.target.value })} className="form-input" /></Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="见面时间"><input type="date" value={group.date} onChange={e => onChange({ date: e.target.value })} className="form-input" /></Field>
          <Field label="见面地点"><input value={group.location} onChange={e => onChange({ location: e.target.value })} className="form-input" /></Field>
        </div>
        <Field label="备注"><textarea value={group.description} onChange={e => onChange({ description: e.target.value })} className="form-input min-h-[72px] resize-none" /></Field>
      </div>
    </details>
  );
}

function SettingsPanel(props: {
  busy: boolean;
  space: CoupleSpace;
  metAt: string;
  loveAt: string;
  countdownTitle: string;
  countdownAt: string;
  city: string;
  onMetAt: (value: string) => void;
  onLoveAt: (value: string) => void;
  onCountdownTitle: (value: string) => void;
  onCountdownAt: (value: string) => void;
  onCity: (value: string) => void;
  onSave: () => void;
  onUnbindRequest: () => void;
  onUnbindRespond: (accept: boolean) => void;
}) {
  return (
    <details className="rounded-[24px] bg-white p-4 shadow-sm ring-1 ring-black/[0.04] dark:bg-gray-900 dark:ring-white/[0.05]">
      <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-bold text-gray-950 dark:text-gray-50">
        <Settings size={16} className="text-gray-400" />
        设置
      </summary>
      <section className="mt-4 space-y-3">
        <Field label="相识时间"><input type="datetime-local" value={props.metAt} onChange={e => props.onMetAt(e.target.value)} className="form-input" /></Field>
        <Field label="相恋时间"><input type="datetime-local" value={props.loveAt} onChange={e => props.onLoveAt(e.target.value)} className="form-input" /></Field>
        <Field label="倒计时名称"><input value={props.countdownTitle} onChange={e => props.onCountdownTitle(e.target.value)} placeholder="例如：下次见面" className="form-input" /></Field>
        <Field label="倒计时时间"><input type="datetime-local" value={props.countdownAt} onChange={e => props.onCountdownAt(e.target.value)} className="form-input" /></Field>
        <Field label="我的城市"><input value={props.city} onChange={e => props.onCity(e.target.value)} placeholder="例如：沈北新区" className="form-input" /></Field>
        <button disabled={props.busy} onClick={props.onSave} className="flex w-full items-center justify-center gap-2 rounded-xl bg-rose-500 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
          <Save size={15} />
          保存设置
        </button>
        <UnbindPanel space={props.space} busy={props.busy} onRequest={props.onUnbindRequest} onRespond={props.onUnbindRespond} />
      </section>
    </details>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[24px] bg-white p-4 shadow-sm ring-1 ring-black/[0.04] dark:bg-gray-900 dark:ring-white/[0.05]">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="mt-2 text-xl font-bold text-gray-950 dark:text-gray-50">{value}</p>
    </div>
  );
}

function WeatherCard({ title, city, weather }: { title: string; city?: string; weather: Weather | null }) {
  const advice = weatherAdvice(weather);
  return (
    <div className="rounded-[24px] bg-white p-4 shadow-sm ring-1 ring-black/[0.04] dark:bg-gray-900 dark:ring-white/[0.05]">
      <CloudSun className="text-sky-500" size={20} />
      <p className="mt-3 text-xs text-gray-500">{title}</p>
      <p className="mt-1 truncate text-base font-bold text-gray-950 dark:text-gray-50">{city || '未设置城市'}</p>
      {weather && <p className="mt-1 text-xs text-sky-500">{weather.temperature}°C · {weatherText(weather)}</p>}
      {advice && <p className="mt-3 rounded-2xl bg-sky-50 px-3 py-2 text-xs leading-5 text-sky-700 dark:bg-sky-950/30 dark:text-sky-200">{advice}</p>}
    </div>
  );
}

function QuietFeature({ icon: Icon, title, onClick }: { icon: LucideIcon; title: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="rounded-[22px] bg-white p-4 text-left shadow-sm ring-1 ring-black/[0.04] dark:bg-gray-900 dark:ring-white/[0.05]">
      <Icon size={18} className="text-rose-500" />
      <p className="mt-3 text-sm font-bold text-gray-950 dark:text-gray-50">{title}</p>
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block text-xs font-semibold text-gray-500">{label}<div className="mt-1">{children}</div></label>;
}

function Avatar({ peer, large = false }: { peer: FriendItem['peer'] | CoupleSpace['peer']; large?: boolean }) {
  const [failed, setFailed] = useState(false);
  const size = large ? 'h-16 w-16 rounded-2xl' : 'h-10 w-10 rounded-xl';
  return peer.avatar && !failed
    ? <img src={assetUrl(peer.avatar)} onError={() => setFailed(true)} className={`${size} shrink-0 object-cover`} draggable={false} />
    : <div className={`${size} flex shrink-0 items-center justify-center bg-rose-100 font-bold text-rose-500`}>{display(peer)[0]?.toUpperCase() || '?'}</div>;
}
