import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import {
  Mail,
  Send,
  Inbox,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  Trash2,
  Edit2,
  Plus,
  ExternalLink,
  Users,
  Search,
  Building2,
  Server,
  Key,
  Clock,
  X,
  Shield,
  Check,
  ChevronDown,
  Info,
  UserCheck,
  UserX,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import {
  mailIntegrationApi,
  type EmailAccount,
  type MailProviderType,
  type MailIntegrationType,
  type CallerPermissions,
} from '@/lib/mailIntegrationService';
import { supabase } from '@/lib/supabase';

// Provider Presets
const PROVIDER_PRESETS: Record<
  MailProviderType,
  { name: string; host: string; port: number; imapHost: string; imapPort: number; pwHint: string; guide: string; guideUrl?: string }
> = {
  gmail: {
    name: 'Gmail / Google Workspace',
    host: 'smtp.gmail.com',
    port: 587,
    imapHost: 'imap.gmail.com',
    imapPort: 993,
    pwHint: '16-letter Google App Password',
    guide: 'Open Google Account → Security → 2-Step Verification → App passwords. Create one named "Argus ERP" and paste the 16 letters here.',
    guideUrl: 'https://myaccount.google.com/apppasswords',
  },
  outlook: {
    name: 'Outlook / Microsoft 365',
    host: 'smtp.office365.com',
    port: 587,
    imapHost: 'outlook.office365.com',
    imapPort: 993,
    pwHint: 'Account password or App Password',
    guide: 'Open Microsoft Account → Security → Advanced Security Options → App Passwords. For Microsoft 365, ensure SMTP AUTH is enabled.',
    guideUrl: 'https://account.live.com/proofs/AppPassword',
  },
  zoho: {
    name: 'Zoho Mail',
    host: 'smtp.zoho.in',
    port: 587,
    imapHost: 'imap.zoho.in',
    imapPort: 993,
    pwHint: 'Application-specific Password',
    guide: 'Open Zoho Accounts → Security → App Passwords → Generate New. For global accounts use smtp.zoho.com.',
    guideUrl: 'https://accounts.zoho.in/home#security/app_password',
  },
  other: {
    name: 'Other (Company / Custom)',
    host: '',
    port: 587,
    imapHost: '',
    imapPort: 993,
    pwHint: 'Mailbox Password or App Password',
    guide: 'Enter SMTP outgoing and IMAP incoming host names and ports provided by your hosting provider or IT administrator.',
  },
};

export function EmailIntegrationPage() {
  const { profile, company, isSuperAdmin, isCompanyAdmin } = useAuth();

  // State
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [callerPerms, setCallerPerms] = useState<CallerPermissions>({
    can_connect_sending: true,
    can_connect_receiving: true,
    can_use_ai_composer: true,
    is_admin: true,
  });
  const [colleagues, setColleagues] = useState<{ id: string; full_name: string; email: string; role: string }[]>([]);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'both' | 'sending' | 'receiving'>('all');

  // Testing & Action feedback
  const [testingId, setTestingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modal State for Connecting / Editing
  const [modalOpen, setModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<EmailAccount | null>(null);

  // Modal State for Direct User Assignment
  const [assignModalAccount, setAssignModalAccount] = useState<EmailAccount | null>(null);
  const [assignIsShared, setAssignIsShared] = useState(false);
  const [assignUserIds, setAssignUserIds] = useState<string[]>([]);
  const [assignUserSearch, setAssignUserSearch] = useState('');
  const [savingAssignment, setSavingAssignment] = useState(false);

  // Connection Form State
  const [connProvider, setConnProvider] = useState<MailProviderType>('gmail');
  const [connType, setConnType] = useState<MailIntegrationType>('both');
  const [connName, setConnName] = useState('');
  const [connEmail, setConnEmail] = useState('');
  const [connPass, setConnPass] = useState('');
  const [connFromName, setConnFromName] = useState(profile?.full_name || '');
  const [connSmtpHost, setConnSmtpHost] = useState(PROVIDER_PRESETS.gmail.host);
  const [connSmtpPort, setConnSmtpPort] = useState('587');
  const [connImapHost, setConnImapHost] = useState(PROVIDER_PRESETS.gmail.imapHost);
  const [connImapPort, setConnImapPort] = useState('993');
  const [connImapSsl, setConnImapSsl] = useState(true);
  const [connIsShared, setConnIsShared] = useState(true);
  const [connAssignedUsers, setConnAssignedUsers] = useState<string[]>([]);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  const [connecting, setConnecting] = useState(false);

  // Load Data
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [accRes, colRes] = await Promise.all([
        mailIntegrationApi.getAccounts(company?.id),
        supabase.from('company_users').select('id, full_name, email, role, status').eq('status', 'Active'),
      ]);

      setAccounts(accRes.accounts || []);
      if (accRes.caller_permissions) setCallerPerms(accRes.caller_permissions);
      setColleagues(colRes.data || []);
    } catch (err: any) {
      console.error('Failed to load email integration data:', err);
      setFeedback({ type: 'error', message: err.message || 'Failed to fetch email accounts.' });
    } finally {
      setLoading(false);
    }
  }, [company?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Open Connect Modal
  const handleOpenConnect = (acc?: EmailAccount) => {
    setFeedback(null);
    if (acc) {
      setEditingAccount(acc);
      setConnProvider(acc.provider || 'gmail');
      setConnType(acc.type || 'both');
      setConnName(acc.name || '');
      setConnEmail(acc.email || '');
      setConnPass('');
      setConnFromName(acc.from_name || profile?.full_name || '');
      setConnSmtpHost(acc.smtp_host || PROVIDER_PRESETS[acc.provider]?.host || '');
      setConnSmtpPort(String(acc.smtp_port || 587));
      setConnImapHost(acc.imap_host || PROVIDER_PRESETS[acc.provider]?.imapHost || '');
      setConnImapPort(String(acc.imap_port || 993));
      setConnImapSsl(acc.imap_ssl !== false);
      setConnIsShared(acc.is_shared !== false);
      setConnAssignedUsers(acc.assigned_user_ids || []);
      setShowAdvancedSettings(acc.provider === 'other');
    } else {
      setEditingAccount(null);
      setConnProvider('gmail');
      setConnType('both');
      setConnName('');
      setConnEmail('');
      setConnPass('');
      setConnFromName(profile?.full_name || '');
      setConnSmtpHost(PROVIDER_PRESETS.gmail.host);
      setConnSmtpPort('587');
      setConnImapHost(PROVIDER_PRESETS.gmail.imapHost);
      setConnImapPort('993');
      setConnImapSsl(true);
      setConnIsShared(true);
      setConnAssignedUsers([]);
      setShowAdvancedSettings(false);
    }
    setModalOpen(true);
  };

  const selectProvider = (p: MailProviderType) => {
    setConnProvider(p);
    const preset = PROVIDER_PRESETS[p];
    setConnSmtpHost(preset.host);
    setConnSmtpPort(String(preset.port));
    setConnImapHost(preset.imapHost);
    setConnImapPort(String(preset.imapPort));
    if (p === 'other') setShowAdvancedSettings(true);
  };

  // Submit Connect / Edit Form
  const handleSaveConnection = async (e: React.FormEvent) => {
    e.preventDefault();
    setConnecting(true);
    setFeedback(null);

    try {
      const res = await mailIntegrationApi.saveAccount({
        id: editingAccount?.id,
        name: connName.trim() || `${connEmail.split('@')[0]} Mailbox`,
        email: connEmail.trim(),
        provider: connProvider,
        type: connType,
        is_shared: isSuperAdmin || isCompanyAdmin ? connIsShared : false,
        assigned_user_ids: isSuperAdmin || isCompanyAdmin ? connAssignedUsers : [profile?.id || ''],
        smtp_host: connSmtpHost.trim(),
        smtp_port: Number(connSmtpPort) || 587,
        smtp_user: connEmail.trim(),
        smtp_pass: connPass,
        imap_host: connImapHost.trim(),
        imap_port: Number(connImapPort) || 993,
        imap_user: connEmail.trim(),
        imap_pass: connPass,
        imap_ssl: connImapSsl,
        from_name: connFromName.trim() || profile?.full_name || '',
        company_id: company?.id,
      });

      setFeedback({ type: 'success', message: res.message || 'Mail ID connected and verified successfully!' });
      setModalOpen(false);
      loadData();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to connect mail account.' });
    } finally {
      setConnecting(false);
    }
  };

  // Open Direct User Assignment Popover/Modal
  const handleOpenAssignModal = (acc: EmailAccount) => {
    setAssignModalAccount(acc);
    setAssignIsShared(acc.is_shared);
    setAssignUserIds(acc.assigned_user_ids || []);
    setAssignUserSearch('');
  };

  // Save Direct User Assignment
  const handleSaveUserAssignment = async () => {
    if (!assignModalAccount) return;
    setSavingAssignment(true);
    try {
      await mailIntegrationApi.assignUsers({
        id: assignModalAccount.id,
        is_shared: assignIsShared,
        assigned_user_ids: assignUserIds,
      });

      setAccounts((prev) =>
        prev.map((a) =>
          a.id === assignModalAccount.id
            ? { ...a, is_shared: assignIsShared, assigned_user_ids: assignUserIds }
            : a
        )
      );

      setFeedback({
        type: 'success',
        message: `Updated user assignment for ${assignModalAccount.email}.`,
      });
      setAssignModalAccount(null);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to update user assignments.' });
    } finally {
      setSavingAssignment(false);
    }
  };

  // Toggle user in direct assignment
  const toggleAssignUser = (userId: string) => {
    setAssignUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  // Test live connection
  const handleTestAccount = async (acc: EmailAccount, testType: 'smtp' | 'imap') => {
    setTestingId(`${acc.id}-${testType}`);
    setFeedback(null);
    try {
      const res = await mailIntegrationApi.testConnection({ id: acc.id, test_type: testType });
      setFeedback({ type: 'success', message: `✅ ${acc.email} (${testType.toUpperCase()}): ${res.message}` });
    } catch (e: any) {
      setFeedback({ type: 'error', message: `❌ ${acc.email} (${testType.toUpperCase()}): ${e.message}` });
    } finally {
      setTestingId(null);
    }
  };

  // Delete / Disconnect Account
  const handleDeleteAccount = async (id: string, email: string) => {
    if (!window.confirm(`Disconnect mailbox "${email}"? Outgoing dispatch and inbound sync for this mail ID will stop.`)) {
      return;
    }
    try {
      await mailIntegrationApi.deleteAccount(id);
      setFeedback({ type: 'success', message: `Mailbox ${email} disconnected successfully.` });
      loadData();
    } catch (e: any) {
      setFeedback({ type: 'error', message: e.message || 'Failed to disconnect mailbox.' });
    }
  };

  // Filtered Accounts
  const filteredAccounts = useMemo(() => {
    return accounts.filter((acc) => {
      if (typeFilter !== 'all' && acc.type !== typeFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesEmail = acc.email.toLowerCase().includes(q);
        const matchesName = acc.name?.toLowerCase().includes(q);
        const matchesProvider = acc.provider?.toLowerCase().includes(q);
        const assignedNames = (acc.assigned_user_ids || [])
          .map((uid) => colleagues.find((c) => c.id === uid)?.full_name?.toLowerCase())
          .filter(Boolean)
          .join(' ');
        const matchesUser = assignedNames.includes(q);
        return matchesEmail || matchesName || matchesProvider || matchesUser;
      }
      return true;
    });
  }, [accounts, typeFilter, searchQuery, colleagues]);

  // Filtered colleagues inside assign modal
  const filteredColleagues = useMemo(() => {
    const q = assignUserSearch.toLowerCase().trim();
    if (!q) return colleagues;
    return colleagues.filter(
      (c) =>
        c.full_name?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.role?.toLowerCase().includes(q)
    );
  }, [colleagues, assignUserSearch]);

  const canManage = isSuperAdmin || isCompanyAdmin || callerPerms.can_connect_sending || callerPerms.can_connect_receiving;

  return (
    <div className="min-h-full p-4 sm:p-6 lg:p-8 space-y-6 bg-[#f8fbff] text-slate-800 font-sans">
      {/* Single Compact Header & Controls Bar */}
      <div className="bg-white px-4 py-3 rounded-2xl border border-slate-200 shadow-2xs flex flex-wrap xl:flex-nowrap items-center justify-between gap-3">
        {/* Title */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center shrink-0">
            <Mail className="w-4 h-4" />
          </div>
          <h1 className="text-base sm:text-lg font-black text-slate-900 tracking-tight whitespace-nowrap">
            Email Integration
          </h1>
        </div>

        {/* Search & Type Filter */}
        <div className="flex flex-wrap items-center gap-2.5 flex-1 justify-start xl:justify-center min-w-0">
          <div className="relative w-full sm:w-64 lg:w-72">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by mail ID, user, or provider..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs shrink-0">
            {(
              [
                { id: 'all', label: 'All Mail IDs' },
                { id: 'both', label: 'Send & Receive' },
                { id: 'sending', label: 'Sending' },
                { id: 'receiving', label: 'Receiving' },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTypeFilter(t.id)}
                className={`px-2.5 py-1 rounded-lg font-bold text-[11px] cursor-pointer transition-all whitespace-nowrap ${
                  typeFilter === t.id
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Right Actions: Refresh + Connect Mail ID */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 transition-colors shadow-2xs cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-blue-600 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          {canManage && (
            <button
              type="button"
              onClick={() => handleOpenConnect()}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 font-bold text-xs text-white shadow-sm shadow-blue-500/25 transition-all cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Connect Mail ID</span>
            </button>
          )}
        </div>
      </div>

      {/* Global Feedback Banner */}
      {feedback && (
        <div
          className={`flex items-center justify-between p-3.5 rounded-xl border text-xs font-medium shadow-xs transition-all ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
              : 'bg-red-50 border-red-300 text-red-900'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="opacity-70 hover:opacity-100 cursor-pointer p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Connected Mail IDs List / Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        {filteredAccounts.length === 0 ? (
          <div className="p-12 text-center bg-white space-y-3">
            <div className="w-16 h-16 rounded-3xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center mx-auto mb-3 shadow-2xs">
              <Mail className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-slate-900">No Connected Mail IDs Found</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
              Connect your business or personal mailbox (Gmail, Outlook, Zoho, Custom SMTP/IMAP) to enable AI email dispatch and team communication.
            </p>
            {canManage && (
              <button
                type="button"
                onClick={() => handleOpenConnect()}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 font-bold text-xs text-white shadow-md shadow-blue-500/25 transition-all cursor-pointer mt-2"
              >
                <Plus className="w-4 h-4" />
                <span>Connect Your First Mail ID</span>
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600 min-w-[780px]">
              <thead className="bg-slate-50/80 text-[10px] text-slate-400 uppercase font-mono font-bold tracking-wider border-b border-slate-200">
                <tr>
                  <th className="p-4">CONNECTED MAIL ID</th>
                  <th className="p-4">SUPPORTED USERS (WHO CAN USE THIS MAIL)</th>
                  <th className="p-4">CAPABILITIES</th>
                  <th className="p-4">SERVER PROTOCOLS</th>
                  <th className="p-4 text-right">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredAccounts.map((acc) => {
                  const isTestingSmtp = testingId === `${acc.id}-smtp`;
                  const isTestingImap = testingId === `${acc.id}-imap`;
                  const assignedUsers = (acc.assigned_user_ids || [])
                    .map((uid) => colleagues.find((c) => c.id === uid))
                    .filter(Boolean) as { id: string; full_name: string; email: string; role: string }[];

                  return (
                    <tr key={acc.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Column 1: Connected Mail ID & Provider */}
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs">
                            {acc.provider === 'gmail'
                              ? 'G'
                              : acc.provider === 'outlook'
                              ? 'MS'
                              : acc.provider === 'zoho'
                              ? 'Z'
                              : 'M'}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900 text-xs truncate max-w-[200px]">
                                {acc.email}
                              </span>
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase font-mono bg-slate-100 text-slate-600 border border-slate-200">
                                {acc.provider}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-500 font-medium mt-0.5 truncate max-w-[220px]">
                              {acc.name || acc.from_name || 'Mailbox'}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Column 2: Supported Users (Straight to that Selecting the Users) */}
                      <td className="p-4">
                        <div className="flex items-center justify-between gap-2 max-w-sm">
                          <div className="flex-1 min-w-0">
                            {acc.is_shared ? (
                              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-bold">
                                <Building2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                <span>All Users (Company-wide Support)</span>
                              </div>
                            ) : assignedUsers.length > 0 ? (
                              <div className="flex flex-wrap items-center gap-1">
                                {assignedUsers.slice(0, 3).map((u) => (
                                  <span
                                    key={u.id}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 text-[11px] font-semibold"
                                  >
                                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                                    <span className="truncate max-w-[100px]">{u.full_name || u.email}</span>
                                  </span>
                                ))}
                                {assignedUsers.length > 3 && (
                                  <span className="px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 font-mono text-[10px] font-bold border border-slate-200">
                                    +{assignedUsers.length - 3} more
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-400 text-xs italic">
                                No users assigned yet
                              </span>
                            )}
                          </div>

                          {/* Direct Inline Selector Button */}
                          {canManage && (
                            <button
                              type="button"
                              onClick={() => handleOpenAssignModal(acc)}
                              className="px-2.5 py-1 rounded-lg bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200 hover:border-blue-300 text-[11px] font-bold transition-all flex items-center gap-1 shrink-0 cursor-pointer shadow-2xs"
                              title="Select which users this mail ID supports"
                            >
                              <Users className="w-3.5 h-3.5 text-blue-600" />
                              <span>Select Users</span>
                              <ChevronDown className="w-3 h-3 text-slate-400" />
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Column 3: Capabilities */}
                      <td className="p-4">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase font-mono ${
                            acc.type === 'both'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : acc.type === 'sending'
                              ? 'bg-purple-50 text-purple-700 border border-purple-200'
                              : 'bg-blue-50 text-blue-700 border border-blue-200'
                          }`}
                        >
                          {acc.type === 'both'
                            ? 'Send & Receive'
                            : acc.type === 'sending'
                            ? 'Sending Only'
                            : 'Receiving Only'}
                        </span>
                      </td>

                      {/* Column 4: Server Protocols & Live Tests */}
                      <td className="p-4">
                        <div className="flex items-center gap-1.5">
                          {(acc.type === 'sending' || acc.type === 'both') && (
                            <button
                              type="button"
                              disabled={isTestingSmtp}
                              onClick={() => handleTestAccount(acc, 'smtp')}
                              className="px-2 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold border border-slate-200 transition-colors inline-flex items-center gap-1 cursor-pointer"
                              title="Verify SMTP Outbound"
                            >
                              {isTestingSmtp ? (
                                <Loader2 className="w-3 h-3 animate-spin text-blue-600" />
                              ) : (
                                <Server className="w-3 h-3 text-slate-500" />
                              )}
                              <span>SMTP</span>
                            </button>
                          )}

                          {(acc.type === 'receiving' || acc.type === 'both') && (
                            <button
                              type="button"
                              disabled={isTestingImap}
                              onClick={() => handleTestAccount(acc, 'imap')}
                              className="px-2 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold border border-slate-200 transition-colors inline-flex items-center gap-1 cursor-pointer"
                              title="Verify IMAP Inbound"
                            >
                              {isTestingImap ? (
                                <Loader2 className="w-3 h-3 animate-spin text-blue-600" />
                              ) : (
                                <Inbox className="w-3 h-3 text-slate-500" />
                              )}
                              <span>IMAP</span>
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Column 5: Actions */}
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {canManage && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleOpenConnect(acc)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
                                title="Edit Connection"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteAccount(acc.id, acc.email)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                                title="Disconnect Mail ID"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Table Footer */}
        <div className="border-t border-slate-100 p-3.5 flex items-center justify-between text-xs text-slate-500 font-medium bg-slate-50/50">
          <div>
            Showing <strong className="text-slate-800">{filteredAccounts.length}</strong> connected mail IDs
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* DIRECT USER ASSIGNMENT MODAL ("stright to that selecting the users")      */}
      {/* ========================================================================= */}
      {assignModalAccount && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150"
          onClick={(e) => {
            if (e.target === e.currentTarget && !savingAssignment) setAssignModalAccount(null);
          }}
        >
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center font-bold">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Select Users for Mail ID
                  </h3>
                  <p className="text-xs text-slate-500 font-mono truncate max-w-xs">
                    {assignModalAccount.email}
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={savingAssignment}
                onClick={() => setAssignModalAccount(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              {/* Option 1: Support All Users */}
              <div
                onClick={() => setAssignIsShared(!assignIsShared)}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-start gap-3 select-none ${
                  assignIsShared
                    ? 'bg-blue-50/70 border-blue-300 ring-2 ring-blue-100'
                    : 'bg-slate-50 border-slate-200 hover:bg-slate-100/70'
                }`}
              >
                <input
                  type="checkbox"
                  checked={assignIsShared}
                  onChange={() => {}}
                  className="mt-0.5 w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
                />
                <div>
                  <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 text-blue-600" />
                    <span>Support All Users (Company-wide Shared Mailbox)</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Every active employee in {company?.name || 'the organization'} can send and receive emails through this mail ID.
                  </p>
                </div>
              </div>

              {/* Option 2: Individual User Picker */}
              {!assignIsShared && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700">
                      Select Specific Users ({assignUserIds.length} selected):
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setAssignUserIds(colleagues.map((c) => c.id))}
                        className="text-[11px] font-bold text-blue-600 hover:text-blue-800 cursor-pointer"
                      >
                        Select All
                      </button>
                      <span className="text-slate-300">|</span>
                      <button
                        type="button"
                        onClick={() => setAssignUserIds([])}
                        className="text-[11px] font-bold text-slate-500 hover:text-slate-700 cursor-pointer"
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  {/* Filter Colleagues Input */}
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      placeholder="Search colleagues by name, email, or role..."
                      value={assignUserSearch}
                      onChange={(e) => setAssignUserSearch(e.target.value)}
                      className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* Colleagues Checkbox List */}
                  <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-xl">
                    {filteredColleagues.length === 0 ? (
                      <div className="p-4 text-center text-xs text-slate-400">
                        No team members match "{assignUserSearch}"
                      </div>
                    ) : (
                      filteredColleagues.map((col) => {
                        const isChecked = assignUserIds.includes(col.id);
                        return (
                          <div
                            key={col.id}
                            onClick={() => toggleAssignUser(col.id)}
                            className={`p-3 text-xs flex items-center justify-between cursor-pointer transition-colors ${
                              isChecked ? 'bg-blue-50/50' : 'hover:bg-slate-50'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-7 h-7 rounded-full bg-slate-800 text-white font-bold text-[10px] flex items-center justify-center shrink-0">
                                {col.full_name ? col.full_name.slice(0, 2).toUpperCase() : 'U'}
                              </div>
                              <div className="min-w-0">
                                <div className="font-bold text-slate-900 truncate">
                                  {col.full_name || 'Staff User'}
                                </div>
                                <div className="text-[10px] text-slate-400 font-mono truncate">
                                  {col.email} • <span className="capitalize">{col.role || 'Member'}</span>
                                </div>
                              </div>
                            </div>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {}}
                              className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 pointer-events-none"
                            />
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-100 flex items-center justify-end gap-2 bg-slate-50/70 shrink-0">
              <button
                type="button"
                disabled={savingAssignment}
                onClick={() => setAssignModalAccount(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={savingAssignment}
                onClick={handleSaveUserAssignment}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-sm shadow-blue-500/20 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {savingAssignment ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Save User Assignment</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* CONNECT NEW / EDIT MAIL ID MODAL (Opened by Top Adding Button)             */}
      {/* ========================================================================= */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150"
          onClick={(e) => {
            if (e.target === e.currentTarget && !connecting) setModalOpen(false);
          }}
        >
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center font-bold">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {editingAccount ? 'Edit Connected Mail ID' : 'Connect New Mail ID'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Integrate your company mailbox with automated live SMTP/IMAP verification.
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={connecting}
                onClick={() => setModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form Body */}
            <form onSubmit={handleSaveConnection} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-6 space-y-5 overflow-y-auto flex-1">
                {/* 1. Provider Cards */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 font-mono">
                    Select Email Provider
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {(
                      [
                        { id: 'gmail', label: 'Gmail / Google', icon: 'Google' },
                        { id: 'outlook', label: 'Outlook / M365', icon: 'Microsoft' },
                        { id: 'zoho', label: 'Zoho Mail', icon: 'Zoho' },
                        { id: 'other', label: 'Custom / Other', icon: 'SMTP/IMAP' },
                      ] as const
                    ).map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => selectProvider(p.id)}
                        className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                          connProvider === p.id
                            ? 'bg-blue-50 border-blue-600 text-blue-700 font-bold ring-2 ring-blue-100 shadow-xs'
                            : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <div className="text-xs font-bold">{p.label}</div>
                      </button>
                    ))}
                  </div>

                  {/* Provider Guide Hint */}
                  <div className="mt-2.5 p-3 rounded-xl bg-blue-50/70 border border-blue-100 text-[11px] text-blue-900 flex items-start gap-2">
                    <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                    <div className="leading-relaxed">
                      <span>{PROVIDER_PRESETS[connProvider].guide}</span>
                      {PROVIDER_PRESETS[connProvider].guideUrl && (
                        <a
                          href={PROVIDER_PRESETS[connProvider].guideUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 font-bold text-blue-700 hover:underline ml-1"
                        >
                          <span>Generate Password</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>

                {/* 2. Mailbox Credentials */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Email Address <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="e.g. sales@yourcompany.com"
                      value={connEmail}
                      onChange={(e) => setConnEmail(e.target.value)}
                      className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      App Password / Password {editingAccount && <span className="text-slate-400 font-normal">(Leave blank to keep current)</span>}
                    </label>
                    <input
                      type="password"
                      required={!editingAccount}
                      placeholder={PROVIDER_PRESETS[connProvider].pwHint}
                      value={connPass}
                      onChange={(e) => setConnPass(e.target.value)}
                      className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* 3. Display Name & Capabilities */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      From Display Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Argus Sales & Invoicing"
                      value={connFromName}
                      onChange={(e) => setConnFromName(e.target.value)}
                      className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Mailbox Mode
                    </label>
                    <select
                      value={connType}
                      onChange={(e) => setConnType(e.target.value as MailIntegrationType)}
                      className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="both">Send &amp; Receive (SMTP + IMAP) — Recommended</option>
                      <option value="sending">Sending Only (SMTP Outbound)</option>
                      <option value="receiving">Receiving Only (IMAP Inbound)</option>
                    </select>
                  </div>
                </div>

                {/* 4. Supported Users (Selecting the Users Directly in Setup) */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wider font-mono">
                      Which Users Should This Mail ID Support?
                    </span>
                  </div>

                  <div
                    onClick={() => setConnIsShared(!connIsShared)}
                    className={`p-3 rounded-lg border transition-all cursor-pointer flex items-center gap-2.5 ${
                      connIsShared ? 'bg-white border-blue-400 ring-1 ring-blue-200' : 'bg-white border-slate-200'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={connIsShared}
                      onChange={() => {}}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
                    />
                    <div>
                      <div className="text-xs font-bold text-slate-800">Support All Users (Company-wide)</div>
                      <div className="text-[10px] text-slate-500">Every active staff member can access and dispatch through this mail ID.</div>
                    </div>
                  </div>

                  {!connIsShared && (
                    <div className="space-y-2 pt-1">
                      <div className="text-[11px] font-bold text-slate-600">Or Select Specific Users:</div>
                      <div className="max-h-40 overflow-y-auto divide-y divide-slate-100 bg-white border border-slate-200 rounded-xl">
                        {colleagues.map((col) => {
                          const isSelected = connAssignedUsers.includes(col.id);
                          return (
                            <div
                              key={col.id}
                              onClick={() => {
                                setConnAssignedUsers((prev) =>
                                  prev.includes(col.id) ? prev.filter((id) => id !== col.id) : [...prev, col.id]
                                );
                              }}
                              className="p-2.5 text-xs flex items-center justify-between cursor-pointer hover:bg-slate-50"
                            >
                              <div className="min-w-0">
                                <div className="font-bold text-slate-900 truncate">{col.full_name || 'Staff User'}</div>
                                <div className="text-[10px] text-slate-400 truncate">{col.email}</div>
                              </div>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => {}}
                                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* 5. Toggle Advanced Server Settings (SMTP / IMAP hosts) */}
                <div>
                  <button
                    type="button"
                    onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
                    className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
                  >
                    <span>{showAdvancedSettings ? '− Hide' : '+ Show'} Advanced Server Settings (Host/Port)</span>
                  </button>

                  {showAdvancedSettings && (
                    <div className="mt-3 p-4 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">SMTP Outbound Host</label>
                        <input
                          type="text"
                          value={connSmtpHost}
                          onChange={(e) => setConnSmtpHost(e.target.value)}
                          className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">SMTP Port</label>
                        <input
                          type="text"
                          value={connSmtpPort}
                          onChange={(e) => setConnSmtpPort(e.target.value)}
                          className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">IMAP Inbound Host</label>
                        <input
                          type="text"
                          value={connImapHost}
                          onChange={(e) => setConnImapHost(e.target.value)}
                          className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">IMAP Port</label>
                        <input
                          type="text"
                          value={connImapPort}
                          onChange={(e) => setConnImapPort(e.target.value)}
                          className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t border-slate-100 flex items-center justify-end gap-2.5 bg-slate-50/70 shrink-0">
                <button
                  type="button"
                  disabled={connecting}
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={connecting}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-500/25 flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {connecting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Verifying &amp; Connecting...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>{editingAccount ? 'Save Changes' : 'Connect Mail ID'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
