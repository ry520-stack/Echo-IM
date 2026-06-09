import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  actions?: ReactNode;
}

export default function Modal({ open, onClose, title, children, actions }: Props) {
  useEffect(() => {
    if (open) {
      const handler = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onClose();
      };
      document.addEventListener('keydown', handler);
      return () => document.removeEventListener('keydown', handler);
    }
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center p-4" onTouchStart={(e) => e.stopPropagation()} onTouchEnd={(e) => e.stopPropagation()}>
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/35 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Card */}
      <div className="relative flex max-h-[calc(100dvh-2rem)] w-full max-w-sm flex-col rounded-2xl border border-gray-100 bg-white p-5 shadow-2xl animate-[modalIn_0.2s_ease-out] dark:border-gray-800 dark:bg-gray-900">
        <button type="button" onClick={onClose} className="absolute right-3 top-3 rounded-lg p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800" aria-label="关闭">
          <X size={16} />
        </button>
        {title && (
          <h3 className="mb-3 pr-8 text-base font-semibold text-gray-900 dark:text-white">{title}</h3>
        )}
        <div className="min-h-0 overflow-y-auto overscroll-contain text-sm leading-6 text-gray-500 dark:text-gray-300">{children}</div>
        {actions && (
          <div className="mt-5 flex justify-end gap-3">
            {actions}
          </div>
        )}
      </div>

      <style>{`
        @keyframes modalIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
