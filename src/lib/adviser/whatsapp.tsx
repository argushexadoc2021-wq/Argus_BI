// WhatsApp messages from the Adviser: the AI writes the message (a [[WHATSAPP {...}]] block), the person checks the number
// and the text, and one click opens WhatsApp (app, desktop or web) with the message filled in, ready to send.
// No WhatsApp business account is needed: the message goes from the person's own WhatsApp.

import { useState } from 'react';
import { Check, Copy, MessageCircle, Send } from 'lucide-react';

export interface WhatsAppBlock { to: string; name: string; text: string }

/** Digits only; a 10-digit Indian mobile number gets the 91 country code. */
export function waNumber(raw: string): string {
  let d = raw.replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  return d.length === 10 ? `91${d}` : d;
}

export const waLink = (to: string, text: string) => {
  const n = waNumber(to);
  return `https://wa.me/${n}?text=${encodeURIComponent(text)}`;
};

export function WhatsAppCard({ draft }: { draft: WhatsAppBlock }) {
  const [to, setTo] = useState(draft.to || '');
  const [text, setText] = useState(draft.text || '');
  const [opened, setOpened] = useState(false);
  const [copied, setCopied] = useState(false);
  const n = waNumber(to);
  const badNumber = !!to.trim() && (n.length < 10 || n.length > 15);
  const field = 'w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-800 focus:border-green-500 focus:outline-none';
  const open = () => { window.open(waLink(to, text), '_blank', 'noopener'); setOpened(true); };
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* no clipboard */ }
  };
  return (
    <div className="mt-2 overflow-hidden rounded-xl border border-green-200 bg-white text-left">
      <div className="flex items-center gap-1.5 border-b border-green-100 bg-green-50 px-2.5 py-1.5 text-[11px] font-bold text-green-800">
        <MessageCircle size={13} />WhatsApp message · check it, then send
      </div>
      <div className="space-y-1.5 p-2.5 whitespace-normal">
        <label className="flex items-center gap-2"><span className="w-12 shrink-0 text-[11px] font-semibold text-slate-500">To</span>
          <input className={field} value={to} onChange={(e) => setTo(e.target.value)} placeholder="Mobile number, e.g. 98765 43210 (empty: choose the chat in WhatsApp)" /></label>
        {draft.name && <p className="pl-14 text-[10px] text-slate-500">{draft.name}</p>}
        <textarea className={`${field} min-h-[7rem] leading-relaxed`} value={text} onChange={(e) => setText(e.target.value)} />
        {badNumber && <p className="rounded-md bg-amber-50 px-2 py-1 text-[11px] text-amber-800">Check the number: it should be a mobile number with 10 digits (or with the country code).</p>}
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" disabled={!text.trim() || badNumber} onClick={open}
            className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-green-700 disabled:opacity-50">
            <Send size={13} />{opened ? 'Open WhatsApp again' : 'Send on WhatsApp'}
          </button>
          <button type="button" onClick={copy} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">
            {copied ? <Check size={13} className="text-green-600" /> : <Copy size={13} />}{copied ? 'Copied' : 'Copy'}
          </button>
        </div>
        {opened && <p className="text-[10px] text-slate-500">WhatsApp is open with the message filled in: press Send there.</p>}
      </div>
    </div>
  );
}
