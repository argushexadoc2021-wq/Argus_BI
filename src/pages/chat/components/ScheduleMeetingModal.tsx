import { useState } from 'react';
import { Calendar, Clock, Video, Users, X, MapPin, ExternalLink, Sparkles, Link2 } from 'lucide-react';
import type { UserColleague } from '../types';

function ScheduleMeetingModalBody({
  open,
  colleagues,
  defaultParticipantIds,
  onClose,
  onSchedule,
}: {
  open: boolean;
  colleagues: UserColleague[];
  defaultParticipantIds: string[];
  onClose: () => void;
  onSchedule: (meeting: {
    title: string;
    description: string;
    startTime: string;
    endTime: string;
    meetingType: 'google_meet' | 'video' | 'voice' | 'in_person';
    locationOrLink: string;
    participantUserIds: string[];
    reminderMinutes: number[];
  }) => void;
}) {

  // Defaults: meeting starts 15 minutes from now, 30 min duration
  const now = new Date();
  now.setMinutes(Math.ceil(now.getMinutes() / 15) * 15 + 15);
  const end = new Date(now.getTime() + 30 * 60000);

  const defaultDate = now.toISOString().split('T')[0];
  const defaultStartTime = now.toTimeString().slice(0, 5);
  const defaultEndTime = end.toTimeString().slice(0, 5);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(defaultDate);
  const [startTime, setStartTime] = useState(defaultStartTime);
  const [endTime, setEndTime] = useState(defaultEndTime);
  const [meetingType, setMeetingType] = useState<'google_meet' | 'video' | 'voice' | 'in_person'>('google_meet');
  const [locationOrLink, setLocationOrLink] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>(
    defaultParticipantIds.length > 0 ? defaultParticipantIds : (colleagues.length > 0 ? [colleagues[0].id] : [])
  );
  const [reminders, setReminders] = useState<number[]>([15, 5, 0]);
  const [error, setError] = useState('');

  const generateGoogleMeetLink = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyz';
    const randStr = (len: number) => Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    return `https://meet.google.com/${randStr(3)}-${randStr(4)}-${randStr(3)}`;
  };

  const handleGenerateMeet = () => {
    const link = generateGoogleMeetLink();
    setLocationOrLink(link);
  };

  const handleOpenGoogleMeetNew = () => {
    window.open('https://meet.google.com/new', '_blank');
  };

  const toggleUser = (userId: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const toggleReminder = (min: number) => {
    setReminders((prev) =>
      prev.includes(min) ? prev.filter((m) => m !== min) : [...prev, min].sort((a, b) => b - a)
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Please enter a meeting title');
      return;
    }

    const startDateTime = new Date(`${date}T${startTime}:00`).toISOString();
    const endDateTime = new Date(`${date}T${endTime}:00`).toISOString();

    if (new Date(endDateTime) <= new Date(startDateTime)) {
      setError('End time must be after start time');
      return;
    }

    if (selectedUserIds.length === 0) {
      setError('Select at least one participant');
      return;
    }

    let finalLink = locationOrLink.trim();
    if (meetingType === 'google_meet') {
      if (!finalLink || !finalLink.startsWith('http')) {
        finalLink = generateGoogleMeetLink();
      }
    } else if (meetingType === 'video') {
      finalLink = finalLink || 'Argus BI Video Room';
    } else if (meetingType === 'voice') {
      finalLink = finalLink || 'Argus BI Voice Room';
    } else {
      finalLink = finalLink || 'Argus Conference Room';
    }

    onSchedule({
      title: title.trim(),
      description: description.trim(),
      startTime: startDateTime,
      endTime: endDateTime,
      meetingType,
      locationOrLink: finalLink,
      participantUserIds: selectedUserIds,
      reminderMinutes: reminders,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-gradient-to-r from-navy-950 via-slate-900 to-slate-950 text-white">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-orange-500/20 text-orange-400 border border-orange-500/30 flex items-center justify-center">
              <Calendar size={17} />
            </div>
            <div>
              <h3 className="text-sm font-bold">Schedule Meeting</h3>
              <p className="text-[11px] text-slate-300">Share Google Meet or Argus Call with Colleagues</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 flex-1">
          {error && (
            <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-semibold">
              {error}
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Meeting Title *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => { setTitle(e.target.value); setError(''); }}
              placeholder="e.g. Production Review, Google Meet Discussion, CNC Sync"
              className="w-full text-xs font-medium px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-orange-500 focus:bg-white transition-colors"
            />
          </div>

          {/* Agenda / Description */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Agenda & Notes
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add discussion agenda, topics, drawings to review..."
              className="w-full text-xs font-medium px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-orange-500 focus:bg-white transition-colors resize-none"
            />
          </div>

          {/* Date & Time Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1">
                <Calendar size={12} className="text-orange-600" /> Date
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full text-xs font-medium px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-orange-500 focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1">
                <Clock size={12} className="text-orange-600" /> Start
              </label>
              <input
                type="time"
                required
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full text-xs font-medium px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-orange-500 focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1">
                <Clock size={12} className="text-orange-600" /> End
              </label>
              <input
                type="time"
                required
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full text-xs font-medium px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-orange-500 focus:bg-white"
              />
            </div>
          </div>

          {/* Meeting Type Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Meeting Type
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { id: 'google_meet', label: 'Google Meet', icon: Video, color: 'text-emerald-600', activeBg: 'bg-emerald-50 border-emerald-500 text-emerald-800 ring-1 ring-emerald-500/20' },
                { id: 'video', label: 'Argus Video', icon: Video, color: 'text-orange-600', activeBg: 'bg-orange-50 border-orange-500 text-orange-800 ring-1 ring-orange-500/20' },
                { id: 'voice', label: 'Audio Call', icon: Users, color: 'text-sky-600', activeBg: 'bg-sky-50 border-sky-500 text-sky-800 ring-1 ring-sky-500/20' },
                { id: 'in_person', label: 'In Person', icon: MapPin, color: 'text-purple-600', activeBg: 'bg-purple-50 border-purple-500 text-purple-800 ring-1 ring-purple-500/20' },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    setMeetingType(t.id as any);
                    if (t.id === 'google_meet' && !locationOrLink) {
                      setLocationOrLink(generateGoogleMeetLink());
                    }
                  }}
                  className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                    meetingType === t.id
                      ? t.activeBg
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <t.icon size={13} className={meetingType === t.id ? '' : t.color} />
                  <span>{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Google Meet Link or Location Input */}
          <div className="bg-slate-50/70 p-3 rounded-xl border border-slate-200">
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                {meetingType === 'google_meet' ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span>Google Meet Link</span>
                  </>
                ) : (
                  <span>Location / Link</span>
                )}
              </label>

              {meetingType === 'google_meet' && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleGenerateMeet}
                    className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 cursor-pointer"
                  >
                    <Sparkles size={11} /> Generate Link
                  </button>
                  <button
                    type="button"
                    onClick={handleOpenGoogleMeetNew}
                    className="text-[11px] font-bold text-orange-600 hover:text-orange-700 flex items-center gap-1 cursor-pointer"
                    title="Open Google Meet in a new tab"
                  >
                    <ExternalLink size={11} /> meet.google.com/new
                  </button>
                </div>
              )}
            </div>

            <div className="relative">
              <Link2 size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
              <input
                type="text"
                value={locationOrLink}
                onChange={(e) => setLocationOrLink(e.target.value)}
                placeholder={
                  meetingType === 'google_meet'
                    ? 'https://meet.google.com/abc-defg-hij'
                    : meetingType === 'video'
                    ? 'Argus BI Integrated Video Room (auto)'
                    : 'Conference Room 1, Shop Floor'
                }
                className="w-full text-xs font-medium pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-orange-500 transition-colors"
              />
            </div>
            {meetingType === 'google_meet' && (
              <p className="text-[10px] text-slate-500 mt-1.5">
                Participants will see an active <strong>Join Google Meet</strong> button directly in the chat and calendar invitation!
              </p>
            )}
          </div>

          {/* Reminders settings */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Automatic Reminders
            </label>
            <div className="flex flex-wrap gap-2">
              {[
                { val: 15, label: '15 min before' },
                { val: 5, label: '5 min before' },
                { val: 0, label: 'At start time' },
              ].map((r) => {
                const active = reminders.includes(r.val);
                return (
                  <button
                    key={r.val}
                    type="button"
                    onClick={() => toggleReminder(r.val)}
                    className={`px-2.5 py-1 rounded-md text-xs font-bold border transition-colors cursor-pointer ${
                      active
                        ? 'bg-orange-100 text-orange-800 border-orange-300'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {active ? '✓ ' : ''}{r.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Participants Multi-Select */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center justify-between">
              <span>Participants ({selectedUserIds.length})</span>
              <span className="text-[10px] text-slate-400 font-normal">Click colleagues to include</span>
            </label>
            <div className="max-h-36 overflow-y-auto border border-slate-200 rounded-xl p-1.5 space-y-1 bg-slate-50/50">
              {colleagues.map((u) => {
                const selected = selectedUserIds.includes(u.id);
                const initials = (u.full_name || u.email || 'Colleague')
                  .split(' ')
                  .map((n) => n[0])
                  .join('')
                  .slice(0, 2)
                  .toUpperCase();
                return (
                  <div
                    key={u.id}
                    onClick={() => toggleUser(u.id)}
                    className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg cursor-pointer text-xs transition-colors ${
                      selected ? 'bg-orange-50 border border-orange-200 text-orange-950 font-bold' : 'hover:bg-white border border-transparent text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <div className="w-5 h-5 rounded-full bg-gradient-to-br from-orange-600 to-amber-700 text-white flex items-center justify-center text-[9px] font-bold shrink-0">
                        {initials}
                      </div>
                      <span className="truncate">{u.full_name}</span>
                      <span className="text-[10px] text-slate-400 font-normal">({u.role})</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => {}}
                      className="accent-orange-600 h-3.5 w-3.5 rounded cursor-pointer"
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Footer buttons */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold shadow-md shadow-orange-600/20 transition-all cursor-pointer"
            >
              Share Meeting Invitation
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/** Mounted only while open, so its hooks always run in the same order (and the form starts fresh each time). */
export function ScheduleMeetingModal(props: Parameters<typeof ScheduleMeetingModalBody>[0]) {
  return props.open ? <ScheduleMeetingModalBody {...props} /> : null;
}
