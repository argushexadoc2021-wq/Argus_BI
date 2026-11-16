import { supabase } from '@/lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    { urls: 'stun:global.stun.twilio.com:3478' },
  ],
};

export interface WebRtcCallbacks {
  onLocalStream?: (stream: MediaStream) => void;
  onRemoteStream?: (stream: MediaStream) => void;
  onCallEnded?: () => void;
  onCallAccepted?: () => void;
  onCallRejected?: () => void;
  onError?: (err: Error) => void;
}

export class WebRtcCallManager {
  private callId: string;
  private isCaller: boolean;
  private callType: 'voice' | 'video';
  private callbacks: WebRtcCallbacks;
  private channel: RealtimeChannel | null = null;
  private broadcastChannel: BroadcastChannel | null = null;
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private currentFacingMode: 'user' | 'environment' = 'user';
  private isCleanedUp = false;
  private isAccepted = false;
  private pendingCandidates: RTCIceCandidateInit[] = [];
  private acceptRetryTimer: number | null = null;

  constructor(callId: string, isCaller: boolean, callType: 'voice' | 'video', callbacks: WebRtcCallbacks) {
    this.callId = callId;
    this.isCaller = isCaller;
    this.callType = callType;
    this.callbacks = callbacks;
  }

  /**
   * Initializes media tracks, sets up dual signaling channels (Supabase Realtime + local BroadcastChannel),
   * and negotiates peer connection.
   */
  async start() {
    this.isCleanedUp = false;
    this.isAccepted = false;
    this.pendingCandidates = [];

    // 1. Acquire local media (with graceful fallback to audio-only if camera is unavailable)
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Media devices are not supported in this browser or context.');
      }

      const constraints: MediaStreamConstraints = {
        audio: true,
        video:
          this.callType === 'video'
            ? { facingMode: this.currentFacingMode, width: { ideal: 1280 }, height: { ideal: 720 } }
            : false,
      };

      try {
        this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (err: any) {
        console.warn('Initial getUserMedia failed, attempting audio-only fallback:', err);
        this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      }

      this.callbacks.onLocalStream?.(this.localStream);
    } catch (err2: any) {
      console.error('getUserMedia failed completely:', err2);
      this.callbacks.onError?.(
        new Error(
          err2.name === 'NotAllowedError'
            ? 'Microphone / Camera access was denied. Please allow access in browser permissions.'
            : 'Could not access microphone or camera on this device.'
        )
      );
      return;
    }

    // 2. Set up PeerConnection
    this.peerConnection = new RTCPeerConnection(ICE_SERVERS);
    this.remoteStream = new MediaStream();
    this.callbacks.onRemoteStream?.(this.remoteStream);

    // Add local tracks to peer connection
    this.localStream.getTracks().forEach((track) => {
      if (this.peerConnection && this.localStream) {
        this.peerConnection.addTrack(track, this.localStream);
      }
    });

    // Handle incoming remote tracks
    this.peerConnection.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        event.streams[0].getTracks().forEach((track) => {
          if (!this.remoteStream?.getTracks().includes(track)) {
            this.remoteStream?.addTrack(track);
          }
        });
        this.callbacks.onRemoteStream?.(this.remoteStream);
      } else if (event.track) {
        if (!this.remoteStream?.getTracks().includes(event.track)) {
          this.remoteStream?.addTrack(event.track);
        }
        this.callbacks.onRemoteStream?.(this.remoteStream);
      }
    };

    // Monitor connection state
    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection?.connectionState;
      if (state === 'connected') {
        this.isAccepted = true;
        this.callbacks.onCallAccepted?.();
      }
    };

    // Handle ICE candidates generated locally
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendSignal('ice_candidate', { candidate: event.candidate.toJSON() });
      }
    };

    // 3. Connect Local BroadcastChannel (cross-tab signaling on same device)
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        this.broadcastChannel = new BroadcastChannel(`bi_call_${this.callId}`);
        this.broadcastChannel.onmessage = (msgEvent) => {
          const d = msgEvent.data;
          if (d && d.event) {
            void this.handleIncomingSignal(d.event, d.payload);
          }
        };
      } catch (bcErr) {
        console.warn('BroadcastChannel initialization error:', bcErr);
      }
    }

    // 4. Connect Supabase Realtime signaling channel (cross-device signaling over Internet)
    const channelName = `bi-call-${this.callId}`;
    this.channel = supabase.channel(channelName);

    this.channel
      .on('broadcast', { event: 'accept_call' }, (e) => void this.handleIncomingSignal('accept_call', e.payload))
      .on('broadcast', { event: 'reject_call' }, (e) => void this.handleIncomingSignal('reject_call', e.payload))
      .on('broadcast', { event: 'end_call' }, (e) => void this.handleIncomingSignal('end_call', e.payload))
      .on('broadcast', { event: 'sdp_offer' }, (e) => void this.handleIncomingSignal('sdp_offer', e.payload))
      .on('broadcast', { event: 'sdp_answer' }, (e) => void this.handleIncomingSignal('sdp_answer', e.payload))
      .on('broadcast', { event: 'ice_candidate' }, (e) => void this.handleIncomingSignal('ice_candidate', e.payload))
      .subscribe((status) => {
        if (status === 'SUBSCRIBED' && !this.isCaller) {
          // Callee sends accept signal once channel is ready, with retry until offer is received
          this.sendAcceptSignalWithRetry();
        }
      });

    // Also trigger accept signal immediately via local BroadcastChannel for same-device cross-tab calls
    if (!this.isCaller) {
      this.sendSignal('accept_call', {});
    }
  }

  /**
   * Helper to send a signaling packet through both Supabase Realtime and local BroadcastChannel.
   */
  private sendSignal(event: string, payload: any) {
    if (this.isCleanedUp) return;

    // Supabase Realtime broadcast
    if (this.channel) {
      void this.channel.send({
        type: 'broadcast',
        event,
        payload,
      });
    }

    // Native BroadcastChannel
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage({ event, payload });
      } catch {}
    }
  }

  /**
   * Dispatches and processes all incoming signals safely.
   */
  private async handleIncomingSignal(event: string, payload: any) {
    if (this.isCleanedUp) return;

    switch (event) {
      case 'accept_call': {
        if (this.isCaller && !this.isAccepted) {
          this.isAccepted = true;
          this.callbacks.onCallAccepted?.();
          await this.createAndSendOffer();
        }
        break;
      }

      case 'reject_call': {
        this.callbacks.onCallRejected?.();
        this.cleanup();
        break;
      }

      case 'end_call': {
        this.callbacks.onCallEnded?.();
        this.cleanup();
        break;
      }

      case 'sdp_offer': {
        if (this.isCaller || !this.peerConnection || !payload?.sdp) return;
        try {
          if (this.acceptRetryTimer) {
            clearInterval(this.acceptRetryTimer);
            this.acceptRetryTimer = null;
          }

          await this.peerConnection.setRemoteDescription(new RTCSessionDescription(payload.sdp));
          await this.flushPendingCandidates();

          const answer = await this.peerConnection.createAnswer();
          await this.peerConnection.setLocalDescription(answer);

          this.sendSignal('sdp_answer', { sdp: answer });
          this.isAccepted = true;
          this.callbacks.onCallAccepted?.();
        } catch (e: any) {
          console.error('Error handling sdp_offer:', e);
        }
        break;
      }

      case 'sdp_answer': {
        if (!this.isCaller || !this.peerConnection || !payload?.sdp) return;
        try {
          if (this.peerConnection.signalingState === 'have-local-offer') {
            await this.peerConnection.setRemoteDescription(new RTCSessionDescription(payload.sdp));
            await this.flushPendingCandidates();
            this.isAccepted = true;
            this.callbacks.onCallAccepted?.();
          }
        } catch (e: any) {
          console.error('Error handling sdp_answer:', e);
        }
        break;
      }

      case 'ice_candidate': {
        if (!this.peerConnection || !payload?.candidate) return;
        try {
          const cand = payload.candidate;
          if (!this.peerConnection.remoteDescription || !this.peerConnection.remoteDescription.type) {
            this.pendingCandidates.push(cand);
          } else {
            await this.peerConnection.addIceCandidate(new RTCIceCandidate(cand));
          }
        } catch (e: any) {
          console.error('Error adding ICE candidate:', e);
        }
        break;
      }
    }
  }

  /**
   * Flushes any ICE candidates received prior to remote description being set.
   */
  private async flushPendingCandidates() {
    if (!this.peerConnection || !this.peerConnection.remoteDescription) return;
    while (this.pendingCandidates.length > 0) {
      const cand = this.pendingCandidates.shift();
      if (cand) {
        try {
          await this.peerConnection.addIceCandidate(new RTCIceCandidate(cand));
        } catch (e) {
          console.warn('Error flushing candidate:', e);
        }
      }
    }
  }

  /**
   * Callee sends accept signal with retries to avoid packet loss.
   */
  private sendAcceptSignalWithRetry() {
    let count = 0;
    this.sendSignal('accept_call', {});

    this.acceptRetryTimer = window.setInterval(() => {
      if (
        this.isCleanedUp ||
        (this.peerConnection && this.peerConnection.remoteDescription) ||
        count >= 4
      ) {
        if (this.acceptRetryTimer) {
          clearInterval(this.acceptRetryTimer);
          this.acceptRetryTimer = null;
        }
        return;
      }
      this.sendSignal('accept_call', {});
      count++;
    }, 800);
  }

  /**
   * Creates and sends an SDP offer to the callee.
   */
  private async createAndSendOffer() {
    if (!this.peerConnection) return;
    try {
      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);
      this.sendSignal('sdp_offer', { sdp: offer });
    } catch (err: any) {
      console.error('Error creating offer:', err);
      this.callbacks.onError?.(err);
    }
  }

  /**
   * Toggles the audio track (mute/unmute). Returns true if audio is enabled.
   */
  toggleAudio(enabled?: boolean): boolean {
    if (!this.localStream) return false;
    const track = this.localStream.getAudioTracks()[0];
    if (!track) return false;
    track.enabled = enabled !== undefined ? enabled : !track.enabled;
    return track.enabled;
  }

  /**
   * Toggles the video track (camera on/off). Returns true if video is enabled.
   */
  toggleVideo(enabled?: boolean): boolean {
    if (!this.localStream) return false;
    const track = this.localStream.getVideoTracks()[0];
    if (!track) return false;
    track.enabled = enabled !== undefined ? enabled : !track.enabled;
    return track.enabled;
  }

  /**
   * Switches camera facing mode on supported mobile devices.
   */
  async switchCamera(): Promise<boolean> {
    if (!this.localStream || this.callType !== 'video') return false;
    const nextMode = this.currentFacingMode === 'user' ? 'environment' : 'user';
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: nextMode, width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      const newVideoTrack = newStream.getVideoTracks()[0];
      const oldVideoTrack = this.localStream.getVideoTracks()[0];

      if (this.peerConnection && oldVideoTrack) {
        const sender = this.peerConnection.getSenders().find((s) => s.track === oldVideoTrack);
        if (sender) {
          await sender.replaceTrack(newVideoTrack);
        }
        oldVideoTrack.stop();
        this.localStream.removeTrack(oldVideoTrack);
        this.localStream.addTrack(newVideoTrack);
        this.currentFacingMode = nextMode;
        this.callbacks.onLocalStream?.(this.localStream);
        return true;
      }
    } catch (e) {
      console.warn('Could not switch camera:', e);
    }
    return false;
  }

  /**
   * Broadcasts reject and cleans up resources.
   */
  reject() {
    this.sendSignal('reject_call', {});
    this.cleanup();
  }

  /**
   * Broadcasts end_call and cleans up resources.
   */
  end() {
    this.sendSignal('end_call', {});
    this.cleanup();
  }

  cleanup() {
    if (this.isCleanedUp) return;
    this.isCleanedUp = true;

    if (this.acceptRetryTimer) {
      clearInterval(this.acceptRetryTimer);
      this.acceptRetryTimer = null;
    }

    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }
    if (this.remoteStream) {
      this.remoteStream.getTracks().forEach((track) => track.stop());
      this.remoteStream = null;
    }
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
    if (this.channel) {
      void supabase.removeChannel(this.channel);
      this.channel = null;
    }
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.close();
      } catch {}
      this.broadcastChannel = null;
    }
  }
}
