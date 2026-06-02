import { useRef, useEffect, useId } from 'react';
import { motion, useMotionValue } from 'framer-motion';
import '../styles/voice-aura.css';

interface Props {
  onSend: () => void;
  onCancel: () => void;
  duration: number;
}

export default function GooeySwipe({ onSend, onCancel, duration }: Props) {
  const x = useMotionValue(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const knobSize = 44;
  const maxDrag = useRef(200);
  const filterId = useId();

  useEffect(() => {
    if (containerRef.current) {
      maxDrag.current = containerRef.current.offsetWidth - knobSize - 4;
    }
    if (duration >= 60) onSend();
  }, [duration, onSend]);

  const handleDragEnd = (_: any, info: { offset: { x: number } }) => {
    if (info.offset.x > maxDrag.current * 0.6) {
      onSend();
    } else {
      onCancel();
    }
  };

  return (
    <div className="flex items-center gap-2 flex-1 relative voice-replica-card listening">
      {/* Voice aura — extracted from Uiverse circle effects */}
      <div className="mic-aura-container">
        <div className="mic-aura-ring" />
        <div className="mic-aura-glow">
          <div className="mic-aura-glow-inner" />
        </div>
      </div>

      {/* SVG Gooey Filter */}
      <svg className="absolute w-0 h-0 pointer-events-none" aria-hidden="true">
        <defs>
          <filter id="goo">
            <feGaussianBlur in="SourceGraphic" stdDeviation="8" result="blur" />
            <feColorMatrix
              in="blur" mode="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7"
              result="goo"
            />
            <feBlend in="SourceGraphic" in2="goo" />
          </filter>
        </defs>
      </svg>

      {/* Gooey Container */}
      <div
        ref={containerRef}
        className="relative flex-1 h-14 flex items-center justify-start"
        style={{ filter: 'url(#goo)' }}
      >
        <div className="absolute inset-0 rounded-full flex items-center justify-center"
          style={{ background: 'rgba(99,102,241,0.7)' }}>
          <span className="text-white/80 text-sm font-medium ml-12 pointer-events-none select-none">
            {duration > 0 ? `🔴 ${duration}s` : '→ 滑动发送 →'}
          </span>
        </div>

        <div className="absolute left-1 top-1/2 -translate-y-1/2 z-10"
          style={{ filter: 'drop-shadow(0 0 12px rgba(255,255,255,0.5))' }}>
          <motion.div
            drag="x"
            dragConstraints={{ left: 0, right: maxDrag.current }}
            dragElastic={0.1}
            dragMomentum={false}
            onDragEnd={handleDragEnd}
            style={{ x }}
            className="w-12 h-12 bg-white rounded-full flex items-center justify-center cursor-grab active:cursor-grabbing"
            transition={{ type: 'spring', stiffness: 300, damping: 20, mass: 1 }}
          >
            <div className="w-4 h-4 rounded-full" style={{ background: 'rgb(99,102,241)' }} />
          </motion.div>
        </div>
      </div>

      <button type="button" onClick={onCancel}
        className="shrink-0 rounded-full bg-gray-200 dark:bg-gray-700 w-10 h-10 flex items-center justify-center text-sm text-gray-500">
        ✕
      </button>
    </div>
  );
}
