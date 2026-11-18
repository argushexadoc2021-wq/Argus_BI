import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Loader2, Shield, Trash2, UserPlus, Users, X } from 'lucide-react';
import { mindMapApi } from '@/lib/mindmap/api';
import type { ColleagueUser, MindMapMember, MindMapRole } from '@/lib/mindmap/types';

interface ShareMindMapModalProps {
  open: boolean;
  mindMapId: string;
  mindMapTitle: string;
  companyId: string | null;
  currentUserId: string | null;
  canManage: boolean;
  members: MindMapMember[];
  onMembersChange: (members: MindMapMember[]) => void;
  onClose: () => void;
}

export function ShareMindMapModal({
  open,
  mindMapId,
  mindMapTitle,
  companyId,
  currentUserId,
  canManage,
  members,
  onMembersChange,
  onClose,
}: ShareMindMapModalProps) {
  const [colleagues, setColleagues] = useState<ColleagueUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedRole, setSelectedRole] = useState<MindMapRole>('editor');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [okMsg, setOkMsg] = useState('');

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setLoading(true);
    setError('');
    setOkMsg('');
    mindMapApi
      .listCompanyColleagues(companyId)
      .then((list) => {
        if (!alive) return;
        setColleagues(list);
      })
      .catch((e) => {
        if (alive) setError(e instanceof Error ? e.message : 'Failed to load company users');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [open, companyId]);

  if (!open || typeof document === 'undefined') return null;

  const existingIds = new Set(members.map((m) => m.user_id));
  const availableColleagues = colleagues.filter((c) => !existingIds.has(c.id));

  const handleInvite = async () => {
    if (!selectedUserId || busy) return;
    setBusy(true);
    setError('');
    setOkMsg('');
    try {
      const saved = await mindMapApi.upsertMember(mindMapId, selectedUserId, selectedRole, currentUserId);
      const colleague = colleagues.find((c) => c.id === selectedUserId);
      const next: MindMapMember = {
        ...saved,
        user: colleague
          ? {
              id: colleague.id,
              full_name: colleague.full_name,
              email: colleague.email,
              role: colleague.role,
            }
          : undefined,
      };
      onMembersChange([...members.filter((m) => m.user_id !== selectedUserId), next]);
      setSelectedUserId('');
      setOkMsg(`Shared with ${colleague?.full_name || 'user'} as ${selectedRole}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add member');
    } finally {
      setBusy(false);
    }
  };

  const handleRoleUpdate = async (m: MindMapMember, role: MindMapRole) => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await mindMapApi.upsertMember(mindMapId, m.user_id, role, currentUserId);
      onMembersChange(members.map((x) => (x.id === m.id ? { ...x, role } : x)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update role');
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async (m: MindMapMember) => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await mindMapApi.removeMember(m.id);
      onMembersChange(members.filter((x) => x.id !== m.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not remove member');
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/70 px-5 py-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-100 text-blue-600 shrink-0">
              <Users className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <h2 className="truncate text-sm font-black text-slate-900">Share Mind Map</h2>
              <p className="truncate text-[11px] text-slate-500">{mindMapTitle}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200/70 hover:text-slate-700 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {canManage && (
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 space-y-2.5">
              <label className="block text-[11px] font-bold text-slate-700">
                Add company team member
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  disabled={loading || busy}
                  className="h-9 min-w-[180px] flex-1 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-800 focus:border-blue-500 focus:outline-none"
                >
                  <option value="">
                    {loading
                      ? 'Loading company users…'
                      : availableColleagues.length
                        ? 'Select a company colleague…'
                        : 'All active colleagues already have access'}
                  </option>
                  {availableColleagues.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.full_name} ({c.email})
                    </option>
                  ))}
                </select>

                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value as MindMapRole)}
                  disabled={busy}
                  className="h-9 rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-bold text-slate-700"
                >
                  <option value="editor">Can Edit</option>
                  <option value="viewer">View Only</option>
                </select>

                <button
                  type="button"
                  disabled={!selectedUserId || busy}
                  onClick={() => void handleInvite()}
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-40 cursor-pointer"
                >
                  {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />}
                  Share
                </button>
              </div>
            </div>
          )}

          {error && (
            <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
              {error}
            </p>
          )}
          {okMsg && (
            <p className="flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
              <Check className="h-3.5 w-3.5" />
              {okMsg}
            </p>
          )}

          <div>
            <p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <Shield className="h-3.5 w-3.5 text-slate-400" />
              People with access ({members.length})
            </p>
            <div className="max-h-60 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200">
              {members.map((m) => {
                const isOwner = m.role === 'owner';
                return (
                  <div key={m.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-slate-900">
                        {m.user?.full_name || 'Company User'}
                        {m.user_id === currentUserId && (
                          <span className="ml-1.5 rounded bg-slate-100 px-1.5 py-0.5 text-[9.5px] font-semibold text-slate-500">
                            You
                          </span>
                        )}
                      </p>
                      <p className="truncate text-[11px] text-slate-500">{m.user?.email || ''}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {isOwner || !canManage ? (
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10.5px] font-bold capitalize text-slate-700">
                          {m.role === 'viewer' ? 'View Only' : m.role === 'editor' ? 'Editor' : 'Owner'}
                        </span>
                      ) : (
                        <>
                          <select
                            value={m.role}
                            disabled={busy}
                            onChange={(e) => void handleRoleUpdate(m, e.target.value as MindMapRole)}
                            className="h-7 rounded-lg border border-slate-200 bg-white px-2 text-[11px] font-bold text-slate-700"
                          >
                            <option value="editor">Editor</option>
                            <option value="viewer">View Only</option>
                          </select>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void handleRemove(m)}
                            title="Remove access"
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex justify-end border-t border-slate-100 bg-slate-50/70 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-4 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
