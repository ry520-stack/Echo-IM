import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface FloatingStackProps {
  images: string[];
  onPreview?: (url: string, index: number) => void;
  onDelete?: (index: number) => void;
}

export default function FloatingStackGallery({ images, onPreview, onDelete }: FloatingStackProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [deleted, setDeleted] = useState<Set<number>>(new Set());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const visibleImages = images.filter((_, i) => !deleted.has(i));
  const total = visibleImages.length;

  // 10s auto-reverse
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (activeIndex > 0) {
      timerRef.current = setTimeout(() => {
        intervalRef.current = setInterval(() => {
          setActiveIndex(prev => {
            if (prev <= 1) { clearInterval(intervalRef.current!); return 0; }
            return prev - 1;
          });
        }, 300);
      }, 10000);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [activeIndex]);

  const handleDragEnd = (_: any, info: { offset: { x: number } }) => {
    if (info.offset.x < -100) {
      setActiveIndex(prev => (prev + 1) % visibleImages.length);
    } else if (info.offset.x > 100) {
      setActiveIndex(prev => (prev - 1 + visibleImages.length) % visibleImages.length);
    }
  };

  const handleDelete = (realIndex: number) => {
    setDeleted(prev => new Set([...prev, realIndex]));
    setConfirmDelete(null);
    onDelete?.(realIndex);
    if (realIndex === activeIndex && visibleImages.length > 1) setActiveIndex(0);
  };

  if (total === 0) return null;

  return (
    <div className="relative w-full flex justify-center items-center aspect-[4/3]" style={{ perspective: '1000px' }}>
      {/* Counter badge */}
      <div className="absolute top-3 right-3 z-50 text-white/90 bg-black/60 backdrop-blur-sm px-2.5 py-1 rounded-full text-xs font-mono tracking-wider">
        {Math.min(activeIndex + 1, total)}/{total}
      </div>

      <AnimatePresence>
        {visibleImages.map((url, i) => {
          const originalIndex = images.indexOf(url);
          const visualIndex = (i - activeIndex + total) % total;
          const isTop = visualIndex === 0;
          const isPeek = visualIndex === 1;
          const isHidden = visualIndex > 1;

          return (
            <motion.img
              key={url}
              src={url}
              alt=""
              className="absolute w-[92%] h-[92%] object-cover rounded-2xl shadow-2xl border border-zinc-800 cursor-pointer select-none touch-callout-none"
              onClick={() => {
                if (confirmDelete === originalIndex) { setConfirmDelete(null); return; }
                if (isTop && onPreview) onPreview(url, i);
              }}
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              onTouchStart={(e) => {
                if (!isTop || !onDelete) return;
                e.stopPropagation();
                longPressRef.current = setTimeout(() => setConfirmDelete(originalIndex), 500);
              }}
              onTouchMove={() => { if (longPressRef.current) { clearTimeout(longPressRef.current); longPressRef.current = null; } }}
              onTouchEnd={() => { if (longPressRef.current) { clearTimeout(longPressRef.current); longPressRef.current = null; } }}
              drag={isTop ? 'x' : false}
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.2}
              onDragEnd={isTop ? handleDragEnd : undefined}
              animate={
                isHidden
                  ? { zIndex: 0, scale: 0.8, x: 0, y: 0, opacity: 0 }
                  : isPeek
                    ? { zIndex: 5, scale: 0.92, x: 14, y: 14, opacity: 0.85 }
                    : { zIndex: 10, scale: 1, x: 0, y: 0, opacity: 1 }
              }
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              exit={{ scale: 0, opacity: 0, filter: 'blur(10px)', transition: { duration: 0.4, ease: 'easeInOut' } }}
            />
          );
        })}
      </AnimatePresence>

      {/* Delete confirmation */}
      {confirmDelete !== null && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40 backdrop-blur-sm rounded-2xl" onClick={() => setConfirmDelete(null)}>
          <div className="text-center">
            <p className="text-white text-xs mb-2 drop-shadow">星体湮灭？</p>
            <button onClick={(e) => { e.stopPropagation(); handleDelete(confirmDelete); }}
              className="rounded-full bg-red-500/80 px-4 py-1.5 text-xs text-white">确认</button>
          </div>
        </div>
      )}
    </div>
  );
}
