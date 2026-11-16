import { supabase } from '@/lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
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
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private currentFacingMode: 'user' | 'environment' = 'user';
  private isCleanedUp = false;

  constructor(callId: string, isCaller: boolean, callType: 'voice' | 'video', callbacks: WebRtcCallbacks) {
    this.callId = callId;
    this.isCaller = isCaller;
    this.callType = callType;
    this.callbacks = callbacks;
  }

  /**
   * Initializes media tracks, sets up signaling channel, and initiates or listens for calls.
   */
  async start() {
    this.isCleanedUp = false;

    // 1. Acquire local media
    try {
      const constraints: MediaStreamConstraints = {
        audio: true,
        video: this.callType === 'video' ? { facingMode: this.currentFacingMode, width: { ideal: 1280 }, height: { ideal: 720 } } : false,
      };
      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
      this.callbacks.onLocalStream?.(this.localStream);
    } catch (err: any) {
      console.warn('getUserMedia error (trying audio only fallback):', err);
      try {
        this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        this.callbacks.onLocalStream?.(this.localStream);
      } catch (err2: any) {
        this.callbacks.onError?.(err2);
        return;
      }
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

    // Handle remote track
    this.peerConnection.ontrack = (event) => {
      event.streams[0]?.getTracks().forEach((track) => {
        if (!this.remoteStream?.getTracks().includes(track)) {
          this.remoteStream?.addTrack(track);
        }
      });
    };

    // Handle ICE candidates
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate && this.channel) {
        void this.channel.send({
          type: 'broadcast',
          event: 'ice_candidate',
          payload: { candidate: event.candidate.toJSON() },
        });
      }
    };

    // 3. Connect Supabase Realtime signaling channel
    const channelName = `bi-call-${this.callId}`;
    this.channel = supabase.channel(channelName);

    this.channel
      .on('broadcast', { event: 'accept_call' }, async () => {
        if (this.isCleanedUp) return;
        this.callbacks.onCallAccepted?.();
        if (this.isCaller) {
          await this.createAndSendOffer();
        }
      })
      .on('broadcast', { event: 'reject_call' }, () => {
        if (this.isCleanedUp) return;
        this.callbacks.onCallRejected?.();
        this.cleanup();
      })
      .on('broadcast', { event: 'end_call' }, () => {
        if (this.isCleanedUp) return;
        this.callbacks.onCallEnded?.();
        this.cleanup();
      })
      .on('broadcast', { event: 'sdp_offer' }, async ({ payload }) => {
        if (this.isCleanedUp || this.isCaller || !this.peerConnection) return;
        try {
          await this.peerConnection.setRemoteDescription(new RTCSessionDescription(payload.sdp));
          const answer = await this.peerConnection.createAnswer();
          await this.peerConnection.setLocalDescription(answer);
          void this.channel?.send({
            type: 'broadcast',
            event: 'sdp_answer',
            payload: { sdp: answer },
          });
        } catch (e: any) {
          console.error('Error handling sdp_offer:', e);
        }
      })
      .on('broadcast', { event: 'sdp_answer' }, async ({ payload }) => {
        if (this.isCleanedUp || !this.peerConnection) return;
        try {
          await this.peerConnection.setRemoteDescription(new RTCSessionDescription(payload.sdp));
        } catch (e: any) {
          console.error('Error handling sdp_answer:', e);
        }
      })
      .on('broadcast', { event: 'ice_candidate' }, async ({ payload }) => {
        if (this.isCleanedUp || !this.peerConnection || !payload.candidate) return;
        try {
          await this.peerConnection.addIceCandidate(new RTCIceCandidate(payload.candidate));
        } catch (e: any) {
          console.error('Error adding ICE candidate:', e);
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED' && !this.isCaller) {
          // Callee sends accept signal once channel is ready
          void this.channel?.send({
            type: 'broadcast',
            event: 'accept_call',
            payload: {},
          });
        }
      });
  }

  private async createAndSendOffer() {
    if (!this.peerConnection || !this.channel) return;
    try {
      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);
      void this.channel.send({
        type: 'broadcast',
        event: 'sdp_offer',
        payload: { sdp: offer },
      });
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
    void this.channel?.send({ type: 'broadcast', event: 'reject_call', payload: {} });
    this.cleanup();
  }

  /**
   * Broadcasts end_call and cleans up resources.
   */
  end() {
    void this.channel?.send({ type: 'broadcast', event: 'end_call', payload: {} });
    this.cleanup();
  }

  cleanup() {
    if (this.isCleanedUp) return;
    this.isCleanedUp = true;

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
  }
}
