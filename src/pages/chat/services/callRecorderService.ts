import { supabase } from '@/lib/supabase';

export interface CallRecordingResult {
  blob: Blob | null;
  recordingUrl: string | null;
  mimeType: string;
  durationSeconds: number;
}

export class CallRecorderService {
  private callId: string;
  private callType: 'voice' | 'video';
  private localStream: MediaStream | null;
  private remoteStream: MediaStream | null;
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private audioContext: AudioContext | null = null;
  private animFrameId: number | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private isRecording = false;
  private startTime = 0;

  constructor(
    callId: string,
    callType: 'voice' | 'video',
    localStream: MediaStream | null,
    remoteStream: MediaStream | null
  ) {
    this.callId = callId;
    this.callType = callType;
    this.localStream = localStream;
    this.remoteStream = remoteStream;
  }

  /**
   * Starts recording mixed audio and video (if video call).
   */
  start(): boolean {
    if (this.isRecording) return true;
    this.recordedChunks = [];
    this.startTime = Date.now();

    try {
      // 1. Mix Audio from both local and remote streams
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) {
        console.warn('[CallRecorder] AudioContext not available');
        return false;
      }

      this.audioContext = new AudioCtx();
      const destination = this.audioContext.createMediaStreamDestination();

      if (this.localStream && this.localStream.getAudioTracks().length > 0) {
        try {
          const localSource = this.audioContext.createMediaStreamSource(this.localStream);
          localSource.connect(destination);
        } catch (e) {
          console.warn('[CallRecorder] Could not connect local audio source:', e);
        }
      }

      if (this.remoteStream && this.remoteStream.getAudioTracks().length > 0) {
        try {
          const remoteSource = this.audioContext.createMediaStreamSource(this.remoteStream);
          remoteSource.connect(destination);
        } catch (e) {
          console.warn('[CallRecorder] Could not connect remote audio source:', e);
        }
      }

      let recordingStream: MediaStream;

      // 2. Handle Video or Voice Stream composition
      if (this.callType === 'video') {
        // Offscreen canvas compositing both local and remote feeds
        this.canvas = document.createElement('canvas');
        this.canvas.width = 1280;
        this.canvas.height = 720;
        const ctx = this.canvas.getContext('2d');

        // Hidden video elements to render streams to canvas
        const remoteVid = document.createElement('video');
        remoteVid.autoplay = true;
        remoteVid.muted = true;
        (remoteVid as any).playsInline = true;
        if (this.remoteStream) remoteVid.srcObject = this.remoteStream;
        void remoteVid.play().catch(() => {});

        const localVid = document.createElement('video');
        localVid.autoplay = true;
        localVid.muted = true;
        (localVid as any).playsInline = true;
        if (this.localStream) localVid.srcObject = this.localStream;
        void localVid.play().catch(() => {});

        const drawFrame = () => {
          if (!this.isRecording || !ctx || !this.canvas) return;

          // Background
          ctx.fillStyle = '#0f172a';
          ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

          // Draw remote video full screen
          if (remoteVid.readyState >= 2) {
            ctx.drawImage(remoteVid, 0, 0, this.canvas.width, this.canvas.height);
          } else {
            ctx.fillStyle = '#1e293b';
            ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            ctx.fillStyle = '#94a3b8';
            ctx.font = '24px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('Live Video Stream', this.canvas.width / 2, this.canvas.height / 2);
          }

          // Draw local video in PiP bottom-right box
          if (localVid.readyState >= 2) {
            const pipW = 280;
            const pipH = 180;
            const pipX = this.canvas.width - pipW - 24;
            const pipY = this.canvas.height - pipH - 24;

            ctx.save();
            ctx.strokeStyle = '#f97316';
            ctx.lineWidth = 3;
            ctx.strokeRect(pipX, pipY, pipW, pipH);
            ctx.drawImage(localVid, pipX, pipY, pipW, pipH);
            ctx.restore();
          }

          this.animFrameId = requestAnimationFrame(drawFrame);
        };

        this.animFrameId = requestAnimationFrame(drawFrame);

        const canvasStream = (this.canvas as any).captureStream ? (this.canvas as any).captureStream(25) : new MediaStream();
        recordingStream = new MediaStream([
          ...canvasStream.getVideoTracks(),
          ...destination.stream.getAudioTracks(),
        ]);
      } else {
        // Voice call: audio only
        recordingStream = destination.stream;
      }

      // 3. Find supported mime type
      const mimeTypes = this.callType === 'video'
        ? ['video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4']
        : ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg', 'audio/wav'];

      let chosenMime = '';
      for (const m of mimeTypes) {
        if (MediaRecorder.isTypeSupported(m)) {
          chosenMime = m;
          break;
        }
      }

      this.mediaRecorder = chosenMime
        ? new MediaRecorder(recordingStream, { mimeType: chosenMime })
        : new MediaRecorder(recordingStream);

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          this.recordedChunks.push(event.data);
        }
      };

      this.mediaRecorder.start(1000);
      this.isRecording = true;
      console.log(`[CallRecorder] Started recording ${this.callType} call (${chosenMime || 'default'})`);
      return true;
    } catch (err) {
      console.warn('[CallRecorder] Failed to start MediaRecorder:', err);
      return false;
    }
  }

  /**
   * Stops recording, uploads the resulting file to Supabase Storage, and returns the result.
   */
  async stop(): Promise<CallRecordingResult> {
    if (!this.isRecording && this.recordedChunks.length === 0) {
      return { blob: null, recordingUrl: null, mimeType: '', durationSeconds: 0 };
    }

    this.isRecording = false;
    const durationSeconds = Math.max(1, Math.round((Date.now() - this.startTime) / 1000));

    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }

    if (this.audioContext) {
      try {
        void this.audioContext.close();
      } catch {}
      this.audioContext = null;
    }

    return new Promise((resolve) => {
      const finalize = async () => {
        try {
          const mimeType = this.mediaRecorder?.mimeType || (this.callType === 'video' ? 'video/webm' : 'audio/webm');
          const blob = new Blob(this.recordedChunks, { type: mimeType });

          if (blob.size === 0) {
            console.warn('[CallRecorder] Recorded blob size is 0');
            resolve({ blob: null, recordingUrl: null, mimeType, durationSeconds });
            return;
          }

          console.log(`[CallRecorder] Recording finished. Size: ${(blob.size / 1024).toFixed(1)} KB, Type: ${mimeType}`);

          // Upload to Supabase Storage bucket 'call-recordings'
          const ext = this.callType === 'video' ? 'webm' : 'webm';
          const fileName = `${this.callId}_${Date.now()}.${ext}`;

          try {
            const { error: uploadErr } = await supabase.storage
              .from('call-recordings')
              .upload(fileName, blob, {
                contentType: mimeType,
                upsert: true,
              });

            if (!uploadErr) {
              const { data: pubData } = supabase.storage
                .from('call-recordings')
                .getPublicUrl(fileName);

              console.log('[CallRecorder] Uploaded to storage:', pubData?.publicUrl);
              resolve({
                blob,
                recordingUrl: pubData?.publicUrl || null,
                mimeType,
                durationSeconds,
              });
              return;
            } else {
              console.warn('[CallRecorder] Storage upload error:', uploadErr);
            }
          } catch (uploadException) {
            console.warn('[CallRecorder] Upload exception:', uploadException);
          }

          // Local fallback: create Object URL so recording can still be played in session
          const localUrl = URL.createObjectURL(blob);
          resolve({
            blob,
            recordingUrl: localUrl,
            mimeType,
            durationSeconds,
          });
        } catch (e) {
          console.error('[CallRecorder] Error finalizing recording:', e);
          resolve({ blob: null, recordingUrl: null, mimeType: '', durationSeconds });
        }
      };

      if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
        this.mediaRecorder.onstop = () => {
          void finalize();
        };
        try {
          this.mediaRecorder.stop();
        } catch {
          void finalize();
        }
      } else {
        void finalize();
      }
    });
  }
}
