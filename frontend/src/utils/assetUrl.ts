export function assetUrl(url?: string): string {
  if (!url) return '';
  if (/^(https?:|blob:|data:)/.test(url)) return url;

  const isAppShell = typeof window !== 'undefined' && ('plus' in window || window.location.protocol === 'file:');
  const rawBase =
    localStorage.getItem('echo-server-url') ||
    (import.meta as any).env?.VITE_API_BASE ||
    (isAppShell ? 'https://echo-im.cloud' : '') ||
    '';
  const base = typeof window !== 'undefined' && window.location.protocol === 'https:' && rawBase.startsWith('http:')
    ? ''
    : rawBase;

  return base ? `${base.replace(/\/$/, '')}${url.startsWith('/') ? url : '/' + url}` : url;
}
