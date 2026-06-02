import { motion } from 'framer-motion';

interface Props {
  isDark: boolean;
  onToggle: () => void;
}

export default function GooeyToggle({ isDark, onToggle }: Props) {
  return (
    <div className="flex items-center justify-center" style={{ filter: 'url(#goo)' }}>
      {/* SVG Gooey Filter */}
      <svg className="hidden" aria-hidden="true">
        <defs>
          <filter id="goo">
            <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />
            <feColorMatrix
              in="blur"
              mode="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -9"
              result="goo"
            />
            <feBlend in="SourceGraphic" in2="goo" />
          </filter>
        </defs>
      </svg>

      {/* Track */}
      <div
        className={`relative w-28 h-12 rounded-full cursor-pointer transition-colors duration-500 backdrop-blur-md shadow-inner ${
          isDark
            ? 'bg-gray-800/60 border border-white/10'
            : 'bg-gray-200/60 border border-white/30'
        }`}
        onClick={onToggle}
      >
        {/* Background icons */}
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-base pointer-events-none select-none z-0">☀️</span>
        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-base pointer-events-none select-none z-0">🌙</span>

        {/* Draggable Knob */}
        <motion.div
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.15}
          onDragEnd={(_, info) => {
            const threshold = 20;
            if (info.offset.x > threshold && !isDark) onToggle();
            else if (info.offset.x < -threshold && isDark) onToggle();
          }}
          animate={{ x: isDark ? 64 : 4 }}
          transition={{ type: 'spring', stiffness: 80, damping: 15 }}
          className={`absolute top-1.5 w-9 h-9 rounded-full shadow-md flex items-center justify-center text-sm cursor-grab active:cursor-grabbing select-none z-10 ${
            isDark ? 'bg-gray-900' : 'bg-white'
          }`}
          whileTap={{ cursor: 'grabbing' }}
        >
          {isDark ? '🌙' : '☀️'}
        </motion.div>
      </div>
    </div>
  );
}
