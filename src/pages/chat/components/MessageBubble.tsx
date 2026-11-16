import { useState } from 'react';
import {
  Check,
  CheckCheck,
  Clock,
  Pin,
  Reply,
  Copy,
  Edit2,
  Trash2,
  Phone,
  Video,
  FileText,
  Download,
  Folder,
  MoreVertical,
  Forward,
} from 'lucide-react';
import type { ChatMessage, Meeting } from '../types';
import { MeetingCard } from './MeetingCard';

export function MessageBubble({
  message,
  isOwn,
  isGroup,
  currentUserId,
  onReply,
  onEdit,
  onDelete,
  onPin,
  onForward,
  onPreviewFile,
  onRespondMeeting,
  onCancelMeeting,
  onJoinMeeting,
}: {
  message: ChatMessage;
  isOwn: boolean;
  isGroup?: boolean;
  currentUserId: string;
  onReply?: (msg: ChatMessage) => void;
  onEdit?: (msg: ChatMessage) => void;
  onDelete?: (msg: ChatMessage) => void;
  onPin?: (msg: ChatMessage) => void;
  onForward?: (msg: ChatMessage) => void;
  onPreviewFile?: (file: { name: string; url: string; type: string; size?: number }) => void;
  onRespondMeeting?: (meetingId: string, status: 'accepted' | 'declined') => void;
  onCancelMeeting?: (meetingId: string) => void;
  onJoinMeeting?: (meeting: Meeting) => void;
}) {
  const [showMenu, setShowMenu] = useState(false);

  const formattedTime = new Date(message.created_at).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  // Call log message rendering
  if (message.type === 'call_log') {
    const isMissed = message.metadata?.call_status === 'missed';
    const isVideo = message.metadata?.call_type === 'video';
    const CallIcon = isVideo ? Video : Phone;

    return (
      <div className="flex justify-center my-2">
        <div
          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold shadow-2xs border ${
            isMissed ? 'bg-red-50 text-red-700 border-red-200' : 'bg-slate-100 text-slate-700 border-slate-200'
          }`}
        >
          <CallIcon size={14} className={isMissed ? 'text-red-500' : 'text-slate-500'} />
          <span>{message.content}</span>
          <span className="text-[10px] text-slate-400 font-normal ml-1">{formattedTime}</span>
        </div>
      </div>
    );
  }

  // System notification
  if (message.type === 'system') {
    return (
      <div className="flex justify-center my-2">
        <span className="px-3 py-1 rounded-full text-[11px] font-medium bg-slate-100 text-slate-500 border border-slate-200/80">
          {message.content} · {formattedTime}
        </span>
      </div>
    );
  }

  // Meeting card message
  if (message.type === 'meeting' && message.metadata?.meeting) {
    const meeting: Meeting = message.metadata.meeting;
    return (
      <div className={`flex flex-col my-2 ${isOwn ? 'items-end' : 'items-start'}`}>
        {!isOwn && isGroup && message.sender_name && (
          <span className="text-[11px] font-bold text-slate-500 mb-1 ml-1">{message.sender_name}</span>
        )}
        <MeetingCard
          meeting={meeting}
          currentUserId={currentUserId}
          onRespond={(status) => onRespondMeeting?.(meeting.id, status)}
          onCancel={() => onCancelMeeting?.(meeting.id)}
          onJoinMeeting={onJoinMeeting}
        />
        <span className="text-[10px] text-slate-400 mt-1 px-1">{formattedTime}</span>
      </div>
    );
  }

  const handleCopy = () => {
    void navigator.clipboard.writeText(message.content);
    setShowMenu(false);
  };

  return (
    <div className={`group flex flex-col my-1 relative ${isOwn ? 'items-end' : 'items-start'}`}>
      {/* Sender name for group chats */}
      {!isOwn && isGroup && message.sender_name && (
        <span className="text-[11px] font-bold text-slate-500 mb-0.5 ml-2">{message.sender_name}</span>
      )}

      {/* Main bubble */}
      <div className="relative max-w-[85%] sm:max-w-[70%]">
        {/* Pinned badge */}
        {message.is_pinned && (
          <div className={`flex items-center gap-1 text-[10px] font-bold mb-0.5 text-amber-600 ${isOwn ? 'justify-end' : 'justify-start'}`}>
            <Pin size={10} className="fill-amber-500 text-amber-600" /> Pinned message
          </div>
        )}

        <div
          className={`rounded-2xl px-3.5 py-2 shadow-xs transition-shadow relative ${
            isOwn
              ? 'bg-gradient-to-r from-brand-600 to-orange-600 text-white rounded-tr-xs'
              : 'bg-white text-slate-800 border border-slate-200/90 rounded-tl-xs'
          }`}
        >
          {/* Reply Quote preview */}
          {message.reply_to && (
            <div
              className={`mb-1.5 px-2.5 py-1 rounded-lg border-l-3 text-xs ${
                isOwn ? 'bg-black/15 border-white/60 text-white/90' : 'bg-slate-100 border-brand-500 text-slate-700'
              }`}
            >
              <p className="font-bold text-[10px] leading-tight truncate">{message.reply_to.sender_name}</p>
              <p className="text-[11px] leading-tight truncate opacity-85">{message.reply_to.content}</p>
            </div>
          )}

          {/* Attachments rendering */}
          {message.attachments && message.attachments.length > 0 && (
            <div className="space-y-1.5 mb-1.5">
              {message.attachments.map((att) => {
                const isImage = att.file_type.startsWith('image/');
                return (
                  <div key={att.id} className="overflow-hidden rounded-xl">
                    {isImage ? (
                      <div
                        onClick={() => onPreviewFile?.({ name: att.file_name, url: att.file_url, type: att.file_type, size: att.file_size })}
                        className="cursor-pointer overflow-hidden rounded-lg bg-black/10 hover:opacity-95 transition-opacity"
                      >
                        <img src={att.file_url} alt={att.file_name} className="max-h-60 w-full object-cover rounded-lg" />
                      </div>
                    ) : (
                      <div
                        className={`flex items-center justify-between gap-3 p-2.5 rounded-lg border text-xs ${
                          isOwn ? 'bg-black/20 border-white/20 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
                        }`}
                      >
                        <div
                          className="flex items-center gap-2 min-w-0 cursor-pointer"
                          onClick={() => onPreviewFile?.({ name: att.file_name, url: att.file_url, type: att.file_type, size: att.file_size })}
                        >
                          <div className={`p-1.5 rounded-md ${isOwn ? 'bg-white/20' : 'bg-brand-50 text-brand-600'}`}>
                            {att.folder_path && att.folder_path !== '/' ? <Folder size={16} /> : <FileText size={16} />}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold truncate text-xs">{att.file_name}</p>
                            <span className="text-[10px] opacity-75">{formatBytes(att.file_size)}</span>
                          </div>
                        </div>
                        <a
                          href={att.file_url}
                          download={att.file_name}
                          target="_blank"
                          rel="noreferrer"
                          className={`p-1.5 rounded-md hover:bg-white/20 transition-colors shrink-0 ${isOwn ? 'text-white' : 'text-slate-500 hover:text-brand-600'}`}
                          title="Download"
                        >
                          <Download size={14} />
                        </a>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Text Content */}
          {message.content && (
            <p className="text-[13px] leading-relaxed whitespace-pre-wrap break-words select-text font-normal">
              {message.content}
            </p>
          )}

          {/* Footer: timestamp, edited, read status */}
          <div className={`flex items-center justify-end gap-1 mt-1 text-[10px] ${isOwn ? 'text-white/80' : 'text-slate-400'}`}>
            {message.is_edited && <span className="italic mr-0.5">(edited)</span>}
            <span>{formattedTime}</span>
            {isOwn && (
              <span className="ml-0.5">
                {message.status === 'sending' ? (
                  <Clock size={12} className="animate-spin text-white/70" />
                ) : message.status === 'read' ? (
                  <CheckCheck size={13} className="text-sky-300" />
                ) : message.status === 'delivered' ? (
                  <CheckCheck size={13} className="text-white/80" />
                ) : (
                  <Check size={13} className="text-white/80" />
                )}
              </span>
            )}
          </div>
        </div>

        {/* Hover / Context Actions Menu Trigger */}
        <div
          className={`absolute top-1 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 z-10 ${
            isOwn ? '-left-16' : '-right-16'
          }`}
        >
          <button
            type="button"
            onClick={() => onReply?.(message)}
            title="Reply"
            className="p-1 rounded-md bg-white border border-slate-200 text-slate-500 hover:text-brand-600 hover:bg-slate-50 shadow-xs transition-colors"
          >
            <Reply size={13} />
          </button>
          <button
            type="button"
            onClick={() => setShowMenu(!showMenu)}
            title="More actions"
            className="p-1 rounded-md bg-white border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50 shadow-xs transition-colors"
          >
            <MoreVertical size={13} />
          </button>
        </div>

        {/* Dropdown Menu */}
        {showMenu && (
          <div
            className={`absolute top-8 z-30 w-36 bg-white border border-slate-200 rounded-xl shadow-xl py-1 text-xs text-slate-700 animate-scale-in ${
              isOwn ? 'right-0' : 'left-0'
            }`}
          >
            <button
              onClick={() => {
                setShowMenu(false);
                onReply?.(message);
              }}
              className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-slate-50 transition-colors text-left"
            >
              <Reply size={13} className="text-slate-400" /> Reply
            </button>
            <button
              onClick={handleCopy}
              className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-slate-50 transition-colors text-left"
            >
              <Copy size={13} className="text-slate-400" /> Copy
            </button>
            <button
              onClick={() => {
                setShowMenu(false);
                onPin?.(message);
              }}
              className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-slate-50 transition-colors text-left"
            >
              <Pin size={13} className="text-slate-400" /> {message.is_pinned ? 'Unpin' : 'Pin'}
            </button>
            {onForward && (
              <button
                onClick={() => {
                  setShowMenu(false);
                  onForward(message);
                }}
                className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-slate-50 transition-colors text-left"
              >
                <Forward size={13} className="text-slate-400" /> Forward
              </button>
            )}
            {isOwn && onEdit && !message.is_deleted && (
              <button
                onClick={() => {
                  setShowMenu(false);
                  onEdit(message);
                }}
                className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-slate-50 transition-colors text-left"
              >
                <Edit2 size={13} className="text-slate-400" /> Edit
              </button>
            )}
            {isOwn && onDelete && !message.is_deleted && (
              <button
                onClick={() => {
                  setShowMenu(false);
                  onDelete(message);
                }}
                className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-red-50 text-red-600 transition-colors text-left border-t border-slate-100"
              >
                <Trash2 size={13} className="text-red-500" /> Delete
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
