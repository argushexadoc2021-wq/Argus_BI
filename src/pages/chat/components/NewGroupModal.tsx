import { useState } from 'react';
import { Users, X, Search, Check } from 'lucide-react';
import type { UserColleague } from '../types';

export function NewGroupModal({
  open,
  colleagues,
  onClose,
  onCreateGroup,
}: {
  open: boolean;
  colleagues: UserColleague[];
  onClose: () => void;
  onCreateGroup: (title: string, description: string, memberIds: string[]) => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [error, setError] = useState('');

  if (!open) return null;

  const toggleMember = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const filtered = colleagues.filter(
    (c) =>
      c.full_name.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase())
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Please provide a group name');
      return;
    }
    if (selectedIds.length === 0) {
      setError('Select at least one member for the group');
      return;
    }

    onCreateGroup(title.trim(), description.trim(), selectedIds);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden flex flex-col max-h-[88vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-gradient-to-r from-navy-950 to-slate-900 text-white">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-brand-500/20 text-brand-400 border border-brand-500/30 flex items-center justify-center">
              <Users size={16} />
            </div>
            <div>
              <h3 className="text-sm font-bold">New Company Group</h3>
              <p className="text-[11px] text-slate-300">Create a group chat for your team or department</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 overflow-y-auto space-y-4 flex-1">
          {error && (
            <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-semibold">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Group Name *
            </label>
            <input
              type="text"
              required
              autoFocus
              value={title}
              onChange={(e) => { setTitle(e.target.value); setError(''); }}
              placeholder="e.g. CNC Production Team, Quality Engineers, Shift 1"
              className="w-full text-xs font-medium px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-brand-500 focus:bg-white transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Group Description / Purpose
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Daily shift communications and urgent tool requests"
              className="w-full text-xs font-medium px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-brand-500 focus:bg-white transition-colors"
            />
          </div>

          {/* Members selection */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center justify-between">
              <span>Select Members ({selectedIds.length})</span>
              <span className="text-[10px] text-slate-400 font-normal">Colleagues in your company</span>
            </label>

            <div className="relative mb-2">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search colleagues to add..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-brand-500"
              />
            </div>

            <div className="max-h-44 overflow-y-auto border border-slate-200 rounded-xl p-1 space-y-1 bg-slate-50/50">
              {filtered.map((c) => {
                const selected = selectedIds.includes(c.id);
                const initials = c.full_name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
                return (
                  <div
                    key={c.id}
                    onClick={() => toggleMember(c.id)}
                    className={`flex items-center justify-between p-2 rounded-lg cursor-pointer text-xs transition-colors ${
                      selected ? 'bg-orange-50 border border-orange-200 text-orange-950 font-bold' : 'hover:bg-white border border-transparent text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-brand-600 to-orange-500 text-white flex items-center justify-center text-[10px] font-bold shrink-0">
                        {initials}
                      </div>
                      <span className="truncate">{c.full_name}</span>
                      <span className="text-[10px] text-slate-400 font-normal">({c.role})</span>
                    </div>

                    <div className={`w-4 h-4 rounded flex items-center justify-center border ${selected ? 'bg-brand-600 border-brand-600 text-white' : 'border-slate-300 bg-white'}`}>
                      {selected && <Check size={11} strokeWidth={3} />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Footer actions */}
          <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold shadow-md shadow-brand-500/20 transition-all"
            >
              Create Group Chat
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
