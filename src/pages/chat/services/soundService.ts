// Web Audio API sound synthesizer for calling ringtones, notification chimes, and call disconnects.
// Runs natively in all browsers without external audio files.

let audioCtx: AudioContext | null = null;
let ringInterval: number | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    audioCtx = new AudioContextClass();
  }
  if (audioCtx.state === 'suspended') {
    void audioCtx.resume();
  }
  return audioCtx;
}

/**
 * Plays a dual-frequency ringtone pulse (WhatsApp / US standard ring style: 440Hz + 480Hz).
 */
export function playRingtone() {
  stopRingtone();
  const ctx = getAudioContext();

  const playBurst = () => {
    try {
      const now = ctx.currentTime;
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'sine';
      osc2.type = 'sine';
      osc1.frequency.setValueAtTime(440, now);
      osc2.frequency.setValueAtTime(480, now);

      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.8);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 1.8);
      osc2.stop(now + 1.8);
    } catch {
      /* ignore audio interruption */
    }
  };

  playBurst();
  ringInterval = window.setInterval(playBurst, 3500);
}

export function stopRingtone() {
  if (ringInterval !== null) {
    clearInterval(ringInterval);
    ringInterval = null;
  }
}

/**
 * Plays a gentle, pleasant notification chime for messages and meeting reminders.
 */
export function playNotificationChime() {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now); // A5
    osc.frequency.exponentialRampToValueAtTime(1320, now + 0.12); // E6

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.35);
  } catch {
    /* ignore */
  }
}

/**
 * Plays a short three-beep disconnect tone when a call ends.
 */
export function playEndCallTone() {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    for (let i = 0; i < 3; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const t = now + i * 0.16;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(480, t);
      gain.gain.setValueAtTime(0.15, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.12);
    }
  } catch {
    /* ignore */
  }
}
