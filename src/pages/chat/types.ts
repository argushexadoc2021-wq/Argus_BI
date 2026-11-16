export interface UserColleague {
  id: string;
  full_name: string;
  email: string;
  role: string;
  status: 'Active' | 'Inactive';
  mobile?: string;
  avatar_url?: string;
  designation?: string;
  is_online?: boolean;
  last_seen?: string;
}

export interface Conversation {
  id: string;
  company_id: string;
  type: 'direct' | 'group';
  title?: string;
  description?: string;
  avatar_url?: string;
  created_by?: string;
  last_message_at: string;
  last_message_preview?: string;
  pinned_by: string[];
  unread_count?: number;
  participants: Participant[];
}

export interface Participant {
  id: string;
  conversation_id: string;
  user_id: string;
  role: 'admin' | 'member';
  last_read_at: string;
  is_muted: boolean;
  user?: UserColleague;
}

export interface ChatMessage {
  id: string;
  conversation_id: string;
  company_id: string;
  sender_id: string;
  sender_name?: string;
  content: string;
  type: 'text' | 'image' | 'file' | 'meeting' | 'call_log' | 'system';
  reply_to_id?: string;
  reply_to?: {
    id: string;
    sender_name: string;
    content: string;
  };
  is_pinned: boolean;
  is_edited: boolean;
  is_deleted: boolean;
  metadata: {
    meeting_id?: string;
    call_id?: string;
    call_type?: 'voice' | 'video';
    call_duration?: number;
    call_status?: 'connected' | 'missed' | 'rejected';
    attachments?: ChatAttachment[];
    [key: string]: any;
  };
  attachments?: ChatAttachment[];
  created_at: string;
  updated_at?: string;
  status?: 'sending' | 'sent' | 'delivered' | 'read';
}

export interface ChatAttachment {
  id: string;
  message_id: string;
  conversation_id: string;
  company_id: string;
  uploader_id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  file_url: string;
  storage_path?: string;
  folder_path: string;
  created_at: string;
}

export interface Meeting {
  id: string;
  company_id: string;
  conversation_id?: string;
  organizer_id: string;
  organizer_name?: string;
  title: string;
  description?: string;
  start_time: string;
  end_time: string;
  meeting_type: 'video' | 'voice' | 'in_person' | 'google_meet';
  location_or_link?: string;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  reminder_minutes: number[];
  participants: MeetingParticipant[];
  created_at: string;
  updated_at?: string;
}

export interface MeetingParticipant {
  user_id: string;
  full_name?: string;
  status: 'pending' | 'accepted' | 'declined';
  responded_at?: string;
}

export interface CallAuditItem {
  id: string;
  company_id: string;
  conversation_id: string;
  caller_id: string;
  type: 'voice' | 'video';
  status: string;
  started_at: string;
  ended_at?: string;
  duration_seconds: number;
  created_at: string;
  caller_name?: string;
  recipient_name?: string;
  recording_url?: string | null;
  recording_type?: string;
  transcript?: string;
  dialogue?: Array<{ speaker_name?: string; speaker?: string; text: string; time?: string; time_offset?: string }>;
}

export interface CallSession {
  id: string;
  company_id: string;
  conversation_id?: string;
  caller_id: string;
  caller_name?: string;
  caller_avatar?: string;
  recipient_id?: string;
  recipient_name?: string;
  recipient_avatar?: string;
  type: 'voice' | 'video';
  status: 'ringing' | 'connected' | 'ended' | 'rejected' | 'missed';
  started_at: string;
  ended_at?: string;
  duration_seconds: number;
  participants: string[];
}

export interface BiChatNotification {
  id: string;
  company_id: string;
  user_id: string;
  type: 'new_message' | 'incoming_call' | 'missed_call' | 'meeting_invite' | 'meeting_reminder' | 'meeting_update' | 'meeting_cancelled';
  title: string;
  body: string;
  link?: string;
  metadata?: Record<string, any>;
  is_read: boolean;
  created_at: string;
}
