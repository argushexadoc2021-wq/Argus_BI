// Spoken commands that open, close or quieten the Adviser ("AI box"), in English, Tanglish and Tamil.
//   open:  "raaju", "raju", "hi raaju", "hey raaju", "raaju open", "open raaju", "open adviser", "ராஜு", "ராஜு ஓபன்", "ஓபன் ராஜு", "திற"
//   close: "raaju close", "close raaju", "close", "close adviser", "bye raaju", "ராஜு மூடு", "மூடு", "க்ளோஸ் ராஜு", "க்ளோஸ்"
//   stop:  "stop", "wait", "enough", "stop talking", "நிறுத்து", "போதும்" (stops the voice, keeps the box open)
// Only a short phrase counts, so a question like "how do I close an invoice" still goes to the Adviser.

const NAME = '(?:raaju|raju|rajoo|raajoo|rajju|ராஜு|ராஜூ|ராசு|ai|a i|ஏஐ|ஏ ஐ|adviser|advisor|adviser box|ai box|a i box|அட்வைசர்|box|window)';
const OPEN_W = '(?:open|opan|ஓபன்|திற|திறந்து|திறங்க|show|start|come|wake|wake up)';
const CLOSE_W = '(?:close|klose|க்ளோஸ்|மூடு|மூடுங்க|bye|bye bye|exit|பை|shut|stop)';
const GREET = '(?:(?:hi|hey|hello|ok|okay|வணக்கம்|ஹாய்|ஹலோ)\\s+)?';
const TAIL = '(?:\\s+(?:please|pannu|pannunga|பண்ணு|பண்ணுங்க|now|over|ஓவர்))?';

const OPEN_RE = new RegExp(
  `^${GREET}(?:${NAME}|${OPEN_W}\\s+(?:the\\s+)?${NAME}(?:\\s+box)?|${NAME}\\s+${OPEN_W}|${OPEN_W}(?:\\s+(?:the\\s+)?(?:adviser|advisor|box|ai|ai box))?)${TAIL}$`,
  'iu'
);
const CLOSE_RE = new RegExp(
  `^${GREET}(?:${CLOSE_W}(?:\\s+(?:the\\s+)?(?:${NAME})(?:\\s+box)?)?|${NAME}\\s+${CLOSE_W})${TAIL}$`,
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

export type AdviserVoiceCommand = 'open' | 'close' | 'stop' | null;

export function adviserVoiceCommand(raw: string): AdviserVoiceCommand {
  const t = cleanSpoken(raw);
  if (!t || t.split(' ').length > 6) return null;
  if (OPEN_RE.test(t)) return 'open';
  if (CLOSE_RE.test(t)) return 'close';
  if (STOP_RE.test(t)) return 'stop';
  return null;
}

/** Tell the Adviser to open or close, from anywhere in the app (the always-on microphone uses this). */
export function sendAdviserCommand(action: 'open' | 'close', query?: string) {
  window.dispatchEvent(new CustomEvent('argus:adviser', { detail: { action, query } }));
}
