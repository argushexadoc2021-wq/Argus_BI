import type { Meeting } from '../types';
import { chatService } from './chatService';
import { playNotificationChime } from './soundService';

let reminderInterval: number | null = null;
const firedReminders = new Set<string>();

/**
 * Starts checking upcoming meetings every 30 seconds for automatic reminder triggers.
 */
export function startMeetingReminderService(companyId: string, currentUserId: string) {
  stopMeetingReminderService();

  // Request browser Notification permission once
  if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
    void Notification.requestPermission();
  }

  const check = async () => {
    if (!companyId || !currentUserId) return;
    try {
      const meetings = await chatService.getMeetings(companyId);
      const now = Date.now();

      meetings.forEach((m) => {
        if (m.status === 'cancelled' || m.status === 'completed') return;

        // Check if user is participant or organizer
        const isParticipant =
          m.organizer_id === currentUserId ||
          m.participants.some((p) => p.user_id === currentUserId && p.status !== 'declined');
        if (!isParticipant) return;

        const startMs = new Date(m.start_time).getTime();
        const diffMinutes = Math.round((startMs - now) / 60000);

        // Check thresholds: 15 min, 5 min, 0 min (start time)
        const thresholds = m.reminder_minutes || [15, 5, 0];

        thresholds.forEach((thresh) => {
          const key = `${m.id}_${thresh}`;
          // Within a 1-minute window around the threshold
          if (diffMinutes <= thresh && diffMinutes >= thresh - 1 && !firedReminders.has(key)) {
            firedReminders.add(key);
            fireReminder(m, thresh);
          }
        });
      });
    } catch {
      /* ignore */
    }
  };

  void check();
  reminderInterval = window.setInterval(check, 30000);
}

export function stopMeetingReminderService() {
  if (reminderInterval !== null) {
    clearInterval(reminderInterval);
    reminderInterval = null;
  }
}

function fireReminder(meeting: Meeting, minutesLeft: number) {
  playNotificationChime();

  const title = minutesLeft === 0 ? `Meeting Starting Now: ${meeting.title}` : `Meeting in ${minutesLeft} minutes: ${meeting.title}`;
  const body = `${new Date(meeting.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · Organizer: ${meeting.organizer_name || 'Colleague'}`;

  // 1. Dispatch custom event for in-app alert banner
  window.dispatchEvent(
    new CustomEvent('argus:meeting-reminder', {
      detail: { meeting, minutesLeft, title, body },
    })
  );

  // 2. Native browser notification if allowed
  if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(title, {
        body,
        icon: '/arguscnc-mark.jpg',
      });
    } catch {
      /* ignore */
    }
  }
}

export const meetingReminderService = {
  start: startMeetingReminderService,
  stop: stopMeetingReminderService,
};
