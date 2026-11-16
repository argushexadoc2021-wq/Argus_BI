import type { Meeting } from '../types';

/**
 * Generates and downloads a standard RFC 5545 .ics calendar event file.
 * Compatible with Google Calendar, Outlook, Apple Calendar, and mobile calendar apps.
 */
export function downloadMeetingIcs(meeting: Meeting) {
  const formatUtc = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  };

  const startUtc = formatUtc(meeting.start_time);
  const endUtc = formatUtc(meeting.end_time);
  const nowUtc = formatUtc(new Date().toISOString());
  const uid = `${meeting.id}@argus-cnc.bi-chat`;

  const cleanText = (str: string) =>
    (str || '').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');

  const summary = cleanText(meeting.title);
  const description = cleanText(meeting.description || `Argus BI Meeting scheduled by ${meeting.organizer_name || 'Colleague'}`);
  const location = cleanText(meeting.location_or_link || 'Argus BI Video Room');

  const icsLines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Argus CNC//BI Chat Meeting//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${nowUtc}`,
    `DTSTART:${startUtc}`,
    `DTEND:${endUtc}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${description}`,
    `LOCATION:${location}`,
    `STATUS:${meeting.status === 'cancelled' ? 'CANCELLED' : 'CONFIRMED'}`,
    // Alarm reminder 15 minutes before
    'BEGIN:VALARM',
    'TRIGGER:-PT15M',
    'ACTION:DISPLAY',
    `DESCRIPTION:Reminder: ${summary}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];

  const icsContent = icsLines.join('\r\n');
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${meeting.title.replace(/[^a-zA-Z0-9_-]/g, '_')}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
