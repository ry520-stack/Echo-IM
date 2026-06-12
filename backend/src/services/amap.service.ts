const AMAP_KEY = process.env.AMAP_WEB_SERVICE_KEY || process.env.AMAP_KEY || process.env.GAODE_KEY || '0044f9fa65caa8f958cc9fd840b3d52f';

type WeatherValue = {
  city: string;
  weather: string;
  temperature: string;
  winddirection: string;
  windpower: string;
  humidity: string;
  reporttime: string;
};

type GeoValue = { city: string; lng: number; lat: number };

const weatherCache = new Map<string, { day: string; value: WeatherValue | null }>();
const geoCache = new Map<string, GeoValue | null>();

function dayKey() {
  return new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function haversineKm(a: GeoValue, b: GeoValue) {
  const toRad = (value: number) => value * Math.PI / 180;
  const radius = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export async function getAmapWeather(city: string) {
  const normalized = city.trim() || '曲阜';
  const key = `weather:${normalized}`;
  const cached = weatherCache.get(key);
  if (cached?.day === dayKey()) return cached.value;
  const url = `https://restapi.amap.com/v3/weather/weatherInfo?key=${AMAP_KEY}&city=${encodeURIComponent(normalized)}&extensions=base`;
  const res = await fetch(url);
  const data: any = await res.json();
  const live = data?.lives?.[0];
  const value: WeatherValue | null = live ? {
    city: live.city || normalized,
    weather: live.weather || '',
    temperature: String(live.temperature ?? ''),
    winddirection: live.winddirection || '',
    windpower: live.windpower || '',
    humidity: String(live.humidity ?? ''),
    reporttime: live.reporttime || '',
  } : null;
  weatherCache.set(key, { day: dayKey(), value });
  return value;
}

export async function geocodeCity(city: string) {
  const normalized = city.trim();
  if (!normalized) return null;
  if (geoCache.has(normalized)) return geoCache.get(normalized) || null;
  const url = `https://restapi.amap.com/v3/geocode/geo?key=${AMAP_KEY}&address=${encodeURIComponent(normalized)}`;
  const res = await fetch(url);
  const data: any = await res.json();
  const item = data?.geocodes?.[0];
  if (!item?.location) {
    geoCache.set(normalized, null);
    return null;
  }
  const [lng, lat] = String(item.location).split(',').map(Number);
  const value = Number.isFinite(lng) && Number.isFinite(lat) ? { city: item.formatted_address || normalized, lng, lat } : null;
  geoCache.set(normalized, value);
  return value;
}

export async function getCityDistance(from: string, to: string) {
  const [a, b] = await Promise.all([geocodeCity(from), geocodeCity(to)]);
  if (!a || !b) return null;
  const km = haversineKm(a, b);
  return {
    from: a.city,
    to: b.city,
    km: Math.round(km * 10) / 10,
  };
}
