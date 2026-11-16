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
} from 'lucide-react';
import type { CallSession } from '../types';
import { WebRtcCallManager } from '../services/webrtcService';
import { playRingtone, stopRingtone, playEndCallTone } from '../services/soundService';

export function CallOverlay({
  call,
  currentUserId,
  onEndCall,
}: {
  call: CallSession;
  currentUserId: string;
  onEndCall: (durationSeconds: number, status: 'connected' | 'missed' | 'rejected') => void;
}) {
  const isIncoming = call.caller_id !== currentUserId && call.status === 'ringing';
  const isVideo = call.type === 'video';

  const [connected, setConnected] = useState(call.status === 'connected');
  const [micMuted, setMicMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [duration, setDuration] = useState(0);
  const [fullScreen, setFullScreen] = useState(false);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const managerRef = useRef<WebRtcCallManager | null>(null);
  const durationTimerRef = useRef<number | null>(null);

  // Play ringtone if incoming call
  useEffect(() => {
    if (isIncoming) {
      playRingtone();
    }
    return () => {
      stopRingtone();
    };
  }, [isIncoming]);

  // Duration timer when connected
  useEffect(() => {
    if (connected) {
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

  // Initialize WebRTC Call Manager
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
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = stream;
          }
        },
        onCallAccepted: () => {
          setConnected(true);
        },
        onCallRejected: () => {
          playEndCallTone();
          onEndCall(0, 'rejected');
        },
        onCallEnded: () => {
          playEndCallTone();
          onEndCall(duration, 'connected');
        },
        onError: (err) => {
          console.error('Call error:', err);
        },
      }
    );

    managerRef.current = manager;
    void manager.start();
  };

  const handleAccept = () => {
    stopRingtone();
    setConnected(true);
    initCall();
  };

  const handleDecline = () => {
    stopRingtone();
    managerRef.current?.reject();
    playEndCallTone();
    onEndCall(0, 'rejected');
  };

  const handleEnd = () => {
    stopRingtone();
    managerRef.current?.end();
    playEndCallTone();
    onEndCall(duration, connected ? 'connected' : 'missed');
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

  // INCOMING CALL MODAL
  if (isIncoming && !connected) {
    const initials = (call.caller_name || 'Colleague')
      .split(' ')
      .map((n) => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();

    return (
      <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-fade-in">
        <div className="bg-gradient-to-b from-navy-950 via-slate-900 to-slate-950 border border-slate-700/60 rounded-3xl p-6 max-w-sm w-full text-center shadow-2xl flex flex-col items-center">
          {/* Avatar with pulse ring */}
          <div className="relative my-4">
            <div className="absolute inset-0 rounded-full animate-ping bg-brand-500/30" />
            <div className="relative w-20 h-20 rounded-full bg-gradient-to-tr from-brand-600 to-orange-500 border-2 border-white/20 text-white flex items-center justify-center text-xl font-bold shadow-xl">
              {call.caller_avatar ? (
                <img src={call.caller_avatar} alt="" className="w-full h-full rounded-full object-cover" />
              ) : (
                initials
              )}
            </div>
          </div>

          <h3 className="text-lg font-bold text-white mb-1">{call.caller_name || 'Colleague'}</h3>
          <p className="text-xs text-orange-400 font-semibold mb-6 flex items-center gap-1.5 justify-center">
            {isVideo ? <Video size={14} /> : <Phone size={14} />}
            Incoming {isVideo ? 'Video' : 'Voice'} Call...
          </p>

          {/* Action buttons */}
          <div className="flex items-center justify-center gap-6 w-full pt-2">
            <button
              onClick={handleDecline}
              className="flex flex-col items-center gap-1 text-slate-300 hover:text-white transition-colors group"
            >
              <div className="w-14 h-14 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center shadow-lg shadow-red-600/30 transition-transform group-hover:scale-105 active:scale-95">
                <PhoneOff size={24} />
              </div>
              <span className="text-[11px] font-bold">Decline</span>
            </button>

            <button
              onClick={handleAccept}
              className="flex flex-col items-center gap-1 text-slate-300 hover:text-white transition-colors group"
            >
              <div className="w-14 h-14 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center shadow-lg shadow-emerald-600/30 transition-transform group-hover:scale-105 active:scale-95">
                {isVideo ? <Video size={24} /> : <Phone size={24} />}
              </div>
              <span className="text-[11px] font-bold">Accept</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ACTIVE CALL WINDOW / OVERLAY
  return (
    <div
      className={`fixed z-[110] transition-all duration-300 flex flex-col bg-slate-950 text-white overflow-hidden shadow-2xl border border-slate-800 ${
        fullScreen
          ? 'inset-0 rounded-none'
          : 'bottom-4 right-4 w-[92vw] sm:w-[480px] h-[360px] sm:h-[420px] rounded-2xl'
      }`}
    >
      {/* Top Header bar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900/90 border-b border-slate-800 z-10 shrink-0">
        <div className="flex items-center gap-2 truncate">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-bold truncate">
            {call.caller_name || 'Argus BI Meeting'}
          </span>
          <span className="text-[10px] text-slate-400 font-mono">
            {connected ? formatTimer(duration) : 'Connecting...'}
          </span>
        </div>
        <button
          onClick={() => setFullScreen(!fullScreen)}
          className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-white/10"
        >
          {fullScreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
        </button>
      </div>

      {/* Main Video / Audio Area */}
      <div className="relative flex-1 bg-black flex items-center justify-center overflow-hidden">
        {isVideo ? (
          <>
            {/* Remote video feed (Main) */}
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />

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
          <div className="flex flex-col items-center justify-center p-6 text-center">
            <div className="relative my-4">
              <div className="absolute inset-0 rounded-full animate-ping bg-brand-500/20" />
              <div className="relative w-24 h-24 rounded-full bg-gradient-to-tr from-brand-600 to-orange-500 text-white flex items-center justify-center text-2xl font-bold shadow-xl border-2 border-white/20">
                <Volume2 size={36} className="animate-pulse text-white" />
              </div>
            </div>
            <h4 className="text-base font-bold text-white mt-2">{call.caller_name || 'Colleague'}</h4>
            <p className="text-xs text-emerald-400 font-semibold mt-1">
              {connected ? `Voice Call · ${formatTimer(duration)}` : 'Calling...'}
            </p>
          </div>
        )}
      </div>

      {/* Bottom Controls Bar */}
      <div className="flex items-center justify-center gap-3 px-4 py-3 bg-slate-900 border-t border-slate-800 z-10 shrink-0">
        {/* Mic toggle */}
        <button
          onClick={toggleMic}
          className={`p-3 rounded-full transition-colors ${
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
            className={`p-3 rounded-full transition-colors ${
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
            className="p-3 rounded-full bg-slate-800 hover:bg-slate-700 text-white transition-colors"
            title="Switch camera"
          >
            <SwitchCamera size={18} />
          </button>
        )}

        {/* End Call button */}
        <button
          onClick={handleEnd}
          className="p-3 rounded-full bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-600/30 transition-colors ml-2"
          title="End Call"
        >
          <PhoneOff size={18} />
        </button>
      </div>
    </div>
  );
}
