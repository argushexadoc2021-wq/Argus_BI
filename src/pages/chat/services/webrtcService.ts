import { supabase } from '@/lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

// A relay (TURN) server is needed when the two people are on different networks that block direct connections (mobile data,
// office firewalls, many home routers). Set VITE_TURN_URLS (comma separated, e.g. "turn:relay.example.com:3478,turns:relay.example.com:443"),
// VITE_TURN_USERNAME and VITE_TURN_CREDENTIAL in the environment to use one.
const TURN_URLS = String(import.meta.env.VITE_TURN_URLS ?? '').split(',').map((u) => u.trim()).filter(Boolean);
export const HAS_TURN = TURN_URLS.length > 0;
const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
    { urls: 'stun:global.stun.twilio.com:3478' },
    ...(HAS_TURN
      ? [{ urls: TURN_URLS, username: String(import.meta.env.VITE_TURN_USERNAME ?? ''), credential: String(import.meta.env.VITE_TURN_CREDENTIAL ?? '') }]
      : []),
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
  private callerId?: string;
  private recipientId?: string;
  private channel: RealtimeChannel | null = null;
  private broadcastChannel: BroadcastChannel | null = null;
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private nativeAudioPlayer: HTMLAudioElement | null = null;
  private currentFacingMode: 'user' | 'environment' = 'user';
  private isCleanedUp = false;
  private isAccepted = false;
  private isChannelSubscribed = false;
  private pendingCandidates: RTCIceCandidateInit[] = [];
  private readyRetryTimer: number | null = null;
  private offerRetryTimer: number | null = null;
  private answerRetryTimer: number | null = null;
  private localSignalHandler: ((e: Event) => void) | null = null;

  constructor(
    callId: string,
    isCaller: boolean,
    callType: 'voice' | 'video',
    callbacks: WebRtcCallbacks,
    options?: { callerId?: string; recipientId?: string }
  ) {
    this.callId = callId;
    this.isCaller = isCaller;
    this.callType = callType;
    this.callbacks = callbacks;
    this.callerId = options?.callerId;
    this.recipientId = options?.recipientId;

    // Direct standalone HTMLAudioElement for guaranteed background audio output
    try {
      this.nativeAudioPlayer = new Audio();
      this.nativeAudioPlayer.autoplay = true;
      (this.nativeAudioPlayer as any).playsInline = true;
    } catch {}
  }

  /**
   * Generates a muted audio stream when microphone permission is denied or device is absent.
   * Allows the PeerConnection to negotiate and receive the colleague's audio/video regardless.
   */
  private createSilentAudioStream(): MediaStream {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const dst = osc.connect(ctx.createMediaStreamDestination());
        osc.start();
        const stream = (dst as any).stream as MediaStream;
        if (stream && stream.getAudioTracks().length > 0) {
          const track = stream.getAudioTracks()[0];
          track.enabled = false;
          return stream;
        }
      }
    } catch (e) {
      console.warn('[WebRTC] Silent audio fallback error:', e);
    }
    return new MediaStream();
  }

  /**
   * Waits briefly for local ICE candidates to gather into the SDP description (Vanilla ICE).
   */
  private async waitForIceGathering(maxWaitMs = 500): Promise<void> {
    if (!this.peerConnection) return;
    if (this.peerConnection.iceGatheringState === 'complete') return;

    await new Promise<void>((resolve) => {
      let timer: number | null = null;
      const checkState = () => {
        if (this.peerConnection?.iceGatheringState === 'complete') {
          if (timer) clearTimeout(timer);
          this.peerConnection?.removeEventListener('icegatheringstatechange', checkState);
          resolve();
        }
      };

      timer = window.setTimeout(() => {
        this.peerConnection?.removeEventListener('icegatheringstatechange', checkState);
        resolve();
      }, maxWaitMs);

      this.peerConnection?.addEventListener('icegatheringstatechange', checkState);
    });
  }

  /**
   * Initializes media tracks, sets up dual signaling channels (Supabase Realtime + local BroadcastChannel),
   * and negotiates peer connection.
   */
  async start() {
    this.isCleanedUp = false;
    this.isAccepted = false;
    this.isChannelSubscribed = false;
    this.pendingCandidates = [];

    console.log(`[WebRTC] Starting manager. Role: ${this.isCaller ? 'CALLER' : 'CALLEE'}, CallId: ${this.callId}`);

    // 1. Acquire local media (with progressive fallbacks)
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Media devices are not supported in this browser or context.');
      }

      const constraints: MediaStreamConstraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video:
          this.callType === 'video'
            ? { facingMode: this.currentFacingMode, width: { ideal: 1280 }, height: { ideal: 720 } }
            : false,
      };

      try {
        this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (err: any) {
        console.warn('[WebRTC] Initial constraints failed, trying basic audio-only:', err);
        try {
          this.localStream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: this.callType === 'video',
          });
        } catch {
          this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        }
      }

      this.callbacks.onLocalStream?.(this.localStream);
      console.log('[WebRTC] Local media acquired successfully. Tracks:', this.localStream.getTracks().map(t => `${t.kind}:${t.enabled}`));
    } catch (err2: any) {
      console.warn('[WebRTC] getUserMedia failed completely, continuing in receive-only mode:', err2);
      this.callbacks.onError?.(
        new Error(
          err2.name === 'NotAllowedError'
            ? 'Microphone / Camera access was denied. Please allow access in browser permissions.'
            : 'Could not access microphone or camera on this device.'
        )
      );
      this.localStream = this.createSilentAudioStream();
    }

    // 2. Set up PeerConnection
    this.peerConnection = new RTCPeerConnection(ICE_SERVERS);
    this.remoteStream = new MediaStream();

    // Add local tracks to peer connection
    let hasLocalTrack = false;
    if (this.localStream && this.localStream.getTracks().length > 0) {
      this.localStream.getTracks().forEach((track) => {
        if (this.peerConnection && this.localStream) {
          try {
            this.peerConnection.addTrack(track, this.localStream);
            hasLocalTrack = true;
            console.log('[WebRTC] Added local track to PeerConnection:', track.kind);
          } catch (e) {
            console.warn('[WebRTC] addTrack error:', e);
          }
        }
      });
    }

    // If no active local tracks, add receive-only transceivers so remote audio/video will stream
    if (!hasLocalTrack) {
      try {
        this.peerConnection.addTransceiver('audio', { direction: 'recvonly' });
        if (this.callType === 'video') {
          this.peerConnection.addTransceiver('video', { direction: 'recvonly' });
        }
        console.log('[WebRTC] Configured recvonly transceivers for receive-only operation');
      } catch (tcErr) {
        console.warn('[WebRTC] addTransceiver error:', tcErr);
      }
    }

    // Handle incoming remote tracks
    this.peerConnection.ontrack = (event) => {
      console.log('[WebRTC] Remote track received:', event.track.kind, 'ReadyState:', event.track.readyState);
      const stream = event.streams && event.streams[0] ? event.streams[0] : new MediaStream([event.track]);
      this.remoteStream = stream;

      // Direct native audio playback for immediate sound output
      if (this.nativeAudioPlayer && event.track.kind === 'audio') {
        try {
          this.nativeAudioPlayer.srcObject = stream;
          void this.nativeAudioPlayer.play().catch((err) => {
            console.warn('[WebRTC] Native audio autoplay caught:', err);
          });
        } catch (e) {
          console.warn('[WebRTC] Audio assignment error:', e);
        }
      }

      this.callbacks.onRemoteStream?.(stream);
    };

    // Monitor connection state
    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection?.connectionState;
      console.log('[WebRTC] Connection state changed:', state);
      if (state === 'connected') {
        this.isAccepted = true;
        this.stopAllRetries();
        this.callbacks.onCallAccepted?.();
      } else if (state === 'failed') {
        console.warn('[WebRTC] Connection failed');
        this.callbacks.onError?.(
          new Error(
            HAS_TURN
              ? 'The call could not connect. Check the internet connection on both sides and try again.'
              : 'The call could not connect: your two networks block a direct connection. A call relay server needs to be set up (ask your administrator).',
          ),
        );
      } else if (state === 'closed') {
        console.warn('[WebRTC] Connection closed');
      }
    };

    this.peerConnection.oniceconnectionstatechange = () => {
      console.log('[WebRTC] ICE connection state:', this.peerConnection?.iceConnectionState);
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
        console.warn('[WebRTC] BroadcastChannel initialization error:', bcErr);
      }
    }

    // 4. Connect Supabase Realtime signaling channel
    const channelName = `bi-call-${this.callId}`;
    this.channel = supabase.channel(channelName);

    this.channel
      .on('broadcast', { event: 'accept_call' }, (e) => void this.handleIncomingSignal('accept_call', e.payload))
      .on('broadcast', { event: 'ready_for_offer' }, (e) => void this.handleIncomingSignal('ready_for_offer', e.payload))
      .on('broadcast', { event: 'reject_call' }, (e) => void this.handleIncomingSignal('reject_call', e.payload))
      .on('broadcast', { event: 'end_call' }, (e) => void this.handleIncomingSignal('end_call', e.payload))
      .on('broadcast', { event: 'sdp_offer' }, (e) => void this.handleIncomingSignal('sdp_offer', e.payload))
      .on('broadcast', { event: 'sdp_answer' }, (e) => void this.handleIncomingSignal('sdp_answer', e.payload))
      .on('broadcast', { event: 'ice_candidate' }, (e) => void this.handleIncomingSignal('ice_candidate', e.payload))
      .subscribe((status) => {
        console.log(`[WebRTC] Channel ${channelName} status:`, status);
        if (status === 'SUBSCRIBED') {
          this.isChannelSubscribed = true;

          // If Callee: immediately inform Caller that we are ready to receive the SDP offer
          if (!this.isCaller) {
            this.sendReadySignalWithRetry();
          } else if (this.isAccepted) {
            // If Caller and already accepted, ensure offer is sent
            void this.createAndSendOffer();
          }
        }
      });

    // 5. Window event signaling listener (relayed from user_events)
    this.localSignalHandler = (e: Event) => {
      const d = (e as CustomEvent).detail;
      if (d && (d.payload?.callId === this.callId || d.callId === this.callId || !d.payload?.callId)) {
        void this.handleIncomingSignal(d.event || 'accept_call', d.payload || d);
      }
    };
    window.addEventListener('argus:chat-webrtc-signal', this.localSignalHandler);

    // Also trigger accept signal immediately via local BroadcastChannel for same-device cross-tab calls
    if (!this.isCaller) {
      this.sendSignal('accept_call', { callId: this.callId });
      this.sendSignal('ready_for_offer', { callId: this.callId });
    }
  }

  /**
   * Helper to send a signaling packet through Supabase Realtime, and BroadcastChannel.
   */
  private sendSignal(event: string, payload: any) {
    if (this.isCleanedUp) return;

    const fullPayload = { ...payload, callId: this.callId };

    // Supabase Realtime call broadcast
    if (this.channel) {
      void this.channel.send({
        type: 'broadcast',
        event,
        payload: fullPayload,
      });
    }

    // Native BroadcastChannel
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage({ event, payload: fullPayload });
      } catch {}
    }
  }

  /**
   * Allows external caller (e.g. CallOverlay reacting to user_events accept_call)
   * to mark accepted and initiate SDP offer.
   */
  getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  getRemoteStream(): MediaStream | null {
    return this.remoteStream;
  }

  handleRemoteAccepted() {
    if (this.isCleanedUp) return;
    this.isAccepted = true;
    this.callbacks.onCallAccepted?.();
    if (this.isCaller) {
      void this.createAndSendOffer();
    }
  }

  /**
   * Re-requests microphone/camera access if previously denied, and adds tracks dynamically to peerConnection.
   */
  async requestMediaAccess(): Promise<boolean> {
    try {
      const constraints: MediaStreamConstraints = {
        audio: true,
        video:
          this.callType === 'video'
            ? { facingMode: this.currentFacingMode, width: { ideal: 1280 }, height: { ideal: 720 } }
            : false,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.localStream = stream;
      this.callbacks.onLocalStream?.(stream);

      if (this.peerConnection) {
        const audioTrack = stream.getAudioTracks()[0];
        if (audioTrack) {
          const senders = this.peerConnection.getSenders();
          const audioSender = senders.find((s) => s.track && s.track.kind === 'audio');
          if (audioSender) {
            await audioSender.replaceTrack(audioTrack);
          } else {
            this.peerConnection.addTrack(audioTrack, stream);
          }
        }
        if (this.callType === 'video') {
          const videoTrack = stream.getVideoTracks()[0];
          if (videoTrack) {
            const senders = this.peerConnection.getSenders();
            const videoSender = senders.find((s) => s.track && s.track.kind === 'video');
            if (videoSender) {
              await videoSender.replaceTrack(videoTrack);
            } else {
              this.peerConnection.addTrack(videoTrack, stream);
            }
          }
        }
      }
      return true;
    } catch (err: any) {
      console.warn('[WebRTC] Retry getUserMedia failed:', err);
      return false;
    }
  }

  /**
   * Dispatches and processes all incoming signals safely.
   */
  private async handleIncomingSignal(event: string, payload: any) {
    if (this.isCleanedUp) return;

    switch (event) {
      case 'accept_call':
      case 'ready_for_offer': {
        if (this.isCaller) {
          console.log(`[WebRTC] Caller received ${event} from Callee!`);
          this.isAccepted = true;
          this.callbacks.onCallAccepted?.();
          await this.createAndSendOffer();
        }
        break;
      }

      case 'reject_call': {
        console.log('[WebRTC] Call rejected by remote peer');
        this.callbacks.onCallRejected?.();
        this.cleanup();
        break;
      }

      case 'end_call': {
        console.log('[WebRTC] Call ended by remote peer');
        this.callbacks.onCallEnded?.();
        this.cleanup();
        break;
      }

      case 'sdp_offer': {
        if (this.isCaller || !this.peerConnection || !payload?.sdp) return;
        try {
          console.log('[WebRTC] Callee received sdp_offer! Setting remote description...');
          if (this.readyRetryTimer) {
            clearInterval(this.readyRetryTimer);
            this.readyRetryTimer = null;
          }

          const desc = new RTCSessionDescription(payload.sdp);
          await this.peerConnection.setRemoteDescription(desc);
          await this.flushPendingCandidates();

          // Create answer with Vanilla ICE gathering
          const answer = await this.peerConnection.createAnswer();
          await this.peerConnection.setLocalDescription(answer);

          // Wait up to 400ms for ICE gathering
          await this.waitForIceGathering(400);

          const finalAnswer = this.peerConnection.localDescription || answer;
          console.log('[WebRTC] Callee sending sdp_answer...');
          this.sendSignal('sdp_answer', { sdp: finalAnswer });
          this.isAccepted = true;
          this.callbacks.onCallAccepted?.();

          // Repeat answer briefly until connected to overcome potential packet loss
          this.startAnswerRetry();
        } catch (e: any) {
          console.error('[WebRTC] Error handling sdp_offer:', e);
        }
        break;
      }

      case 'sdp_answer': {
        if (!this.isCaller || !this.peerConnection || !payload?.sdp) return;
        try {
          console.log('[WebRTC] Caller received sdp_answer! SignalingState:', this.peerConnection.signalingState);
          if (this.offerRetryTimer) {
            clearInterval(this.offerRetryTimer);
            this.offerRetryTimer = null;
          }

          if (this.peerConnection.signalingState === 'have-local-offer') {
            const desc = new RTCSessionDescription(payload.sdp);
            await this.peerConnection.setRemoteDescription(desc);
            await this.flushPendingCandidates();
            this.isAccepted = true;
            this.callbacks.onCallAccepted?.();
            console.log('[WebRTC] Caller successfully set remote description for answer!');
          }
        } catch (e: any) {
          console.error('[WebRTC] Error handling sdp_answer:', e);
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
          console.warn('[WebRTC] Error adding ICE candidate:', e);
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
          console.warn('[WebRTC] Error flushing candidate:', e);
        }
      }
    }
  }

  /**
   * Callee sends ready_for_offer signal with retries until SDP offer is received.
   */
  private sendReadySignalWithRetry() {
    if (this.readyRetryTimer) return;
    let count = 0;
    this.sendSignal('ready_for_offer', { callId: this.callId });
    this.sendSignal('accept_call', { callId: this.callId });

    this.readyRetryTimer = window.setInterval(() => {
      if (
        this.isCleanedUp ||
        (this.peerConnection && this.peerConnection.remoteDescription) ||
        count >= 10
      ) {
        if (this.readyRetryTimer) {
          clearInterval(this.readyRetryTimer);
          this.readyRetryTimer = null;
        }
        return;
      }
      this.sendSignal('ready_for_offer', { callId: this.callId });
      count++;
    }, 700);
  }

  /**
   * Creates and sends an SDP offer to the callee, with retry until answer is received.
   */
  private offerStarted = false;

  private async createAndSendOffer() {
    if (!this.peerConnection || this.isCleanedUp) return;
    // The offer is made only ONCE. "accept" / "ready" signals arrive several times (they are repeated on purpose); making a
    // second offer while the first is still being made, or after the call is connected, fails ("order of m-lines...").
    if (this.offerStarted) {
      if (this.peerConnection.signalingState === 'have-local-offer' && this.peerConnection.localDescription) {
        this.sendSignal('sdp_offer', { sdp: this.peerConnection.localDescription });
      }
      return;
    }
    this.offerStarted = true;
    try {

      console.log('[WebRTC] Creating SDP offer...');
      const offer = await this.peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: this.callType === 'video',
      });
      await this.peerConnection.setLocalDescription(offer);

      // Wait up to 400ms for ICE gathering
      await this.waitForIceGathering(400);

      const finalOffer = this.peerConnection.localDescription || offer;
      console.log('[WebRTC] Caller sending sdp_offer to Callee...');
      this.sendSignal('sdp_offer', { sdp: finalOffer });

      // Retry sending offer every 800ms until answer is received
      if (!this.offerRetryTimer) {
        let attempts = 0;
        this.offerRetryTimer = window.setInterval(() => {
          if (
            this.isCleanedUp ||
            !this.peerConnection ||
            this.peerConnection.remoteDescription ||
            this.peerConnection.connectionState === 'connected' ||
            attempts >= 8
          ) {
            if (this.offerRetryTimer) {
              clearInterval(this.offerRetryTimer);
              this.offerRetryTimer = null;
            }
            return;
          }
          const curOffer = this.peerConnection.localDescription || finalOffer;
          console.log(`[WebRTC] Retrying sdp_offer (attempt ${attempts + 1})...`);
          this.sendSignal('sdp_offer', { sdp: curOffer });
          attempts++;
        }, 800);
      }
    } catch (err: any) {
      console.error('[WebRTC] Error creating offer:', err);
      this.callbacks.onError?.(err);
    }
  }

  /**
   * Callee retries sending SDP answer until connected.
   */
  private startAnswerRetry() {
    if (this.answerRetryTimer || !this.peerConnection) return;
    let attempts = 0;
    this.answerRetryTimer = window.setInterval(() => {
      if (
        this.isCleanedUp ||
        !this.peerConnection ||
        this.peerConnection.connectionState === 'connected' ||
        attempts >= 6
      ) {
        if (this.answerRetryTimer) {
          clearInterval(this.answerRetryTimer);
          this.answerRetryTimer = null;
        }
        return;
      }
      if (this.peerConnection.localDescription) {
        this.sendSignal('sdp_answer', { sdp: this.peerConnection.localDescription });
      }
      attempts++;
    }, 900);
  }

  private stopAllRetries() {
    if (this.readyRetryTimer) {
      clearInterval(this.readyRetryTimer);
      this.readyRetryTimer = null;
    }
    if (this.offerRetryTimer) {
      clearInterval(this.offerRetryTimer);
      this.offerRetryTimer = null;
    }
    if (this.answerRetryTimer) {
      clearInterval(this.answerRetryTimer);
      this.answerRetryTimer = null;
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
    console.log('[WebRTC] toggleAudio ->', track.enabled);
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
      console.warn('[WebRTC] Could not switch camera:', e);
    }
    return false;
  }

  /**
   * Broadcasts reject and cleans up resources.
   */
  reject() {
    this.sendSignal('reject_call', { callId: this.callId });
    this.cleanup();
  }

  /**
   * Broadcasts end_call and cleans up resources.
   */
  end() {
    this.sendSignal('end_call', { callId: this.callId });
    this.cleanup();
  }

  cleanup() {
    if (this.isCleanedUp) return;
    this.isCleanedUp = true;
    console.log('[WebRTC] Cleaning up call manager...');

    this.stopAllRetries();

    if (this.localSignalHandler) {
      window.removeEventListener('argus:chat-webrtc-signal', this.localSignalHandler);
      this.localSignalHandler = null;
    }

    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }
    if (this.remoteStream) {
      this.remoteStream.getTracks().forEach((track) => track.stop());
      this.remoteStream = null;
    }
    if (this.nativeAudioPlayer) {
      try {
        this.nativeAudioPlayer.pause();
        this.nativeAudioPlayer.srcObject = null;
      } catch {}
      this.nativeAudioPlayer = null;
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
