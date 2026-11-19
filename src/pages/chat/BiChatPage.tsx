import { useState, useEffect, useCallback, useRef, Component, type ErrorInfo, type ReactNode } from 'react';
import {
  MessageSquare,
  Users,
  Video,
  Phone,
  Calendar,
  Bell,
  Clock,
  Sparkles,
  ChevronRight,
  ShieldCheck,
  AlertCircle,
  X,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import type {
  Conversation,
  ChatMessage,
  UserColleague,
  Meeting,
  CallSession,
} from './types';
import { chatService } from './services/chatService';
import { meetingReminderService } from './services/meetingReminderService';
import { playChime, playRingtone, stopRingtone, playEndCallTone } from './services/soundService';
import { ConversationList } from './components/ConversationList';
import { ChatWindow } from './components/ChatWindow';
import { InfoPanel } from './components/InfoPanel';
import { NewChatModal } from './components/NewChatModal';
import { NewGroupModal } from './components/NewGroupModal';
import { ScheduleMeetingModal } from './components/ScheduleMeetingModal';
import { MediaPreviewModal } from './components/MediaPreviewModal';
import { CallOverlay } from './components/CallOverlay';

class ChatErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('BI Chat caught error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-[calc(100vh-4.25rem)] bg-white text-slate-800 p-6 select-none">
          <div className="w-16 h-16 rounded-2xl bg-brand-500/20 text-brand-400 border border-brand-500/30 flex items-center justify-center mb-4 shadow-lg shadow-brand-500/10">
            <MessageSquare size={32} />
          </div>
          <h2 className="text-lg font-bold text-slate-800 mb-1">BI Chat · Initializing</h2>
          <p className="text-xs text-slate-500 max-w-sm text-center mb-4 leading-relaxed">
            {this.state.error?.message || 'Chat module encountered an unexpected issue while loading.'}
          </p>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.reload();
            }}
            className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-brand-600/30 cursor-pointer"
          >
            Reload Chat
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function BiChatPage() {
  return (
    <ChatErrorBoundary>
      <BiChatInner />
    </ChatErrorBoundary>
  );
}

function BiChatInner() {
  const { user, profile, company, companies } = useAuth();

  const currentUserId = profile?.id || user?.id || '';
  const currentUserName =
    profile?.full_name ||
    user?.user_metadata?.full_name ||
    user?.email?.split('@')[0] ||
    'Argus User';
  const companyId =
    company?.id ||
    profile?.company_id ||
    profile?.active_company_id ||
    (user as any)?.company_id ||
    companies?.[0]?.id ||
    '0255839c-a9b1-49a8-a9f6-e776fd7bdd00';
  const companyName = company?.company_name || (user as any)?.company_name || 'Argus Technologies';

  // State
  const [colleagues, setColleagues] = useState<UserColleague[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);

  // UI state
  const [showInfoPanel, setShowInfoPanel] = useState<boolean>(() => window.innerWidth >= 1280);
  const [mobileView, setMobileView] = useState<'list' | 'chat'>('list');

  // Modals
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
  const [isNewGroupOpen, setIsNewGroupOpen] = useState(false);
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [previewFile, setPreviewFile] = useState<{
    name: string;
    url: string;
    type: string;
    size?: number;
  } | null>(null);

  // Active voice/video call session
  const [activeCall, setActiveCall] = useState<CallSession | null>(null);

  // In-app meeting reminder banner
  const [meetingAlert, setMeetingAlert] = useState<{
    meeting: Meeting;
    offsetMinutes: number;
    time: string;
  } | null>(null);

  // 1. Initial Load: Colleagues and Conversations
  const loadInitialData = useCallback(async () => {
    if (!currentUserId) return;
    setLoadingConversations(true);
    try {
      const [colls, convs] = await Promise.all([
        chatService.getCompanyColleagues(companyId, currentUserId),
        chatService.getConversations(companyId, currentUserId),
      ]);
      setColleagues(colls);
      setConversations(convs);

      // Default select the first conversation if none selected and on desktop
      if (convs.length > 0 && !activeConversation && window.innerWidth >= 768) {
        setActiveConversation(convs[0]);
      }
    } catch (err) {
      console.error('Failed to load initial chat data:', err);
    } finally {
      setLoadingConversations(false);
    }
  }, [companyId, currentUserId]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // 2. Start Meeting Reminder Service & Listeners
  useEffect(() => {
    if (!currentUserId) return;
    meetingReminderService.start(companyId, currentUserId);

    const handleReminderEvent = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail && detail.meeting) {
        setMeetingAlert({
          meeting: detail.meeting,
          offsetMinutes: detail.offsetMinutes,
          time: detail.formattedTime,
        });
      }
    };

    window.addEventListener('argus:meeting-reminder', handleReminderEvent);

    return () => {
      meetingReminderService.stop();
      window.removeEventListener('argus:meeting-reminder', handleReminderEvent);
    };
  }, [companyId, currentUserId]);

  // 3. Load messages when active conversation changes
  useEffect(() => {
    if (!activeConversation) {
      setMessages([]);
      return;
    }

    let isMounted = true;
    setLoadingMessages(true);

    chatService
      .getMessages(activeConversation.id)
      .then((msgs) => {
        if (!isMounted) return;
        setMessages(msgs);
        setLoadingMessages(false);

        // Mark conversation as read
        chatService.markConversationAsRead(activeConversation.id, currentUserId);
        setConversations((prev) =>
          prev.map((c) => (c.id === activeConversation.id ? { ...c, unread_count: 0 } : c))
        );
      })
      .catch((err) => {
        console.error('Failed to load messages:', err);
        if (isMounted) setLoadingMessages(false);
      });

    // Real-time message subscription for this active conversation
    const unsubscribe = chatService.subscribeToConversation(
      activeConversation.id,
      (newMsg) => {
        setMessages((prev) => {
          if (prev.some((m) => m.id === newMsg.id)) return prev;
          return [...prev, newMsg];
        });

        // Update last message in conversation list
        setConversations((prev) =>
          prev.map((c) =>
            c.id === activeConversation.id
              ? {
                  ...c,
                  last_message: newMsg,
                  last_message_at: newMsg.created_at,
                  unread_count: 0,
                }
              : c
          )
        );
      },
      (updatedMsg) => {
        setMessages((prev) =>
          prev.map((m) => (m.id === updatedMsg.id ? updatedMsg : m))
        );
      }
    );

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [activeConversation?.id, currentUserId]);

  // 4. Company-Level Broadcast & User Signaling (Incoming Calls, Global New Messages)
  useEffect(() => {
    if (!currentUserId) return;

    const unsubEvents = chatService.subscribeToCompanyEvents(
      companyId,
      currentUserId,
      (event) => {
        if (event.type === 'INCOMING_CALL' || event.type === 'CANCEL_CALL') {
          // incoming calls ring through the app-wide CallHost (on every page), so nothing to do here
        } else if (event.type === 'NEW_MESSAGE' && event.message) {
          // If message is for another conversation, increment its unread count and play chime
          if (event.message.conversation_id !== activeConversation?.id) {
            playChime();
            setConversations((prev) =>
              prev.map((c) =>
                c.id === event.message.conversation_id
                  ? {
                      ...c,
                      last_message: event.message,
                      last_message_at: event.message.created_at,
                      unread_count: (c.unread_count || 0) + 1,
                    }
                  : c
              )
            );
          }
        }
      }
    );

    return () => {
      unsubEvents();
    };
  }, [companyId, currentUserId, activeConversation?.id]);

  // Handlers
  const handleSelectConversation = (conv: Conversation) => {
    setActiveConversation(conv);
    setMobileView('chat');
  };

  const handleSendMessage = async (params: {
    content: string;
    type?: 'text' | 'image' | 'file';
    replyTo?: { id: string; sender_name: string; content: string };
    attachments?: {
      file_name: string;
      file_type: string;
      file_size: number;
      file_url: string;
      folder_path?: string;
    }[];
  }) => {
    if (!activeConversation) return;

    try {
      const msg = await chatService.sendMessage({
        conversationId: activeConversation.id,
        companyId,
        senderId: currentUserId,
        senderName: currentUserName,
        content: params.content,
        type: params.type || 'text',
        replyTo: params.replyTo,
        attachments: params.attachments,
      });

      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });

      setConversations((prev) =>
        prev.map((c) =>
          c.id === activeConversation.id
            ? { ...c, last_message: msg, last_message_at: msg.created_at }
            : c
        )
      );
    } catch (err) {
      console.error('Failed to send message:', err);
    }
  };

  const handleEditMessage = async (messageId: string, newContent: string) => {
    try {
      await chatService.editMessage(messageId, currentUserId, newContent);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId ? { ...m, content: newContent, is_edited: true } : m
        )
      );
    } catch (err) {
      console.error('Failed to edit message:', err);
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    try {
      await chatService.deleteMessage(messageId, currentUserId);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? { ...m, is_deleted: true, content: 'This message was deleted' }
            : m
        )
      );
    } catch (err) {
      console.error('Failed to delete message:', err);
    }
  };

  const handleTogglePin = async (messageId: string, currentPin: boolean) => {
    if (!activeConversation) return;
    try {
      await chatService.togglePinMessage(activeConversation.id, messageId, currentPin);
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, is_pinned: !currentPin } : m))
      );
    } catch (err) {
      console.error('Failed to pin message:', err);
    }
  };

  // Start Voice or Video Call
  const handleStartCall = async (type: 'voice' | 'video') => {
    if (!activeConversation) return;

    // Recipient id: for direct chat, find other participant; for group, 'all'
    let recipientId = '';
    let recipientName = activeConversation.title || 'Colleague';
    let recipientAvatar = activeConversation.avatar_url;

    if (activeConversation.type === 'direct') {
      const otherPart = activeConversation.participants.find(
        (p) => p.user_id !== currentUserId
      );
      if (otherPart) {
        recipientId = otherPart.user_id;
        recipientName = otherPart.user?.full_name || recipientName;
      }
    } else {
      recipientId = 'all';
    }

    const effCompanyId =
      activeConversation.company_id ||
      companyId ||
      '0255839c-a9b1-49a8-a9f6-e776fd7bdd00';

    const session: CallSession = {
      id: `call_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      company_id: effCompanyId,
      conversation_id: activeConversation.id,
      caller_id: currentUserId,
      caller_name: currentUserName,
      caller_avatar: profile?.avatar_url || (user as any)?.user_metadata?.avatar_url,
      recipient_id: recipientId,
      recipient_name: recipientName,
      recipient_avatar: recipientAvatar,
      type,
      status: 'ringing',
      started_at: new Date().toISOString(),
      duration_seconds: 0,
      participants: recipientId && recipientId !== 'all' ? [currentUserId, recipientId] : [currentUserId],
    };

    setActiveCall(session);

    // CRITICAL: Broadcast incoming call so recipient immediately receives ringing modal and ringtone
    await chatService.broadcastIncomingCall(effCompanyId, session);
  };

  const handleEndCall = async (
    durationSeconds: number,
    status: 'connected' | 'missed' | 'rejected',
    auditData?: {
      recordingUrl?: string | null;
      recordingType?: string;
      transcriptText?: string;
      dialogue?: any[];
    }
  ) => {
    if (!activeCall) return;

    try {
      const effCompanyId =
        activeCall.company_id ||
        companyId ||
        '0255839c-a9b1-49a8-a9f6-e776fd7bdd00';

      // If caller hung up before connection, broadcast cancellation to dismiss recipient ringing popup
      if (activeCall.caller_id === currentUserId && status !== 'connected') {
        await chatService.broadcastCancelCall(effCompanyId, activeCall.id, activeCall.recipient_id);
      }

      await chatService.logCall({
        companyId: effCompanyId,
        conversationId: activeCall.conversation_id || '',
        callerId: activeCall.caller_id,
        callerName: activeCall.caller_name || '',
        recipientId: activeCall.recipient_id,
        recipientName: activeCall.recipient_name,
        callType: activeCall.type,
        status,
        durationSeconds,
        recordingUrl: auditData?.recordingUrl,
        recordingType: auditData?.recordingType,
        transcriptText: auditData?.transcriptText,
        dialogue: auditData?.dialogue,
      });

      // Reload messages in active conversation to reflect call log
      if (activeConversation && activeConversation.id === activeCall.conversation_id) {
        const msgs = await chatService.getMessages(activeConversation.id);
        setMessages(msgs);
      }
    } catch (err) {
      console.error('Failed to log call:', err);
    } finally {
      setActiveCall(null);
    }
  };

  // Schedule Meeting
  const handleScheduleMeeting = async (meetingData: {
    title: string;
    description: string;
    startTime: string;
    endTime: string;
    meetingType: 'video' | 'voice' | 'in_person';
    locationOrLink: string;
    participantUserIds: string[];
    reminderMinutes: number[];
  }) => {
    if (!activeConversation) return;

    try {
      await chatService.scheduleMeeting({
        companyId,
        conversationId: activeConversation.id,
        organizerId: currentUserId,
        organizerName: currentUserName,
        title: meetingData.title,
        description: meetingData.description,
        startTime: meetingData.startTime,
        endTime: meetingData.endTime,
        meetingType: meetingData.meetingType,
        locationOrLink: meetingData.locationOrLink,
        participantUserIds: meetingData.participantUserIds,
        reminderMinutes: meetingData.reminderMinutes,
      });

      // Reload messages to display the new meeting card
      const msgs = await chatService.getMessages(activeConversation.id);
      setMessages(msgs);
      setIsScheduleOpen(false);
    } catch (err) {
      console.error('Failed to schedule meeting:', err);
    }
  };

  const handleRespondMeeting = async (
    meetingId: string,
    status: 'accepted' | 'declined'
  ) => {
    try {
      await chatService.respondToMeeting(meetingId, currentUserId, status);
      if (activeConversation) {
        const msgs = await chatService.getMessages(activeConversation.id);
        setMessages(msgs);
      }
    } catch (err) {
      console.error('Failed to respond to meeting:', err);
    }
  };

  const handleCancelMeeting = async (meetingId: string) => {
    try {
      await chatService.cancelMeeting(meetingId, currentUserId);
      if (activeConversation) {
        const msgs = await chatService.getMessages(activeConversation.id);
        setMessages(msgs);
      }
    } catch (err) {
      console.error('Failed to cancel meeting:', err);
    }
  };

  const handleJoinMeeting = (meeting: Meeting) => {
    const link = meeting.location_or_link || '';
    if (link.startsWith('http://') || link.startsWith('https://')) {
      window.open(link, '_blank');
      return;
    }

    if (meeting.meeting_type === 'video' || meeting.meeting_type === 'voice') {
      const session: CallSession = {
        id: `mtg_call_${meeting.id}`,
        conversation_id: meeting.conversation_id,
        caller_id: currentUserId,
        caller_name: currentUserName,
        type: meeting.meeting_type,
        status: 'connected',
        created_at: new Date().toISOString(),
      };
      setActiveCall(session);
    }
  };

  // Direct chat creation from colleague directory
  const handleSelectColleague = async (colleague: UserColleague) => {
    setIsNewChatOpen(false);
    try {
      const conv = await chatService.getOrCreateDirectConversation(
        companyId,
        currentUserId,
        colleague.id
      );
      setConversations((prev) => {
        if (prev.some((c) => c.id === conv.id)) return prev;
        return [conv, ...prev];
      });
      setActiveConversation(conv);
      setMobileView('chat');
    } catch (err) {
      console.error('Failed to open direct conversation:', err);
    }
  };

  // Group chat creation
  const handleCreateGroup = async (
    title: string,
    description: string,
    memberIds: string[]
  ) => {
    setIsNewGroupOpen(false);
    try {
      const conv = await chatService.createGroupConversation(
        companyId,
        currentUserId,
        title,
        description,
        memberIds
      );
      setConversations((prev) => [conv, ...prev]);
      setActiveConversation(conv);
      setMobileView('chat');
    } catch (err) {
      console.error('Failed to create group conversation:', err);
    }
  };

  // Default participant IDs for meeting modal
  const defaultMeetingParticipantIds = activeConversation
    ? activeConversation.participants
        .map((p) => p.user_id)
        .filter((id) => id !== currentUserId)
    : [];

  return (
    <div className="flex flex-col h-[calc(100vh-4.25rem)] bg-white overflow-hidden select-none">
      {/* Top Banner / In-App Meeting Reminder Alert */}
      {meetingAlert && (
        <div className="bg-gradient-to-r from-orange-600 via-amber-600 to-orange-700 text-white px-4 py-2.5 flex items-center justify-between shadow-lg z-50 animate-slide-down shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
              <Clock size={18} className="animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider bg-white/25 px-1.5 py-0.5 rounded">
                  Meeting Reminder
                </span>
                <span className="text-sm font-bold truncate">
                  {meetingAlert.meeting.title}
                </span>
              </div>
              <p className="text-xs text-orange-100">
                {meetingAlert.offsetMinutes === 0
                  ? 'Starting right now!'
                  : `Starts in ${meetingAlert.offsetMinutes} minutes (${meetingAlert.time})`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                handleJoinMeeting(meetingAlert.meeting);
                setMeetingAlert(null);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-orange-700 hover:bg-orange-50 font-bold text-xs rounded-lg shadow-sm transition-colors cursor-pointer"
            >
              <Video size={14} />
              Join Call
            </button>
            <button
              onClick={() => setMeetingAlert(null)}
              className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Main 3-Section Chat Container */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Section: Conversation Directory */}
        <div
          className={`${
            mobileView === 'chat' ? 'hidden md:flex' : 'flex'
          } w-full md:w-[320px] lg:w-[360px] xl:w-[380px] shrink-0 border-r border-slate-800 bg-[#0c1427] z-20`}
        >
          <ConversationList
            conversations={conversations}
            activeConversationId={activeConversation?.id}
            currentUserId={currentUserId}
            colleagues={colleagues}
            companyName={companyName}
            onSelectConversation={handleSelectConversation}
            onSelectColleague={handleSelectColleague}
            onOpenNewChat={() => setIsNewChatOpen(true)}
            onOpenNewGroup={() => setIsNewGroupOpen(true)}
          />
        </div>

        {/* Center Section: Chat Thread & Input */}
        <div
          className={`${
            mobileView === 'list' ? 'hidden md:flex' : 'flex'
          } flex-1 flex flex-col bg-white min-w-0 z-10 overflow-hidden`}
        >
          {activeConversation ? (
            <ChatWindow
              conversation={activeConversation}
              messages={messages}
              currentUserId={currentUserId}
              currentUserName={currentUserName}
              colleagues={colleagues}
              onSendMessage={handleSendMessage}
              onEditMessage={handleEditMessage}
              onDeleteMessage={handleDeleteMessage}
              onTogglePin={handleTogglePin}
              onStartCall={handleStartCall}
              onOpenScheduleMeeting={() => setIsScheduleOpen(true)}
              onToggleInfoPanel={() => setShowInfoPanel((prev) => !prev)}
              onPreviewFile={(f) => setPreviewFile(f)}
              onRespondMeeting={handleRespondMeeting}
              onCancelMeeting={handleCancelMeeting}
              onJoinMeeting={handleJoinMeeting}
              onBackMobile={() => setMobileView('list')}
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-[#090f1e]">
              <div className="w-20 h-20 rounded-3xl bg-brand-50 border border-brand-200 flex items-center justify-center text-brand-600 mb-5 shadow-lg shadow-brand-500/10">
                <MessageSquare size={38} />
              </div>
              <h2 className="text-xl font-bold text-slate-800 mb-2">
                BI Chat · Company Communication
              </h2>
              <p className="text-sm text-slate-500 max-w-md leading-relaxed mb-6">
                Connect with company colleagues, share drawings and ERP documents, make
                HD voice/video calls, and schedule team meetings directly in Argus CNC.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <button
                  onClick={() => setIsNewChatOpen(true)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-semibold text-sm shadow-lg shadow-brand-600/30 transition-all cursor-pointer"
                >
                  <MessageSquare size={16} />
                  Start Direct Chat
                </button>
                <button
                  onClick={() => setIsNewGroupOpen(true)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 font-semibold text-sm border border-slate-300 shadow-xs transition-all cursor-pointer"
                >
                  <Users size={16} />
                  Create Team Group
                </button>
              </div>

              {/* Company Team Directory */}
              {colleagues.length > 0 && (
                <div className="w-full max-w-2xl mt-8 pt-6 border-t border-slate-200">
                  <div className="flex items-center justify-between mb-3 text-left">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                      <Users size={14} className="text-brand-500" />
                      Company Colleagues in {companyName} ({colleagues.length})
                    </h3>
                    <span className="text-[11px] text-slate-400">Tap to start conversation</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[340px] overflow-y-auto pr-1">
                    {colleagues.map((colleague) => {
                      const initials = (colleague.full_name || 'U')
                        .split(' ')
                        .map((n) => n[0])
                        .join('')
                        .slice(0, 2)
                        .toUpperCase();

                      return (
                        <div
                          key={colleague.id}
                          onClick={() => handleSelectColleague(colleague)}
                          className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 hover:bg-white border border-slate-200 hover:border-brand-500 hover:shadow-sm transition-all text-left cursor-pointer group shadow-sm"
                        >
                          <div className="relative shrink-0">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-brand-600 to-orange-500 text-white flex items-center justify-center text-xs font-bold shadow-md">
                              {initials}
                            </div>
                            <span
                              title={colleague.is_online ? 'Online' : 'Offline'}
                              className={`absolute bottom-0 right-0 w-3 h-3 rounded-full ring-2 ring-white ${
                                colleague.is_online ? 'bg-emerald-400' : 'bg-slate-500'
                              }`}
                            />
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-1 mb-0.5">
                              <h4 className="text-xs font-bold text-slate-800 group-hover:text-brand-600 transition-colors truncate">
                                {colleague.full_name}
                              </h4>
                              <span
                                className={`text-[9px] font-bold px-1.5 py-0.2 rounded shrink-0 ${
                                  colleague.role === 'SUPER_ADMIN'
                                    ? 'bg-purple-100 text-purple-700'
                                    : colleague.role === 'COMPANY_ADMIN'
                                    ? 'bg-amber-100 text-amber-700'
                                    : 'bg-slate-100 text-slate-600'
                                }`}
                              >
                                {colleague.role === 'SUPER_ADMIN'
                                  ? 'Super Admin'
                                  : colleague.role === 'COMPANY_ADMIN'
                                  ? 'Admin'
                                  : 'Staff'}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-400 truncate leading-tight">
                              {colleague.designation || colleague.email}
                            </p>
                          </div>

                          <MessageSquare size={14} className="text-slate-600 group-hover:text-brand-400 transition-colors shrink-0" />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Section: Collapsible Information Panel */}
        {showInfoPanel && activeConversation && (
          <div className="hidden lg:flex w-[320px] xl:w-[340px] shrink-0 border-l border-slate-200 bg-white z-20">
            <InfoPanel
              conversation={activeConversation}
              messages={messages}
              colleagues={colleagues}
              currentUserId={currentUserId}
              onClose={() => setShowInfoPanel(false)}
              onPreviewFile={(f) => setPreviewFile(f)}
              onStartCall={handleStartCall}
            />
          </div>
        )}
      </div>

      {/* Modals & Overlays */}
      <NewChatModal
        open={isNewChatOpen}
        colleagues={colleagues}
        onClose={() => setIsNewChatOpen(false)}
        onSelectColleague={handleSelectColleague}
      />

      <NewGroupModal
        open={isNewGroupOpen}
        colleagues={colleagues}
        onClose={() => setIsNewGroupOpen(false)}
        onCreateGroup={handleCreateGroup}
      />

      <ScheduleMeetingModal
        open={isScheduleOpen}
        colleagues={colleagues}
        defaultParticipantIds={defaultMeetingParticipantIds}
        onClose={() => setIsScheduleOpen(false)}
        onSchedule={handleScheduleMeeting}
      />

      <MediaPreviewModal
        file={previewFile}
        onClose={() => setPreviewFile(null)}
      />

      {activeCall && (
        <CallOverlay
          call={activeCall}
          currentUserId={currentUserId}
          currentUserName={currentUserName}
          onEndCall={handleEndCall}
        />
      )}
    </div>
  );
}
