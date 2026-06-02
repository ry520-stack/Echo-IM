import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<'email' | 'code' | 'done'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [captchaKey, setCaptchaKey] = useState('');
  const [captchaQuestion, setCaptchaQuestion] = useState('');
  const [captchaAnswer, setCaptchaAnswer] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [countdown, setCountdown] = useState(0);

  const fetchCaptcha = async () => {
    try {
      const data = await api<{ key: string; question: string }>('GET', '/api/auth/captcha');
      setCaptchaKey(data.key);
      setCaptchaQuestion(data.question);
      setCaptchaAnswer('');
    } catch { /* ignore */ }
  };

  const startCountdown = () => {
    setCountdown(60);
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) { clearInterval(timer); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  const sendCode = async () => {
    setError('');
    setSending(true);
    try {
      const res = await api<{ message: string }>('POST', '/api/auth/send-code', {
        email: email.trim(),
        captchaKey,
        captchaAnswer: parseInt(captchaAnswer),
      });
      setStep('code');
      startCountdown();
    } catch (e: any) {
      setError(e.message || '发送失败');
      fetchCaptcha();
    } finally {
      setSending(false);
    }
  };

  const resetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api('POST', '/api/auth/reset-password', {
        email: email.trim(),
        code: code.trim(),
        newPassword,
      });
      setStep('done');
    } catch (e: any) {
      setError(e.message || '重置失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-full overflow-y-auto items-center justify-center bg-gray-50 px-4 dark:bg-gray-950">
      <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-8 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary-500 text-xl font-bold text-white">E</div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">找回密码</h1>
        </div>

        {step === 'done' ? (
          <div className="text-center">
            <p className="text-4xl mb-3">✅</p>
            <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">密码已重置</p>
            <Link to="/login" className="text-sm text-primary-500 hover:underline">返回登录</Link>
          </div>
        ) : step === 'email' ? (
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm text-gray-600 dark:text-gray-400">邮箱</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="输入注册邮箱"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                required
              />
            </div>

            {captchaQuestion && (
              <div>
                <label className="mb-1 block text-sm text-gray-600 dark:text-gray-400">{captchaQuestion}</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={captchaAnswer}
                    onChange={(e) => setCaptchaAnswer(e.target.value)}
                    className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                    required
                  />
                  <button
                    type="button"
                    onClick={fetchCaptcha}
                    className="shrink-0 rounded-lg bg-gray-100 px-3 py-2 text-xs text-gray-500 dark:bg-gray-800 dark:text-gray-400"
                  >
                    换一题
                  </button>
                </div>
              </div>
            )}

            {error && <p className="text-sm text-red-500">{error}</p>}

            {!captchaQuestion ? (
              <button
                type="button"
                onClick={fetchCaptcha}
                className="w-full rounded-lg bg-primary-500 py-2 text-sm font-medium text-white hover:bg-primary-600"
              >
                下一步
              </button>
            ) : (
              <button
                type="button"
                onClick={sendCode}
                disabled={sending || countdown > 0}
                className="w-full rounded-lg bg-primary-500 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-600 disabled:opacity-50"
              >
                {sending ? '发送中...' : countdown > 0 ? `${countdown}s 后重发` : '发送验证码'}
              </button>
            )}

            <p className="text-center text-sm text-gray-500 dark:text-gray-400">
              <Link to="/login" className="text-primary-500 hover:underline">返回登录</Link>
            </p>
          </div>
        ) : (
          <form onSubmit={resetPassword} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm text-gray-600 dark:text-gray-400">验证码</label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="6位数字验证码"
                maxLength={6}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-gray-600 dark:text-gray-400">新密码</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="至少6位"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                required
                minLength={6}
              />
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-primary-500 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-600 disabled:opacity-50"
            >
              {loading ? '重置中...' : '重置密码'}
            </button>

            <button
              type="button"
              onClick={sendCode}
              disabled={countdown > 0}
              className="w-full text-center text-sm text-primary-500 hover:underline"
            >
              {countdown > 0 ? `${countdown}s 后重发` : '重新发送验证码'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
