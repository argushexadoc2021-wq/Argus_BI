import { Calendar, Clock, Video, CheckCircle, XCircle, CalendarPlus, User, Trash2 } from 'lucide-react';
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

  return (
    <div className={`w-full max-w-sm rounded-xl border overflow-hidden shadow-sm transition-all ${isCancelled ? 'bg-slate-50 border-slate-200 opacity-75' : 'bg-white border-orange-200'}`}>
      {/* Top Header */}
      <div className={`px-3.5 py-2.5 flex items-center justify-between ${isCancelled ? 'bg-slate-200 text-slate-700' : 'bg-gradient-to-r from-navy-950 to-slate-900 text-white'}`}>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-brand-500/20 text-brand-400 border border-brand-500/30 flex items-center justify-center shrink-0">
            <Calendar size={15} />
          </div>
          <div>
            <h4 className="text-xs font-bold leading-tight truncate">{meeting.title}</h4>
            <span className="text-[10px] text-slate-300">By {meeting.organizer_name || 'Organizer'}</span>
          </div>
        </div>
        <span
          className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
            isCancelled
              ? 'bg-red-100 text-red-700 border border-red-200'
              : isCompleted
              ? 'bg-slate-100 text-slate-600'
              : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
          }`}
        >
          {meeting.status}
        </span>
      </div>

      {/* Body info */}
      <div className="p-3 space-y-2 text-xs">
        {meeting.description && (
          <p className="text-slate-600 text-[11px] leading-relaxed line-clamp-2">
            {meeting.description}
          </p>
        )}

        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100 text-[11px]">
          <div className="flex items-center gap-1.5 text-slate-700">
            <Calendar size={13} className="text-brand-600 shrink-0" />
            <span className="font-semibold">{formattedDate}</span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-700">
            <Clock size={13} className="text-brand-600 shrink-0" />
            <span className="font-semibold">{formattedTime}</span>
          </div>
        </div>

        {/* Participants status summary */}
        <div className="pt-2 border-t border-slate-100">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
            Participants ({meeting.participants.length})
          </p>
          <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
            {meeting.participants.map((p, idx) => (
              <span
                key={idx}
                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border ${
                  p.status === 'accepted'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : p.status === 'declined'
                    ? 'bg-red-50 text-red-700 border-red-200'
                    : 'bg-slate-50 text-slate-600 border-slate-200'
                }`}
              >
                <User size={10} />
                <span className="truncate max-w-[80px]">{p.full_name || p.user_id.slice(0, 6)}</span>
                {p.status === 'accepted' && <CheckCircle size={10} className="text-emerald-600" />}
                {p.status === 'declined' && <XCircle size={10} className="text-red-500" />}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Action Footer */}
      {!isCancelled && (
        <div className="p-2.5 bg-slate-50/70 border-t border-slate-100 flex flex-wrap items-center justify-between gap-1.5">
          <div className="flex items-center gap-1">
            {myStatus !== 'accepted' && (
              <button
                type="button"
                onClick={() => onRespond('accepted')}
                className="flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-[11px] font-bold shadow-xs transition-colors"
              >
                <CheckCircle size={12} /> Accept
              </button>
            )}
            {myStatus !== 'declined' && (
              <button
                type="button"
                onClick={() => onRespond('declined')}
                className="flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-red-50 text-red-600 border border-red-200 rounded-md text-[11px] font-bold transition-colors"
              >
                <XCircle size={12} /> Decline
              </button>
            )}
            <button
              type="button"
              onClick={() => downloadMeetingIcs(meeting)}
              title="Add to Google / Outlook / Apple Calendar"
              className="flex items-center gap-1 px-2 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-md text-[11px] font-medium transition-colors"
            >
              <CalendarPlus size={12} className="text-brand-600" /> Calendar
            </button>
          </div>

          <div className="flex items-center gap-1">
            {meeting.meeting_type !== 'in_person' && onJoinMeeting && (
              <button
                type="button"
                onClick={() => onJoinMeeting(meeting)}
                className="flex items-center gap-1 px-2.5 py-1 bg-brand-600 hover:bg-brand-700 text-white rounded-md text-[11px] font-bold shadow-xs transition-colors"
              >
                <Video size={12} /> Join Call
              </button>
            )}

            {isOrganizer && onCancel && (
              <button
                type="button"
                onClick={onCancel}
                title="Cancel Meeting"
                className="p-1 text-slate-400 hover:text-red-600 rounded transition-colors"
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
