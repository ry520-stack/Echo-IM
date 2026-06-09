import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useToast } from '../contexts/ToastContext';
import { api, getServerUrl, setServerUrl } from '../api/client';
import ToggleSwitch from '../components/ToggleSwitch';
import { useBackground, type PageKey } from '../hooks/useBackground';
import { Camera, ChevronLeft, LogOut, Image, Music, Palette, RotateCcw } from 'lucide-react';
import { assetUrl } from '../utils/assetUrl';
import { useSocket } from '../contexts/SocketContext';

interface BlockEntry {
  id: string;
  blocked: { id: string; username: string; nickname: string; avatar: string; digitalId: number };
}

export default function SettingsPage() {
  const { user, token, logout, updateUser } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const toast = useToast();
  const { socket } = useSocket();
  const nav = useNavigate();

  const [nickname, setNickname] = useState(user?.nickname || '');
  const [status, setStatus] = useState(user?.status || '');
  const [strangerMsg, setStrangerMsg] = useState(user?.allowStrangerMessage !== false);
  const [serverUrl, setServerUrlState] = useState(getServerUrl());
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [blockedUsers, setBlockedUsers] = useState<BlockEntry[]>([]);
  const [notifOn, setNotifOn] = useState(() => localStorage.getItem('echo-notif-enabled') !== 'false');
  const [readReceiptGlobal, setReadReceiptGlobal] = useState(() => localStorage.getItem('echo-read-receipt-global') !== 'false');
  const [ringtoneUrl, setRingtoneUrl] = useState(() => user?.callRingtoneUrl || localStorage.getItem('echo-call-ringtone-url') || '');
  const [ringtoneMode, setRingtoneMode] = useState<'peer' | 'mine'>(() => user?.callRingtoneMode || 'peer');
  const [accentColor, setAccentColor] = useState(() => localStorage.getItem('echo-accent-color') || 'purple');
  const [ringtoneUploading, setRingtoneUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bgFileInputRef = useRef<HTMLInputElement>(null);
  const ringtoneInputRef = useRef<HTMLInputElement>(null);
  const { settings, getBg, setBg, resetBg, resetAll, uploadAndGetUrl } = useBackground();
  const [bgTarget, setBgTarget] = useState<PageKey>('chat');
  const showDeveloperTools = user?.email === 'ranyv520@gmail.com' || localStorage.getItem('echo-dev-mode') === 'true';

  useEffect(() => {
    api<BlockEntry[]>('GET', '/api/blocks').then(setBlockedUsers).catch(() => {});
  }, []);

  useEffect(() => {
    if (!socket) return;
    const refreshBlockedUsers = () => api<BlockEntry[]>('GET', '/api/blocks').then(setBlockedUsers).catch(() => {});
    socket.on('relationship:updated', refreshBlockedUsers);
    return () => {
      socket.off('relationship:updated', refreshBlockedUsers);
    };
  }, [socket]);

  useEffect(() => {
    setRingtoneUrl(user?.callRingtoneUrl || localStorage.getItem('echo-call-ringtone-url') || '');
    setRingtoneMode(user?.callRingtoneMode || 'peer');
  }, [user?.callRingtoneUrl, user?.callRingtoneMode]);

  const saveProfile = async () => {
    setSaving(true);
    setMsg('');
    try {
      const updated = await api<any>('PUT', '/api/users/me', { nickname, status, allowStrangerMessage: strangerMsg });
      setMsg('保存成功');
      toast('个人资料已保存', 'success');
      const userKey = 'echo-user';
      const cached = JSON.parse(localStorage.getItem(userKey) || '{}');
      cached.nickname = updated.nickname;
      cached.status = updated.status;
      cached.allowStrangerMessage = updated.allowStrangerMessage;
      localStorage.setItem(userKey, JSON.stringify(cached));
    } catch (e: any) {
      setMsg(e.message || '保存失败');
      toast(e.message || '保存失败', 'error');
    } finally {
      setSaving(false);
    }
  };

  const unblock = async (userId: string) => {
    try {
      await api('DELETE', '/api/blocks/' + userId);
      setBlockedUsers(prev => prev.filter(b => b.blocked.id !== userId));
      toast('已取消拉黑', 'success');
    } catch (e: any) { toast(e.message || '操作失败', 'error'); }
  };

  const uploadAvatar = async (file: File) => {
    setAvatarUploading(true);
    setMsg('');
    try {
      const base = getServerUrl() || '';
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(base + '/api/upload/avatar', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '上传失败');

      updateUser({ avatar: data.url });
      setMsg('头像已更新');
      toast('头像已更新', 'success');
    } catch (e: any) {
      setMsg(e.message || '上传失败');
      toast(e.message || '上传失败', 'error');
    } finally {
      setAvatarUploading(false);
    }
  };

  const saveServerUrl = () => {
    setServerUrl(serverUrl);
    setMsg('服务器地址已更新');
    toast('服务器地址已更新', 'success');
  };

  const handleBgUpload = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) { toast('图片不能超过 10MB', 'error'); return; }
    try {
      const url = await uploadAndGetUrl(file);
      await setBg(bgTarget, url);
      toast('背景已更新', 'success');
    } catch (err: any) { toast(err.message || '上传失败', 'error'); }
  };

  const uploadRingtone = async (file: File) => {
    if (file.size > 80 * 1024 * 1024) { toast('\u94c3\u58f0\u6587\u4ef6\u4e0d\u80fd\u8d85\u8fc7 80MB', 'error'); return; }
    setRingtoneUploading(true);
    try {
      const base = getServerUrl() || '';
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(base + '/api/upload/ringtone', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
      });
      const contentType = res.headers.get('content-type') || '';
      const data = contentType.includes('application/json')
        ? await res.json()
        : { error: (await res.text()).slice(0, 100) };
      if (!res.ok) throw new Error(data.error || '\u4e0a\u4f20\u5931\u8d25');
      await api('PUT', '/api/users/me', { callRingtoneUrl: data.url });
      localStorage.setItem('echo-call-ringtone-url', data.url);
      setRingtoneUrl(data.url);
      updateUser({ callRingtoneUrl: data.url });
      toast('\u6765\u7535\u94c3\u58f0\u5df2\u66f4\u65b0', 'success');
    } catch (e: any) {
      toast(e.message || '\u4e0a\u4f20\u5931\u8d25', 'error');
    } finally {
      setRingtoneUploading(false);
    }
  };

  const saveRingtoneMode = async (mode: 'peer' | 'mine') => {
    setRingtoneMode(mode);
    try {
      await api('PUT', '/api/users/me', { callRingtoneMode: mode });
      updateUser({ callRingtoneMode: mode });
      toast(mode === 'mine' ? '\u547c\u51fa\u65f6\u5df2\u6539\u4e3a\u64ad\u653e\u6211\u7684\u94c3\u58f0' : '\u547c\u51fa\u65f6\u5df2\u6539\u4e3a\u64ad\u653e\u5bf9\u65b9\u94c3\u58f0', 'success');
    } catch (e: any) {
      setRingtoneMode(user?.callRingtoneMode || 'peer');
      toast(e.message || '\u8bbe\u7f6e\u5931\u8d25', 'error');
    }
  };

  const resetRingtone = async () => {
    try {
      await api('PUT', '/api/users/me', { callRingtoneUrl: '' });
      localStorage.removeItem('echo-call-ringtone-url');
      setRingtoneUrl('');
      updateUser({ callRingtoneUrl: '' });
      toast('\u5df2\u6062\u590d\u9ed8\u8ba4\u94c3\u58f0', 'info');
    } catch (e: any) {
      toast(e.message || '\u8bbe\u7f6e\u5931\u8d25', 'error');
    }
  };

  const pageLabels: Record<PageKey, string> = {
    conversation: '会话列表',
    gravity: '引力圈',
    chat: '聊天界面',
  };

  const avatarUrl = assetUrl(user?.avatar);

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-700/50 dark:bg-gray-800/50">
      <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">{title}</h3>
      <div className="space-y-4">{children}</div>
    </div>
  );

  return (
    <div className="h-full overflow-y-auto bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-gray-100/60 bg-white/80 backdrop-blur-md dark:border-gray-800/60 dark:bg-gray-900/80">
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            onClick={() => nav('/')}
            className="rounded-xl p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 transition-colors"
          >
            <ChevronLeft size={20} strokeWidth={1.5} />
          </button>
          <h1 className="text-base font-semibold text-gray-900 dark:text-gray-100">个人设置</h1>
        </div>
      </header>

      <div className="mx-auto max-w-lg px-4 py-6 space-y-5">
        {/* Profile Header Card */}
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-700/50 dark:bg-gray-800/50">
          <div className="flex items-center gap-4">
            {/* Avatar with camera badge */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="relative shrink-0 group"
              disabled={avatarUploading}
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-100 text-2xl font-bold text-primary-600 overflow-hidden dark:bg-primary-900/30 dark:text-primary-400">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  (user?.nickname || user?.username || '?')[0]?.toUpperCase()
                )}
              </div>
              <div className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-gray-800 text-white ring-2 ring-white dark:ring-gray-800">
                <Camera size={12} strokeWidth={2} />
              </div>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) uploadAvatar(file);
              }}
            />
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 truncate">
                {user?.nickname || user?.username}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{user?.email}</p>
              <div className="mt-1.5 inline-flex items-center gap-1.5 rounded-lg bg-gray-100 px-2.5 py-0.5 dark:bg-gray-700">
                <span className="text-[10px] uppercase tracking-wider text-gray-400">ID</span>
                <span className="font-mono text-sm font-bold tracking-wider text-primary-500">{user?.digitalId}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Personal Info */}
        <Section title="个人资料">
          <div>
            <label className="mb-1.5 block text-sm text-gray-600 dark:text-gray-400">昵称</label>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="设置昵称"
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm transition-colors focus:border-primary-300 focus:bg-white dark:border-gray-600 dark:bg-gray-700/50 dark:text-gray-100 dark:focus:border-primary-500 dark:focus:bg-gray-700"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm text-gray-600 dark:text-gray-400">个性签名</label>
            <input
              type="text"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              placeholder="写一句话..."
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm transition-colors focus:border-primary-300 focus:bg-white dark:border-gray-600 dark:bg-gray-700/50 dark:text-gray-100 dark:focus:border-primary-500 dark:focus:bg-gray-700"
            />
          </div>
          <button
            onClick={saveProfile}
            disabled={saving}
            className="w-full rounded-xl bg-primary-500 py-2.5 text-sm font-semibold text-white hover:bg-primary-600 disabled:opacity-50 transition-colors"
          >
            {saving ? '保存中...' : '保存'}
          </button>
          {msg && <p className="text-center text-sm text-green-500">{msg}</p>}
        </Section>

        {/* Privacy */}
        <Section title="隐私">
          <ToggleSwitch
            label="允许陌生人给我发消息"
            checked={strangerMsg}
            onChange={setStrangerMsg}
          />
          <ToggleSwitch
            label="已读回执（全局）"
            checked={readReceiptGlobal}
            onChange={(v) => {
              setReadReceiptGlobal(v);
              localStorage.setItem('echo-read-receipt-global', String(v));
              api('PUT', '/api/users/me', { readReceiptsEnabled: v }).catch(() => {});
              toast(v ? '已读回执已开启' : '已读回执已关闭', 'info');
            }}
          />
          {blockedUsers.length > 0 && (
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">已拉黑的用户</p>
              {blockedUsers.map(b => (
                <div key={b.id} className="flex items-center justify-between py-1">
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    {b.blocked.nickname || b.blocked.username} (ID: {b.blocked.digitalId})
                  </span>
                  <button onClick={() => unblock(b.blocked.id)} className="text-xs text-red-400 hover:underline">取消拉黑</button>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* System */}
        <Section title="系统">
          <ToggleSwitch
            label="暗黑模式"
            checked={theme === 'dark'}
            onChange={toggleTheme}
          />
          <ToggleSwitch
            label="消息通知"
            checked={notifOn}
            onChange={(v) => {
              setNotifOn(v);
              localStorage.setItem('echo-notif-enabled', String(v));
              if (v && Notification.permission === 'default') Notification.requestPermission().catch(() => {});
            }}
          />
          <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800/60">
            <div className="mb-3 flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
              <Palette size={15} />
              <span>{'\u9ad8\u4eae\u989c\u8272'}</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { key: 'purple', label: '\u7d2b\u8272', cls: 'bg-primary-500' },
                { key: 'blue', label: '\u84dd\u8272', cls: 'bg-blue-600' },
                { key: 'black', label: '\u9ed1\u8272', cls: 'bg-gray-900' },
              ].map(item => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => {
                    setAccentColor(item.key);
                    localStorage.setItem('echo-accent-color', item.key);
                    window.dispatchEvent(new Event('echo-accent-color-change'));
                    toast('\u9ad8\u4eae\u989c\u8272\u5df2\u66f4\u65b0', 'success');
                  }}
                  className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs transition-colors ${accentColor === item.key ? 'bg-white text-gray-900 ring-1 ring-gray-200 dark:bg-gray-900 dark:text-gray-100 dark:ring-gray-700' : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-300'}`}
                >
                  <span className={`h-3 w-3 rounded-full ${item.cls}`} />
                  {item.label}
                </button>
              ))}
            </div>
          </div>
          <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800/60">
            <div className="mb-2 flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
              <Music size={15} />
              <span>{'\u6765\u7535\u94c3\u58f0'}</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => ringtoneInputRef.current?.click()}
                disabled={ringtoneUploading}
                className="rounded-xl bg-primary-500 px-3 py-2 text-xs font-medium text-white disabled:opacity-50"
              >
                {ringtoneUploading ? '\u4e0a\u4f20\u4e2d...' : ringtoneUrl ? '\u66f4\u6362\u94c3\u58f0' : '\u4e0a\u4f20\u94c3\u58f0'}
              </button>
              {ringtoneUrl && (
                <button
                  onClick={resetRingtone}
                  className="rounded-xl bg-gray-200 px-3 py-2 text-xs text-gray-600 dark:bg-gray-700 dark:text-gray-200"
                >
                  {'\u6062\u590d\u9ed8\u8ba4'}
                </button>
              )}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl bg-white p-1 dark:bg-gray-900/60">
              <button
                type="button"
                onClick={() => saveRingtoneMode('peer')}
                className={`rounded-lg px-2 py-2 text-xs transition-colors ${ringtoneMode === 'peer' ? 'bg-primary-500 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'}`}
              >
                {'\u547c\u51fa\u542c\u5bf9\u65b9\u94c3\u58f0'}
              </button>
              <button
                type="button"
                onClick={() => saveRingtoneMode('mine')}
                className={`rounded-lg px-2 py-2 text-xs transition-colors ${ringtoneMode === 'mine' ? 'bg-primary-500 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'}`}
              >
                {'\u547c\u51fa\u542c\u6211\u7684\u94c3\u58f0'}
              </button>
            </div>
            <input
              ref={ringtoneInputRef}
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) uploadRingtone(file);
                e.target.value = '';
              }}
            />
            <p className="mt-2 text-[10px] text-gray-400">{'\u652f\u6301 mp3/m4a/aac/wav\u3002\u522b\u4eba\u6253\u7ed9\u4f60\u65f6\u64ad\u653e\u4f60\u7684\u94c3\u58f0\uff1b\u4f60\u547c\u51fa\u65f6\u53ef\u9009\u64ad\u653e\u5bf9\u65b9\u6216\u81ea\u5df1\u7684\u94c3\u58f0\u3002'}</p>
          </div>
          {showDeveloperTools && (
            <div>
              <label className="mb-1.5 block text-sm text-gray-600 dark:text-gray-400">服务器地址</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={serverUrl}
                  onChange={(e) => setServerUrlState(e.target.value)}
                  placeholder="例如 http://8.140.194.214:3001"
                  className="flex-1 rounded-xl border border-gray-200 bg-gray-50 px-4 py-2 text-xs transition-colors focus:border-primary-300 focus:bg-white dark:border-gray-600 dark:bg-gray-700/50 dark:text-gray-100 dark:focus:border-primary-500 dark:focus:bg-gray-700"
                />
                <button onClick={saveServerUrl} className="shrink-0 rounded-xl bg-gray-100 px-4 py-2 text-xs font-medium text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 transition-colors">更新</button>
              </div>
            </div>
          )}
        </Section>

        {/* Background Settings */}
        <Section title="背景设置">
          <div className="flex gap-2 flex-wrap">
            {(['conversation', 'gravity', 'chat'] as const).map(key => (
              <button
                key={key}
                onClick={() => setBgTarget(key)}
                className={`px-3 py-1.5 text-xs rounded-full transition-colors ${
                  bgTarget === key
                    ? 'bg-primary-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                }`}
              >
                {pageLabels[key]}
              </button>
            ))}
          </div>

          {/* Preview */}
          <div className="relative h-32 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-600">
            {(() => {
              const previewUrl = getBg(bgTarget);
              if (!previewUrl) {
                return (
                  <div className="w-full h-full bg-gradient-to-br from-gray-100 via-gray-200 to-gray-300 dark:from-gray-800 dark:via-gray-900 dark:to-gray-950 flex items-center justify-center">
                    <span className="text-xs text-gray-400 dark:text-gray-500">无背景</span>
                  </div>
                );
              }
              return <img src={assetUrl(previewUrl)} alt="" className="w-full h-full object-cover" />;
            })()}
            <div className="absolute bottom-2 right-2 flex gap-1.5">
              <button
                onClick={() => bgFileInputRef.current?.click()}
                className="flex items-center gap-1 rounded-lg bg-black/50 backdrop-blur-sm px-2.5 py-1.5 text-xs text-white hover:bg-black/70 transition-colors"
              >
                <Image size={12} /> 上传
              </button>
              <button
                onClick={() => {
                  resetBg(bgTarget);
                  toast('已重置', 'info');
                }}
                className="flex items-center gap-1 rounded-lg bg-black/50 backdrop-blur-sm px-2.5 py-1.5 text-xs text-white hover:bg-black/70 transition-colors"
              >
                <RotateCcw size={12} /> 重置
              </button>
            </div>
          </div>

          <input
            ref={bgFileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleBgUpload(file);
              e.target.value = '';
            }}
          />

          <p className="text-[10px] text-gray-400">
            支持 JPG/PNG/WEBP，最大 10MB。图片将上传至服务器，支持多端同步。
          </p>

          <button
            onClick={() => { resetAll(); toast('已恢复默认背景', 'info'); }}
            className="w-full rounded-xl border border-gray-200 dark:border-gray-600 py-2 text-xs text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            恢复全部默认
          </button>
        </Section>

        {/* Logout */}
        <button
          onClick={() => { logout(); nav('/login'); }}
          className="w-full rounded-2xl border border-red-200 bg-white py-3 text-sm font-medium text-red-500 hover:bg-red-50 dark:border-red-900/50 dark:bg-gray-800/50 dark:hover:bg-red-900/20 transition-colors flex items-center justify-center gap-2"
        >
          <LogOut size={16} strokeWidth={1.5} />
          退出登录
        </button>

        {/* Developer Footer */}
        <div className="text-xs text-slate-400 mt-6 text-center pb-4 space-y-0.5">
          <p>开发者邮箱: ranyv520@gmail.com</p>
          <p>微信: Echo11238</p>
          <p className="font-mono text-primary-500">Echo ID: 260520</p>
        </div>
      </div>
    </div>
  );
}
