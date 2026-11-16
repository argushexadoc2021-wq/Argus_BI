import { useState } from 'react';
import {
  Calendar,
  Clock,
  Video,
  CheckCircle,
  XCircle,
  CalendarPlus,
  User,
  Trash2,
  ExternalLink,
  Copy,
  Check,
  MapPin,
  Link2,
} from 'lucide-react';
import type { Meeting } from '../types';
import { downloadMeetingIcs } from '../services/icsGenerator';

export function MeetingCard({
  meeting,
  currentUserId,
  onRespond,
  onCancel,
  onJoinMeeting,
}: {
  meeting: Meeting;
  currentUserId: string;
  onRespond: (status: 'accepted' | 'declined') => void;
  onCancel?: () => void;
  onJoinMeeting?: (meeting: Meeting) => void;
}) {
  const [copied, setCopied] = useState(false);

  const isOrganizer = meeting.organizer_id === currentUserId;
  const myParticipant = meeting.participants.find((p) => p.user_id === currentUserId);
  const myStatus = myParticipant?.status || 'pending';

  const startDate = new Date(meeting.start_time);
  const endDate = new Date(meeting.end_time);

  const formattedDate = startDate.toLocaleDateString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const formattedTime = `${startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${endDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

  const isCancelled = meeting.status === 'cancelled';
  const isCompleted = meeting.status === 'completed';

  const isGoogleMeet =
    (meeting.location_or_link || '').toLowerCase().includes('meet.google.com') ||
    (meeting.meeting_type as string) === 'google_meet';

  const isExternalLink =
    (meeting.location_or_link || '').startsWith('http://') ||
    (meeting.location_or_link || '').startsWith('https://');

  const handleCopyLink = () => {
    if (!meeting.location_or_link) return;
    void navigator.clipboard.writeText(meeting.location_or_link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Helper to get friendly participant name
  const getParticipantName = (p: { user_id: string; full_name?: string }) => {
    if (p.full_name && p.full_name !== p.user_id && !p.full_name.startsWith('e0ccbd')) {
      return p.full_name;
    }
    // Try localStorage cached colleagues
    try {
      const raw = localStorage.getItem('argus_bi_chat_colleagues_0255839c-a9b1-49a8-a9f6-e776fd7bdd00');
      if (raw) {
        const colleagues = JSON.parse(raw);
        const match = (colleagues || []).find((c: any) => c.id === p.user_id);
        if (match && match.full_name) return match.full_name;
      }
    } catch {}
    if (p.user_id === 'e0ccbd4c-37cf-445c-af12-665ca93dd251') return 'test';
    if (p.user_id === '2356c424-f7fb-47e4-81a4-fe76d5c3e460') return 'Janani Mohan';
    if (p.user_id === '4273d9d3-13f2-4088-b162-ad892a561d63') return 'argus';
    if (p.user_id === '266742af-6f29-41ad-adb8-8a5ac3ad05dc') return 'priya';
    return p.full_name || p.user_id.slice(0, 8);
  };

  return (
    <div
      className={`w-full max-w-sm rounded-2xl border overflow-hidden shadow-md transition-all ${
        isCancelled
          ? 'bg-slate-50 border-slate-200 opacity-75'
          : isGoogleMeet
          ? 'bg-white border-emerald-300 ring-1 ring-emerald-500/10'
          : 'bg-white border-orange-200'
      }`}
    >
      {/* Top Header */}
      <div
        className={`px-3.5 py-2.5 flex items-center justify-between ${
          isCancelled
            ? 'bg-slate-200 text-slate-700'
            : isGoogleMeet
            ? 'bg-gradient-to-r from-emerald-950 via-slate-900 to-slate-950 text-white'
            : 'bg-gradient-to-r from-navy-950 via-slate-900 to-slate-950 text-white'
        }`}
      >
        <div className="flex items-center gap-2 truncate pr-2">
          <div
            className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border ${
              isGoogleMeet
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                : 'bg-orange-500/20 text-orange-400 border-orange-500/30'
            }`}
          >
            <Calendar size={15} />
          </div>
          <div className="truncate">
            <h4 className="text-xs font-bold leading-tight truncate">{meeting.title}</h4>
            <span className="text-[10px] text-slate-300">
              By {meeting.organizer_name || 'Organizer'}
              {isGoogleMeet ? ' · Google Meet' : ''}
            </span>
          </div>
        </div>
        <span
          className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0 ${
            isCancelled
              ? 'bg-red-100 text-red-700 border border-red-200'
              : isCompleted
              ? 'bg-slate-100 text-slate-600'
              : isGoogleMeet
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
              : 'bg-orange-500/20 text-orange-300 border border-orange-500/30'
          }`}
        >
          {meeting.status}
        </span>
      </div>

      {/* Body info */}
      <div className="p-3 space-y-2.5 text-xs">
        {meeting.description && (
          <p className="text-slate-600 text-[11px] leading-relaxed line-clamp-2">
            {meeting.description}
          </p>
        )}

        {/* Date and Time row */}
        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100 text-[11px]">
          <div className="flex items-center gap-1.5 text-slate-700">
            <Calendar size={13} className="text-orange-600 shrink-0" />
            <span className="font-semibold">{formattedDate}</span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-700">
            <Clock size={13} className="text-orange-600 shrink-0" />
            <span className="font-semibold">{formattedTime}</span>
          </div>
        </div>

        {/* Meeting Link / Location Box */}
        {isGoogleMeet && meeting.location_or_link ? (
          <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950 flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Google Meet Video Room
              </span>
              <button
                type="button"
                onClick={handleCopyLink}
                className="text-[10px] font-bold text-emerald-700 hover:text-emerald-900 flex items-center gap-0.5 cursor-pointer"
                title="Copy meeting link"
              >
                {copied ? <Check size={11} className="text-emerald-600" /> : <Copy size={11} />}
                <span>{copied ? 'Copied!' : 'Copy'}</span>
              </button>
            </div>
            <a
              href={meeting.location_or_link}
              target="_blank"
              rel="noreferrer"
              className="text-xs font-mono font-semibold text-emerald-700 hover:underline truncate block flex items-center gap-1"
            >
              <Link2 size={12} className="shrink-0" />
              <span className="truncate">{meeting.location_or_link}</span>
              <ExternalLink size={10} className="shrink-0 ml-auto" />
            </a>
          </div>
        ) : meeting.location_or_link ? (
          <div className="flex items-center gap-1.5 text-slate-700 text-[11px] bg-slate-50 p-2 rounded-lg border border-slate-100">
            <MapPin size={12} className="text-orange-500 shrink-0" />
            <span className="truncate">{meeting.location_or_link}</span>
          </div>
        ) : null}

        {/* Participants status summary */}
        <div className="pt-2 border-t border-slate-100">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
            Participants ({meeting.participants.length})
          </p>
          <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto">
            {meeting.participants.map((p, idx) => {
              const name = getParticipantName(p);
              return (
                <span
                  key={idx}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                    p.status === 'accepted'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : p.status === 'declined'
                      ? 'bg-red-50 text-red-700 border-red-200'
                      : 'bg-slate-50 text-slate-700 border-slate-200'
                  }`}
                >
                  <User size={10} className="text-slate-400" />
                  <span className="truncate max-w-[100px]">{name}</span>
                  {p.status === 'accepted' && <CheckCircle size={10} className="text-emerald-600 ml-0.5" />}
                  {p.status === 'declined' && <XCircle size={10} className="text-red-500 ml-0.5" />}
                </span>
              );
            })}
          </div>
        </div>
      </div>

      {/* Action Footer */}
      {!isCancelled && (
        <div className="p-2.5 bg-slate-50/80 border-t border-slate-100 flex flex-wrap items-center justify-between gap-1.5">
          <div className="flex items-center gap-1">
            {myStatus !== 'accepted' && (
              <button
                type="button"
                onClick={() => onRespond('accepted')}
                className="flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold shadow-xs transition-colors cursor-pointer"
              >
                <CheckCircle size={12} /> Accept
              </button>
            )}
            {myStatus !== 'declined' && (
              <button
                type="button"
                onClick={() => onRespond('declined')}
                className="flex items-center gap-1 px-2 py-1 bg-white hover:bg-red-50 text-red-600 border border-red-200 rounded-lg text-[11px] font-bold transition-colors cursor-pointer"
              >
                <XCircle size={12} /> Decline
              </button>
            )}
            <button
              type="button"
              onClick={() => downloadMeetingIcs(meeting)}
              title="Add to Google / Outlook / Apple Calendar (.ics)"
              className="flex items-center gap-1 px-2 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-[11px] font-medium transition-colors cursor-pointer"
            >
              <CalendarPlus size={12} className="text-orange-600" /> Calendar
            </button>
          </div>

          <div className="flex items-center gap-1">
            {isGoogleMeet && meeting.location_or_link ? (
              <a
                href={meeting.location_or_link}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
              >
                <Video size={12} />
                <span>Join Google Meet</span>
                <ExternalLink size={11} />
              </a>
            ) : isExternalLink && meeting.location_or_link ? (
              <a
                href={meeting.location_or_link}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 px-2.5 py-1 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-[11px] font-bold shadow-xs transition-colors cursor-pointer"
              >
                <ExternalLink size={12} /> Join Meeting
              </a>
            ) : (
              meeting.meeting_type !== 'in_person' &&
              onJoinMeeting && (
                <button
                  type="button"
                  onClick={() => onJoinMeeting(meeting)}
                  className="flex items-center gap-1 px-2.5 py-1 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-[11px] font-bold shadow-xs transition-colors cursor-pointer"
                >
                  <Video size={12} /> Join Call
                </button>
              )
            )}

            {isOrganizer && onCancel && (
              <button
                type="button"
                onClick={onCancel}
                title="Cancel Meeting"
                className="p-1 text-slate-400 hover:text-red-600 rounded transition-colors cursor-pointer ml-0.5"
              >
                <Trash2 size={13} />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
