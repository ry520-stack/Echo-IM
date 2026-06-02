import { useRef, useState, useCallback } from 'react';
import { is5Plus } from '../utils/env';

// 按优先级选择浏览器支持的 mimeType
function getPreferredMimeType(): string {
  const types = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/aac', 'audio/webm'];
  for (const t of types) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t)) return t;
  }
  return 'audio/webm'; // fallback
}

export function useAudioRecorder() {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const plusRecorderRef = useRef<any>(null);
  const plusRecordPathRef = useRef<string>('');

  const startRecord = useCallback(async () => {
    if (isRecording) return;

    if (!is5Plus() && !window.isSecureContext && location.hostname !== 'localhost') {
      throw new Error('录音需要 HTTPS');
    }

    if (is5Plus()) {
      const plus = (window as any).plus;
      const recorder = plus.audio.getRecorder();
      plusRecorderRef.current = recorder;
      plusRecordPathRef.current = '';
      recorder.record(
        { filename: '_doc/audio/', format: 'aac' },
        (path: string) => {
          // 录音成功回调，保存真实文件路径
          plusRecordPathRef.current = path;
        },
        (e: any) => {
          console.error('5+ 录音失败', e);
          setIsRecording(false);
        }
      );
      setIsRecording(true);
      return;
    }

    // Web: 标准 MediaRecorder
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mimeType = getPreferredMimeType();
    const mediaRecorder = new MediaRecorder(stream, { mimeType });
    mediaRecorderRef.current = mediaRecorder;
    chunksRef.current = [];

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    mediaRecorder.start(200);
    setIsRecording(true);
  }, [isRecording]);

  const waitPlusRecordPath = useCallback((): Promise<string> => {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      const waitPath = () => {
        if (Date.now() - startTime > 5000) {
          reject(new Error('录音文件生成失败'));
          return;
        }
        if (plusRecordPathRef.current) {
          resolve(plusRecordPathRef.current);
        } else {
          setTimeout(waitPath, 100);
        }
      };
      waitPath();
    });
  }, []);

  const stopRecordPath = useCallback((): Promise<string> => {
    if (!is5Plus()) return Promise.reject(new Error('当前环境不是 App'));
    return new Promise((resolve, reject) => {
      const recorder = plusRecorderRef.current;
      if (!recorder) return reject(new Error('未开始录音'));
      recorder.stop();
      setIsRecording(false);
      waitPlusRecordPath().then(resolve).catch(reject);
    });
  }, [waitPlusRecordPath]);

  const stopRecord = useCallback((): Promise<File> => {
    if (is5Plus()) {
      return new Promise((resolve, reject) => {
        const recorder = plusRecorderRef.current;
        if (!recorder) return reject(new Error('未开始录音'));
        recorder.stop();
        setIsRecording(false);

        waitPlusRecordPath().then((recordPath) => {
            // 读取真实文件
            const plus = (window as any).plus;
            plus.io.resolveLocalFileSystemURL(recordPath, (entry: any) => {
              entry.file((file: any) => {
                const reader = new FileReader();
                reader.onload = () => {
                  const blob = new Blob([reader.result as ArrayBuffer], { type: 'audio/aac' });
                  const f = new File([blob], `voice_${Date.now()}.aac`, { type: 'audio/aac' });
                  resolve(f);
                };
                reader.onerror = () => reject(new Error('读取录音文件失败'));
                reader.readAsArrayBuffer(file);
              });
            }, () => reject(new Error('录音文件不存在')));
        }).catch(reject);
      });
    }

    // Web: 标准 MediaRecorder
    return new Promise((resolve, reject) => {
      if (!mediaRecorderRef.current) {
        reject(new Error('未开始录音'));
        return;
      }

      mediaRecorderRef.current.onstop = () => {
        const mimeType = mediaRecorderRef.current?.mimeType || 'audio/webm';
        const ext = mimeType.includes('mp4') || mimeType.includes('aac') ? 'm4a' : 'webm';
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const file = new File([blob], `voice_${Date.now()}.${ext}`, { type: mimeType });
        mediaRecorderRef.current?.stream.getTracks().forEach(track => track.stop());
        setIsRecording(false);
        resolve(file);
      };

      mediaRecorderRef.current.stop();
    });
  }, [waitPlusRecordPath]);

  return { startRecord, stopRecord, stopRecordPath, isRecording };
}
