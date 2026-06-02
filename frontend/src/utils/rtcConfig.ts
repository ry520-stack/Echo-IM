import { is5Plus } from './env';

const DEFAULT_STUN_URLS = ['stun:stun.l.google.com:19302'];

function splitUrls(value: string | undefined | null): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function getEnv(name: string): string {
  return ((import.meta as any).env?.[name] || '').trim();
}

function getLocal(name: string): string {
  return (localStorage.getItem(name) || '').trim();
}

export function getRtcConfig(): RTCConfiguration {
  const stunUrls = splitUrls(getLocal('echo-rtc-stun-urls') || getEnv('VITE_RTC_STUN_URLS'));
  const turnUrls = splitUrls(getLocal('echo-rtc-turn-urls') || getEnv('VITE_RTC_TURN_URLS'));
  const turnUsername = getLocal('echo-rtc-turn-username') || getEnv('VITE_RTC_TURN_USERNAME');
  const turnCredential = getLocal('echo-rtc-turn-credential') || getEnv('VITE_RTC_TURN_CREDENTIAL');
  const iceTransportPolicy = (getLocal('echo-rtc-ice-policy') || getEnv('VITE_RTC_ICE_TRANSPORT_POLICY')) as RTCIceTransportPolicy;

  const iceServers: RTCIceServer[] = [
    { urls: stunUrls.length ? stunUrls : DEFAULT_STUN_URLS },
  ];

  if (turnUrls.length && turnUsername && turnCredential) {
    iceServers.push({
      urls: turnUrls,
      username: turnUsername,
      credential: turnCredential,
    });
  }

  return {
    iceServers,
    iceTransportPolicy: iceTransportPolicy === 'relay' ? 'relay' : 'all',
  };
}

export function getCallReadinessError(): string | null {
  if (typeof RTCPeerConnection === 'undefined') {
    return '当前环境不支持实时通话';
  }

  if (!is5Plus() && !window.isSecureContext && location.hostname !== 'localhost') {
    return '网页通话需要 HTTPS 域名';
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    return '当前环境不支持麦克风通话';
  }

  return null;
}
