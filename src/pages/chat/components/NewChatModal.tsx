import { useState, useMemo } from 'react';
import { Search, UserPlus, X, User } from 'lucide-react';
import type { UserColleague } from '../types';

export function NewChatModal({
  open,
  colleagues,
  onClose,
  onSelectColleague,
}: {
  open: boolean;
  colleagues: UserColleague[];
  onClose: () => void;
  onSelectColleague: (colleague: UserColleague) => void;
}) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const s = search.toLowerCase().trim();
    if (!s) return colleagues;
    return colleagues.filter(
      (c) =>
        c.full_name.toLowerCase().includes(s) ||
        c.email.toLowerCase().includes(s) ||
        c.role.toLowerCase().includes(s)
    );
  }, [colleagues, search]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-gradient-to-r from-navy-950 to-slate-900 text-white">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-brand-500/20 text-brand-400 border border-brand-500/30 flex items-center justify-center">
              <UserPlus size={16} />
            </div>
            <div>
              <h3 className="text-sm font-bold">New Direct Conversation</h3>
              <p className="text-[11px] text-slate-300">Select a company colleague to chat</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Search Input */}
        <div className="p-3 border-b border-slate-100 bg-slate-50/50">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search colleagues by name, role or email..."
              className="w-full pl-9 pr-4 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-brand-500 transition-colors"
            />
          </div>
        </div>

        {/* Colleagues list */}
        <div className="p-2 overflow-y-auto max-h-96 space-y-1 flex-1">
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              <User size={32} className="mx-auto mb-2 text-slate-300" />
              <p className="font-semibold">No colleagues found</p>
              <p className="text-[11px] mt-0.5">Try searching with a different name</p>
            </div>
          ) : (
            filtered.map((c) => {
              const initials = c.full_name
                .split(' ')
                .map((n) => n[0])
                .join('')
                .slice(0, 2)
                .toUpperCase();

              return (
                <div
                  key={c.id}
                  onClick={() => {
                    onSelectColleague(c);
                    onClose();
                  }}
                  className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-200/80 cursor-pointer transition-colors group"
                >
                  <div className="relative shrink-0">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-brand-600 to-orange-500 text-white flex items-center justify-center text-xs font-bold shadow-xs">
                      {initials}
                    </div>
                    {c.is_online && (
                      <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-white" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-slate-800 truncate group-hover:text-brand-600 transition-colors">
                        {c.full_name}
                      </h4>
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                        {c.role}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 truncate mt-0.5">{c.email}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
