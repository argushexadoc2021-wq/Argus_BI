import { useState, useMemo } from 'react';
import {
  X,
  User,
  Users,
  Image,
  FileText,
  Folder,
  Calendar,
  Download,
  Mail,
  Phone,
  Building2,
  CalendarPlus,
  Video,
} from 'lucide-react';
import type { Conversation, ChatMessage, UserColleague, Meeting } from '../types';
import { downloadMeetingIcs } from '../services/icsGenerator';

export function InfoPanel({
  conversation,
  messages,
  colleagues,
  currentUserId,
  onClose,
  onPreviewFile,
  onStartCall,
}: {
  conversation: Conversation;
  messages: ChatMessage[];
  colleagues: UserColleague[];
  currentUserId: string;
  onClose: () => void;
  onPreviewFile: (file: { name: string; url: string; type: string; size?: number }) => void;
  onStartCall?: (type: 'voice' | 'video') => void;
}) {
  const [activeTab, setActiveTab] = useState<'info' | 'media' | 'docs' | 'folders' | 'meetings'>('info');

  const isGroup = conversation.type === 'group';

  // Identify colleague for direct chat
  const otherPart = conversation.participants.find((p) => p.user_id !== currentUserId);
  const otherColleague = otherPart ? colleagues.find((c) => c.id === otherPart.user_id) : undefined;

  const title = isGroup ? conversation.title || 'Group' : otherColleague?.full_name || otherPart?.user?.full_name || 'Colleague';
  const designation = isGroup ? `${conversation.participants.length} members` : otherColleague?.designation || otherColleague?.role || 'Staff';

  // Extract shared media and documents from messages
  const allAttachments = useMemo(() => {
    const list: any[] = [];
    messages.forEach((m) => {
      if (m.attachments && m.attachments.length > 0) {
        m.attachments.forEach((att) => {
          list.push({ ...att, sender_name: m.sender_name, message_date: m.created_at });
        });
      }
    });
    return list;
  }, [messages]);

  const mediaFiles = useMemo(() => {
    return allAttachments.filter((a) => a.file_type.startsWith('image/'));
  }, [allAttachments]);

  const docFiles = useMemo(() => {
    return allAttachments.filter((a) => !a.file_type.startsWith('image/'));
  }, [allAttachments]);

  // Grouped folders
  const folderGroups = useMemo(() => {
    const groups: Record<string, any[]> = {};
    allAttachments.forEach((a) => {
      const folder = a.folder_path && a.folder_path !== '/' ? a.folder_path : 'General Files';
      if (!groups[folder]) groups[folder] = [];
      groups[folder].push(a);
    });
    return groups;
  }, [allAttachments]);

  // Extract meetings from messages
  const meetingList = useMemo(() => {
    const meets: Meeting[] = [];
    messages.forEach((m) => {
      if (m.type === 'meeting' && m.metadata?.meeting) {
        meets.push(m.metadata.meeting);
      }
    });
    return meets.sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime());
  }, [messages]);

  const initials = title
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="w-80 h-full bg-white border-l border-slate-200 flex flex-col overflow-hidden select-none">
      {/* Header */}
      <div className="p-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
          {isGroup ? 'Group Information' : 'Contact Details'}
        </h3>
        <button
          onClick={onClose}
          className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      {/* Main Profile Header */}
      <div className="p-5 flex flex-col items-center text-center border-b border-slate-100 bg-gradient-to-b from-slate-50/40 to-white">
        <div
          className={`w-16 h-16 rounded-full text-white flex items-center justify-center text-lg font-bold shadow-md mb-2.5 ${
            isGroup ? 'bg-gradient-to-tr from-navy-900 to-slate-800' : 'bg-gradient-to-tr from-brand-600 to-orange-500'
          }`}
        >
          {isGroup ? <Users size={28} /> : initials}
        </div>
        <h4 className="text-sm font-bold text-slate-900 leading-tight">{title}</h4>
        <p className="text-xs text-brand-600 font-semibold mt-0.5">{designation}</p>

        {/* Quick action buttons for direct chat */}
        {!isGroup && onStartCall && (
          <div className="flex items-center gap-2 mt-3 w-full justify-center">
            <button
              onClick={() => onStartCall('voice')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-orange-50 text-slate-700 hover:text-brand-600 rounded-lg text-xs font-semibold border border-slate-200 transition-colors"
            >
              <Phone size={13} /> Call
            </button>
            <button
              onClick={() => onStartCall('video')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
            >
              <Video size={13} /> Video
            </button>
          </div>
        )}
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-100 text-[11px] font-bold bg-slate-50/50">
        {[
          { id: 'info', label: 'Overview' },
          { id: 'media', label: `Media (${mediaFiles.length})` },
          { id: 'docs', label: `Docs (${docFiles.length})` },
          { id: 'folders', label: 'Folders' },
          { id: 'meetings', label: `Meets (${meetingList.length})` },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex-1 py-2 text-center border-b-2 transition-colors truncate px-1 ${
              activeTab === tab.id
                ? 'border-brand-600 text-brand-600 bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Contents */}
      <div className="flex-1 overflow-y-auto p-3 text-xs">
        {/* OVERVIEW TAB */}
        {activeTab === 'info' && (
          <div className="space-y-4">
            {/* Contact Info or Description */}
            {!isGroup ? (
              <div className="space-y-2.5">
                <div className="flex items-start gap-2.5 p-2 rounded-lg bg-slate-50">
                  <Mail size={15} className="text-slate-400 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[10px] text-slate-400 font-bold uppercase">Email Address</p>
                    <p className="text-xs text-slate-700 font-medium truncate">{otherColleague?.email || 'N/A'}</p>
                  </div>
                </div>

                {otherColleague?.mobile && (
                  <div className="flex items-start gap-2.5 p-2 rounded-lg bg-slate-50">
                    <Phone size={15} className="text-slate-400 mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[10px] text-slate-400 font-bold uppercase">Mobile Number</p>
                      <p className="text-xs text-slate-700 font-medium">{otherColleague.mobile}</p>
                    </div>
                  </div>
                )}

                <div className="flex items-start gap-2.5 p-2 rounded-lg bg-slate-50">
                  <Building2 size={15} className="text-slate-400 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[10px] text-slate-400 font-bold uppercase">Company Access</p>
                    <p className="text-xs text-slate-700 font-medium">Company Internal Colleague</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {conversation.description && (
                  <div>
                    <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Description</p>
                    <p className="text-xs text-slate-700 leading-relaxed bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                      {conversation.description}
                    </p>
                  </div>
                )}

                <div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase mb-1.5">
                    Members ({conversation.participants.length})
                  </p>
                  <div className="space-y-1 max-h-56 overflow-y-auto">
                    {conversation.participants.map((p) => {
                      const u = colleagues.find((c) => c.id === p.user_id);
                      const isMe = p.user_id === currentUserId;
                      return (
                        <div
                          key={p.id}
                          className="flex items-center justify-between p-1.5 rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-100"
                        >
                          <div className="flex items-center gap-2 truncate">
                            <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-[10px] font-bold">
                              {(u?.full_name || 'U')[0]}
                            </div>
                            <span className="truncate font-semibold text-slate-800">
                              {u?.full_name || 'Colleague'} {isMe && '(You)'}
                            </span>
                          </div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase">
                            {p.role}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* MEDIA TAB */}
        {activeTab === 'media' && (
          <div>
            {mediaFiles.length === 0 ? (
              <div className="py-12 text-center text-slate-400">
                <Image size={28} className="mx-auto mb-1.5 text-slate-300" />
                <p>No photos shared yet</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-1.5">
                {mediaFiles.map((m) => (
                  <div
                    key={m.id}
                    onClick={() => onPreviewFile({ name: m.file_name, url: m.file_url, type: m.file_type, size: m.file_size })}
                    className="aspect-square rounded-lg overflow-hidden bg-slate-100 cursor-pointer hover:opacity-90 border border-slate-200 transition-opacity"
                  >
                    <img src={m.file_url} alt={m.file_name} className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* DOCUMENTS TAB */}
        {activeTab === 'docs' && (
          <div className="space-y-1.5">
            {docFiles.length === 0 ? (
              <div className="py-12 text-center text-slate-400">
                <FileText size={28} className="mx-auto mb-1.5 text-slate-300" />
                <p>No documents shared yet</p>
              </div>
            ) : (
              docFiles.map((d) => (
                <div
                  key={d.id}
                  className="flex items-center justify-between p-2 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
                >
                  <div
                    className="flex items-center gap-2 truncate cursor-pointer"
                    onClick={() => onPreviewFile({ name: d.file_name, url: d.file_url, type: d.file_type, size: d.file_size })}
                  >
                    <FileText size={16} className="text-brand-600 shrink-0" />
                    <div className="truncate">
                      <p className="font-semibold text-slate-800 truncate text-[11px]">{d.file_name}</p>
                      <span className="text-[9px] text-slate-400">
                        {formatBytes(d.file_size)} · {new Date(d.message_date).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <a
                    href={d.file_url}
                    download={d.file_name}
                    target="_blank"
                    rel="noreferrer"
                    className="p-1 rounded text-slate-400 hover:text-brand-600 transition-colors"
                    title="Download"
                  >
                    <Download size={13} />
                  </a>
                </div>
              ))
            )}
          </div>
        )}

        {/* FOLDERS TAB */}
        {activeTab === 'folders' && (
          <div className="space-y-3">
            {Object.keys(folderGroups).length === 0 ? (
              <div className="py-12 text-center text-slate-400">
                <Folder size={28} className="mx-auto mb-1.5 text-slate-300" />
                <p>No shared folders</p>
              </div>
            ) : (
              Object.entries(folderGroups).map(([folderName, files]) => (
                <div key={folderName} className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border-b border-slate-100 font-bold text-slate-700">
                    <Folder size={15} className="text-brand-600" />
                    <span className="truncate flex-1">{folderName}</span>
                    <span className="text-[10px] text-slate-400 font-normal">({files.length})</span>
                  </div>
                  <div className="p-1.5 space-y-1">
                    {files.map((f) => (
                      <div
                        key={f.id}
                        onClick={() => onPreviewFile({ name: f.file_name, url: f.file_url, type: f.file_type, size: f.file_size })}
                        className="flex items-center justify-between p-1.5 rounded hover:bg-slate-50 cursor-pointer text-[11px]"
                      >
                        <span className="truncate font-medium text-slate-700">{f.file_name}</span>
                        <span className="text-[9px] text-slate-400 shrink-0 ml-2">{formatBytes(f.file_size)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* MEETINGS TAB */}
        {activeTab === 'meetings' && (
          <div className="space-y-2">
            {meetingList.length === 0 ? (
              <div className="py-12 text-center text-slate-400">
                <Calendar size={28} className="mx-auto mb-1.5 text-slate-300" />
                <p>No meetings scheduled</p>
              </div>
            ) : (
              meetingList.map((m) => (
                <div key={m.id} className="p-2.5 rounded-xl border border-slate-200 bg-white space-y-1.5 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <h5 className="font-bold text-slate-800 truncate text-xs">{m.title}</h5>
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.2 rounded uppercase ${
                        m.status === 'cancelled'
                          ? 'bg-red-100 text-red-700'
                          : m.status === 'completed'
                          ? 'bg-slate-100 text-slate-600'
                          : 'bg-emerald-100 text-emerald-700'
                      }`}
                    >
                      {m.status}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500">
                    {new Date(m.start_time).toLocaleDateString([], { month: 'short', day: 'numeric' })} ·{' '}
                    {new Date(m.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                  <div className="pt-1 flex items-center justify-between border-t border-slate-100">
                    <button
                      onClick={() => downloadMeetingIcs(m)}
                      className="text-[10px] font-bold text-brand-600 hover:text-brand-700 flex items-center gap-1"
                    >
                      <CalendarPlus size={11} /> Add to Calendar
                    </button>
                    {m.status === 'scheduled' && onStartCall && (
                      <button
                        onClick={() => onStartCall('video')}
                        className="text-[10px] font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
                      >
                        <Video size={11} /> Join
                      </button>
                    )}
                  </div>
                </div>
              ))
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
