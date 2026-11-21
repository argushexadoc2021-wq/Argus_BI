// Spoken commands that open, close, resize or quieten the Adviser ("AI box"), in English, Tanglish and Tamil.
//   open:       "raaju", "raju", "hi raaju", "hey raaju", "raaju open", "open raaju", "open adviser", "ராஜு", "ராஜு ஓபன்", "ஓபன் ராஜு", "திற"
//   fullscreen: "raju open in full screen", "open in full screen", "open full screen", "fullscreen", "full screen", "maximize", "ராஜு முழுத்திரை", "பெரிதாக்கு"
//   minimize:   "raju minimize", "minimize", "make it small", "மினிமைஸ்", "சின்னதாக்கு"
//   close:      "raaju close", "close raaju", "close", "close it", "close adviser", "bye raaju", "ராஜு மூடு", "மூடு", "க்ளோஸ் ராஜு", "க்ளோஸ்"
//   stop:       "stop", "wait", "enough", "stop talking", "நிறுத்து", "போதும்" (stops the voice, keeps the box open)
// Only a short phrase counts, so a question like "how do I close an invoice" still goes to the Adviser.

const NAME = '(?:raaju|raju|rajoo|raajoo|rajju|ராஜு|ராஜூ|ராசு|ai|a i|ஏஐ|ஏ ஐ|adviser|advisor|adviser box|ai box|a i box|அட்வைசர்|box|window)';
const OPEN_W = '(?:open|opan|ஓபன்|திற|திறந்து|திறங்க|show|start|come|wake|wake up)';
const CLOSE_W = '(?:close|klose|க்ளோஸ்|மூடு|மூடுங்க|bye|bye bye|exit|பை|shut|stop)';
const FULL_W = '(?:full\\s*screen|fullscreen|full|maximize|maximized|big|zoom|expand|முழுத்திரை|முழு\\s*திரை(?:யில்)?|பெரிதாக்கு|பெரிசு)';
const MIN_W = '(?:minimize|minimized|small|hide|மினிமைஸ்|சின்னதாக்கு|சிறிதாக்கு|மறை)';
const GREET = '(?:(?:hi|hey|hello|ok|okay|வணக்கம்|ஹாய்|ஹலோ)\\s+)?';
const TAIL = '(?:\\s+(?:please|pannu|pannunga|பண்ணு|பண்ணுங்க|now|over|ஓவர்|it|this|that|window|box|app|screen))*';

const FULLSCREEN_RE = new RegExp(
  `^${GREET}(?:(?:${NAME}\\s+)?(?:${OPEN_W}\\s+(?:in\\s+)?)?${FULL_W}(?:\\s+${NAME})?|${NAME}\\s+${OPEN_W}\\s+(?:in\\s+)?${FULL_W}|${OPEN_W}\\s+(?:the\\s+)?${NAME}\\s+(?:in\\s+)?${FULL_W}|${OPEN_W}\\s+(?:in\\s+)?${FULL_W}\\s+(?:the\\s+)?${NAME}|(?:make\\s+(?:it\\s+)?)?${FULL_W})${TAIL}$`,
  'iu'
);

const MINIMIZE_RE = new RegExp(
  `^${GREET}(?:(?:${NAME}\\s+)?${MIN_W}(?:\\s+${NAME})?|(?:make\\s+(?:it\\s+)?)?${MIN_W})${TAIL}$`,
  'iu'
);

const CLOSE_RE = new RegExp(
  `^${GREET}(?:${CLOSE_W}(?:\\s+(?:the\\s+)?(?:${NAME})(?:\\s+box)?)?|${NAME}\\s+${CLOSE_W}|${CLOSE_W}\\s+(?:it|this|that|window|box)|${NAME}\\s+${CLOSE_W}\\s+(?:it|this|that|window|box))${TAIL}$`,
  'iu'
);

const OPEN_RE = new RegExp(
  `^${GREET}(?:${NAME}|${OPEN_W}\\s+(?:the\\s+)?${NAME}(?:\\s+box)?|${NAME}\\s+${OPEN_W}|${OPEN_W}(?:\\s+(?:the\\s+)?(?:adviser|advisor|box|ai|ai box))?)${TAIL}$`,
  'iu'
);

// The Adviser's typing microphone: "Raaju mic on" / "Raaju mic off", "மைக் ஆன்" / "மைக் ஆஃப்", "turn on the mic", "stop listening"
const MIC = '(?:mic|mike|mic phone|microphone|மைக்|மைக்கு|மைக்க|மைக்ரோஃபோன்)';
const ON_W = '(?:on|onn|ஆன்|start|open|திற|enable|போடு)';
const OFF_W = '(?:off|of|ஆஃப்|ஆப்|stop|close|மூடு|disable|mute|நிறுத்து)';
const MIC_ON_RE = new RegExp(
  `^${GREET}(?:${NAME}\\s+)?(?:${MIC}\\s+${ON_W}|${ON_W}\\s+(?:the\\s+)?${MIC}|(?:turn|switch)\\s+on\\s+(?:the\\s+)?${MIC}|(?:turn|switch)\\s+(?:the\\s+)?${MIC}\\s+on|start\\s+listening)(?:\\s+${NAME})?${TAIL}$`,
  'iu'
);
const MIC_OFF_RE = new RegExp(
  `^${GREET}(?:${NAME}\\s+)?(?:${MIC}\\s+${OFF_W}|${OFF_W}\\s+(?:the\\s+)?${MIC}|(?:turn|switch)\\s+off\\s+(?:the\\s+)?${MIC}|(?:turn|switch)\\s+(?:the\\s+)?${MIC}\\s+off|stop\\s+listening)(?:\\s+${NAME})?${TAIL}$`,
  'iu'
);

const STOP_RE = new RegExp(
  `^(?:(?:stop|wait|enough|silence|quiet|shut up|stop talking|stop speaking|நிறுத்து|நிறுத்துங்க|போதும்|நில்லு|சும்மா இரு)(?:\\s+${NAME})?|${NAME}\\s+(?:stop|wait|நிறுத்து|போதும்))${TAIL}$`,
  'iu'
);

/** Lower case, no punctuation, no trailing "over" (the send word), single spaces. */
export function cleanSpoken(raw: string): string {
  return String(raw || '')
    .toLowerCase()
    .replace(/[.,!?;:'"()\-_/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\s*(?:over|ஓவர்)$/u, '')
    .trim();
}

export type AdviserVoiceCommand = 'open' | 'close' | 'stop' | 'fullscreen' | 'minimize' | 'mic_on' | 'mic_off' | null;

export function adviserVoiceCommand(raw: string): AdviserVoiceCommand {
  const t = cleanSpoken(raw);
  if (!t || t.split(' ').length > 8) return null;
  // the microphone words first, so "Raaju mic off" is never read as "close"
  if (MIC_ON_RE.test(t)) return 'mic_on';
  if (MIC_OFF_RE.test(t)) return 'mic_off';
  if (FULLSCREEN_RE.test(t)) return 'fullscreen';
  if (MINIMIZE_RE.test(t)) return 'minimize';
  if (CLOSE_RE.test(t)) return 'close';
  if (STOP_RE.test(t)) return 'stop';
  if (OPEN_RE.test(t)) return 'open';
  return null;
}

/** Tell the Adviser to open, close, fullscreen or minimize, from anywhere in the app (the always-on microphone uses this). */
export function sendAdviserCommand(action: 'open' | 'close' | 'fullscreen' | 'minimize' | 'mic_on' | 'mic_off', query?: string) {
  window.dispatchEvent(new CustomEvent('argus:adviser', { detail: { action, query } }));
}
