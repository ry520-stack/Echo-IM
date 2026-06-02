import { useState, useRef } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getServerUrl } from '../api/client';

export default function RegisterPage() {
  const { register, token } = useAuth();
  const nav = useNavigate();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [countdown, setCountdown] = useState(0);

  const [captchaOpen, setCaptchaOpen] = useState(false);
  const [captchaQuestion, setCaptchaQuestion] = useState('');
  const [captchaInput, setCaptchaInput] = useState('');
  const [captchaError, setCaptchaError] = useState('');
  const captchaResolve = useRef<((ans: number | null) => void) | null>(null);
  const captchaInputRef = useRef<HTMLInputElement>(null);

  if (token) return <Navigate to="/" replace />;

  const askCaptcha = (question: string, _key: string): Promise<number | null> => {
    return new Promise((resolve) => {
      captchaResolve.current = resolve;
      setCaptchaQuestion(question);
      setCaptchaInput('');
      setCaptchaError('');
      setCaptchaOpen(true);
      setTimeout(() => captchaInputRef.current?.focus(), 100);
    });
  };

  const handleCaptchaOk = () => {
    const val = parseInt(captchaInput, 10);
    if (isNaN(val)) {
      setCaptchaError('请输入数字');
      return;
    }
    setCaptchaOpen(false);
    captchaResolve.current?.(val);
  };

  const handleCaptchaCancel = () => {
    setCaptchaOpen(false);
    captchaResolve.current?.(null);
  };

  const handleCaptchaKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleCaptchaOk();
    if (e.key === 'Escape') handleCaptchaCancel();
  };

  const sendCode = async () => {
    setError('');
    if (!email) { setError('请先输入邮箱'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('请输入正确的邮箱格式');
      return;
    }

    const base = getServerUrl();

    try {
      const captchaRes = await fetch(base + '/api/auth/captcha');
      const captchaText = await captchaRes.text();
      let captchaData: any;
      try { captchaData = JSON.parse(captchaText); } catch {
        throw new Error('服务器繁忙，请稍后重试');
      }
      if (!captchaRes.ok) throw new Error(captchaData.error || '获取验证题目失败');

      const answer = await askCaptcha(captchaData.question, captchaData.key);
      if (answer === null) { setError('请回答数学题'); return; }

      setSending(true);
      try {
        const res = await fetch(base + '/api/auth/send-code', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, captchaKey: captchaData.key, captchaAnswer: answer }),
        });
        let data: any;
        const text = await res.text();
        try { data = JSON.parse(text); } catch {
          throw new Error('服务器繁忙，请稍后重试');
        }
        if (!res.ok) throw new Error(data.error || '发送失败');
        let sec = 60;
        setCountdown(sec);
        const timer = setInterval(() => {
          sec--;
          setCountdown(sec);
          if (sec <= 0) clearInterval(timer);
        }, 1000);
      } catch (e: any) {
        setError(e.message || '网络错误');
      } finally {
        setSending(false);
      }
    } catch (e: any) {
      setError(e.message || '网络错误');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 6) { setError('密码至少 6 位'); return; }
    if (!code) { setError('请输入验证码'); return; }
    setLoading(true);
    try {
      await register(username, email, password, code);
      nav('/');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-full overflow-y-auto items-center justify-center bg-gray-50 px-4 dark:bg-gray-950">
      {captchaOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={handleCaptchaCancel}>
          <div
            className="w-full max-w-xs rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-800"
            onClick={e => e.stopPropagation()}
          >
            <p className="text-center text-sm text-gray-500 dark:text-gray-400">请回答以下问题</p>
            <p className="mt-3 text-center text-2xl font-bold tracking-wider text-gray-800 dark:text-gray-100">
              {captchaQuestion}
            </p>
            <input
              ref={captchaInputRef}
              type="number"
              value={captchaInput}
              onChange={e => setCaptchaInput(e.target.value)}
              onKeyDown={handleCaptchaKeyDown}
              placeholder="输入答案"
              className="mt-4 w-full rounded-xl border border-gray-200 px-4 py-3 text-center text-lg tracking-wider outline-none focus:border-primary-400 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            />
            {captchaError && <p className="mt-2 text-center text-xs text-red-500">{captchaError}</p>}
            <div className="mt-4 flex gap-3">
              <button
                onClick={handleCaptchaCancel}
                className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-500 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-700"
              >
                取消
              </button>
              <button
                onClick={handleCaptchaOk}
                className="flex-1 rounded-xl bg-primary-500 py-2.5 text-sm font-medium text-white hover:bg-primary-600"
              >
                确定
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-8 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary-500 text-xl font-bold text-white">
            E
          </div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">注册 Echo</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">创建你的专属账号</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm text-gray-600 dark:text-gray-400">用户名</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-gray-600 dark:text-gray-400">邮箱</label>
            <div className="flex gap-2">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                required
              />
              <button
                type="button"
                onClick={sendCode}
                disabled={sending || countdown > 0}
                className="shrink-0 rounded-lg bg-primary-50 px-3 py-2 text-xs font-medium text-primary-600 transition-colors hover:bg-primary-100 disabled:opacity-50 dark:bg-primary-900/30 dark:text-primary-400"
              >
                {sending ? '发送中' : countdown > 0 ? `${countdown}s` : '获取验证码'}
              </button>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm text-gray-600 dark:text-gray-400">验证码</label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="6位数字验证码"
              maxLength={6}
              required
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-gray-600 dark:text-gray-400">密码</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="至少 6 位"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              required
            />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-primary-500 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-600 disabled:opacity-50"
          >
            {loading ? '注册中...' : '注册'}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-gray-500 dark:text-gray-400">
          已有账号？
          <Link to="/login" className="ml-1 text-primary-500 hover:underline dark:text-primary-400">
            登录
          </Link>
        </p>
      </div>
    </div>
  );
}
