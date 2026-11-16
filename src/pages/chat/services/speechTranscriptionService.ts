export interface TranscriptEntry {
  id: string;
  speaker_id: string;
  speaker_name: string;
  text: string;
  time_offset: string;
  timestamp: string;
}

export class SpeechTranscriptionService {
  private callId: string;
  private currentUserId: string;
  private currentUserName: string;
  private peerUserName: string;
  private recognition: any = null;
  private isRunning = false;
  private dialogue: TranscriptEntry[] = [];
  private onEntryCallback?: (entry: TranscriptEntry) => void;
  private getCallDurationSec: () => number;

  constructor(
    callId: string,
    currentUserId: string,
    currentUserName: string,
    peerUserName: string,
    getCallDurationSec: () => number,
    onEntry?: (entry: TranscriptEntry) => void
  ) {
    this.callId = callId;
    this.currentUserId = currentUserId;
    this.currentUserName = currentUserName || 'Colleague';
    this.peerUserName = peerUserName || 'Colleague';
    this.getCallDurationSec = getCallDurationSec;
    this.onEntryCallback = onEntry;
  }

  /**
   * Starts speech recognition on local microphone audio.
   */
  start(): boolean {
    if (this.isRunning) return true;
    this.dialogue = [];

    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      console.warn('[Transcription] Web Speech API not supported in this browser.');
      return false;
    }

    try {
      this.recognition = new SpeechRec();
      this.recognition.continuous = true;
      this.recognition.interimResults = false;
      this.recognition.lang = 'en-US';

      this.recognition.onresult = (event: any) => {
        const lastIndex = event.results.length - 1;
        if (lastIndex >= 0) {
          const res = event.results[lastIndex];
          if (res.isFinal && res[0]?.transcript?.trim()) {
            const text = res[0].transcript.trim();
            this.addLocalEntry(text);
          }
        }
      };

      this.recognition.onerror = (event: any) => {
        // 'no-speech' is normal during silence, do not break
        if (event.error !== 'no-speech') {
          console.warn('[Transcription] Speech recognition error:', event.error);
        }
      };

      this.recognition.onend = () => {
        // Auto-restart while call is running
        if (this.isRunning && this.recognition) {
          try {
            this.recognition.start();
          } catch {}
        }
      };

      this.recognition.start();
      this.isRunning = true;
      console.log('[Transcription] Speech recognition started for', this.currentUserName);
      return true;
    } catch (err) {
      console.warn('[Transcription] Failed to start speech recognition:', err);
      return false;
    }
  }

  /**
   * Adds an entry spoken by the local user.
   */
  private addLocalEntry(text: string) {
    const sec = this.getCallDurationSec();
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    const time_offset = `${m}:${s < 10 ? '0' : ''}${s}`;

    const entry: TranscriptEntry = {
      id: `tr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      speaker_id: this.currentUserId,
      speaker_name: this.currentUserName,
      text,
      time_offset,
      timestamp: new Date().toISOString(),
    };

    this.dialogue.push(entry);
    this.onEntryCallback?.(entry);

    // Relay entry to peer via window event (picked up by WebRtcCallManager)
    window.dispatchEvent(
      new CustomEvent('argus:chat-send-transcript', {
        detail: { callId: this.callId, entry },
      })
    );
  }

  /**
   * Receives an entry spoken by the remote peer.
   */
  addRemoteEntry(entry: TranscriptEntry) {
    if (!entry || !entry.text) return;
    if (this.dialogue.some((d) => d.id === entry.id)) return;
    this.dialogue.push(entry);
    this.onEntryCallback?.(entry);
  }

  /**
   * Stops recognition and returns dialogue and full text.
   */
  stop(): { dialogue: TranscriptEntry[]; transcriptText: string } {
    this.isRunning = false;
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch {}
      this.recognition = null;
    }

    // Sort dialogue chronologically
    this.dialogue.sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    // Compile human-readable transcript text
    const transcriptText = this.dialogue.length > 0
      ? this.dialogue
          .map((d) => `[${d.time_offset}] ${d.speaker_name}: ${d.text}`)
          .join('\n')
      : `Call conducted between ${this.currentUserName} and ${this.peerUserName}. No voice speech detected.`;

    console.log('[Transcription] Finished. Total entries:', this.dialogue.length);
    return {
      dialogue: this.dialogue,
      transcriptText,
    };
  }
}
