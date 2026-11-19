import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import type { CallSession } from '../types';
import { callTopicForCompany, callTopicForUser } from '../services/chatService';
import { playEndCallTone, stopRingtone } from '../services/soundService';
import { CallOverlay } from './CallOverlay';

/**
 * Incoming BI Chat calls, on every page of the app. A call rings here whether the person is in BI Chat, Sales, Inventory or
 * anywhere else (as long as Argus BI is open). Outgoing calls are still placed and shown from the BI Chat page.
 */
export function CallHost() {
  const { profile, company, companies } = useAuth();
  const me = profile?.id || '';
  const myName = profile?.full_name || profile?.email?.split('@')[0] || 'Argus User';
  const companyId = company?.id || profile?.company_id || companies?.[0]?.id || '';
  const [call, setCall] = useState<CallSession | null>(null);
  const callRef = useRef<CallSession | null>(null);
  callRef.current = call;

  useEffect(() => {
    if (!me) return;
    const seen = new Set<string>();
    const onIncoming = ({ payload }: { payload: CallSession }) => {
      if (!payload?.id || payload.caller_id === me || seen.has(payload.id)) return;
      if (payload.recipient_id && payload.recipient_id !== 'all' && payload.recipient_id !== me) return;
      // already in a call: let this one ring out on the caller's side
      if (callRef.current) return;
      // a call announced long ago (a stale message) is not shown
      if (payload.started_at && Date.now() - new Date(payload.started_at).getTime() > 60_000) return;
      seen.add(payload.id);
      setCall({ ...payload, status: 'ringing' });
    };
    const onCancel = ({ payload }: { payload: { callId?: string } }) => {
      if (payload?.callId && callRef.current?.id === payload.callId) {
        stopRingtone();
        playEndCallTone();
        setCall(null);
      }
    };
    const channels = [
      supabase.channel(callTopicForUser(me)),
      ...(companyId ? [supabase.channel(callTopicForCompany(companyId))] : []),
    ];
    for (const ch of channels) {
      ch.on('broadcast', { event: 'incoming_call' }, onIncoming as never)
        .on('broadcast', { event: 'cancel_call' }, onCancel as never)
        .subscribe();
    }
    return () => { for (const ch of channels) void supabase.removeChannel(ch); };
  }, [me, companyId]);

  if (!call) return null;
  return (
    <CallOverlay
      call={call}
      currentUserId={me}
      currentUserName={myName}
      // the caller's side records the call in the chat history (missed / declined / duration)
      onEndCall={() => { stopRingtone(); setCall(null); }}
    />
  );
}
