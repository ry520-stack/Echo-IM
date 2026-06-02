import { motion } from 'framer-motion';
import { Phone, PhoneOff, MicOff, Mic, Minimize2 } from 'lucide-react';
import { type CallStatus } from '../hooks/useWebRTC';
import { assetUrl } from '../utils/assetUrl';

interface CallScreenProps {
  status: CallStatus;
  peerName: string;
  peerAvatar?: string;
  isMuted: boolean;
  onAccept: () => void;
  onReject: () => void;
  onHangup: () => void;
  onToggleMute: () => void;
  onMinimize: () => void;
}

export default function CallScreen({ status, peerName, peerAvatar, isMuted, onAccept, onReject, onHangup, onToggleMute, onMinimize }: CallScreenProps) {
  if (status === 'idle') return null;

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex flex-col items-center justify-between bg-zinc-950/95 text-white p-8 backdrop-blur-md"
    >
      <button
        type="button"
        onClick={onMinimize}
        className="absolute right-5 top-5 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
        aria-label="收起通话界面"
        title="收起通话界面"
      >
        <Minimize2 size={18} />
      </button>
      <div className="flex flex-col items-center mt-20 gap-4">
        <div className="w-24 h-24 rounded-3xl bg-primary-500/20 flex items-center justify-center text-3xl border border-white/10 shadow-2xl overflow-hidden">
          {peerAvatar ? <img src={assetUrl(peerAvatar)} alt="" className="w-full h-full object-cover" /> : peerName[0]?.toUpperCase()}
        </div>
        <h2 className="text-xl font-bold mt-2">{peerName}</h2>
        <p className="text-sm text-cyan-400 font-medium animate-pulse tracking-wider">
          {status === 'calling' && '正在呼叫对方...'}
          {status === 'receiving' && '收到语音通话邀请...'}
          {status === 'connected' && '通话已建立'}
        </p>
      </div>

      <div className="flex flex-col items-center gap-10 mb-16 w-full max-w-xs">
        <div className="flex justify-center items-center gap-8 w-full">
          {status === 'receiving' ? (
            <>
              <button onClick={onReject} className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center shadow-lg shadow-red-500/30 active:scale-95 transition-transform">
                <PhoneOff size={24} />
              </button>
              <button onClick={onAccept} className="w-16 h-16 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/30 active:scale-95 transition-transform animate-bounce">
                <Phone size={24} />
              </button>
            </>
          ) : (
            <>
              {status === 'connected' && (
                <button onClick={onToggleMute} className={`w-14 h-14 rounded-full flex items-center justify-center border transition-colors ${isMuted ? 'bg-white text-zinc-950 border-white' : 'bg-transparent border-white/20 hover:bg-white/10'}`}>
                  {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
                </button>
              )}
              <button onClick={onHangup} className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center shadow-lg shadow-red-500/30 active:scale-95 transition-transform">
                <PhoneOff size={24} />
              </button>
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
}
