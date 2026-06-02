import { useRef } from 'react';
import { assetUrl } from '../utils/assetUrl';

export default function GravityLockedCard({ name, avatar, chatStreak, onClick, onLongPress, isDark, isPinned }: {
  name: string; avatar?: string; chatStreak?: number; onClick: () => void; onLongPress: (targetNode?: HTMLElement) => void; isDark?: boolean; isPinned?: boolean;
}) {
  const isLongPressing = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startPos = useRef({ x: 0, y: 0 });
  const streak = chatStreak || 0;
  const stages = [
    { days: 90, label: '恒星共鸣', icon: '✹', color: 'text-fuchsia-300', glow: 'shadow-[0_0_30px_rgba(217,70,239,0.42)]' },
    { days: 75, label: '星环守望', icon: '✦', color: 'text-violet-300', glow: 'shadow-[0_0_26px_rgba(139,92,246,0.38)]' },
    { days: 60, label: '银河回声', icon: '✧', color: 'text-indigo-300', glow: 'shadow-[0_0_24px_rgba(99,102,241,0.34)]' },
    { days: 45, label: '流星轨迹', icon: '✶', color: 'text-sky-300', glow: 'shadow-[0_0_22px_rgba(14,165,233,0.32)]' },
    { days: 30, label: '炽热星火', icon: '🔥', color: 'text-orange-300', glow: 'shadow-[0_0_20px_rgba(249,115,22,0.30)]' },
    { days: 15, label: '闪耀火花', icon: '✷', color: 'text-amber-300', glow: 'shadow-[0_0_18px_rgba(245,158,11,0.28)]' },
    { days: 7, label: '升温火花', icon: '✦', color: 'text-yellow-300', glow: 'shadow-[0_0_15px_rgba(234,179,8,0.24)]' },
    { days: 3, label: '初遇火花', icon: '✨', color: 'text-amber-400', glow: 'shadow-[0_0_12px_rgba(251,191,36,0.22)]' },
  ];
  const stage = stages.find(item => streak >= item.days);

  return (
    <>
      <style>{`
        @keyframes blob-float {
          0% { transform: translate(0, 0) scale(1); }
          25% { transform: translate(60px, -20px) scale(1.3); }
          50% { transform: translate(-20px, 40px) scale(0.8); }
          75% { transform: translate(-50px, -30px) scale(1.2); }
          100% { transform: translate(0, 0) scale(1); }
        }
        @keyframes blob-float-2 {
          0% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(-40px, 30px) scale(1.4); }
          66% { transform: translate(50px, -10px) scale(0.7); }
          100% { transform: translate(0, 0) scale(1); }
        }
        .blob-1 { animation: blob-float 10s ease-in-out infinite; }
        .blob-2 { animation: blob-float-2 14s ease-in-out infinite; }
      `}</style>

      <div
        onClick={() => { if (!isLongPressing.current) onClick(); }}
        onTouchStart={(e) => {
          isLongPressing.current = false;
          startPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
          const targetNode = e.currentTarget;
          if (timerRef.current) clearTimeout(timerRef.current);
          timerRef.current = setTimeout(() => {
            isLongPressing.current = true;
            onLongPress(targetNode as HTMLElement);
          }, 500);
        }}
        onTouchMove={(e) => {
          const dx = Math.abs(e.touches[0].clientX - startPos.current.x);
          const dy = Math.abs(e.touches[0].clientY - startPos.current.y);
          if (dx > 10 || dy > 10) {
            if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
          }
        }}
        onTouchEnd={(e) => {
          if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
          if (isLongPressing.current) {
            e.preventDefault();
            e.stopPropagation();
          }
        }}
        onTouchCancel={() => {
          if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
        }}
        className={`relative flex items-center gap-4 p-4 rounded-2xl backdrop-blur-xl border shadow-[0_8px_32px_rgba(0,0,0,0.3)] cursor-pointer select-none overflow-hidden transition-colors ${
          isDark ? 'bg-white/8 border-white/10 active:bg-white/15' : 'bg-white/50 border-white/30 active:bg-white/70'
        } ${isPinned ? 'border-b-2 border-b-blue-400' : ''} ${stage?.glow || ''}`}
        style={{ WebkitTouchCallout: 'none', WebkitUserSelect: 'none', userSelect: 'none' }}
      >
        {/* Floating blobs */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-2xl">
          <div className="blob-1 absolute -bottom-4 -left-4 w-24 h-24 bg-purple-900/30 rounded-full filter blur-2xl" />
          <div className="blob-2 absolute -top-4 -right-4 w-20 h-20 bg-blue-900/30 rounded-full filter blur-2xl" />
        </div>

        {/* Avatar */}
        <div className={`relative z-10 w-11 h-11 rounded-full bg-gradient-to-tr from-indigo-500/50 to-purple-500/50 p-[1px] shrink-0 ${streak >= 30 ? 'animate-pulse' : ''}`}>
          <div className="w-full h-full rounded-full bg-amber-500 flex items-center justify-center text-base font-bold text-white overflow-hidden">
            {avatar ? <img src={assetUrl(avatar)} alt="" className="w-full h-full object-cover" /> : name[0]?.toUpperCase()}
          </div>
        </div>

        {/* Name */}
        <div className="relative z-10 flex-1 min-w-0">
          <p className={`text-sm font-medium tracking-wide truncate ${isDark ? 'text-white/80' : 'text-gray-800'}`}>{name}</p>
          <p className={`mt-1 text-[11px] ${stage?.color || 'text-gray-400'}`}>
            {stage ? `${stage.icon} ${stage.label} · 连续聊天 ${streak} 天` : streak > 0 ? `连续聊天 ${streak} 天 · 再聊 ${3 - streak} 天点亮火花` : '今天互相发消息，开始累积火花'}
          </p>
        </div>
      </div>
    </>
  );
}
