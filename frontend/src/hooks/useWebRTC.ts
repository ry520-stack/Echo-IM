import { useState, useEffect, useRef, useCallback } from 'react';
import { useSocket } from '../contexts/SocketContext';

export type CallStatus = 'idle' | 'calling' | 'receiving' | 'connected';

interface CurrentUser {
  id: string;
  username: string;
  nickname?: string;
  avatar?: string;
}

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
};

const CALL_TIMEOUT = 30000; // 30秒呼叫超时

export function useWebRTC(
  peerId: string,
  currentUser: CurrentUser | null,
  onRemoteStream: (stream: MediaStream | null) => void,
  onError?: (msg: string) => void,
) {
  const { socket } = useSocket();
  const [callStatus, setCallStatus] = useState<CallStatus>('idle');
  const [isMuted, setIsMuted] = useState(false);

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const pendingCandidatesRef = useRef<RTCIceCandidate[]>([]);
  const callTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const callStatusRef = useRef<CallStatus>('idle');

  // 同步 ref 和 state
  useEffect(() => { callStatusRef.current = callStatus; }, [callStatus]);

  const cleanup = useCallback(() => {
    if (callTimeoutRef.current) { clearTimeout(callTimeoutRef.current); callTimeoutRef.current = null; }
    if (peerConnectionRef.current) { peerConnectionRef.current.close(); peerConnectionRef.current = null; }
    if (localStreamRef.current) { localStreamRef.current.getTracks().forEach(t => t.stop()); localStreamRef.current = null; }
    if (audioRef.current) { audioRef.current.srcObject = null; }
    pendingCandidatesRef.current = [];
    onRemoteStream(null);
    setCallStatus('idle');
    setIsMuted(false);
  }, [onRemoteStream]);

  useEffect(() => { return () => cleanup(); }, [cleanup]);

  const createPeerConnection = useCallback((targetId: string) => {
    if (peerConnectionRef.current) return peerConnectionRef.current;
    const pc = new RTCPeerConnection(RTC_CONFIG);

    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit('webrtc:signal', { targetId, signal: { candidate: event.candidate } });
      }
    };

    pc.ontrack = (event) => {
      if (event.streams?.[0]) {
        onRemoteStream(event.streams[0]);
        // 清理挂载到 audio 元素
        if (audioRef.current) audioRef.current.srcObject = event.streams[0];
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected') {
        onError?.('通话连接中断');
        cleanup();
      }
    };

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => pc.addTrack(track, localStreamRef.current!));
    }

    peerConnectionRef.current = pc;
    return pc;
  }, [socket, onRemoteStream, onError, cleanup]);

  // 处理排队的 ICE candidate
  const drainPendingCandidates = useCallback(async (pc: RTCPeerConnection) => {
    for (const candidate of pendingCandidatesRef.current) {
      try { await pc.addIceCandidate(candidate); } catch { /* ignore */ }
    }
    pendingCandidatesRef.current = [];
  }, []);

  const startCall = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;
      setCallStatus('calling');
      socket?.emit('call:request', {
        receiverId: peerId,
        callerName: currentUser?.nickname || currentUser?.username || '未知',
        callerAvatar: currentUser?.avatar || '',
      }, (res: any) => {
        if (!res?.ok) {
          onError?.(res?.message || res?.error || '无法发起通话');
          cleanup();
        }
      });
      // 30秒超时自动挂断（使用 ref 避免闭包捕获旧状态）
      callTimeoutRef.current = setTimeout(() => {
        if (callStatusRef.current === 'calling') {
          onError?.('对方未接听');
          socket?.emit('call:hangup', { targetId: peerId });
          cleanup();
        }
      }, CALL_TIMEOUT);
    } catch (err) {
      console.error('麦克风权限被拒绝', err);
      onError?.('麦克风权限被拒绝，请检查设置');
      setCallStatus('idle');
    }
  };

  const acceptCall = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;
      setCallStatus('connected');
      socket?.emit('call:accept', { targetId: peerId });
      // 接听方创建 PeerConnection
      createPeerConnection(peerId);
    } catch (err) {
      console.error('接听失败：麦克风被拒', err);
      onError?.('麦克风权限被拒绝');
      socket?.emit('call:reject', { targetId: peerId });
      setCallStatus('idle');
    }
  };

  const rejectCall = () => { socket?.emit('call:reject', { targetId: peerId }); cleanup(); };
  const hangupCall = () => { socket?.emit('call:hangup', { targetId: peerId }); cleanup(); };

  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  useEffect(() => {
    if (!socket) return;

    const onInvite = (data: { senderId: string }) => {
      if (data.senderId === peerId) setCallStatus('receiving');
    };

    const onAccepted = async () => {
      if (callTimeoutRef.current) { clearTimeout(callTimeoutRef.current); callTimeoutRef.current = null; }
      setCallStatus('connected');
      const pc = createPeerConnection(peerId);
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit('webrtc:signal', { targetId: peerId, signal: { sdp: offer } });
      } catch (err) {
        console.error('创建 Offer 失败', err);
        onError?.('通话建立失败');
      }
    };

    const onRejected = () => { cleanup(); };
    const onHangedup = () => { cleanup(); };

    const onSignal = async (data: { senderId: string; signal: any }) => {
      if (data.senderId !== peerId) return;
      const pc = peerConnectionRef.current || createPeerConnection(peerId);

      try {
        if (data.signal.sdp) {
          await pc.setRemoteDescription(new RTCSessionDescription(data.signal.sdp));
          // drain pending ICE candidates after remoteDescription set
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
            // remoteDescription 还没到，排队
            pendingCandidatesRef.current.push(candidate);
          }
        }
      } catch (err) {
        console.warn('WebRTC signal 协商冲突', err);
      }
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
  }, [socket, peerId, createPeerConnection, cleanup, drainPendingCandidates, onError]);

  return { callStatus, isMuted, startCall, acceptCall, rejectCall, hangupCall, toggleMute };
}
