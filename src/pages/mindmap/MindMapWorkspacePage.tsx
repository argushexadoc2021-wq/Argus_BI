import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Archive,
  ArrowLeft,
  Calendar,
  Clock,
  Copy,
  Edit3,
  FolderOpen,
  Layers,
  Loader2,
  Network,
  Plus,
  Search,
  Share2,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { mindMapApi } from '@/lib/mindmap/api';
import { MIND_MAP_TEMPLATES } from '@/lib/mindmap/templates';
import type { MindMapMember, MindMapRecord, MindMapTemplate } from '@/lib/mindmap/types';
import { ShareMindMapModal } from './ShareMindMapModal';

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function MindMapWorkspacePage() {
  const navigate = useNavigate();
  const { company, profile, isSuperAdmin, isCompanyAdmin, canDo } = useAuth();

  const [maps, setMaps] = useState<MindMapRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'active' | 'archived' | 'all'>('active');

  // Create modal state
  const [creatingTemplate, setCreatingTemplate] = useState<MindMapTemplate | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [creatingBusy, setCreatingBusy] = useState(false);

  // Rename modal state
  const [renameTarget, setRenameTarget] = useState<MindMapRecord | null>(null);
  const [renameTitle, setRenameTitle] = useState('');
  const [renameDesc, setRenameDesc] = useState('');
  const [renameBusy, setRenameBusy] = useState(false);

  // Delete confirm modal state
  const [deleteTarget, setDeleteTarget] = useState<MindMapRecord | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  // Share modal state
  const [shareTarget, setShareTarget] = useState<MindMapRecord | null>(null);
  const [shareMembers, setShareMembers] = useState<MindMapMember[]>([]);

  const [busyId, setBusyId] = useState<string | null>(null);

  const isAdmin = isSuperAdmin || isCompanyAdmin;
  const canCreate = canDo('mind-map', 'create');
  const activeCompanyId = company?.id ?? profile?.active_company_id ?? profile?.company_id ?? null;

  const fetchMaps = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const list = await mindMapApi.listMindMaps(activeCompanyId, profile?.id ?? null, isAdmin);
      setMaps(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load mind maps');
    } finally {
      setLoading(false);
    }
  }, [activeCompanyId, profile?.id, isAdmin]);

  useEffect(() => {
    void fetchMaps();
  }, [fetchMaps]);

  const handleQuickBlank = async () => {
    if (!canCreate || creatingBusy) return;
    setCreatingBusy(true);
    setError('');
    try {
      const blank = MIND_MAP_TEMPLATES[0];
      const res = await mindMapApi.createMindMap({
        companyId: activeCompanyId,
        title: 'Untitled Mind Map',
        description: null,
        nodes: blank.nodes,
      });
      navigate(`/mind-map/editor/${res.map.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create mind map');
    } finally {
      setCreatingBusy(false);
    }
  };

  const openTemplateDialog = (tpl: MindMapTemplate) => {
    setCreatingTemplate(tpl);
    setNewTitle(tpl.defaultTitle);
    setNewDesc(tpl.id === 'blank' ? '' : tpl.description);
  };

  const handleConfirmCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!creatingTemplate || creatingBusy) return;
    setCreatingBusy(true);
    setError('');
    try {
      const res = await mindMapApi.createMindMap({
        companyId: activeCompanyId,
        title: newTitle.trim() || creatingTemplate.defaultTitle,
        description: newDesc.trim() || null,
        nodes: creatingTemplate.nodes,
        edges: creatingTemplate.edges,
      });
      setCreatingTemplate(null);
      navigate(`/mind-map/editor/${res.map.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create mind map');
    } finally {
      setCreatingBusy(false);
    }
  };

  const handleDuplicate = async (m: MindMapRecord) => {
    if (busyId) return;
    setBusyId(m.id);
    setError('');
    try {
      const copy = await mindMapApi.duplicateMindMap(m.id, `${m.title} (Copy)`);
      setMaps((prev) => [
        { ...copy, node_count: m.node_count, my_role: 'owner', creator_name: profile?.full_name || 'You' },
        ...prev,
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not duplicate mind map');
    } finally {
      setBusyId(null);
    }
  };

  const handleToggleArchive = async (m: MindMapRecord) => {
    if (busyId) return;
    setBusyId(m.id);
    setError('');
    try {
      const nextStatus = m.status === 'archived' ? 'active' : 'archived';
      const updated = await mindMapApi.updateMindMapMeta(m.id, {
        status: nextStatus,
        expectedVersion: m.version,
      });
      setMaps((prev) =>
        prev.map((x) => (x.id === m.id ? { ...x, ...updated } : x)),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update status');
    } finally {
      setBusyId(null);
    }
  };

  const handleRenameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renameTarget || renameBusy) return;
    setRenameBusy(true);
    setError('');
    try {
      const updated = await mindMapApi.updateMindMapMeta(renameTarget.id, {
        title: renameTitle.trim() || renameTarget.title,
        description: renameDesc.trim(),
        expectedVersion: renameTarget.version,
      });
      setMaps((prev) =>
        prev.map((x) => (x.id === renameTarget.id ? { ...x, ...updated } : x)),
      );
      setRenameTarget(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not rename mind map');
    } finally {
      setRenameBusy(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget || deleteBusy) return;
    setDeleteBusy(true);
    setError('');
    try {
      await mindMapApi.softDeleteMindMap(deleteTarget.id);
      setMaps((prev) => prev.filter((x) => x.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete mind map');
    } finally {
      setDeleteBusy(false);
    }
  };

  const openShareFor = async (m: MindMapRecord) => {
    setShareTarget(m);
    try {
      const loaded = await mindMapApi.loadMindMap(m.id, profile?.id ?? null, isAdmin);
      setShareMembers(loaded.members);
    } catch {
      setShareMembers([]);
    }
  };

  const filteredMaps = useMemo(() => {
    const q = search.trim().toLowerCase();
    return maps.filter((m) => {
      if (statusFilter !== 'all' && m.status !== statusFilter) return false;
      if (!q) return true;
      return (
        m.title.toLowerCase().includes(q) ||
        (m.description ?? '').toLowerCase().includes(q) ||
        (m.creator_name ?? '').toLowerCase().includes(q)
      );
    });
  }, [maps, search, statusFilter]);

  return (
    <div className="min-h-[calc(100vh-56px)] bg-[#f8fbff] pb-12">
      {/* Page Header matching Argus BI design system */}
      <div className="border-b border-slate-200 bg-white px-4 sm:px-6 py-4">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/mind-map')}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 cursor-pointer"
              title="Back to 3D / 2D Project Mind Map"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-sm shadow-blue-500/25">
              <Network className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-black tracking-tight text-slate-900">
                Create Mind Map Workspace
              </h1>
              <p className="text-xs text-slate-500">
                Design custom mind maps from scratch or templates, autosave every branch, and share with your team
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate('/mind-map')}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              <Layers className="h-3.5 w-3.5 text-sky-600" />
              Project Mind Map
            </button>
            {canCreate && (
              <button
                type="button"
                disabled={creatingBusy}
                onClick={() => void handleQuickBlank()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-sm shadow-blue-600/25 hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
              >
                {creatingBusy ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                New Blank Mind Map
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 pt-6 space-y-8">
        {error && (
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-700">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => setError('')}
              className="rounded p-1 hover:bg-rose-100 cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Section 1: Start from Blank Canvas or Template */}
        {canCreate && (
          <section>
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-blue-600" />
                <h2 className="text-sm font-black text-slate-900">Start a New Mind Map</h2>
              </div>
              <span className="text-[11px] font-medium text-slate-500">
                Choose a blank canvas or a ready-made template
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {MIND_MAP_TEMPLATES.map((tpl) => {
                const isBlank = tpl.id === 'blank';
                return (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => openTemplateDialog(tpl)}
                    className={`group flex flex-col justify-between rounded-2xl border p-4 text-left transition-all cursor-pointer ${
                      isBlank
                        ? 'border-blue-300 bg-gradient-to-br from-blue-50 to-white hover:border-blue-500 hover:shadow-md'
                        : 'border-slate-200 bg-white hover:border-blue-300 hover:shadow-md'
                    }`}
                  >
                    <div>
                      <div className="mb-2.5 flex items-center justify-between gap-2">
                        <span
                          className="inline-flex h-8 w-8 items-center justify-center rounded-xl text-white shadow-xs"
                          style={{ backgroundColor: tpl.accent }}
                        >
                          {isBlank ? <Plus className="h-4 w-4" /> : <Network className="h-4 w-4" />}
                        </span>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                          {tpl.category}
                        </span>
                      </div>
                      <h3 className="text-xs font-black text-slate-900 group-hover:text-blue-700 transition-colors">
                        {tpl.name}
                      </h3>
                      <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                        {tpl.description}
                      </p>
                    </div>
                    <div className="mt-3 flex items-center justify-between text-[10.5px] font-bold text-blue-600">
                      <span>{isBlank ? 'Start blank canvas' : `${tpl.nodes.length} starter nodes`}</span>
                      <span className="group-hover:translate-x-0.5 transition-transform">→</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* Section 2: Saved Mind Maps */}
        <section>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-black text-slate-900">
                Saved Mind Maps ({filteredMaps.length})
              </h2>
              <p className="text-[11px] text-slate-500">
                {company?.company_name ? `${company.company_name} · ` : ''}
                Automatically saved per node and persisted under your company account
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search mind maps…"
                  className="h-9 w-56 rounded-xl border border-slate-200 bg-white pl-8 pr-3 text-xs text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="inline-flex rounded-xl border border-slate-200 bg-white p-0.5 text-[11px] font-bold">
                {(['active', 'archived', 'all'] as const).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setStatusFilter(st)}
                    className={`rounded-lg px-2.5 py-1 capitalize cursor-pointer ${
                      statusFilter === st
                        ? 'bg-slate-900 text-white'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white py-16 gap-2 text-slate-400">
              <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
              <span className="text-xs font-semibold">Loading saved mind maps…</span>
            </div>
          ) : filteredMaps.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white py-16 px-4 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 mb-3">
                <FolderOpen className="h-6 w-6" />
              </div>
              <h3 className="text-sm font-black text-slate-900">
                {search ? 'No matching mind maps' : 'No saved mind maps yet'}
              </h3>
              <p className="mt-1 max-w-sm text-xs text-slate-500">
                {search
                  ? 'Try a different search keyword or switch the status filter.'
                  : 'Click "New Blank Mind Map" or pick any template above to create your first interactive mind map.'}
              </p>
              {canCreate && !search && (
                <button
                  type="button"
                  onClick={() => void handleQuickBlank()}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 cursor-pointer"
                >
                  <Plus className="h-4 w-4" />
                  Create Your First Mind Map
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredMaps.map((m) => {
                const isOwner = m.my_role === 'owner';
                const canEditMap = m.my_role === 'owner' || m.my_role === 'editor';
                return (
                  <div
                    key={m.id}
                    className="group flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs transition-all hover:border-blue-300 hover:shadow-md"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => navigate(`/mind-map/editor/${m.id}`)}
                          className="min-w-0 flex-1 text-left cursor-pointer"
                        >
                          <h3 className="truncate text-sm font-black text-slate-900 group-hover:text-blue-700 transition-colors">
                            {m.title}
                          </h3>
                          <p className="mt-1 line-clamp-2 text-xs text-slate-500 min-h-[2rem]">
                            {m.description || 'No description added.'}
                          </p>
                        </button>
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold capitalize ${
                            m.my_role === 'owner'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : m.my_role === 'editor'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          {m.my_role === 'viewer' ? 'View Only' : m.my_role || 'Owner'}
                        </span>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-2 text-[10.5px] font-semibold text-slate-500">
                        <span className="rounded-lg bg-slate-100 px-2 py-0.5 text-slate-700">
                          {m.node_count ?? 1} node{(m.node_count ?? 1) === 1 ? '' : 's'}
                        </span>
                        {m.status === 'archived' && (
                          <span className="rounded-lg bg-amber-100 px-2 py-0.5 text-amber-800">
                            Archived
                          </span>
                        )}
                        {m.creator_name && (
                          <span className="truncate">by {m.creator_name}</span>
                        )}
                      </div>

                      <div className="mt-3 space-y-1 border-t border-slate-100 pt-2.5 text-[10.5px] text-slate-400">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3 w-3 shrink-0" />
                          <span>Created: {formatDateTime(m.created_at)}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-3 w-3 shrink-0" />
                          <span>Modified: {formatDateTime(m.updated_at)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Card Footer Actions */}
                    <div className="mt-4 flex items-center justify-between gap-1.5 border-t border-slate-100 pt-3">
                      <button
                        type="button"
                        onClick={() => navigate(`/mind-map/editor/${m.id}`)}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-blue-600 transition-colors cursor-pointer"
                      >
                        Open Editor
                      </button>

                      <div className="flex items-center gap-1">
                        {canEditMap && (
                          <button
                            type="button"
                            title="Rename / Edit Description"
                            onClick={() => {
                              setRenameTarget(m);
                              setRenameTitle(m.title);
                              setRenameDesc(m.description ?? '');
                            }}
                            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 cursor-pointer"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {canCreate && (
                          <button
                            type="button"
                            disabled={busyId === m.id}
                            title="Duplicate Mind Map"
                            onClick={() => void handleDuplicate(m)}
                            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-40 cursor-pointer"
                          >
                            {busyId === m.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </button>
                        )}
                        <button
                          type="button"
                          title="Share & Permissions"
                          onClick={() => void openShareFor(m)}
                          className="rounded-lg p-1.5 text-slate-500 hover:bg-emerald-50 hover:text-emerald-700 cursor-pointer"
                        >
                          <Share2 className="h-3.5 w-3.5" />
                        </button>
                        {isOwner && (
                          <button
                            type="button"
                            disabled={busyId === m.id}
                            title={m.status === 'archived' ? 'Restore to Active' : 'Archive Mind Map'}
                            onClick={() => void handleToggleArchive(m)}
                            className="rounded-lg p-1.5 text-slate-500 hover:bg-amber-50 hover:text-amber-700 cursor-pointer"
                          >
                            <Archive className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {isOwner && (
                          <button
                            type="button"
                            title="Delete Mind Map"
                            onClick={() => setDeleteTarget(m)}
                            className="rounded-lg p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-600 cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* Create from Template Modal */}
      {creatingTemplate && (
        <div
          className="fixed inset-0 z-[85] flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setCreatingTemplate(null);
          }}
        >
          <form
            onSubmit={(e) => void handleConfirmCreate(e)}
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden"
          >
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-5 py-3.5">
              <div>
                <h3 className="text-sm font-black text-slate-900">Create Mind Map</h3>
                <p className="text-[11px] text-slate-500">
                  Template: <span className="font-bold text-slate-700">{creatingTemplate.name}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCreatingTemplate(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-200/70 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-5 space-y-3.5">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Mind Map Title *
                </label>
                <input
                  autoFocus
                  required
                  maxLength={200}
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Q4 CNC Production Roadmap"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-900 focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Description (optional)
                </label>
                <textarea
                  rows={3}
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Briefly describe the purpose of this mind map…"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-800 focus:border-blue-500 focus:outline-none resize-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50/70 px-5 py-3">
              <button
                type="button"
                onClick={() => setCreatingTemplate(null)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creatingBusy}
                className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
              >
                {creatingBusy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Create &amp; Open Canvas
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Rename Modal */}
      {renameTarget && (
        <div
          className="fixed inset-0 z-[85] flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setRenameTarget(null);
          }}
        >
          <form
            onSubmit={(e) => void handleRenameSubmit(e)}
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden"
          >
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-5 py-3.5">
              <h3 className="text-sm font-black text-slate-900">Rename Mind Map</h3>
              <button
                type="button"
                onClick={() => setRenameTarget(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-200/70 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-5 space-y-3.5">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Title *</label>
                <input
                  autoFocus
                  required
                  maxLength={200}
                  value={renameTitle}
                  onChange={(e) => setRenameTitle(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-900 focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Description</label>
                <textarea
                  rows={3}
                  value={renameDesc}
                  onChange={(e) => setRenameDesc(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-800 focus:border-blue-500 focus:outline-none resize-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50/70 px-5 py-3">
              <button
                type="button"
                onClick={() => setRenameTarget(null)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={renameBusy}
                className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
              >
                {renameBusy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Save Changes
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-[85] flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setDeleteTarget(null);
          }}
        >
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
            <h3 className="text-sm font-black text-slate-900">Delete Mind Map?</h3>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
              Are you sure you want to delete <span className="font-bold text-slate-900">“{deleteTarget.title}”</span>? It will be removed from your workspace.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteBusy}
                onClick={() => void handleConfirmDelete()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-rose-700 disabled:opacity-50 cursor-pointer"
              >
                {deleteBusy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Share Modal */}
      {shareTarget && (
        <ShareMindMapModal
          open={!!shareTarget}
          mindMapId={shareTarget.id}
          mindMapTitle={shareTarget.title}
          companyId={shareTarget.company_id || activeCompanyId}
          currentUserId={profile?.id ?? null}
          canManage={shareTarget.my_role === 'owner'}
          members={shareMembers}
          onMembersChange={setShareMembers}
          onClose={() => setShareTarget(null)}
        />
      )}
    </div>
  );
}
