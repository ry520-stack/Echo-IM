import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { assetUrl } from '../utils/assetUrl';

interface NotificationData {
  senderName: string;
  messagePreview: string;
  avatar?: string;
  chatId: string;
}

interface Props {
  isVisible: boolean;
  notification: NotificationData | null;
  onClose: () => void;
  onClick: (chatId: string) => void;
}

export default function NotificationBanner({ isVisible, notification, onClose, onClick }: Props) {
  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(onClose, 3000);
      return () => clearTimeout(timer);
    }
  }, [isVisible, onClose]);

  return (
    <AnimatePresence>
      {isVisible && notification && (
        <motion.div
          initial={{ opacity: 0, y: -50, scale: 0.95 }}
          animate={{ opacity: 1, y: 16, scale: 1 }}
          exit={{ opacity: 0, y: -50, scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25, mass: 0.8 }}
          drag="y"
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={0.2}
          onDragEnd={(_e, info) => { if (info.offset.y < -20) onClose(); }}
          className="fixed top-0 left-0 right-0 z-[9999] flex justify-center px-4 pointer-events-none"
        >
          <div
            onClick={() => onClick(notification.chatId)}
            className="pointer-events-auto flex items-center gap-3 w-full max-w-sm p-3 rounded-2xl bg-white/20 dark:bg-black/40 backdrop-blur-xl border border-white/30 dark:border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.15)] cursor-pointer active:scale-[0.98] transition-transform"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-500 text-sm font-bold text-white shadow-sm">
              {notification.avatar
                ? <img src={assetUrl(notification.avatar)} alt="" className="h-full w-full rounded-full object-cover" />
                : notification.senderName[0]?.toUpperCase()}
            </div>
            <div className="flex-1 overflow-hidden">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                {notification.senderName}
              </h4>
              <p className="text-xs text-gray-700 dark:text-gray-300 truncate mt-0.5">
                {notification.messagePreview}
              </p>
            </div>
            <div className="w-2 h-2 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.8)] animate-pulse shrink-0" />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
