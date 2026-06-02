import { useState, useRef, useEffect } from 'react';
import { Pause, Play } from 'lucide-react';
import { getPlus, is5Plus } from '../utils/env';

export default function VoiceBubble({ src }: { src: string }) {
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);
  const nativePlayerRef = useRef<any>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopTimer = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const stopPlayback = () => {
    stopTimer();
    audioRef.current?.pause();
    try { nativePlayerRef.current?.stop?.(); } catch { /* ignore */ }
    nativePlayerRef.current = null;
    setPlaying(false);
  };

  useEffect(() => {
    const handleGlobalPlay = (e: any) => {
      if (e.detail.src !== src && playing) stopPlayback();
    };
    window.addEventListener('voice-play', handleGlobalPlay);
    return () => window.removeEventListener('voice-play', handleGlobalPlay);
  }, [src, playing]);

  useEffect(() => () => stopPlayback(), []);

  const playNative = () => {
    const plus = getPlus();
    if (!plus?.audio?.createPlayer) return false;

    window.dispatchEvent(new CustomEvent('voice-play', { detail: { src } }));
    const player = plus.audio.createPlayer(src);
    nativePlayerRef.current = player;
    player.play(
      () => {
        stopTimer();
        nativePlayerRef.current = null;
        setPlaying(false);
        setCurrent(0);
      },
      () => {
        stopTimer();
        nativePlayerRef.current = null;
        setPlaying(false);
      }
    );

    setPlaying(true);
    intervalRef.current = setInterval(() => {
      try {
        const d = Number(player.getDuration?.() || 0);
        const p = Number(player.getPosition?.() || 0);
        if (d > 0) setDuration(d);
        if (p >= 0) setCurrent(p);
      } catch { /* ignore */ }
    }, 200);
    return true;
  };

  const toggle = () => {
    if (playing) {
      stopPlayback();
      return;
    }

    if (is5Plus() && playNative()) return;

    const audio = audioRef.current;
    if (!audio) return;
    window.dispatchEvent(new CustomEvent('voice-play', { detail: { src } }));
    audio.play()
      .then(() => {
        setPlaying(true);
        intervalRef.current = setInterval(() => setCurrent(audio.currentTime), 100);
      })
      .catch(() => {
        stopTimer();
        setPlaying(false);
      });
  };

  const onEnded = () => {
    stopTimer();
    setPlaying(false);
    setCurrent(0);
  };

  const fmt = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex min-w-[76px] cursor-pointer items-center gap-1.5" onClick={toggle}>
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onLoadedMetadata={() => {
          const audio = audioRef.current;
          if (!audio) return;
          if (audio.duration === Infinity || Number.isNaN(audio.duration)) {
            audio.currentTime = 1e101;
            const handleTimeUpdate = () => {
              audio.removeEventListener('timeupdate', handleTimeUpdate);
              audio.currentTime = 0;
              setDuration(audio.duration);
            };
            audio.addEventListener('timeupdate', handleTimeUpdate);
          } else {
            setDuration(audio.duration);
          }
        }}
        onEnded={onEnded}
        className="hidden"
      />
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-current/10">
        {playing ? <Pause size={10} fill="currentColor" /> : <Play size={10} fill="currentColor" />}
      </span>
      <span className="text-xs font-mono">
        {duration > 0 ? fmt(playing ? current : duration) : '语音'}
      </span>
      {playing && (
        <span className="flex h-4 items-end gap-0.5">
          {[0, 1, 2].map(i => (
            <span key={i} className="w-0.5 animate-pulse rounded-full bg-current" style={{ height: `${8 + i * 4}px`, animationDelay: `${i * 0.15}s` }} />
          ))}
        </span>
      )}
    </div>
  );
}
