import { useEffect, useRef, useState } from 'react';
import {
  Phone,
  PhoneOff,
  Video,
  VideoOff,
  Mic,
  MicOff,
  SwitchCamera,
  Maximize2,
  Minimize2,
  Volume2,
  AlertCircle,
  HelpCircle,
  CheckCircle2,
  X,
  Radio,
  FileText,
  RotateCw,
} from 'lucide-react';
import type { CallSession } from '../types';
import { WebRtcCallManager } from '../services/webrtcService';
import { chatService } from '../services/chatService';
import {
  playRingtone,
  stopRingtone,
  playRingbackTone,
  stopRingbackTone,
  playEndCallTone,
} from '../services/soundService';
import { CallRecorderService } from '../services/callRecorderService';
import { SpeechTranscriptionService, type TranscriptEntry } from '../services/speechTranscriptionService';

export function CallOverlay({
  call,
  currentUserId,
  currentUserName,
  onEndCall,
}: {
  call: CallSession;
  currentUserId: string;
  currentUserName?: string;
  onEndCall: (
    durationSeconds: number,
    status: 'connected' | 'missed' | 'rejected',
    auditData?: {
      recordingUrl?: string | null;
      recordingType?: string;
      transcriptText?: string;
      dialogue?: any[];
    }
  ) => void;
}) {
  const isIncoming = call.caller_id !== currentUserId && call.status === 'ringing';
  const isVideo = call.type === 'video';

  const [connected, setConnected] = useState(call.status === 'connected');
  const [micMuted, setMicMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [duration, setDuration] = useState(0);
  const [fullScreen, setFullScreen] = useState(false);
  const [callError, setCallError] = useState<string | null>(null);
  const [showPermissionGuide, setShowPermissionGuide] = useState(false);
  const [isRetryingMic, setIsRetryingMic] = useState(false);
  const [retrySuccessToast, setRetrySuccessToast] = useState(false);

  // Live subtitles and transcript
  const [latestSubtitle, setLatestSubtitle] = useState<string | null>(null);
  const [dialogueEntries, setDialogueEntries] = useState<TranscriptEntry[]>([]);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const managerRef = useRef<WebRtcCallManager | null>(null);
  const durationTimerRef = useRef<number | null>(null);
  const ringingTimeoutRef = useRef<number | null>(null);
  const durationRef = useRef(0);
  durationRef.current = duration;

  // Services refs
  const recorderRef = useRef<CallRecorderService | null>(null);
  const transcriptionRef = useRef<SpeechTranscriptionService | null>(null);

  // Determine peer details (the other participant)
  const peerName = isIncoming
    ? call.caller_name || 'Colleague'
    : call.recipient_name || 'Colleague';
  const peerAvatar = isIncoming ? call.caller_avatar : call.recipient_avatar;
  const initials = peerName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  // Handle Ringtones: Callee hears ringtone, Caller hears ringback tone
  useEffect(() => {
    if (isIncoming && !connected) {
      playRingtone();
    } else if (!isIncoming && !connected) {
      playRingbackTone();
    }

    // Auto timeout if call rings for 45 seconds without answer
    if (!connected) {
      ringingTimeoutRef.current = window.setTimeout(() => {
        void handleEnd();
      }, 45000);
    }

    return () => {
      stopRingtone();
      stopRingbackTone();
      if (ringingTimeoutRef.current !== null) {
        clearTimeout(ringingTimeoutRef.current);
      }
    };
  }, [isIncoming, connected]);

  // Redundant listener for call acceptance across direct user channels and Supabase Realtime
  useEffect(() => {
    const handleAcceptEv = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail && detail.callId === call.id) {
        stopRingbackTone();
        setConnected(true);
        managerRef.current?.handleRemoteAccepted();
      }
    };
    window.addEventListener('argus:chat-call-accepted', handleAcceptEv);
    return () => {
      window.removeEventListener('argus:chat-call-accepted', handleAcceptEv);
    };
  }, [call.id]);

  // Duration timer when connected
  useEffect(() => {
    if (connected) {
      stopRingtone();
      stopRingbackTone();
      if (ringingTimeoutRef.current !== null) {
        clearTimeout(ringingTimeoutRef.current);
      }

      durationTimerRef.current = window.setInterval(() => {
        setDuration((d) => d + 1);
      }, 1000);
    }
    return () => {
      if (durationTimerRef.current !== null) {
        clearInterval(durationTimerRef.current);
      }
    };
  }, [connected]);

  // Start Call Recorder and Speech Transcription when connected
  useEffect(() => {
    if (connected) {
      // 1. Initialize recording service
      try {
        const localSt = managerRef.current?.getLocalStream() || null;
        const remoteSt = managerRef.current?.getRemoteStream() || null;
        const recorder = new CallRecorderService(call.id, call.type, localSt, remoteSt);
        recorder.start();
        recorderRef.current = recorder;
      } catch (e) {
        console.warn('[CallOverlay] Could not initialize call recorder:', e);
      }

      // 2. Initialize speech transcription service
      try {
        const transcription = new SpeechTranscriptionService(
          call.id,
          currentUserId,
          currentUserName || 'User',
          peerName,
          () => durationRef.current,
          (entry) => {
            setLatestSubtitle(`${entry.speaker_name}: "${entry.text}"`);
            setDialogueEntries((prev) => [...prev, entry]);
          }
        );
        transcription.start();
        transcriptionRef.current = transcription;
      } catch (e) {
        console.warn('[CallOverlay] Could not initialize speech transcription:', e);
      }
    }

    return () => {
      // Cleanup services on unmount if still open
      if (recorderRef.current) {
        void recorderRef.current.stop();
        recorderRef.current = null;
      }
      if (transcriptionRef.current) {
        transcriptionRef.current.stop();
        transcriptionRef.current = null;
      }
    };
  }, [connected, call.id, call.type, currentUserId, currentUserName, peerName]);

  // Initialize WebRTC Call Manager immediately if caller, or on accept if callee
  useEffect(() => {
    if (!isIncoming) {
      initCall();
    }
    return () => {
      managerRef.current?.cleanup();
    };
  }, [call.id, isIncoming]);

  const initCall = () => {
    stopRingtone();
    const manager = new WebRtcCallManager(
      call.id,
      call.caller_id === currentUserId,
      call.type,
      {
        onLocalStream: (stream) => {
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = stream;
          }
        },
        onRemoteStream: (stream) => {
          console.log('[CallOverlay] Remote stream received with tracks:', stream.getTracks().map(t => `${t.kind}:${t.enabled}`));
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = stream;
            void remoteVideoRef.current.play().catch(() => {});
          }
          if (remoteAudioRef.current) {
            remoteAudioRef.current.srcObject = stream;
            remoteAudioRef.current.muted = false;
            remoteAudioRef.current.volume = 1.0;
            void remoteAudioRef.current.play().catch((err) => {
              console.warn('[CallOverlay] Audio play failed:', err);
            });
          }
        },
        onCallAccepted: () => {
          stopRingbackTone();
          setConnected(true);
        },
        onCallRejected: () => {
          stopRingbackTone();
          playEndCallTone();
          void finalizeAndEnd(0, 'rejected');
        },
        onCallEnded: () => {
          stopRingbackTone();
          playEndCallTone();
          void finalizeAndEnd(durationRef.current, 'connected');
        },
        onError: (err) => {
          console.error('WebRTC Call error:', err);
          const msg = err.message || 'Call connection error';
          setCallError(msg);
          // If permission denied, also auto-show helpful guidance
          if (msg.toLowerCase().includes('denied') || msg.toLowerCase().includes('access')) {
            setShowPermissionGuide(true);
          }
        },
      },
      {
        callerId: call.caller_id,
        recipientId: call.recipient_id,
      }
    );

    managerRef.current = manager;
    void manager.start();
  };

  const handleAccept = () => {
    stopRingtone();
    setConnected(true);
    void chatService.broadcastAcceptCall(
      call.caller_id,
      call.id,
      call.company_id,
      call.conversation_id
    );
    initCall();
  };

  const handleDecline = () => {
    stopRingtone();
    stopRingbackTone();
    managerRef.current?.reject();
    playEndCallTone();
    void finalizeAndEnd(0, 'rejected');
  };

  const handleEnd = () => {
    stopRingtone();
    stopRingbackTone();
    managerRef.current?.end();
    playEndCallTone();
    void finalizeAndEnd(duration, connected ? 'connected' : 'missed');
  };

  const finalizeAndEnd = async (
    durationSec: number,
    status: 'connected' | 'missed' | 'rejected'
  ) => {
    let recordingUrl: string | null = null;
    let recordingType = isVideo ? 'video/webm' : 'audio/webm';

    // 1. Finalize recording and upload to Supabase storage
    if (recorderRef.current) {
      try {
        const recResult = await recorderRef.current.stop();
        recordingUrl = recResult.recordingUrl;
        recordingType = recResult.mimeType || recordingType;
      } catch (err) {
        console.warn('[CallOverlay] Failed stopping recorder:', err);
      }
      recorderRef.current = null;
    }

    // 2. Finalize dialogue transcript
    let transcriptText = '';
    let dialogue: any[] = [];
    if (transcriptionRef.current) {
      try {
        transcriptText = transcriptionRef.current.getFullTranscript();
        dialogue = transcriptionRef.current.getDialogue();
        transcriptionRef.current.stop();
      } catch (err) {
        console.warn('[CallOverlay] Failed stopping transcription:', err);
      }
      transcriptionRef.current = null;
    }

    onEndCall(durationSec, status, {
      recordingUrl,
      recordingType,
      transcriptText,
      dialogue,
    });
  };

  const retryMediaAccess = async () => {
    setIsRetryingMic(true);
    try {
      const ok = await managerRef.current?.requestMediaAccess();
      if (ok) {
        setCallError(null);
        setShowPermissionGuide(false);
        setRetrySuccessToast(true);
        setTimeout(() => setRetrySuccessToast(false), 4000);
      } else {
        setShowPermissionGuide(true);
      }
    } catch {
      setShowPermissionGuide(true);
    } finally {
      setIsRetryingMic(false);
    }
  };

  const toggleMic = () => {
    if (managerRef.current) {
      const active = managerRef.current.toggleAudio();
      setMicMuted(!active);
    }
  };

  const toggleCamera = () => {
    if (managerRef.current) {
      const active = managerRef.current.toggleVideo();
      setCameraOff(!active);
    }
  };

  const switchCam = () => {
    void managerRef.current?.switchCamera();
  };

  const formatTimer = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec < 10 ? '0' : ''}${sec}`;
  };

  return (
    <>
      <audio
        ref={remoteAudioRef}
        autoPlay
        playsInline
        style={{ position: 'fixed', opacity: 0, pointerEvents: 'none', width: '1px', height: '1px', bottom: 0 }}
      />

      {isIncoming && !connected ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-fade-in select-none">
          <div className="bg-gradient-to-b from-navy-950 via-slate-900 to-slate-950 border border-slate-700/60 rounded-3xl p-6 max-w-sm w-full text-center shadow-2xl flex flex-col items-center">
            {/* Avatar with pulse ring */}
            <div className="relative my-4">
              <div className="absolute inset-0 rounded-full animate-ping bg-brand-500/30" />
              <div className="relative w-20 h-20 rounded-full bg-gradient-to-tr from-brand-600 to-orange-500 border-2 border-white/20 text-white flex items-center justify-center text-xl font-bold shadow-xl">
                {peerAvatar ? (
                  <img src={peerAvatar} alt="" className="w-full h-full rounded-full object-cover" />
                ) : (
                  initials
                )}
              </div>
            </div>

            <h3 className="text-lg font-bold text-white mb-1">{peerName}</h3>
            <p className="text-xs text-orange-400 font-semibold mb-6 flex items-center gap-1.5 justify-center">
              {isVideo ? <Video size={14} /> : <Phone size={14} />}
              Incoming {isVideo ? 'Video' : 'Voice'} Call...
            </p>

            {/* Action buttons */}
            <div className="flex items-center justify-center gap-8 w-full pt-2">
              <button
                onClick={handleDecline}
                className="flex flex-col items-center gap-1.5 text-slate-300 hover:text-white transition-colors group cursor-pointer"
              >
                <div className="w-14 h-14 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center shadow-lg shadow-red-600/30 transition-transform group-hover:scale-105 active:scale-95">
                  <PhoneOff size={24} />
                </div>
                <span className="text-[11px] font-bold">Decline</span>
              </button>

              <button
                onClick={handleAccept}
                className="flex flex-col items-center gap-1.5 text-slate-300 hover:text-white transition-colors group cursor-pointer"
              >
                <div className="w-14 h-14 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center shadow-lg shadow-emerald-600/30 transition-transform group-hover:scale-105 active:scale-95 animate-bounce">
                  {isVideo ? <Video size={24} /> : <Phone size={24} />}
                </div>
                <span className="text-[11px] font-bold">Accept</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* 2. ACTIVE CALL WINDOW / OVERLAY */
        <div
          className={`fixed z-[110] transition-all duration-300 flex flex-col bg-slate-950 text-white overflow-hidden shadow-2xl border border-slate-800 ${
            fullScreen
              ? 'inset-0 rounded-none'
              : 'bottom-4 right-4 w-[94vw] sm:w-[500px] h-[390px] sm:h-[440px] rounded-2xl'
          }`}
        >
          {/* Top Header bar */}
          <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900/95 border-b border-slate-800 z-10 shrink-0">
            <div className="flex items-center gap-2 truncate">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  connected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400 animate-ping'
                }`}
              />
              <span className="text-xs font-bold truncate">{peerName}</span>
              <span className="text-[10px] text-slate-400 font-mono">
                {connected ? formatTimer(duration) : 'Ringing...'}
              </span>

              {/* Live recording indicator badge */}
              {connected && (
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-red-500/20 border border-red-500/30 text-red-400 text-[10px] font-semibold animate-pulse ml-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                  <span>REC · Audit</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setFullScreen(!fullScreen)}
                title={fullScreen ? 'Exit Full Screen' : 'Full Screen'}
                className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer"
              >
                {fullScreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              </button>
            </div>
          </div>

          {/* Success toast after re-enabling mic */}
          {retrySuccessToast && (
            <div className="bg-emerald-600/95 text-white px-3 py-1.5 text-xs flex items-center gap-2 z-20 animate-fade-in shadow-md">
              <CheckCircle2 size={14} className="shrink-0 text-white" />
              <span className="font-semibold">Microphone connected successfully! Audio is now live.</span>
            </div>
          )}

          {/* Error notification if microphone/camera failed */}
          {callError && (
            <div className="bg-amber-950/95 border-b border-amber-500/40 px-3 py-2 flex items-center justify-between text-xs text-amber-200 z-20 shadow-md">
              <div className="flex items-center gap-2 truncate pr-2">
                <AlertCircle size={16} className="text-amber-400 shrink-0" />
                <div className="truncate flex flex-col">
                  <span className="font-semibold text-amber-300 truncate">{callError}</span>
                  <span className="text-[10px] text-amber-400/80 truncate">
                    Click "Allow Mic" or the 🔒 lock icon in the URL bar
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={retryMediaAccess}
                  disabled={isRetryingMic}
                  className="px-2.5 py-1 rounded bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white font-bold text-[11px] cursor-pointer transition-colors shadow flex items-center gap-1"
                >
                  <RotateCw size={11} className={isRetryingMic ? 'animate-spin' : ''} />
                  <span>Retry Mic</span>
                </button>
                <button
                  onClick={() => setShowPermissionGuide(true)}
                  className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-amber-300 text-[11px] cursor-pointer transition-colors flex items-center gap-1"
                  title="How to allow in browser"
                >
                  <HelpCircle size={11} />
                  <span>Guide</span>
                </button>
                <button
                  onClick={() => setCallError(null)}
                  className="text-slate-400 hover:text-white cursor-pointer px-1"
                  title="Dismiss"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          )}

          {/* Permission Helper Modal */}
          {showPermissionGuide && (
            <div className="absolute inset-0 z-30 bg-black/85 backdrop-blur-sm p-4 flex flex-col justify-center items-center text-center animate-fade-in">
              <div className="bg-slate-900 border border-orange-500/40 rounded-2xl p-5 max-w-sm w-full text-left shadow-2xl relative">
                <button
                  onClick={() => setShowPermissionGuide(false)}
                  className="absolute top-3 right-3 text-slate-400 hover:text-white p-1 rounded-full cursor-pointer"
                >
                  <X size={16} />
                </button>
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-2 rounded-xl bg-orange-500/20 text-orange-400">
                    <Mic size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Allow Microphone & Camera</h3>
                    <p className="text-[11px] text-slate-400">Your browser has blocked access</p>
                  </div>
                </div>

                <div className="space-y-2 text-xs text-slate-300 bg-slate-950/60 p-3 rounded-xl border border-slate-800 mb-4">
                  <div className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-orange-500 text-white text-[10px] font-bold flex items-center justify-center shrink-0">1</span>
                    <span>Look at the <strong>left side of the URL bar</strong> (next to <code>localhost</code> or your domain).</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-orange-500 text-white text-[10px] font-bold flex items-center justify-center shrink-0">2</span>
                    <span>Click the <strong>tune sliders (🎛️) or padlock (🔒)</strong> icon.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-orange-500 text-white text-[10px] font-bold flex items-center justify-center shrink-0">3</span>
                    <span>Set <strong>Microphone</strong> &amp; <strong>Camera</strong> from "Block" to <strong>"Allow"</strong>.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-orange-500 text-white text-[10px] font-bold flex items-center justify-center shrink-0">4</span>
                    <span>Click the orange button below to immediately re-enable your audio!</span>
                  </div>
                </div>

                <button
                  onClick={retryMediaAccess}
                  disabled={isRetryingMic}
                  className="w-full py-2.5 px-4 rounded-xl bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-orange-600/30 cursor-pointer"
                >
                  <RotateCw size={14} className={isRetryingMic ? 'animate-spin' : ''} />
                  <span>{isRetryingMic ? 'Connecting Microphone...' : 'I Allowed It — Re-test Microphone'}</span>
                </button>
              </div>
            </div>
          )}

          {/* Main Video / Audio Area */}
          <div className="relative flex-1 bg-black flex items-center justify-center overflow-hidden">
            {isVideo ? (
              <>
                {/* Remote video feed (Main) */}
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  className={`w-full h-full object-cover ${connected ? 'block' : 'hidden'}`}
                />

                {/* Waiting placeholder when ringing */}
                {!connected && (
                  <div className="flex flex-col items-center justify-center p-6 text-center">
                    <div className="relative my-3">
                      <div className="absolute inset-0 rounded-full animate-ping bg-brand-500/20" />
                      <div className="relative w-20 h-20 rounded-full bg-gradient-to-tr from-brand-600 to-orange-500 text-white flex items-center justify-center text-xl font-bold shadow-xl border-2 border-white/20">
                        {peerAvatar ? (
                          <img src={peerAvatar} alt="" className="w-full h-full rounded-full object-cover" />
                        ) : (
                          initials
                        )}
                      </div>
                    </div>
                    <h4 className="text-sm font-bold text-white">{peerName}</h4>
                    <p className="text-xs text-brand-400 font-semibold mt-1 animate-pulse">
                      Connecting video call...
                    </p>
                  </div>
                )}

                {/* Local Video Picture-in-Picture */}
                <div className="absolute top-3 right-3 w-28 sm:w-36 h-20 sm:h-28 rounded-xl overflow-hidden border-2 border-slate-700 bg-slate-900 shadow-xl z-20">
                  <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className={`w-full h-full object-cover ${cameraOff ? 'hidden' : 'block'}`}
                  />
                  {cameraOff && (
                    <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-slate-400 bg-slate-900">
                      Camera Off
                    </div>
                  )}
                  <span className="absolute bottom-1 left-1 bg-black/60 px-1 py-0.5 rounded text-[8px] font-bold text-white">
                    You
                  </span>
                </div>
              </>
            ) : (
              /* Voice Call Audio Display */
              <div className="flex flex-col items-center justify-center p-6 text-center select-none">
                <div className="relative my-4">
                  <div className="absolute inset-0 rounded-full animate-ping bg-brand-500/20" />
                  <div className="relative w-24 h-24 rounded-full bg-gradient-to-tr from-brand-600 to-orange-500 text-white flex items-center justify-center text-2xl font-bold shadow-xl border-2 border-white/20">
                    <Volume2 size={36} className="animate-pulse text-white" />
                  </div>
                </div>
                <h4 className="text-base font-bold text-white mt-2">{peerName}</h4>
                <p className="text-xs text-brand-400 font-semibold mt-1">
                  {connected ? `Voice Call · ${formatTimer(duration)}` : 'Calling colleague...'}
                </p>
              </div>
            )}

            {/* Live speech transcription subtitle overlay */}
            {connected && latestSubtitle && (
              <div className="absolute bottom-4 left-3 right-3 z-20 flex justify-center pointer-events-none">
                <div className="max-w-[92%] px-3.5 py-1.5 rounded-full bg-slate-950/85 backdrop-blur-md border border-orange-500/30 text-white text-xs text-center shadow-lg animate-fade-in truncate">
                  <span className="text-orange-400 font-bold mr-1.5">💬 Live:</span>
                  <span className="text-slate-100">{latestSubtitle}</span>
                </div>
              </div>
            )}
          </div>

          {/* Bottom Controls Bar */}
          <div className="flex items-center justify-center gap-3 px-4 py-3 bg-slate-900 border-t border-slate-800 z-10 shrink-0">
            {/* Mic toggle */}
            <button
              onClick={toggleMic}
              className={`p-3 rounded-full transition-colors cursor-pointer ${
                micMuted ? 'bg-red-600/80 text-white' : 'bg-slate-800 hover:bg-slate-700 text-white'
              }`}
              title={micMuted ? 'Unmute microphone' : 'Mute microphone'}
            >
              {micMuted ? <MicOff size={18} /> : <Mic size={18} />}
            </button>

            {/* Camera toggle (video only) */}
            {isVideo && (
              <button
                onClick={toggleCamera}
                className={`p-3 rounded-full transition-colors cursor-pointer ${
                  cameraOff ? 'bg-red-600/80 text-white' : 'bg-slate-800 hover:bg-slate-700 text-white'
                }`}
                title={cameraOff ? 'Turn camera on' : 'Turn camera off'}
              >
                {cameraOff ? <VideoOff size={18} /> : <Video size={18} />}
              </button>
            )}

            {/* Switch camera (video only) */}
            {isVideo && (
              <button
                onClick={switchCam}
                className="p-3 rounded-full bg-slate-800 hover:bg-slate-700 text-white transition-colors cursor-pointer"
                title="Switch camera"
              >
                <SwitchCamera size={18} />
              </button>
            )}

            {/* End Call button */}
            <button
              onClick={handleEnd}
              className="p-3 rounded-full bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-600/30 transition-colors ml-2 cursor-pointer"
              title="End Call"
            >
              <PhoneOff size={18} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
