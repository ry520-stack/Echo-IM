import { createContext, useContext, useState, useRef, useEffect, useCallback, type ReactNode } from 'react';
import { useSocket } from './SocketContext';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';
import CallScreen from '../components/CallScreen';
import { type CallStatus } from '../hooks/useWebRTC';
import { getCallReadinessError, getRtcConfig } from '../utils/rtcConfig';
import { assetUrl } from '../utils/assetUrl';
import { createNativeMessage } from '../utils/nativePush';
import { Mic, MicOff, PhoneOff } from 'lucide-react';

interface CallContextValue {
  callStatus: CallStatus;
  startCall: (targetId: string) => void;
}

const CallContext = createContext<CallContextValue>({
  callStatus: 'idle',
  startCall: () => {},
});

const CALL_TIMEOUT = 30000;

function formatCallDuration(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function CallProvider({ children }: { children: ReactNode }) {
  const { socket } = useSocket();
  const { user } = useAuth();
  const toast = useToast();

  const [callStatus, setCallStatus] = useState<CallStatus>('idle');
  const [isMuted, setIsMuted] = useState(false);
  const [peerId, setPeerId] = useState('');
  const [callerName, setCallerName] = useState('');
  const [callerAvatar, setCallerAvatar] = useState('');
  const [isCallMinimized, setIsCallMinimized] = useState(false);

  const callStatusRef = useRef(callStatus);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const pendingCandidatesRef = useRef<RTCIceCandidate[]>([]);
  const callTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ringtoneRef = useRef<HTMLAudioElement | null>(null);
  const ringTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const connectedAtRef = useRef<number | null>(null);
  const loggedCallRef = useRef(false);

  useEffect(() => { callStatusRef.current = callStatus; }, [callStatus]);

  const stopRinging = useCallback(() => {
    if (ringTimerRef.current) {
      clearInterval(ringTimerRef.current);
      ringTimerRef.current = null;
    }
    if (ringtoneRef.current) {
      ringtoneRef.current.pause();
      ringtoneRef.current.currentTime = 0;
      ringtoneRef.current = null;
    }
  }, []);

  const playDefaultRing = useCallback(() => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      if (!audioCtxRef.current) audioCtxRef.current = new AudioContextClass();
      if (audioCtxRef.current.state === 'suspended') audioCtxRef.current.resume();
      const ctx = audioCtxRef.current;
      const playTone = () => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.setValueAtTime(660, ctx.currentTime);
        osc.frequency.setValueAtTime(880, ctx.currentTime + 0.22);
        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + 0.03);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.55);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.58);
        osc.onended = () => { osc.disconnect(); gain.disconnect(); };
      };
      playTone();
      ringTimerRef.current = setInterval(playTone, 1200);
    } catch { /* autoplay may be blocked */ }
  }, []);

  const startRinging = useCallback((name: string, targetId: string, ringtoneUrl?: string) => {
    stopRinging();
    createNativeMessage(name || '\u6765\u7535', '\u9080\u8bf7\u4f60\u8bed\u97f3\u901a\u8bdd', { chatId: targetId });
    if (document.visibilityState === 'hidden' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        const notification = new Notification(name || '\u6765\u7535', {
          body: '\u9080\u8bf7\u4f60\u8bed\u97f3\u901a\u8bdd',
          icon: './favicon.svg',
          tag: `call-${targetId}`,
          data: { url: `#/chat/${targetId}` },
        });
        notification.onclick = () => {
          window.focus();
          window.location.hash = `#/chat/${targetId}`;
          notification.close();
        };
      } catch { /* ignore */ }
    }

    const customUrl = ringtoneUrl || user?.callRingtoneUrl || localStorage.getItem('echo-call-ringtone-url') || '';
    if (customUrl) {
      try {
        const audio = new Audio(assetUrl(customUrl));
        audio.loop = true;
        audio.volume = 0.9;
        ringtoneRef.current = audio;
        audio.play().catch(() => playDefaultRing());
        return;
      } catch { /* fallback */ }
    }
    playDefaultRing();
  }, [playDefaultRing, stopRinging, user?.callRingtoneUrl]);

  const cleanup = useCallback(() => {
    stopRinging();
    if (callTimeoutRef.current) { clearTimeout(callTimeoutRef.current); callTimeoutRef.current = null; }
    if (peerConnectionRef.current) { peerConnectionRef.current.close(); peerConnectionRef.current = null; }
    if (localStreamRef.current) { localStreamRef.current.getTracks().forEach(t => t.stop()); localStreamRef.current = null; }
    if (audioRef.current) { audioRef.current.srcObject = null; }
    pendingCandidatesRef.current = [];
    connectedAtRef.current = null;
    loggedCallRef.current = false;
    setCallStatus('idle');
    setIsMuted(false);
    setPeerId('');
    setCallerName('');
    setCallerAvatar('');
    setIsCallMinimized(false);
  }, []);

  useEffect(() => () => cleanup(), [cleanup]);

  const createPeerConnection = useCallback((targetId: string) => {
    if (peerConnectionRef.current) return peerConnectionRef.current;
    const pc = new RTCPeerConnection(getRtcConfig());

    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit('webrtc:signal', { targetId, signal: { candidate: event.candidate } });
      }
    };

    pc.ontrack = (event) => {
      if (event.streams?.[0]) {
        if (audioRef.current) audioRef.current.srcObject = event.streams[0];
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected') {
        toast('通话连接中断', 'error');
        cleanup();
      }
    };

    pc.onicecandidateerror = () => {
      console.warn('[Echo call] ICE candidate error. Check TURN/STUN configuration.');
    };

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => pc.addTrack(track, localStreamRef.current!));
    }

    peerConnectionRef.current = pc;
    return pc;
  }, [socket, toast, cleanup]);

  const drainPendingCandidates = useCallback(async (pc: RTCPeerConnection) => {
    for (const candidate of pendingCandidatesRef.current) {
      try { await pc.addIceCandidate(candidate); } catch { /* ignore */ }
    }
    pendingCandidatesRef.current = [];
  }, []);

  const markConnected = useCallback(() => {
    stopRinging();
    connectedAtRef.current = Date.now();
    loggedCallRef.current = false;
    setCallStatus('connected');
  }, [stopRinging]);

  const emitCallRecord = useCallback((targetId: string) => {
    if (!socket || !targetId || !connectedAtRef.current || loggedCallRef.current) return;
    const seconds = Math.max(1, Math.round((Date.now() - connectedAtRef.current) / 1000));
    loggedCallRef.current = true;
    socket.emit('message:send', {
      receiverId: targetId,
      type: 'call',
      content: `语音通话 ${formatCallDuration(seconds)}`,
    });
  }, [socket]);

  // Outgoing call
  const startCall = useCallback(async (targetId: string) => {
    const readinessError = getCallReadinessError();
    if (readinessError) {
      toast(readinessError, 'error');
      return;
    }

    if (!socket?.connected) {
      toast('连接已断开，请稍后再试', 'error');
      return;
    }
    if (!targetId) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;
      setPeerId(targetId);
      setCallerName('');
      setCallerAvatar('');
      setIsCallMinimized(false);
      setCallStatus('calling');

      socket.emit('call:request', {
        receiverId: targetId,
        callerName: user?.nickname || user?.username || '\u672a\u77e5',
        callerAvatar: user?.avatar || '',
      }, (res: any) => {
        if (!res?.ok) {
          toast(res?.message || '\u547c\u53eb\u5931\u8d25', 'error');
          cleanup();
          return;
        }
        const waitingUrl = user?.callRingtoneMode === 'mine'
          ? user?.callRingtoneUrl
          : (res?.receiverRingtoneUrl || user?.callRingtoneUrl);
        startRinging('\u7b49\u5f85\u63a5\u542c', targetId, waitingUrl);
      });

      callTimeoutRef.current = setTimeout(() => {
        if (callStatusRef.current === 'calling') {
          toast('对方未接听', 'error');
          socket?.emit('call:hangup', { targetId });
          cleanup();
        }
      }, CALL_TIMEOUT);
    } catch {
      toast('麦克风权限被拒绝，请检查设置', 'error');
      setCallStatus('idle');
    }
  }, [socket, user, toast, cleanup, startRinging]);

  const acceptCall = useCallback(async () => {
    const readinessError = getCallReadinessError();
    if (readinessError) {
      toast(readinessError, 'error');
      socket?.emit('call:reject', { targetId: peerId });
      cleanup();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;
      markConnected();
      socket?.emit('call:accept', { targetId: peerId });
      createPeerConnection(peerId);
    } catch {
      toast('麦克风权限被拒绝', 'error');
      socket?.emit('call:reject', { targetId: peerId });
      cleanup();
    }
  }, [socket, peerId, toast, createPeerConnection, cleanup, markConnected]);

  const rejectCall = useCallback(() => {
    socket?.emit('call:reject', { targetId: peerId });
    cleanup();
  }, [socket, peerId, cleanup]);

  const hangupCall = useCallback(() => {
    emitCallRecord(peerId);
    socket?.emit('call:hangup', { targetId: peerId });
    cleanup();
  }, [socket, peerId, cleanup, emitCallRecord]);

  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  }, []);

  // Global socket listeners
  useEffect(() => {
    if (!socket) return;

    const onInvite = (data: { senderId: string; callerName: string; callerAvatar: string; receiverRingtoneUrl?: string; callerRingtoneUrl?: string }) => {
      if (callStatusRef.current !== 'idle') return; // busy
      setPeerId(data.senderId);
      setCallerName(data.callerName || '\u672a\u77e5');
      setCallerAvatar(data.callerAvatar || '');
      setIsCallMinimized(false);
      setCallStatus('receiving');
      startRinging(data.callerName || '\u6765\u7535', data.senderId, data.receiverRingtoneUrl || user?.callRingtoneUrl);
    };

    const onAccepted = async () => {
      if (callTimeoutRef.current) { clearTimeout(callTimeoutRef.current); callTimeoutRef.current = null; }
      markConnected();
      const pc = createPeerConnection(peerId);
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit('webrtc:signal', { targetId: peerId, signal: { sdp: offer } });
      } catch {
        toast('通话建立失败', 'error');
      }
    };

    const onRejected = () => { toast('对方已拒绝', 'info'); cleanup(); };
    const onHangedup = () => { cleanup(); };

    const onSignal = async (data: { senderId: string; signal: any }) => {
      if (data.senderId !== peerId) return;
      const pc = peerConnectionRef.current || createPeerConnection(peerId);

      try {
        if (data.signal.sdp) {
          await pc.setRemoteDescription(new RTCSessionDescription(data.signal.sdp));
          await drainPendingCandidates(pc);
          if (pc.remoteDescription?.type === 'offer') {
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            socket.emit('webrtc:signal', { targetId: peerId, signal: { sdp: answer } });
          }
        } else if (data.signal.candidate) {
          const candidate = new RTCIceCandidate(data.signal.candidate);
          if (pc.remoteDescription) {
            await pc.addIceCandidate(candidate);
          } else {
            pendingCandidatesRef.current.push(candidate);
          }
        }
      } catch { /* ignore */ }
    };

    socket.on('call:invite', onInvite);
    socket.on('call:accepted', onAccepted);
    socket.on('call:rejected', onRejected);
    socket.on('call:hangedup', onHangedup);
    socket.on('webrtc:signal', onSignal);

    return () => {
      socket.off('call:invite', onInvite);
      socket.off('call:accepted', onAccepted);
      socket.off('call:rejected', onRejected);
      socket.off('call:hangedup', onHangedup);
      socket.off('webrtc:signal', onSignal);
    };
  }, [socket, peerId, createPeerConnection, cleanup, drainPendingCandidates, toast, markConnected, startRinging, user?.callRingtoneUrl]);

  return (
    <CallContext.Provider value={{ callStatus, startCall }}>
      {children}
      <audio ref={audioRef} autoPlay className="hidden" />
      {!isCallMinimized && (
        <CallScreen
          status={callStatus}
          peerName={callerName || (peerId ? '对方' : '')}
          peerAvatar={callerAvatar || undefined}
          isMuted={isMuted}
          onAccept={acceptCall}
          onReject={rejectCall}
          onHangup={hangupCall}
          onToggleMute={toggleMute}
          onMinimize={() => setIsCallMinimized(true)}
        />
      )}
      {isCallMinimized && callStatus !== 'idle' && (
        <div className="fixed left-1/2 top-[max(12px,env(safe-area-inset-top))] z-[110] flex w-[min(92vw,420px)] -translate-x-1/2 items-center gap-2 rounded-2xl border border-emerald-400/30 bg-zinc-900/95 px-3 py-2 text-white shadow-xl backdrop-blur-md">
          <button
            type="button"
            onClick={() => setIsCallMinimized(false)}
            className="flex min-w-0 flex-1 items-center gap-2 text-left"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-emerald-500/20 text-sm font-bold text-emerald-300">
              {callerAvatar ? <img src={assetUrl(callerAvatar)} alt="" className="h-full w-full object-cover" /> : (callerName || '对方')[0]?.toUpperCase()}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold">{callerName || '对方'}</span>
              <span className="block text-[11px] text-emerald-300">
                {callStatus === 'connected' ? '语音通话中 · 点击返回' : callStatus === 'receiving' ? '收到语音通话邀请 · 点击查看' : '正在呼叫 · 点击返回'}
              </span>
            </span>
          </button>
          {callStatus === 'connected' && (
            <button type="button" onClick={toggleMute} className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${isMuted ? 'bg-white text-zinc-900' : 'bg-white/10 text-white'}`}>
              {isMuted ? <MicOff size={16} /> : <Mic size={16} />}
            </button>
          )}
          <button type="button" onClick={callStatus === 'receiving' ? rejectCall : hangupCall} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-500 text-white">
            <PhoneOff size={16} />
          </button>
        </div>
      )}
    </CallContext.Provider>
  );
}

export function useCall() {
  return useContext(CallContext);
}
