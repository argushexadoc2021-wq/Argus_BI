import React, { useState, useEffect, useMemo } from 'react';
import {
  FileText,
  Phone,
  Video,
  Play,
  Pause,
  Download,
  Search,
  Calendar,
  Clock,
  ShieldCheck,
  User,
  Volume2,
  Copy,
  Check,
  Filter,
  Eye,
  RefreshCw,
  ExternalLink,
  PhoneIncoming,
  PhoneMissed,
  Activity,
  Layers,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { chatService, type CallAuditItem } from '../chat/services/chatService';

export function AuditLogsPage() {
  const { company, profile, user, isSuperAdmin } = useAuth();
  const companyId = company?.id || profile?.company_id || (user as any)?.company_id || '';
  const companyName = company?.company_name || 'Argus Technologies';

  const [activeTab, setActiveTab] = useState<'calls' | 'system'>('calls');
  const [callLogs, setCallLogs] = useState<CallAuditItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'voice' | 'video'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'ended' | 'missed' | 'rejected'>('all');

  // Modal states
  const [selectedCall, setSelectedCall] = useState<CallAuditItem | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [currentAudioUrl, setCurrentAudioUrl] = useState<string | null>(null);
  const [copiedTranscriptId, setCopiedTranscriptId] = useState<string | null>(null);

  const loadAuditData = async () => {
    setLoading(true);
    try {
      const logs = await chatService.getCallAuditLogs(isSuperAdmin ? undefined : companyId);
      setCallLogs(logs);
    } catch (e) {
      console.warn('Failed to load call audit logs:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAuditData();
  }, [companyId, isSuperAdmin]);

  // Filtered call logs
  const filteredCalls = useMemo(() => {
    return callLogs.filter((call) => {
      // Type filter
      if (typeFilter !== 'all' && call.type !== typeFilter) return false;
      // Status filter
      if (statusFilter !== 'all') {
        const s = call.status === 'connected' ? 'ended' : call.status;
        if (s !== statusFilter) return false;
      }
      // Query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const callerMatch = (call.caller_name || '').toLowerCase().includes(q);
        const recipientMatch = (call.recipient_name || '').toLowerCase().includes(q);
        const transcriptMatch = (call.transcript || '').toLowerCase().includes(q);
        if (!callerMatch && !recipientMatch && !transcriptMatch) return false;
      }
      return true;
    });
  }, [callLogs, typeFilter, statusFilter, searchQuery]);

  // Aggregate stats
  const stats = useMemo(() => {
    const totalCalls = callLogs.length;
    const voiceCount = callLogs.filter((c) => c.type === 'voice').length;
    const videoCount = callLogs.filter((c) => c.type === 'video').length;
    const totalSec = callLogs.reduce((acc, c) => acc + (c.duration_seconds || 0), 0);
    const totalMin = Math.round(totalSec / 60);
    const withTranscripts = callLogs.filter((c) => c.transcript && c.transcript.trim().length > 0).length;
    const withRecordings = callLogs.filter((c) => c.recording_url).length;

    return { totalCalls, voiceCount, videoCount, totalMin, withTranscripts, withRecordings };
  }, [callLogs]);

  const copyTranscript = (callId: string, text: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedTranscriptId(callId);
    setTimeout(() => setCopiedTranscriptId(null), 2500);
  };

  const formatSec = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 lg:p-8">
      {/* Top Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-6 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2.5 mb-1.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-600 to-orange-500 flex items-center justify-center text-white shadow-lg shadow-brand-500/20">
                <ShieldCheck size={20} />
              </div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Audit Logs & Communications</h1>
            </div>
            <p className="text-sm text-slate-400">
              Company-wide voice and video call recordings, AI speech-to-text transcripts, and compliance tracking for{' '}
              <span className="text-brand-400 font-semibold">{companyName}</span>.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => void loadAuditData()}
              disabled={loading}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700/80 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-semibold shadow transition-all cursor-pointer"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              <span>Refresh Logs</span>
            </button>
          </div>
        </div>

        {/* KPI Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
          <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-semibold">Total Calls</span>
              <Phone size={16} className="text-brand-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-white">{stats.totalCalls}</span>
              <span className="text-[11px] text-slate-400 font-medium">({stats.voiceCount} voice, {stats.videoCount} video)</span>
            </div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-semibold">Recorded Time</span>
              <Clock size={16} className="text-emerald-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-white">{stats.totalMin}</span>
              <span className="text-[11px] text-slate-400 font-medium">minutes</span>
            </div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-semibold">With Recordings</span>
              <Volume2 size={16} className="text-indigo-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-white">{stats.withRecordings}</span>
              <span className="text-[11px] text-slate-400 font-medium">audio/video files</span>
            </div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-semibold">AI Transcribed</span>
              <Sparkles size={16} className="text-amber-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-white">{stats.withTranscripts}</span>
              <span className="text-[11px] text-slate-400 font-medium">transcripts</span>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 mt-8 border-b border-slate-800">
          <button
            onClick={() => setActiveTab('calls')}
            className={`flex items-center gap-2 px-5 py-3 border-b-2 font-bold text-sm transition-all cursor-pointer ${
              activeTab === 'calls'
                ? 'border-brand-500 text-brand-400 bg-brand-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <PhoneCallIcon size={16} />
            <span>Call & Video Communications Audit</span>
            <span className="ml-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-300">
              {callLogs.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('system')}
            className={`flex items-center gap-2 px-5 py-3 border-b-2 font-bold text-sm transition-all cursor-pointer ${
              activeTab === 'system'
                ? 'border-brand-500 text-brand-400 bg-brand-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Activity size={16} />
            <span>System & Security Audit</span>
          </button>
        </div>

        {/* Content Section */}
        {activeTab === 'calls' ? (
          <div className="mt-6">
            {/* Filter and Search Bar */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 mb-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by participant name, role, or spoken words in transcript..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-700/80 rounded-xl text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-brand-500 transition-colors"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <div className="flex items-center bg-slate-950 border border-slate-700/80 rounded-xl p-0.5 text-xs">
                  <button
                    onClick={() => setTypeFilter('all')}
                    className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                      typeFilter === 'all' ? 'bg-brand-600 text-white shadow' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    All Types
                  </button>
                  <button
                    onClick={() => setTypeFilter('voice')}
                    className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                      typeFilter === 'voice' ? 'bg-brand-600 text-white shadow' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Voice
                  </button>
                  <button
                    onClick={() => setTypeFilter('video')}
                    className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                      typeFilter === 'video' ? 'bg-brand-600 text-white shadow' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Video
                  </button>
                </div>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="px-3 py-2 bg-slate-950 border border-slate-700/80 rounded-xl text-xs text-slate-300 font-semibold focus:outline-none cursor-pointer"
                >
                  <option value="all">All Outcomes</option>
                  <option value="ended">Connected & Ended</option>
                  <option value="missed">Missed</option>
                  <option value="rejected">Declined</option>
                </select>
              </div>
            </div>

            {/* Calls Audit Table */}
            {loading ? (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-400">
                <RefreshCw size={24} className="animate-spin mx-auto mb-3 text-brand-500" />
                <p className="text-sm font-semibold">Loading communication logs and recordings...</p>
              </div>
            ) : filteredCalls.length === 0 ? (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-400">
                <FileText size={32} className="mx-auto mb-3 text-slate-600" />
                <h3 className="text-base font-bold text-slate-200 mb-1">No call records found</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  {searchQuery || typeFilter !== 'all' || statusFilter !== 'all'
                    ? 'No calls match the selected filter criteria. Try clearing search filters.'
                    : 'Calls conducted in BI Chat will automatically be recorded, transcribed, and logged here.'}
                </p>
              </div>
            ) : (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 bg-slate-950/60 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        <th className="py-3 px-4">Date & Time</th>
                        <th className="py-3 px-4">Type</th>
                        <th className="py-3 px-4">Participants</th>
                        <th className="py-3 px-4">Status & Duration</th>
                        <th className="py-3 px-4">Recording</th>
                        <th className="py-3 px-4">Transcript</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/80 text-sm">
                      {filteredCalls.map((call) => {
                        const isVideo = call.type === 'video';
                        const isMissed = call.status === 'missed';
                        const isRejected = call.status === 'rejected';

                        return (
                          <tr key={call.id} className="hover:bg-slate-800/40 transition-colors">
                            {/* Date */}
                            <td className="py-3.5 px-4 whitespace-nowrap text-xs text-slate-300 font-mono">
                              {new Date(call.created_at || call.started_at).toLocaleString([], {
                                dateStyle: 'medium',
                                timeStyle: 'short',
                              })}
                            </td>

                            {/* Type */}
                            <td className="py-3.5 px-4 whitespace-nowrap">
                              <span
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
                                  isVideo
                                    ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                                    : 'bg-brand-500/20 text-brand-300 border border-brand-500/30'
                                }`}
                              >
                                {isVideo ? <Video size={12} /> : <Phone size={12} />}
                                <span className="capitalize">{call.type} Call</span>
                              </span>
                            </td>

                            {/* Participants */}
                            <td className="py-3.5 px-4 whitespace-nowrap">
                              <div className="flex flex-col gap-0.5">
                                <div className="flex items-center gap-2">
                                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                                  <span className="font-semibold text-xs text-slate-200">
                                    {call.caller_name || 'Caller'}
                                  </span>
                                  <span className="text-[10px] text-slate-500">→</span>
                                  <span className="font-semibold text-xs text-slate-200">
                                    {call.recipient_name || 'Recipient'}
                                  </span>
                                </div>
                              </div>
                            </td>

                            {/* Status & Duration */}
                            <td className="py-3.5 px-4 whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                    isMissed
                                      ? 'bg-rose-500/20 text-rose-300'
                                      : isRejected
                                      ? 'bg-amber-500/20 text-amber-300'
                                      : 'bg-emerald-500/20 text-emerald-300'
                                  }`}
                                >
                                  {isMissed ? 'Missed' : isRejected ? 'Declined' : 'Ended'}
                                </span>
                                {!isMissed && !isRejected && (
                                  <span className="text-xs font-mono text-slate-400 font-semibold">
                                    {formatSec(call.duration_seconds || 0)}
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Recording */}
                            <td className="py-3.5 px-4 whitespace-nowrap">
                              {call.recording_url ? (
                                <button
                                  onClick={() => setSelectedCall(call)}
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-semibold cursor-pointer transition-colors shadow-sm"
                                >
                                  <Play size={12} />
                                  <span>{isVideo ? 'Play Video' : 'Play Audio'}</span>
                                </button>
                              ) : (
                                <span className="text-[11px] text-slate-500 italic">No recording</span>
                              )}
                            </td>

                            {/* Transcript snippet */}
                            <td className="py-3.5 px-4 max-w-xs truncate">
                              {call.transcript ? (
                                <button
                                  onClick={() => setSelectedCall(call)}
                                  className="text-left group cursor-pointer block max-w-[260px] truncate"
                                >
                                  <span className="text-xs text-slate-300 group-hover:text-brand-300 transition-colors truncate block">
                                    {call.transcript}
                                  </span>
                                </button>
                              ) : (
                                <span className="text-[11px] text-slate-500 italic">No transcript</span>
                              )}
                            </td>

                            {/* Actions */}
                            <td className="py-3.5 px-4 whitespace-nowrap text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => setSelectedCall(call)}
                                  title="View Details & Transcript"
                                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                                >
                                  <Eye size={14} />
                                </button>
                                {call.recording_url && (
                                  <a
                                    href={call.recording_url}
                                    download={`call_${call.id}.${call.type === 'video' ? 'webm' : 'webm'}`}
                                    title="Download Recording"
                                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                                  >
                                    <Download size={14} />
                                  </a>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* System & Security Audit Tab */
          <div className="mt-6 bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center">
            <Activity size={36} className="mx-auto mb-3 text-brand-400" />
            <h3 className="text-lg font-bold text-white mb-2">System Activity & Security Events</h3>
            <p className="text-sm text-slate-400 max-w-md mx-auto mb-6">
              Audits administrative role modifications, login authentications, company switches, and confidential ERP
              records changes for compliance.
            </p>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-300">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>Realtime Audit Logging is active on Supabase public schemas</span>
            </div>
          </div>
        )}
      </div>

      {/* MODAL: View Call Details, Recording Player, and Full Transcript */}
      {selectedCall && (
        <div className="fixed inset-0 z-[150] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-slate-900 border border-slate-700/80 rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center text-white ${
                    selectedCall.type === 'video' ? 'bg-indigo-600' : 'bg-brand-600'
                  }`}
                >
                  {selectedCall.type === 'video' ? <Video size={18} /> : <Phone size={18} />}
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    {selectedCall.type === 'video' ? 'Video Call Audit & Recording' : 'Voice Call Audit & Recording'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {new Date(selectedCall.created_at || selectedCall.started_at).toLocaleString()}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedCall(null)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center text-sm font-bold cursor-pointer transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-200">
              {/* Call Overview Badges */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-950/70 p-3.5 rounded-2xl border border-slate-800 text-xs">
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Caller</span>
                  <span className="font-semibold text-slate-200 truncate block">{selectedCall.caller_name || 'Caller'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Recipient</span>
                  <span className="font-semibold text-slate-200 truncate block">{selectedCall.recipient_name || 'Recipient'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Duration</span>
                  <span className="font-semibold text-slate-200 block font-mono">{formatSec(selectedCall.duration_seconds || 0)}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">Status</span>
                  <span className="font-bold text-emerald-400 capitalize block">{selectedCall.status}</span>
                </div>
              </div>

              {/* Recording Player (Audio or Video) */}
              {selectedCall.recording_url ? (
                <div className="bg-slate-950 rounded-2xl p-4 border border-slate-800">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                      <Volume2 size={14} className="text-brand-400" />
                      Recorded Media Playback
                    </span>
                    <a
                      href={selectedCall.recording_url}
                      download={`call_${selectedCall.id}.${selectedCall.type === 'video' ? 'webm' : 'webm'}`}
                      className="inline-flex items-center gap-1 text-xs text-brand-400 hover:text-brand-300 font-semibold cursor-pointer"
                    >
                      <Download size={12} />
                      Download File
                    </a>
                  </div>

                  {selectedCall.type === 'video' ? (
                    <video
                      controls
                      playsInline
                      className="w-full max-h-72 rounded-xl bg-black border border-slate-800"
                      src={selectedCall.recording_url}
                    />
                  ) : (
                    <audio controls className="w-full" src={selectedCall.recording_url} />
                  )}
                </div>
              ) : (
                <div className="p-4 bg-slate-950/40 border border-slate-800/80 rounded-2xl text-center text-xs text-slate-500">
                  No audio or video recording file was saved for this call session.
                </div>
              )}

              {/* Speech-to-Text Transcript Dialogue */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <FileText size={14} className="text-amber-400" />
                    Conversation Speech Transcript
                  </span>
                  {selectedCall.transcript && (
                    <button
                      onClick={() => copyTranscript(selectedCall.id, selectedCall.transcript || '')}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 hover:text-white cursor-pointer transition-colors"
                    >
                      {copiedTranscriptId === selectedCall.id ? (
                        <>
                          <Check size={12} className="text-emerald-400" />
                          <span className="text-emerald-400">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy size={12} />
                          <span>Copy Transcript</span>
                        </>
                      )}
                    </button>
                  )}
                </div>

                <div className="bg-slate-950 rounded-2xl p-4 border border-slate-800 max-h-64 overflow-y-auto space-y-3">
                  {selectedCall.dialogue && selectedCall.dialogue.length > 0 ? (
                    selectedCall.dialogue.map((item, idx) => (
                      <div key={idx} className="flex flex-col gap-1 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-300 text-[11px]">{item.speaker_name || item.speaker}</span>
                          <span className="font-mono text-[10px] text-slate-500">{item.time_offset || item.time || ''}</span>
                        </div>
                        <p className="p-2.5 rounded-xl bg-slate-900 border border-slate-800/80 text-slate-200 leading-relaxed">
                          {item.text}
                        </p>
                      </div>
                    ))
                  ) : selectedCall.transcript ? (
                    <p className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed font-sans">
                      {selectedCall.transcript}
                    </p>
                  ) : (
                    <p className="text-xs text-slate-500 italic text-center py-4">
                      No speech was transcribed for this call.
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3.5 bg-slate-950 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setSelectedCall(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PhoneCallIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}
