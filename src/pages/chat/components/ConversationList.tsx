import { useState, useMemo } from 'react';
import {
  Search,
  MessageSquarePlus,
  Users,
  Pin,
  Circle,
  MessageSquare,
  Building2,
  ChevronRight,
  Shield,
  Briefcase,
} from 'lucide-react';
import type { Conversation, UserColleague } from '../types';

export function ConversationList({
  conversations,
  activeConversationId,
  currentUserId,
  colleagues,
  companyName = 'Argus CNC',
  onSelectConversation,
  onSelectColleague,
  onOpenNewChat,
  onOpenNewGroup,
}: {
  conversations: Conversation[];
  activeConversationId?: string;
  currentUserId: string;
  colleagues: UserColleague[];
  companyName?: string;
  onSelectConversation: (conv: Conversation) => void;
  onSelectColleague?: (colleague: UserColleague) => void;
  onOpenNewChat: () => void;
  onOpenNewGroup: () => void;
}) {
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'chats' | 'colleagues'>('chats');
  const [filter, setFilter] = useState<'all' | 'direct' | 'group' | 'unread'>('all');

  // Map of colleagues by user_id
  const colleagueMap = useMemo(() => {
    return new Map(colleagues.map((c) => [c.id, c]));
  }, [colleagues]);

  // Filtered conversations
  const filteredConversations = useMemo(() => {
    const s = search.toLowerCase().trim();

    return conversations.filter((c) => {
      // Type filter
      if (filter === 'direct' && c.type !== 'direct') return false;
      if (filter === 'group' && c.type !== 'group') return false;
      if (filter === 'unread' && (!c.unread_count || c.unread_count === 0)) return false;

      // Text search
      if (!s) return true;

      if (c.type === 'group') {
        return (
          c.title?.toLowerCase().includes(s) ||
          c.last_message_preview?.toLowerCase().includes(s)
        );
      }

      // Direct chat: search colleague's name or preview
      const otherPart = c.participants.find((p) => p.user_id !== currentUserId);
      const otherUser = otherPart ? colleagueMap.get(otherPart.user_id) : undefined;
      const name = otherUser?.full_name || otherPart?.user?.full_name || 'Colleague';

      return (
        name.toLowerCase().includes(s) ||
        (c.last_message_preview && c.last_message_preview.toLowerCase().includes(s))
      );
    });
  }, [conversations, search, filter, currentUserId, colleagueMap]);

  // Filtered colleagues
  const filteredColleagues = useMemo(() => {
    const s = search.toLowerCase().trim();
    if (!s) return colleagues;
    return colleagues.filter(
      (c) =>
        c.full_name?.toLowerCase().includes(s) ||
        c.email?.toLowerCase().includes(s) ||
        c.designation?.toLowerCase().includes(s) ||
        c.role?.toLowerCase().includes(s)
    );
  }, [colleagues, search]);

  const totalUnread = useMemo(() => {
    return conversations.reduce((acc, c) => acc + (c.unread_count || 0), 0);
  }, [conversations]);

  return (
    <div className="flex flex-col h-full bg-[#0c1427] border-r border-slate-800 text-slate-200 select-none w-full">
      {/* Top Header */}
      <div className="p-3.5 border-b border-slate-800/80 flex items-center justify-between bg-[#0e172e]">
        <div>
          <div className="flex items-center gap-1.5">
            <h2 className="text-sm font-bold text-white tracking-tight">BI Chat</h2>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-brand-500/20 text-brand-400 border border-brand-500/30">
              Company
            </span>
          </div>
          <p className="text-[11px] text-slate-400 truncate max-w-[190px]">
            {companyName}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onOpenNewChat}
            title="Start new direct chat"
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 border border-slate-700/80 transition-colors cursor-pointer"
          >
            <MessageSquarePlus size={16} />
          </button>
          <button
            type="button"
            onClick={onOpenNewGroup}
            title="Create company group"
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 border border-slate-700/80 transition-colors cursor-pointer"
          >
            <Users size={16} />
          </button>
        </div>
      </div>

      {/* Main Mode Tabs: Chats vs Colleagues */}
      <div className="grid grid-cols-2 p-1.5 bg-[#080d1a] border-b border-slate-800 gap-1 shrink-0">
        <button
          type="button"
          onClick={() => setActiveTab('chats')}
          className={`flex items-center justify-center gap-2 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'chats'
              ? 'bg-brand-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <MessageSquare size={13} />
          <span>Chats</span>
          {totalUnread > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white text-brand-700 font-black">
              {totalUnread}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('colleagues')}
          className={`flex items-center justify-center gap-2 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'colleagues'
              ? 'bg-brand-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Users size={13} />
          <span>Colleagues</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-800 text-slate-300 border border-slate-700">
            {colleagues.length}
          </span>
        </button>
      </div>

      {/* Search Input */}
      <div className="p-2.5 border-b border-slate-800/80 bg-[#0c1427]">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={
              activeTab === 'chats'
                ? 'Search chats or colleagues...'
                : 'Search colleagues by name, role...'
            }
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-[#131d36] text-white placeholder:text-slate-500 border border-slate-700/80 rounded-lg focus:outline-none focus:border-brand-500 transition-colors"
          />
        </div>

        {/* Filter Pills for Chats tab */}
        {activeTab === 'chats' && (
          <div className="flex items-center gap-1 mt-2">
            {[
              { id: 'all', label: 'All' },
              { id: 'direct', label: 'Direct' },
              { id: 'group', label: 'Groups' },
              { id: 'unread', label: 'Unread' },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id as any)}
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold transition-colors cursor-pointer ${
                  filter === f.id
                    ? 'bg-brand-500 text-white shadow-xs'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Body List */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-800/50">
        {/* TAB 1: COLLEAGUES DIRECTORY (Shows who is in the company!) */}
        {activeTab === 'colleagues' && (
          <div className="flex flex-col">
            <div className="px-3.5 py-2 bg-slate-900/60 border-b border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400 font-bold uppercase tracking-wider">
              <span>Company Employees ({filteredColleagues.length})</span>
              <span className="text-[10px] font-normal text-slate-500">Click to chat</span>
            </div>

            {filteredColleagues.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                <Users size={32} className="mx-auto mb-2 text-slate-600" />
                <p className="font-semibold text-slate-300">No matching colleagues</p>
                <p className="text-[11px] mt-0.5 text-slate-500">Try adjusting your search</p>
              </div>
            ) : (
              filteredColleagues.map((colleague) => {
                const initials = (colleague.full_name || 'U')
                  .split(' ')
                  .map((n) => n[0])
                  .join('')
                  .slice(0, 2)
                  .toUpperCase();

                const isMe = colleague.id === currentUserId;

                return (
                  <div
                    key={colleague.id}
                    onClick={() => onSelectColleague && onSelectColleague(colleague)}
                    className="flex items-center gap-3 p-3 hover:bg-slate-800/60 transition-colors cursor-pointer group"
                  >
                    {/* Avatar */}
                    <div className="relative shrink-0">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-brand-600 to-orange-500 text-white flex items-center justify-center text-xs font-bold shadow-md">
                        {initials}
                      </div>
                      <span
                        title={colleague.is_online ? 'Online' : 'Offline'}
                        className={`absolute bottom-0 right-0 w-3 h-3 rounded-full ring-2 ring-[#0c1427] ${
                          colleague.is_online ? 'bg-emerald-400' : 'bg-slate-500'
                        }`}
                      />
                    </div>

                    {/* Details */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between mb-0.5">
                        <div className="flex items-center gap-1.5 truncate">
                          <h4 className="text-xs font-bold text-white group-hover:text-brand-400 transition-colors truncate">
                            {colleague.full_name}
                          </h4>
                          {isMe && (
                            <span className="text-[9px] px-1 py-0.2 rounded bg-brand-500/20 text-brand-300 font-bold">
                              You
                            </span>
                          )}
                        </div>
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.2 rounded shrink-0 ${
                            colleague.role === 'SUPER_ADMIN'
                              ? 'bg-purple-900/40 text-purple-300 border border-purple-500/30'
                              : colleague.role === 'COMPANY_ADMIN'
                              ? 'bg-amber-900/40 text-amber-300 border border-amber-500/30'
                              : 'bg-slate-800 text-slate-300 border border-slate-700'
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

                    <ChevronRight size={14} className="text-slate-600 group-hover:text-slate-300 transition-colors shrink-0" />
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* TAB 2: ACTIVE CHATS (With Company Colleagues listed right below) */}
        {activeTab === 'chats' && (
          <>
            {filteredConversations.length > 0 && (
              <div className="flex flex-col">
                {filteredConversations.map((conv) => {
                  const isGroup = conv.type === 'group';
                  const isSelected = conv.id === activeConversationId;
                  const isPinned = conv.pinned_by?.includes(currentUserId);

                  // Colleague info for direct chat
                  const otherPart = conv.participants.find((p) => p.user_id !== currentUserId);
                  const otherColleague = otherPart ? colleagueMap.get(otherPart.user_id) : undefined;

                  const title = isGroup
                    ? conv.title || 'Group'
                    : otherColleague?.full_name || otherPart?.user?.full_name || 'Colleague';
                  const subtitle = isGroup
                    ? `${conv.participants.length} members`
                    : otherColleague?.designation || otherColleague?.role || 'Company Colleague';
                  const isOnline = !isGroup && otherColleague?.is_online;

                  const initials = title
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .slice(0, 2)
                    .toUpperCase();

                  const formattedTime = conv.last_message_at
                    ? formatLastTime(new Date(conv.last_message_at))
                    : '';

                  return (
                    <div
                      key={conv.id}
                      onClick={() => onSelectConversation(conv)}
                      className={`flex items-center gap-3 p-3 cursor-pointer transition-colors border-l-3 ${
                        isSelected
                          ? 'bg-brand-600/15 border-l-brand-500 text-white'
                          : 'hover:bg-slate-800/50 border-l-transparent text-slate-300'
                      }`}
                    >
                      {/* Avatar */}
                      <div className="relative shrink-0">
                        <div
                          className={`w-10 h-10 rounded-full text-white flex items-center justify-center text-xs font-bold shadow-md ${
                            isGroup
                              ? 'bg-gradient-to-tr from-slate-700 to-slate-900 border border-slate-600'
                              : 'bg-gradient-to-tr from-brand-600 to-orange-500'
                          }`}
                        >
                          {isGroup ? <Users size={16} /> : initials}
                        </div>
                        {isOnline && (
                          <span
                            title="Online"
                            className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-400 ring-2 ring-[#0c1427]"
                          />
                        )}
                      </div>

                      {/* Details */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between mb-0.5">
                          <h3
                            className={`text-xs truncate ${
                              isSelected ? 'font-bold text-white' : 'font-semibold text-slate-200'
                            }`}
                          >
                            {title}
                          </h3>
                          <div className="flex items-center gap-1 shrink-0 ml-1">
                            {isPinned && <Pin size={11} className="fill-amber-400 text-amber-400" />}
                            <span className="text-[10px] text-slate-400 font-medium tabular-nums">
                              {formattedTime}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between">
                          <p className="text-[11px] text-slate-400 truncate max-w-[170px] leading-tight">
                            {conv.last_message_preview || subtitle}
                          </p>
                          {conv.unread_count && conv.unread_count > 0 ? (
                            <span className="inline-flex items-center justify-center px-1.5 py-0.2 min-w-[18px] h-[18px] rounded-full text-[10px] font-bold bg-brand-600 text-white shrink-0">
                              {conv.unread_count}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* COMPANY COLLEAGUES SECTION: Always visible so user can see everyone in that company! */}
            <div className="flex flex-col">
              <div className="px-3.5 py-2.5 bg-[#090f1e] border-y border-slate-800 flex items-center justify-between text-[11px] text-slate-400 font-bold uppercase tracking-wider">
                <span className="flex items-center gap-1.5">
                  <Building2 size={13} className="text-brand-400" />
                  Company Colleagues ({filteredColleagues.length})
                </span>
                <span className="text-[10px] font-normal text-slate-500">Tap to message</span>
              </div>

              {filteredColleagues.map((colleague) => {
                const initials = (colleague.full_name || 'U')
                  .split(' ')
                  .map((n) => n[0])
                  .join('')
                  .slice(0, 2)
                  .toUpperCase();

                const isMe = colleague.id === currentUserId;

                return (
                  <div
                    key={colleague.id}
                    onClick={() => onSelectColleague && onSelectColleague(colleague)}
                    className="flex items-center gap-3 p-3 hover:bg-slate-800/60 transition-colors cursor-pointer group"
                  >
                    {/* Avatar */}
                    <div className="relative shrink-0">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-brand-600 to-orange-500 text-white flex items-center justify-center text-xs font-bold shadow-xs">
                        {initials}
                      </div>
                      <span
                        title={colleague.is_online ? 'Online' : 'Offline'}
                        className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full ring-2 ring-[#0c1427] ${
                          colleague.is_online ? 'bg-emerald-400' : 'bg-slate-500'
                        }`}
                      />
                    </div>

                    {/* Details */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between mb-0.5">
                        <div className="flex items-center gap-1 truncate">
                          <h4 className="text-xs font-bold text-slate-200 group-hover:text-brand-400 transition-colors truncate">
                            {colleague.full_name}
                          </h4>
                          {isMe && (
                            <span className="text-[9px] px-1 py-0.1 rounded bg-brand-500/20 text-brand-300 font-bold">
                              You
                            </span>
                          )}
                        </div>
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.2 rounded shrink-0 ${
                            colleague.role === 'SUPER_ADMIN'
                              ? 'bg-purple-900/40 text-purple-300'
                              : colleague.role === 'COMPANY_ADMIN'
                              ? 'bg-amber-900/40 text-amber-300'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {colleague.role === 'SUPER_ADMIN'
                            ? 'Admin'
                            : colleague.role === 'COMPANY_ADMIN'
                            ? 'Lead'
                            : 'Staff'}
                        </span>
                      </div>

                      <p className="text-[11px] text-slate-400 truncate leading-tight">
                        {colleague.designation || colleague.email}
                      </p>
                    </div>

                    <MessageSquare size={13} className="text-slate-600 group-hover:text-brand-400 transition-colors shrink-0" />
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function formatLastTime(date: Date): string {
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 3600 * 24));

  if (diffDays === 0) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  if (diffDays === 1) {
    return 'Yesterday';
  }
  if (diffDays < 7) {
    return date.toLocaleDateString([], { weekday: 'short' });
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}
