import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

type ToastType = 'success' | 'error' | 'info';
type ToastFn = (message: string, type?: ToastType) => void;

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

const ToastContext = createContext<ToastFn | null>(null);

let nextId = 0;

function formatToastMessage(message: string) {
  if (message === 'TODAY_SIGNED') return '今天已经签到过了';
  if (message === 'COIN_PLUS_20') return '签到成功，金币 +20';
  if (message === 'HOME_UPGRADED') return '小屋升级成功';
  if (message === 'SIGNIN_FAILED') return '签到失败';
  if (message === 'UPGRADE_FAILED') return '小屋升级失败';
  if (message === 'HOME_MAX_LEVEL') return '小屋已经满级了';
  const comfort = message.match(/^COMFORT_REQUIRED_(\d+)$/);
  if (comfort) return `舒适度需要达到 ${comfort[1]}`;
  const furniture = message.match(/^FURNITURE_REQUIRED_(\d+)$/);
  if (furniture) return `需要先摆放 ${furniture[1]} 件家具`;
  return message;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = nextId++;
    setToasts(prev => [...prev, { id, message: formatToastMessage(message), type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  }, []);

  return (
    <ToastContext.Provider value={addToast}>
      {children}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] flex flex-col items-center gap-2 pointer-events-none">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`pointer-events-auto animate-[slideDown_0.3s_ease-out] rounded-2xl px-5 py-2.5 text-sm font-semibold shadow-lg backdrop-blur-md ${
              t.type === 'success'
                ? 'bg-emerald-500/90 text-white'
                : t.type === 'error'
                  ? 'bg-red-500/90 text-white'
                  : 'bg-slate-800/90 text-white dark:bg-white/90 dark:text-slate-800'
            }`}
            style={{
              animation: 'slideDown 0.3s ease-out',
            }}
          >
            {t.message}
          </div>
        ))}
      </div>
      <style>{`
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastFn {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be within ToastProvider');
  return ctx;
}
