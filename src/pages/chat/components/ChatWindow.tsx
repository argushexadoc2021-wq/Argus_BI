import { useState, useRef, useEffect, useMemo } from 'react';
import {
  Phone,
  Video,
  Info,
  Paperclip,
  Smile,
  Send,
  Pin,
  X,
  FileText,
  Folder,
  Calendar,
  Image as ImageIcon,
  ArrowDown,
  ChevronLeft,
  Search,
} from 'lucide-react';
import type { Conversation, ChatMessage, UserColleague, Meeting } from '../types';
import { MessageBubble } from './MessageBubble';

const EMOJI_LIST = ['👍', '❤️', '😊', '🎉', '🔥', '👏', '✅', '🙏', '💯', '🚀', '💡', '⚠️', '👀', '🤝', '⚙️', '🏭'];

export function ChatWindow({
  conversation,
  messages,
  currentUserId,
  currentUserName,
  colleagues,
  onSendMessage,
  onEditMessage,
  onDeleteMessage,
  onTogglePin,
  onStartCall,
  onOpenScheduleMeeting,
  onToggleInfoPanel,
  onPreviewFile,
  onRespondMeeting,
  onCancelMeeting,
  onJoinMeeting,
  onBackMobile,
}: {
  conversation: Conversation;
  messages: ChatMessage[];
  currentUserId: string;
  currentUserName: string;
  colleagues: UserColleague[];
  onSendMessage: (params: {
    content: string;
    type?: 'text' | 'image' | 'file';
    replyTo?: { id: string; sender_name: string; content: string };
    attachments?: { file_name: string; file_type: string; file_size: number; file_url: string; folder_path?: string }[];
  }) => void;
  onEditMessage: (messageId: string, newContent: string) => void;
  onDeleteMessage: (messageId: string) => void;
  onTogglePin: (messageId: string, currentPin: boolean) => void;
  onStartCall: (type: 'voice' | 'video') => void;
  onOpenScheduleMeeting: () => void;
  onToggleInfoPanel: () => void;
  onPreviewFile: (file: { name: string; url: string; type: string; size?: number }) => void;
  onRespondMeeting: (meetingId: string, status: 'accepted' | 'declined') => void;
  onCancelMeeting: (meetingId: string) => void;
  onJoinMeeting: (meeting: Meeting) => void;
  onBackMobile?: () => void;
}) {
  const [inputText, setInputText] = useState('');
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [editingMessage, setEditingMessage] = useState<ChatMessage | null>(null);
  const [searchInChat, setSearchInChat] = useState('');
  const [showSearchBar, setShowSearchBar] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const isGroup = conversation.type === 'group';

  // Identify colleague for direct chat
  const otherPart = conversation.participants.find((p) => p.user_id !== currentUserId);
  const otherColleague = otherPart ? colleagues.find((c) => c.id === otherPart.user_id) : undefined;

  const title = isGroup ? conversation.title || 'Group' : otherColleague?.full_name || otherPart?.user?.full_name || 'Colleague';
  const subtitle = isGroup
    ? `${conversation.participants.length} members`
    : otherColleague?.is_online
    ? 'Online'
    : otherColleague?.last_seen
    ? `Last seen ${new Date(otherColleague.last_seen).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`
    : otherColleague?.designation || 'Offline';

  const isOnline = !isGroup && otherColleague?.is_online;

  const initials = title
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // Pinned messages list
  const pinnedMessages = useMemo(() => {
    return messages.filter((m) => m.is_pinned && !m.is_deleted);
  }, [messages]);

  // Filter messages if search query is active
  const displayedMessages = useMemo(() => {
    if (!searchInChat.trim()) return messages;
    const q = searchInChat.toLowerCase();
    return messages.filter(
      (m) =>
        m.content.toLowerCase().includes(q) ||
        m.sender_name?.toLowerCase().includes(q) ||
        m.attachments?.some((a) => a.file_name.toLowerCase().includes(q))
    );
  }, [messages, searchInChat]);

  const handleSend = () => {
    const text = inputText.trim();
    if (!text && !editingMessage) return;

    if (editingMessage) {
      onEditMessage(editingMessage.id, text);
      setEditingMessage(null);
      setInputText('');
      return;
    }

    onSendMessage({
      content: text,
      replyTo: replyingTo
        ? {
            id: replyingTo.id,
            sender_name: replyingTo.sender_name || 'Colleague',
            content: replyingTo.content.slice(0, 80),
          }
        : undefined,
    });

    setInputText('');
    setReplyingTo(null);
    setShowEmojiPicker(false);
    setShowAttachMenu(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, folderPath = '/') => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        const url = reader.result as string;
        onSendMessage({
          content: '',
          type: file.type.startsWith('image/') ? 'image' : 'file',
          attachments: [
            {
              file_name: file.name,
              file_type: file.type || 'application/octet-stream',
              file_size: file.size,
              file_url: url,
              folder_path: folderPath,
            },
          ],
        });
      };
      reader.readAsDataURL(file);
    });

    e.target.value = '';
    setShowAttachMenu(false);
  };

  const handleStartEdit = (msg: ChatMessage) => {
    setEditingMessage(msg);
    setInputText(msg.content);
    inputRef.current?.focus();
  };

  return (
    <div className="flex flex-col h-full bg-white relative overflow-hidden">
      {/* Top Header */}
      <div className="px-4 py-2.5 bg-white border-b border-slate-200 flex items-center justify-between shadow-xs z-10 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          {/* Back button for mobile */}
          {onBackMobile && (
            <button
              onClick={onBackMobile}
              className="p-1 -ml-1 text-slate-500 hover:text-slate-800 lg:hidden"
            >
              <ChevronLeft size={20} />
            </button>
          )}

          {/* Avatar */}
          <div className="relative shrink-0">
            <div
              className={`w-10 h-10 rounded-full text-white flex items-center justify-center text-xs font-bold shadow-xs ${
                isGroup
                  ? 'bg-gradient-to-tr from-navy-800 to-slate-700'
                  : 'bg-gradient-to-tr from-brand-600 to-orange-500'
              }`}
            >
              {isGroup ? <Users size={17} /> : initials}
            </div>
            {isOnline && (
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />
            )}
          </div>

          <div className="min-w-0">
            <h3 className="text-xs font-bold text-slate-800 truncate leading-tight">{title}</h3>
            <p className="text-[11px] text-slate-400 font-medium truncate mt-0.5">{subtitle}</p>
          </div>
        </div>

        {/* Right Header Actions */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => onStartCall('voice')}
            title="Start Voice Call"
            className="p-2 rounded-lg text-slate-600 hover:text-brand-600 hover:bg-orange-50 border border-slate-200 transition-colors"
          >
            <Phone size={15} />
          </button>
          <button
            type="button"
            onClick={() => onStartCall('video')}
            title="Start Video Call"
            className="p-2 rounded-lg text-slate-600 hover:text-brand-600 hover:bg-orange-50 border border-slate-200 transition-colors cursor-pointer"
          >
            <Video size={15} />
          </button>
          <button
            type="button"
            onClick={onOpenScheduleMeeting}
            title="Schedule Meeting / Share Google Meet"
            className="p-2 rounded-lg text-slate-600 hover:text-orange-600 hover:bg-orange-50 border border-slate-200 transition-colors cursor-pointer"
          >
            <Calendar size={15} />
          </button>
          <button
            type="button"
            onClick={() => setShowSearchBar(!showSearchBar)}
            title="Search in conversation"
            className={`p-2 rounded-lg border transition-colors ${
              showSearchBar
                ? 'bg-orange-50 border-brand-500 text-brand-600'
                : 'text-slate-600 hover:text-brand-600 hover:bg-orange-50 border-slate-200'
            }`}
          >
            <Search size={15} />
          </button>
          <button
            type="button"
            onClick={onToggleInfoPanel}
            title="Contact & Media Info"
            className="p-2 rounded-lg text-slate-600 hover:text-brand-600 hover:bg-orange-50 border border-slate-200 transition-colors"
          >
            <Info size={15} />
          </button>
        </div>
      </div>

      {/* In-chat search bar */}
      {showSearchBar && (
        <div className="p-2 bg-white border-b border-slate-200 flex items-center gap-2 animate-fade-in shadow-2xs">
          <Search size={14} className="text-slate-400 shrink-0 ml-1" />
          <input
            type="text"
            autoFocus
            value={searchInChat}
            onChange={(e) => setSearchInChat(e.target.value)}
            placeholder="Type to find messages or attachments in this conversation..."
            className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 focus:outline-none focus:border-brand-500"
          />
          {searchInChat && (
            <span className="text-[10px] text-slate-400 font-bold shrink-0">
              {displayedMessages.length} found
            </span>
          )}
          <button
            onClick={() => { setSearchInChat(''); setShowSearchBar(false); }}
            className="p-1 text-slate-400 hover:text-slate-700"
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* Pinned Messages Header Strip */}
      {pinnedMessages.length > 0 && (
        <div className="px-4 py-1.5 bg-amber-50/80 border-b border-amber-200/60 flex items-center justify-between text-xs text-amber-900 shrink-0">
          <div className="flex items-center gap-2 truncate">
            <Pin size={12} className="fill-amber-500 text-amber-600 shrink-0" />
            <span className="font-bold text-[11px] shrink-0">Pinned ({pinnedMessages.length}):</span>
            <span className="truncate text-[11px] text-amber-800 opacity-90">
              {pinnedMessages[pinnedMessages.length - 1].content || 'Attachment'}
            </span>
          </div>
          <button
            onClick={() => onTogglePin(pinnedMessages[pinnedMessages.length - 1].id, true)}
            title="Unpin message"
            className="text-[10px] text-amber-700 hover:underline font-bold shrink-0 ml-2"
          >
            Unpin
          </button>
        </div>
      )}

      {/* Message History Stream */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1.5 bg-[#f8fafc]">
        {displayedMessages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-400">
            <div className="w-14 h-14 rounded-2xl bg-orange-50 border border-orange-200 text-brand-600 flex items-center justify-center mb-3 shadow-xs">
              <Calendar size={28} />
            </div>
            <h4 className="text-sm font-bold text-slate-700">No messages yet</h4>
            <p className="text-xs text-slate-400 mt-1 max-w-xs">
              Say hello, share production drawings, or schedule a team review meeting below.
            </p>
          </div>
        ) : (
          displayedMessages.map((msg, index) => {
            const isOwn = msg.sender_id === currentUserId;

            // Date separator
            const msgDate = new Date(msg.created_at).toDateString();
            const prevMsgDate = index > 0 ? new Date(displayedMessages[index - 1].created_at).toDateString() : null;
            const showDateHeader = msgDate !== prevMsgDate;

            return (
              <div key={msg.id}>
                {showDateHeader && (
                  <div className="flex items-center justify-center my-3">
                    <span className="px-3 py-0.5 rounded-full text-[10px] font-bold bg-slate-200/70 text-slate-600 border border-slate-300/40 uppercase tracking-wider">
                      {formatDateHeader(new Date(msg.created_at))}
                    </span>
                  </div>
                )}
                <MessageBubble
                  message={msg}
                  isOwn={isOwn}
                  isGroup={isGroup}
                  currentUserId={currentUserId}
                  onReply={(m) => setReplyingTo(m)}
                  onEdit={handleStartEdit}
                  onDelete={(m) => onDeleteMessage(m.id)}
                  onPin={(m) => onTogglePin(m.id, m.is_pinned)}
                  onPreviewFile={onPreviewFile}
                  onRespondMeeting={onRespondMeeting}
                  onCancelMeeting={onCancelMeeting}
                  onJoinMeeting={onJoinMeeting}
                />
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Reply Banner */}
      {replyingTo && (
        <div className="px-4 py-2 bg-slate-100 border-t border-slate-200 flex items-center justify-between text-xs animate-slide-up shrink-0">
          <div className="flex items-center gap-2 truncate border-l-3 border-brand-600 pl-2">
            <div className="truncate">
              <span className="font-bold text-[11px] text-brand-700 block truncate">
                Replying to {replyingTo.sender_name || 'Colleague'}
              </span>
              <span className="text-[11px] text-slate-500 truncate block">
                {replyingTo.content || 'Attachment'}
              </span>
            </div>
          </div>
          <button
            onClick={() => setReplyingTo(null)}
            className="p-1 rounded-md text-slate-400 hover:text-slate-700"
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* Editing Banner */}
      {editingMessage && (
        <div className="px-4 py-2 bg-orange-50 border-t border-orange-200 flex items-center justify-between text-xs shrink-0">
          <span className="font-bold text-orange-800 text-xs">Editing Message</span>
          <button
            onClick={() => { setEditingMessage(null); setInputText(''); }}
            className="p-1 text-orange-600 hover:text-orange-900"
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* Attachment Menu Popup */}
      {showAttachMenu && (
        <div className="absolute bottom-16 left-4 z-30 bg-white border border-slate-200 rounded-2xl shadow-xl p-2 w-56 animate-scale-in">
          <button
            type="button"
            onClick={() => imageInputRef.current?.click()}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-orange-50 hover:text-brand-600 rounded-xl transition-colors text-left"
          >
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <ImageIcon size={15} />
            </div>
            <span>Photos & Images</span>
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-orange-50 hover:text-brand-600 rounded-xl transition-colors text-left"
          >
            <div className="w-7 h-7 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">
              <FileText size={15} />
            </div>
            <span>Documents (PDF, Excel, Docs)</span>
          </button>

          <button
            type="button"
            onClick={() => folderInputRef.current?.click()}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-orange-50 hover:text-brand-600 rounded-xl transition-colors text-left"
          >
            <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              <Folder size={15} />
            </div>
            <span>Share Folder / Drawing Set</span>
          </button>

          <div className="my-1 border-t border-slate-100" />

          <button
            type="button"
            onClick={() => {
              setShowAttachMenu(false);
              onOpenScheduleMeeting();
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-brand-700 hover:bg-orange-50 rounded-xl transition-colors text-left"
          >
            <div className="w-7 h-7 rounded-lg bg-brand-500/20 text-brand-600 flex items-center justify-center shrink-0">
              <Calendar size={15} />
            </div>
            <span>Schedule Meeting...</span>
          </button>
        </div>
      )}

      {/* Emoji Picker Popup */}
      {showEmojiPicker && (
        <div className="absolute bottom-16 left-12 z-30 bg-white border border-slate-200 rounded-2xl shadow-xl p-2.5 w-64 animate-scale-in">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 px-1">Quick Reactions</p>
          <div className="grid grid-cols-8 gap-1">
            {EMOJI_LIST.map((em) => (
              <button
                key={em}
                type="button"
                onClick={() => {
                  setInputText((t) => t + em);
                  inputRef.current?.focus();
                }}
                className="w-7 h-7 flex items-center justify-center text-lg hover:bg-slate-100 rounded-lg transition-transform hover:scale-125"
              >
                {em}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => handleFileUpload(e, '/Documents')}
      />
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => handleFileUpload(e, '/Images')}
      />
      <input
        ref={folderInputRef}
        type="file"
        {...({ webkitdirectory: '', directory: '' } as any)}
        multiple
        className="hidden"
        onChange={(e) => handleFileUpload(e, '/Project_Folder')}
      />

      {/* Input Bar */}
      <div className="p-3 bg-white border-t border-slate-200 shrink-0">
        <div className="flex items-end gap-2 bg-slate-50 border border-slate-200 rounded-2xl p-1.5 focus-within:border-brand-500 focus-within:bg-white transition-colors shadow-2xs">
          {/* Attach Button (+) */}
          <button
            type="button"
            onClick={() => setShowAttachMenu(!showAttachMenu)}
            title="Attach files, folders or schedule meeting"
            className={`p-2 rounded-xl transition-colors shrink-0 ${
              showAttachMenu
                ? 'bg-orange-100 text-brand-700'
                : 'text-slate-500 hover:text-brand-600 hover:bg-slate-200/60'
            }`}
          >
            <Paperclip size={17} />
          </button>

          {/* Emoji button */}
          <button
            type="button"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            title="Emojis"
            className={`p-2 rounded-xl transition-colors shrink-0 ${
              showEmojiPicker
                ? 'bg-orange-100 text-brand-700'
                : 'text-slate-500 hover:text-brand-600 hover:bg-slate-200/60'
            }`}
          >
            <Smile size={17} />
          </button>

          {/* Text input textarea */}
          <textarea
            ref={inputRef}
            rows={1}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={editingMessage ? 'Update message...' : 'Type a message... (Press Enter to send, Shift+Enter for newline)'}
            className="flex-1 max-h-32 min-h-[38px] text-xs font-normal py-2 px-1 bg-transparent focus:outline-none resize-none leading-relaxed text-slate-800 placeholder-slate-400"
          />

          {/* Send Button */}
          <button
            type="button"
            onClick={handleSend}
            disabled={!inputText.trim()}
            title="Send Message"
            className={`p-2.5 rounded-xl transition-all shrink-0 ${
              inputText.trim()
                ? 'bg-brand-600 hover:bg-brand-700 text-white shadow-md shadow-brand-500/30'
                : 'text-slate-300 bg-slate-100 cursor-not-allowed'
            }`}
          >
            <Send size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}

function formatDateHeader(date: Date): string {
  const now = new Date();
  if (date.toDateString() === now.toDateString()) return 'Today';
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}
