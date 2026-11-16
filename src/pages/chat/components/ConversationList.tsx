import { useState, useMemo } from 'react';
import {
  Search,
  MessageSquarePlus,
  Users,
  Pin,
  CheckCheck,
  Check,
  Circle,
} from 'lucide-react';
import type { Conversation, UserColleague } from '../types';

export function ConversationList({
  conversations,
  activeConversationId,
  currentUserId,
  colleagues,
  onSelectConversation,
  onOpenNewChat,
  onOpenNewGroup,
}: {
  conversations: Conversation[];
  activeConversationId?: string;
  currentUserId: string;
  colleagues: UserColleague[];
  onSelectConversation: (conv: Conversation) => void;
  onOpenNewChat: () => void;
  onOpenNewGroup: () => void;
}) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'direct' | 'group' | 'unread'>('all');

  // Map of colleagues by user_id
  const colleagueMap = useMemo(() => {
    return new Map(colleagues.map((c) => [c.id, c]));
  }, [colleagues]);

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

  return (
    <div className="flex flex-col h-full bg-white border-r border-slate-200 select-none">
      {/* Top Header */}
      <div className="p-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
        <div>
          <h2 className="text-sm font-bold text-slate-800 tracking-tight">BI Conversations</h2>
          <p className="text-[10px] text-slate-400 font-medium">Internal Company Chat</p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onOpenNewChat}
            title="Start new direct chat"
            className="p-1.5 rounded-lg text-slate-600 hover:text-brand-600 hover:bg-orange-50 border border-slate-200 transition-colors"
          >
            <MessageSquarePlus size={16} />
          </button>
          <button
            type="button"
            onClick={onOpenNewGroup}
            title="Create company group"
            className="p-1.5 rounded-lg text-slate-600 hover:text-brand-600 hover:bg-orange-50 border border-slate-200 transition-colors"
          >
            <Users size={16} />
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="p-2.5 border-b border-slate-100">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search chats, colleagues or messages..."
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-brand-500 focus:bg-white transition-colors"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1 mt-2">
          {[
            { id: 'all', label: 'All' },
            { id: 'direct', label: 'Direct' },
            { id: 'group', label: 'Groups' },
            { id: 'unread', label: 'Unread' },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id as any)}
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold transition-colors ${
                filter === f.id
                  ? 'bg-brand-600 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-100/80">
        {filteredConversations.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs">
            <Users size={32} className="mx-auto mb-2 text-slate-300" />
            <p className="font-semibold text-slate-600">No conversations</p>
            <p className="text-[11px] mt-0.5">Click + to start chatting with your colleagues</p>
            <button
              type="button"
              onClick={onOpenNewChat}
              className="mt-3 px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold rounded-lg transition-colors inline-flex items-center gap-1.5"
            >
              <MessageSquarePlus size={14} /> New Chat
            </button>
          </div>
        ) : (
          filteredConversations.map((conv) => {
            const isGroup = conv.type === 'group';
            const isSelected = conv.id === activeConversationId;
            const isPinned = conv.pinned_by?.includes(currentUserId);

            // Colleague info for direct chat
            const otherPart = conv.participants.find((p) => p.user_id !== currentUserId);
            const otherColleague = otherPart ? colleagueMap.get(otherPart.user_id) : undefined;

            const title = isGroup ? conv.title || 'Group' : otherColleague?.full_name || otherPart?.user?.full_name || 'Colleague';
            const subtitle = isGroup ? `${conv.participants.length} members` : otherColleague?.designation || otherColleague?.role || 'CNC Staff';
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
                    ? 'bg-orange-50/70 border-l-brand-600'
                    : 'hover:bg-slate-50 border-l-transparent'
                }`}
              >
                {/* Avatar */}
                <div className="relative shrink-0">
                  <div
                    className={`w-11 h-11 rounded-full text-white flex items-center justify-center text-xs font-bold shadow-xs ${
                      isGroup
                        ? 'bg-gradient-to-tr from-navy-800 to-slate-700'
                        : 'bg-gradient-to-tr from-brand-600 to-orange-500'
                    }`}
                  >
                    {isGroup ? <Users size={18} /> : initials}
                  </div>
                  {isOnline && (
                    <span
                      title="Online"
                      className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-white"
                    />
                  )}
                </div>

                {/* Details */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between mb-0.5">
                    <h3
                      className={`text-xs truncate ${
                        isSelected ? 'font-bold text-brand-900' : 'font-semibold text-slate-800'
                      }`}
                    >
                      {title}
                    </h3>
                    <div className="flex items-center gap-1 shrink-0 ml-1">
                      {isPinned && <Pin size={11} className="fill-amber-500 text-amber-500" />}
                      <span className="text-[10px] text-slate-400 font-medium tabular-nums">
                        {formattedTime}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <p className="text-[11px] text-slate-500 truncate max-w-[170px] leading-tight">
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
          })
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
