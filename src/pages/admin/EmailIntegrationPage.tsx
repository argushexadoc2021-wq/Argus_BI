import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Mail, Send, Inbox, Sparkles, ShieldCheck, CheckCircle2, AlertCircle,
  Loader2, RefreshCw, Trash2, Edit2, Plus, ExternalLink, Lock, Users,
  Search, Building2, Server, Key, ArrowRight, Clock, CornerUpLeft,
  Sliders, Check, X, Shield, ArrowUpDown, ChevronDown, ChevronRight, FileText,
  BadgeAlert, Info
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import {
  mailIntegrationApi,
  type EmailAccount,
  type UserMailPermission,
  type InboundEmail,
  type SentEmailLog,
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
    pwHint: '16-letter App Password',
    guide: 'Open Google Account → Security → 2-Step Verification → App passwords. Create one named "Argus CNC" and paste the 16 letters here.',
    guideUrl: 'https://myaccount.google.com/apppasswords',
  },
  outlook: {
    name: 'Outlook / Microsoft 365',
    host: 'smtp.office365.com',
    port: 587,
    imapHost: 'outlook.office365.com',
    imapPort: 993,
    pwHint: 'Account password or App Password',
    guide: 'Open Microsoft Account → Security → Advanced Security Options → App Passwords. For Microsoft 365 Exchange, ensure SMTP AUTH is enabled by IT.',
    guideUrl: 'https://account.live.com/proofs/AppPassword',
  },
  zoho: {
    name: 'Zoho Mail',
    host: 'smtp.zoho.in',
    port: 587,
    imapHost: 'imap.zoho.in',
    imapPort: 993,
    pwHint: 'Application-specific Password',
    guide: 'Open Zoho Accounts → Security → App Passwords → Generate New. For non-India regions use smtp.zoho.com and imap.zoho.com.',
    guideUrl: 'https://accounts.zoho.in/home#security/app_password',
  },
  other: {
    name: 'Other (Company / Custom)',
    host: '',
    port: 587,
    imapHost: '',
    imapPort: 993,
    pwHint: 'Mailbox Password or App Password',
    guide: 'Obtain outgoing (SMTP) and incoming (IMAP) host names and ports from your IT administrator or hosting control panel.',
  },
};

export function EmailIntegrationPage() {
  const { profile, company, isSuperAdmin, isCompanyAdmin } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  // Active tab: 'accounts' | 'connect' | 'composer' | 'inbound' | 'permissions' | 'logs'
  const activeTab = searchParams.get('tab') || 'accounts';
  const setActiveTab = (tab: string) => {
    setSearchParams({ tab }, { replace: true });
  };

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
  const [inboundEmails, setInboundEmails] = useState<InboundEmail[]>([]);
  const [userPermissions, setUserPermissions] = useState<UserMailPermission[]>([]);
  const [logs, setLogs] = useState<any[]>([]);

  // Feedback banner
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Load Accounts & Colleagues
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

  // Load Tab specific data
  useEffect(() => {
    if (activeTab === 'inbound') {
      mailIntegrationApi.getInbound().then((r) => setInboundEmails(r.emails || [])).catch(() => {});
    } else if (activeTab === 'permissions' && (isSuperAdmin || isCompanyAdmin)) {
      mailIntegrationApi.getPermissions(company?.id).then((r) => setUserPermissions(r.users || [])).catch(() => {});
    } else if (activeTab === 'logs') {
      mailIntegrationApi.getLogs().then((r) => setLogs(r.logs || [])).catch(() => {});
    }
  }, [activeTab, company?.id, isSuperAdmin, isCompanyAdmin]);

  // KPIs
  const sendingCount = useMemo(() => accounts.filter((a) => a.type === 'sending' || a.type === 'both').length, [accounts]);
  const receivingCount = useMemo(() => accounts.filter((a) => a.type === 'receiving' || a.type === 'both').length, [accounts]);

  // ------------------------------------------------------------------------------------
  // TAB 1: CONNECTED MAILBOXES STATE
  // ------------------------------------------------------------------------------------
  const [accountFilter, setAccountFilter] = useState<'all' | 'sending' | 'receiving' | 'both'>('all');
  const [accountSearch, setAccountSearch] = useState('');
  const [testingId, setTestingId] = useState<string | null>(null);
  const [editingAccount, setEditingAccount] = useState<EmailAccount | null>(null);

  const filteredAccounts = useMemo(() => {
    return accounts.filter((a) => {
      if (accountFilter !== 'all' && a.type !== accountFilter) return false;
      if (accountSearch) {
        const q = accountSearch.toLowerCase();
        return a.name.toLowerCase().includes(q) || a.email.toLowerCase().includes(q) || a.provider.toLowerCase().includes(q);
      }
      return true;
    });
  }, [accounts, accountFilter, accountSearch]);

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

  const handleDeleteAccount = async (id: string, email: string) => {
    if (!window.confirm(`Disconnect mailbox ${email}? Outgoing AI dispatch and inbound sync for this account will stop.`)) return;
    try {
      await mailIntegrationApi.deleteAccount(id);
      setFeedback({ type: 'success', message: `Mailbox ${email} disconnected.` });
      loadData();
    } catch (e: any) {
      setFeedback({ type: 'error', message: e.message });
    }
  };

  // ------------------------------------------------------------------------------------
  // TAB 2: CONNECT NEW MAILBOX FORM STATE
  // ------------------------------------------------------------------------------------
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
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    if (editingAccount) {
      setConnProvider(editingAccount.provider);
      setConnType(editingAccount.type);
      setConnName(editingAccount.name);
      setConnEmail(editingAccount.email);
      setConnPass('');
      setConnFromName(editingAccount.from_name || '');
      setConnSmtpHost(editingAccount.smtp_host || PROVIDER_PRESETS[editingAccount.provider].host);
      setConnSmtpPort(String(editingAccount.smtp_port || 587));
      setConnImapHost(editingAccount.imap_host || PROVIDER_PRESETS[editingAccount.provider].imapHost);
      setConnImapPort(String(editingAccount.imap_port || 993));
      setConnImapSsl(editingAccount.imap_ssl !== false);
      setConnIsShared(editingAccount.is_shared);
      setConnAssignedUsers(editingAccount.assigned_user_ids || []);
    }
  }, [editingAccount]);

  const selectProvider = (p: MailProviderType) => {
    setConnProvider(p);
    const preset = PROVIDER_PRESETS[p];
    setConnSmtpHost(preset.host);
    setConnSmtpPort(String(preset.port));
    setConnImapHost(preset.imapHost);
    setConnImapPort(String(preset.imapPort));
  };

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

      setFeedback({ type: 'success', message: res.message || 'Mailbox connected successfully!' });
      setConnEmail('');
      setConnPass('');
      setConnName('');
      setEditingAccount(null);
      await loadData();
      setActiveTab('accounts');
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Connection test failed.' });
    } finally {
      setConnecting(false);
    }
  };

  // ------------------------------------------------------------------------------------
  // TAB 3: AI EMAIL COMPOSER STATE
  // ------------------------------------------------------------------------------------
  const sendingAccounts = useMemo(() => accounts.filter((a) => a.type === 'sending' || a.type === 'both'), [accounts]);
  const [composerAccountId, setComposerAccountId] = useState<string>('');

  useEffect(() => {
    if (sendingAccounts.length > 0 && !composerAccountId) {
      setComposerAccountId(sendingAccounts[0].id);
    }
  }, [sendingAccounts, composerAccountId]);

  const [composerTo, setComposerTo] = useState('');
  const [composerCc, setComposerCc] = useState('');
  const [composerBcc, setComposerBcc] = useState('');
  const [composerSubject, setComposerSubject] = useState('');
  const [composerBody, setComposerBody] = useState('');
  const [composerPrompt, setComposerPrompt] = useState('');
  const [composerRecipientName, setComposerRecipientName] = useState('');
  const [composerTone, setComposerTone] = useState<'professional' | 'formal' | 'friendly' | 'urgent' | 'persuasive'>('professional');
  const [generatingAi, setGeneratingAi] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);

  const handleGenerateAi = async (customPrompt?: string, purpose?: any) => {
    setGeneratingAi(true);
    setFeedback(null);
    try {
      const res = await mailIntegrationApi.aiCompose({
        prompt: customPrompt || composerPrompt || 'Follow up politely on the quotation proposal.',
        purpose: purpose || 'general',
        tone: composerTone,
        recipient_name: composerRecipientName || (composerTo.split('@')[0] || 'Valued Partner'),
      });
      setComposerSubject(res.subject);
      setComposerBody(res.body);
      setFeedback({ type: 'success', message: '✨ Email drafted by AI! You can review or edit before sending.' });
    } catch (e: any) {
      setFeedback({ type: 'error', message: e.message || 'Failed to draft email with AI.' });
    } finally {
      setGeneratingAi(false);
    }
  };

  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!composerAccountId) {
      setFeedback({ type: 'error', message: 'Please select a connected sending mailbox.' });
      return;
    }
    setSendingEmail(true);
    setFeedback(null);

    try {
      const res = await mailIntegrationApi.sendEmail({
        account_id: composerAccountId,
        to: composerTo,
        cc: composerCc,
        bcc: composerBcc,
        subject: composerSubject,
        body: composerBody,
        is_ai_generated: true,
        ai_prompt: composerPrompt,
      });

      setFeedback({ type: 'success', message: `🚀 ${res.message} (Message ID: ${res.messageId || 'sent'})` });
      setComposerTo('');
      setComposerCc('');
      setComposerBcc('');
      setComposerSubject('');
      setComposerBody('');
      setComposerPrompt('');
    } catch (e: any) {
      setFeedback({ type: 'error', message: e.message || 'Failed to dispatch email.' });
    } finally {
      setSendingEmail(false);
    }
  };

  // ------------------------------------------------------------------------------------
  // TAB 4: INBOUND MAIL VIEWER STATE
  // ------------------------------------------------------------------------------------
  const receivingAccounts = useMemo(() => accounts.filter((a) => a.type === 'receiving' || a.type === 'both'), [accounts]);
  const [inboundAccountId, setInboundAccountId] = useState<string>('all');
  const [syncingInbox, setSyncingInbox] = useState(false);
  const [selectedInboundEmail, setSelectedInboundEmail] = useState<InboundEmail | null>(null);

  const filteredInbound = useMemo(() => {
    if (inboundAccountId === 'all') return inboundEmails;
    return inboundEmails.filter((m) => m.account_id === inboundAccountId);
  }, [inboundEmails, inboundAccountId]);

  useEffect(() => {
    if (filteredInbound.length > 0 && !selectedInboundEmail) {
      setSelectedInboundEmail(filteredInbound[0]);
    }
  }, [filteredInbound, selectedInboundEmail]);

  const handleSyncInbound = async () => {
    const accId = inboundAccountId === 'all' ? receivingAccounts[0]?.id : inboundAccountId;
    if (!accId) {
      setFeedback({ type: 'error', message: 'No receiving mailbox available to sync.' });
      return;
    }
    setSyncingInbox(true);
    setFeedback(null);
    try {
      const res = await mailIntegrationApi.syncInbound(accId);
      setFeedback({ type: 'success', message: res.message || 'Inbox synced successfully.' });
      const refreshed = await mailIntegrationApi.getInbound(inboundAccountId === 'all' ? undefined : inboundAccountId);
      setInboundEmails(refreshed.emails || []);
    } catch (e: any) {
      setFeedback({ type: 'error', message: e.message || 'Failed to sync inbound mailbox.' });
    } finally {
      setSyncingInbox(false);
    }
  };

  const handleReplyWithAi = (email: InboundEmail) => {
    setActiveTab('composer');
    setComposerTo(email.from_address);
    setComposerSubject(email.subject.startsWith('Re:') ? email.subject : `Re: ${email.subject}`);
    setComposerRecipientName(email.from_name || email.from_address.split('@')[0]);
    handleGenerateAi(`Reply addressing the inquiry: "${email.snippet || email.body_text.slice(0, 200)}"`, 'reply_inquiry');
  };

  // ------------------------------------------------------------------------------------
  // TAB 5: USER PERMISSIONS STATE
  // ------------------------------------------------------------------------------------
  const [savingPermUserId, setSavingPermUserId] = useState<string | null>(null);

  const handleTogglePerm = async (userId: string, key: 'can_connect_sending' | 'can_connect_receiving' | 'can_use_ai_composer', val: boolean) => {
    const usr = userPermissions.find((u) => u.user_id === userId);
    if (!usr) return;

    const updated = { ...usr, [key]: val };
    setUserPermissions((prev) => prev.map((u) => (u.user_id === userId ? updated : u)));
    setSavingPermUserId(userId);

    try {
      await mailIntegrationApi.savePermission({
        user_id: userId,
        company_id: company?.id,
        can_connect_sending: updated.can_connect_sending,
        can_connect_receiving: updated.can_connect_receiving,
        can_use_ai_composer: updated.can_use_ai_composer,
      });
      setFeedback({ type: 'success', message: `Permissions updated for ${usr.full_name}.` });
    } catch (e: any) {
      setFeedback({ type: 'error', message: e.message });
      setUserPermissions((prev) => prev.map((u) => (u.user_id === userId ? usr : u)));
    } finally {
      setSavingPermUserId(null);
    }
  };

  const handleToggleBothPerms = async (userId: string, enable: boolean) => {
    const usr = userPermissions.find((u) => u.user_id === userId);
    if (!usr) return;

    const updated = {
      ...usr,
      can_connect_sending: enable,
      can_connect_receiving: enable,
    };

    setUserPermissions((prev) => prev.map((u) => (u.user_id === userId ? updated : u)));
    setSavingPermUserId(userId);

    try {
      await mailIntegrationApi.savePermission({
        user_id: userId,
        company_id: company?.id,
        can_connect_sending: enable,
        can_connect_receiving: enable,
        can_use_ai_composer: usr.can_use_ai_composer,
      });
      setFeedback({ type: 'success', message: `Full self-setup permissions updated for ${usr.full_name}.` });
    } catch (e: any) {
      setFeedback({ type: 'error', message: e.message });
      setUserPermissions((prev) => prev.map((u) => (u.user_id === userId ? usr : u)));
    } finally {
      setSavingPermUserId(null);
    }
  };

  // ------------------------------------------------------------------------------------
  // RENDER (CLEAN CRISP LIGHT THEME - ZERO MURKY SILVER)
  // ------------------------------------------------------------------------------------
  return (
    <div className="min-h-full p-4 lg:p-6 space-y-6 bg-[#f8fafc] text-slate-800">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-orange-500 to-amber-500 text-white flex items-center justify-center shadow-md shadow-orange-500/20">
            <Mail size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight">
              Email Integration & Mailbox Hub
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              Connect multiple mailboxes, assign access user-wise or company-wide, draft emails with AI, and manage permissions.
            </p>
          </div>
        </div>

        {(isSuperAdmin || isCompanyAdmin || callerPerms.can_connect_sending || callerPerms.can_connect_receiving) && (
          <button
            type="button"
            onClick={() => {
              setEditingAccount(null);
              setActiveTab('connect');
            }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 font-bold text-xs text-white shadow-md shadow-orange-500/20 transition-all cursor-pointer self-start md:self-auto"
          >
            <Plus size={15} />
            <span>Connect New Mailbox</span>
          </button>
        )}
      </div>

      {/* KPI Highlights Cards (Clean Crisp White with Vibrant Badges) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <div className="p-4 rounded-2xl border border-slate-200 bg-white shadow-xs hover:shadow-sm transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500">
            <span>Total Mailboxes</span>
            <div className="w-7 h-7 rounded-lg bg-orange-50 border border-orange-200 flex items-center justify-center text-orange-600">
              <Mail size={14} />
            </div>
          </div>
          <div className="mt-3 text-2xl font-black text-slate-900">{accounts.length}</div>
          <p className="text-[11px] text-slate-500 font-medium mt-0.5">Multi-mailbox connections</p>
        </div>

        <div className="p-4 rounded-2xl border border-slate-200 bg-white shadow-xs hover:shadow-sm transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500">
            <span>Sending (Outbound & AI)</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
              <Send size={14} />
            </div>
          </div>
          <div className="mt-3 text-2xl font-black text-emerald-600">{sendingCount}</div>
          <p className="text-[11px] text-slate-500 font-medium mt-0.5">Ready for AI dispatch</p>
        </div>

        <div className="p-4 rounded-2xl border border-slate-200 bg-white shadow-xs hover:shadow-sm transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500">
            <span>Receiving (Inbound)</span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
              <Inbox size={14} />
            </div>
          </div>
          <div className="mt-3 text-2xl font-black text-blue-600">{receivingCount}</div>
          <p className="text-[11px] text-slate-500 font-medium mt-0.5">IMAP synced mailboxes</p>
        </div>

        <div className="p-4 rounded-2xl border border-slate-200 bg-white shadow-xs hover:shadow-sm transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500">
            <span>Access Mode</span>
            <div className="w-7 h-7 rounded-lg bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-600">
              <Shield size={14} />
            </div>
          </div>
          <div className="mt-3 text-base font-black text-purple-700">
            {isSuperAdmin ? 'Super Admin' : isCompanyAdmin ? 'Company Admin' : 'Assigned User'}
          </div>
          <p className="text-[11px] text-slate-500 font-medium mt-0.5">
            {callerPerms.can_connect_sending && callerPerms.can_connect_receiving
              ? 'Self-setup enabled'
              : 'Admin-managed permissions'}
          </p>
        </div>
      </div>

      {/* Global Feedback Alert Banner */}
      {feedback && (
        <div
          className={`flex items-center justify-between p-3.5 rounded-xl border text-xs font-medium shadow-xs ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
              : 'bg-red-50 border-red-300 text-red-900'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? <CheckCircle2 size={16} className="text-emerald-600" /> : <AlertCircle size={16} className="text-red-600" />}
            <span>{feedback.message}</span>
          </div>
          <button type="button" onClick={() => setFeedback(null)} className="opacity-70 hover:opacity-100 cursor-pointer">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Modern Navigation Tabs (Clean Crisp White/Slate Bar) */}
      <div className="flex flex-wrap gap-1.5 p-1.5 rounded-2xl bg-white border border-slate-200 shadow-xs">
        <button
          type="button"
          onClick={() => setActiveTab('accounts')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'accounts'
              ? 'bg-orange-500 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Mail size={15} />
          <span>Connected Mailboxes</span>
          <span className={`ml-1 rounded-full px-1.5 py-0.2 text-[10px] font-bold ${activeTab === 'accounts' ? 'bg-white/25 text-white' : 'bg-slate-200 text-slate-700'}`}>
            {accounts.length}
          </span>
        </button>

        {(isSuperAdmin || isCompanyAdmin || callerPerms.can_connect_sending || callerPerms.can_connect_receiving) && (
          <button
            type="button"
            onClick={() => {
              setEditingAccount(null);
              setActiveTab('connect');
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'connect'
                ? 'bg-orange-500 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Plus size={15} />
            <span>Connect New Mailbox</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => setActiveTab('composer')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'composer'
              ? 'bg-orange-500 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Sparkles size={15} className={activeTab === 'composer' ? 'text-amber-200' : 'text-orange-500'} />
          <span>AI Email Composer & Send</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('inbound')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'inbound'
              ? 'bg-orange-500 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Inbox size={15} className={activeTab === 'inbound' ? 'text-white' : 'text-blue-500'} />
          <span>Inbound Mail Viewer</span>
        </button>

        {(isSuperAdmin || isCompanyAdmin) && (
          <button
            type="button"
            onClick={() => setActiveTab('permissions')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'permissions'
                ? 'bg-orange-500 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <ShieldCheck size={15} className={activeTab === 'permissions' ? 'text-white' : 'text-emerald-500'} />
            <span>User Permissions</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => setActiveTab('logs')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'logs'
              ? 'bg-orange-500 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Clock size={15} />
          <span>Dispatch & Audit Logs</span>
        </button>
      </div>

      {/* ----------------------------------------------------------------------------- */}
      {/* TAB 1: CONNECTED MAILBOXES                                                    */}
      {/* ----------------------------------------------------------------------------- */}
      {activeTab === 'accounts' && (
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="flex flex-col md:flex-row gap-3 items-center justify-between p-3.5 rounded-2xl bg-white border border-slate-200 shadow-xs">
            <div className="flex items-center gap-2 w-full md:w-auto">
              <div className="relative flex-1 md:w-72">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search mailboxes by email, name..."
                  value={accountSearch}
                  onChange={(e) => setAccountSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-orange-500"
                />
              </div>

              <div className="flex gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
                {(['all', 'sending', 'receiving', 'both'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setAccountFilter(t)}
                    className={`px-3 py-1 rounded-lg capitalize font-bold text-[11px] cursor-pointer transition-all ${
                      accountFilter === t ? 'bg-orange-500 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto justify-end">
              <button
                type="button"
                onClick={loadData}
                disabled={loading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 transition-colors shadow-xs cursor-pointer"
              >
                <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                <span>Refresh</span>
              </button>

              {(isSuperAdmin || isCompanyAdmin || callerPerms.can_connect_sending || callerPerms.can_connect_receiving) && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingAccount(null);
                    setActiveTab('connect');
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-orange-500 hover:bg-orange-600 font-bold text-xs text-white transition-colors shadow-sm cursor-pointer"
                >
                  <Plus size={14} />
                  <span>Connect Mailbox</span>
                </button>
              )}
            </div>
          </div>

          {/* Accounts Grid or Clean White Empty State */}
          {filteredAccounts.length === 0 ? (
            <div className="p-12 text-center rounded-2xl border border-slate-200 bg-white shadow-xs space-y-3">
              <div className="w-16 h-16 rounded-3xl bg-orange-50 border border-orange-200 text-orange-500 flex items-center justify-center mx-auto mb-3 shadow-xs">
                <Mail size={32} />
              </div>
              <h3 className="text-base font-bold text-slate-800">No Connected Mailboxes Found</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                Connect your business or personal mailbox (Gmail, Outlook, Zoho, Custom SMTP/IMAP) to enable AI email dispatch and inbound message synchronization.
              </p>
              {(isSuperAdmin || isCompanyAdmin || callerPerms.can_connect_sending || callerPerms.can_connect_receiving) && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingAccount(null);
                    setActiveTab('connect');
                  }}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 font-bold text-xs text-white shadow-md shadow-orange-500/20 transition-all cursor-pointer"
                >
                  <Plus size={15} />
                  <span>Connect Your First Mailbox</span>
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredAccounts.map((acc) => {
                const isTestingSmtp = testingId === `${acc.id}-smtp`;
                const isTestingImap = testingId === `${acc.id}-imap`;
                const assignedNames = (acc.assigned_user_ids || [])
                  .map((uid) => colleagues.find((c) => c.id === uid)?.full_name)
                  .filter(Boolean);

                return (
                  <div
                    key={acc.id}
                    className="p-5 rounded-2xl border border-slate-200 bg-white hover:border-orange-300 hover:shadow-md transition-all flex flex-col justify-between shadow-xs space-y-4"
                  >
                    <div>
                      {/* Top Row: Provider & Status */}
                      <div className="flex items-center justify-between mb-2.5">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-orange-50 text-orange-700 border border-orange-200">
                            {acc.provider}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                              acc.type === 'both'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : acc.type === 'sending'
                                ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                : 'bg-blue-50 text-blue-700 border border-blue-200'
                            }`}
                          >
                            {acc.type === 'both' ? 'Send & Receive' : acc.type === 'sending' ? 'Sending Only' : 'Receiving Only'}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          <span>Connected</span>
                        </div>
                      </div>

                      {/* Name & Email */}
                      <h4 className="text-sm font-bold text-slate-800 truncate">{acc.name}</h4>
                      <p className="text-xs text-slate-500 font-mono truncate">{acc.email}</p>

                      {/* Display name */}
                      {acc.from_name && (
                        <p className="text-[11px] text-slate-500 mt-1">
                          Display Name: <span className="font-semibold text-slate-700">{acc.from_name}</span>
                        </p>
                      )}

                      {/* Server Details */}
                      <div className="mt-3 p-2.5 rounded-xl bg-slate-50 border border-slate-200/60 space-y-1 text-[11px] text-slate-600">
                        {(acc.type === 'sending' || acc.type === 'both') && (
                          <div className="flex items-center justify-between">
                            <span className="flex items-center gap-1.5 text-slate-700 font-medium">
                              <Send size={11} className="text-purple-600" /> SMTP Outbound
                            </span>
                            <span className="font-mono text-slate-500">{acc.smtp_host}:{acc.smtp_port}</span>
                          </div>
                        )}
                        {(acc.type === 'receiving' || acc.type === 'both') && (
                          <div className="flex items-center justify-between">
                            <span className="flex items-center gap-1.5 text-slate-700 font-medium">
                              <Inbox size={11} className="text-blue-600" /> IMAP Inbound
                            </span>
                            <span className="font-mono text-slate-500">{acc.imap_host}:{acc.imap_port}</span>
                          </div>
                        )}
                      </div>

                      {/* Assignment Badge */}
                      <div className="mt-3 text-[11px]">
                        {acc.is_shared ? (
                          <div className="flex items-center gap-1.5 text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 font-medium">
                            <Building2 size={12} className="text-emerald-600" />
                            <span>Company Shared Mailbox (All Authorized Users)</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200 font-medium">
                            <Users size={12} className="text-orange-500" />
                            <span className="truncate">
                              Assigned to:{' '}
                              {assignedNames.length > 0 ? assignedNames.join(', ') : 'Personal Account'}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Actions Row */}
                    <div className="pt-3 border-t border-slate-100 flex flex-wrap gap-1.5 items-center justify-between text-xs">
                      <div className="flex gap-1.5">
                        {(acc.type === 'sending' || acc.type === 'both') && (
                          <button
                            type="button"
                            disabled={isTestingSmtp}
                            onClick={() => handleTestAccount(acc, 'smtp')}
                            className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold border border-slate-200 transition-colors inline-flex items-center gap-1 cursor-pointer"
                            title="Test SMTP Handshake"
                          >
                            {isTestingSmtp ? <Loader2 size={11} className="animate-spin" /> : <Server size={11} />}
                            <span>Test SMTP</span>
                          </button>
                        )}

                        {(acc.type === 'receiving' || acc.type === 'both') && (
                          <button
                            type="button"
                            disabled={isTestingImap}
                            onClick={() => handleTestAccount(acc, 'imap')}
                            className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold border border-slate-200 transition-colors inline-flex items-center gap-1 cursor-pointer"
                            title="Test IMAP Handshake"
                          >
                            {isTestingImap ? <Loader2 size={11} className="animate-spin" /> : <Inbox size={11} />}
                            <span>Test IMAP</span>
                          </button>
                        )}
                      </div>

                      <div className="flex gap-1">
                        {(acc.type === 'sending' || acc.type === 'both') && (
                          <button
                            type="button"
                            onClick={() => {
                              setComposerAccountId(acc.id);
                              setActiveTab('composer');
                            }}
                            className="p-1.5 rounded-lg bg-orange-50 hover:bg-orange-100 text-orange-600 transition-colors cursor-pointer"
                            title="Compose with AI"
                          >
                            <Sparkles size={14} />
                          </button>
                        )}

                        {(acc.type === 'receiving' || acc.type === 'both') && (
                          <button
                            type="button"
                            onClick={() => {
                              setInboundAccountId(acc.id);
                              setActiveTab('inbound');
                            }}
                            className="p-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 transition-colors cursor-pointer"
                            title="View Synced Inbox"
                          >
                            <Inbox size={14} />
                          </button>
                        )}

                        {(isSuperAdmin || isCompanyAdmin || acc.created_by === profile?.id) && (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingAccount(acc);
                                setActiveTab('connect');
                              }}
                              className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
                              title="Edit Mailbox Details"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteAccount(acc.id, acc.email)}
                              className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 transition-colors cursor-pointer"
                              title="Disconnect Mailbox"
                            >
                              <Trash2 size={14} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ----------------------------------------------------------------------------- */}
      {/* TAB 2: CONNECT NEW MAILBOX FORM                                               */}
      {/* ----------------------------------------------------------------------------- */}
      {activeTab === 'connect' && (
        <div className="max-w-4xl mx-auto p-6 md:p-8 rounded-2xl border border-slate-200 bg-white shadow-sm space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-200">
            <div>
              <h3 className="text-lg font-bold text-slate-800">
                {editingAccount ? `Edit Mailbox: ${editingAccount.name}` : 'Connect New Mailbox'}
              </h3>
              <p className="text-xs text-slate-500">
                Configure SMTP for AI outbound dispatch, IMAP for inbound sync, and assign user permissions.
              </p>
            </div>
            {editingAccount && (
              <button
                type="button"
                onClick={() => {
                  setEditingAccount(null);
                  setActiveTab('accounts');
                }}
                className="px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-700 cursor-pointer"
              >
                Cancel Edit
              </button>
            )}
          </div>

          <form onSubmit={handleSaveConnection} className="space-y-6">
            {/* 1. Integration Purpose / Type Selector */}
            <div className="space-y-2.5">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                1. Select Integration Capability
              </label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => setConnType('both')}
                  className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                    connType === 'both'
                      ? 'border-orange-500 bg-orange-50/60 text-slate-900 ring-2 ring-orange-500/20 shadow-xs'
                      : 'border-slate-200 bg-slate-50/60 text-slate-600 hover:bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2 font-bold text-sm text-slate-800 mb-1">
                    <ArrowUpDown size={16} className="text-orange-500" />
                    <span>Both (Sending & Receiving)</span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Full dual integration: AI outbound dispatch via SMTP + mailbox sync & reading via IMAP.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setConnType('sending')}
                  className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                    connType === 'sending'
                      ? 'border-purple-500 bg-purple-50/60 text-slate-900 ring-2 ring-purple-500/20 shadow-xs'
                      : 'border-slate-200 bg-slate-50/60 text-slate-600 hover:bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2 font-bold text-sm text-slate-800 mb-1">
                    <Send size={16} className="text-purple-600" />
                    <span>Sending Mail Only (SMTP & AI)</span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Outbound email dispatch only. Send quotations, invoices, and AI drafted emails.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setConnType('receiving')}
                  className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                    connType === 'receiving'
                      ? 'border-blue-500 bg-blue-50/60 text-slate-900 ring-2 ring-blue-500/20 shadow-xs'
                      : 'border-slate-200 bg-slate-50/60 text-slate-600 hover:bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2 font-bold text-sm text-slate-800 mb-1">
                    <Inbox size={16} className="text-blue-600" />
                    <span>Receiving Mail Only (IMAP)</span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Connect existing mailbox to sync and review incoming supplier and customer emails.
                  </p>
                </button>
              </div>
            </div>

            {/* 2. Provider Preset Selector */}
            <div className="space-y-2.5">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                2. Choose Email Service Provider
              </label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {(['gmail', 'outlook', 'zoho', 'other'] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => selectProvider(p)}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-all text-center cursor-pointer ${
                      connProvider === p
                        ? 'border-orange-500 bg-orange-500 text-white shadow-xs'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 hover:border-slate-300'
                    }`}
                  >
                    {PROVIDER_PRESETS[p].name}
                  </button>
                ))}
              </div>

              {/* Provider Guide Info Box */}
              <div className="p-3.5 rounded-xl bg-orange-50/80 border border-orange-200 text-xs text-slate-700 flex items-start gap-2.5">
                <Info size={16} className="text-orange-600 shrink-0 mt-0.5" />
                <div className="flex-1 text-[11px] leading-relaxed">
                  <span>{PROVIDER_PRESETS[connProvider].guide}</span>
                  {PROVIDER_PRESETS[connProvider].guideUrl && (
                    <a
                      href={PROVIDER_PRESETS[connProvider].guideUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="ml-2 inline-flex items-center gap-1 font-bold text-orange-600 underline hover:text-orange-700"
                    >
                      Open Security Settings <ExternalLink size={10} />
                    </a>
                  )}
                </div>
              </div>
            </div>

            {/* 3. Credentials & Details */}
            <div className="space-y-4 pt-2">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                3. Mailbox Credentials
              </label>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Mailbox Label / Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Sales Inquiries, Operations Dispatch"
                    value={connName}
                    onChange={(e) => setConnName(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs rounded-xl bg-white border border-slate-300 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 shadow-2xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Email Address</label>
                  <input
                    type="email"
                    required
                    placeholder="name@company.com"
                    value={connEmail}
                    onChange={(e) => setConnEmail(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs rounded-xl bg-white border border-slate-300 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 shadow-2xs font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">
                    {PROVIDER_PRESETS[connProvider].pwHint}
                    {editingAccount && <span className="ml-1 text-[10px] text-slate-400 font-normal">(Leave blank to keep saved)</span>}
                  </label>
                  <input
                    type="password"
                    required={!editingAccount}
                    placeholder={editingAccount ? '•••••••••••••••• (blank = keep)' : 'Enter password / app password'}
                    value={connPass}
                    onChange={(e) => setConnPass(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs rounded-xl bg-white border border-slate-300 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 shadow-2xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Sender Display Name (Receivers See This)</label>
                  <input
                    type="text"
                    placeholder="e.g. Argus Technologies Sales"
                    value={connFromName}
                    onChange={(e) => setConnFromName(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs rounded-xl bg-white border border-slate-300 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 shadow-2xs"
                  />
                </div>
              </div>

              {/* Advanced Server Settings for SMTP/IMAP */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                {(connType === 'sending' || connType === 'both') && (
                  <div className="space-y-2">
                    <span className="font-bold text-slate-700 flex items-center gap-1.5">
                      <Send size={12} className="text-purple-600" /> Outbound SMTP Server
                    </span>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="smtp.example.com"
                        value={connSmtpHost}
                        onChange={(e) => setConnSmtpHost(e.target.value)}
                        className="flex-1 px-3 py-1.5 text-xs rounded-lg bg-white border border-slate-300 text-slate-900 font-mono focus:border-orange-500 focus:outline-none"
                      />
                      <input
                        type="text"
                        placeholder="587"
                        value={connSmtpPort}
                        onChange={(e) => setConnSmtpPort(e.target.value)}
                        className="w-16 px-2 py-1.5 text-xs rounded-lg bg-white border border-slate-300 text-slate-900 font-mono text-center focus:border-orange-500 focus:outline-none"
                      />
                    </div>
                  </div>
                )}

                {(connType === 'receiving' || connType === 'both') && (
                  <div className="space-y-2">
                    <span className="font-bold text-slate-700 flex items-center gap-1.5">
                      <Inbox size={12} className="text-blue-600" /> Inbound IMAP Server
                    </span>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="imap.example.com"
                        value={connImapHost}
                        onChange={(e) => setConnImapHost(e.target.value)}
                        className="flex-1 px-3 py-1.5 text-xs rounded-lg bg-white border border-slate-300 text-slate-900 font-mono focus:border-orange-500 focus:outline-none"
                      />
                      <input
                        type="text"
                        placeholder="993"
                        value={connImapPort}
                        onChange={(e) => setConnImapPort(e.target.value)}
                        className="w-16 px-2 py-1.5 text-xs rounded-lg bg-white border border-slate-300 text-slate-900 font-mono text-center focus:border-orange-500 focus:outline-none"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 4. Assignment & Access Scope (Admins only) */}
            {(isSuperAdmin || isCompanyAdmin) && (
              <div className="space-y-3 pt-2 border-t border-slate-200">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  4. User-Wise Assignment & Sharing
                </label>

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={connIsShared}
                      onChange={(e) => setConnIsShared(e.target.checked)}
                      className="w-4 h-4 rounded text-orange-500 bg-white border-slate-300 focus:ring-orange-500 cursor-pointer"
                    />
                    <div>
                      <span className="text-xs font-bold text-slate-800">Company Shared Mailbox</span>
                      <p className="text-[11px] text-slate-500">
                        Allow all authorized team members in your company to view and send via this mailbox.
                      </p>
                    </div>
                  </label>

                  {!connIsShared && (
                    <div className="pt-3 border-t border-slate-200 space-y-2">
                      <span className="text-xs font-bold text-slate-700">
                        Assign to Specific Colleagues:
                      </span>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-48 overflow-y-auto p-2 bg-white rounded-xl border border-slate-200">
                        {colleagues.map((usr) => {
                          const isAssigned = connAssignedUsers.includes(usr.id);
                          return (
                            <label
                              key={usr.id}
                              className={`flex items-center gap-2 p-2 rounded-lg text-xs cursor-pointer transition-colors ${
                                isAssigned ? 'bg-orange-50 border border-orange-300 text-orange-900 font-semibold' : 'hover:bg-slate-50 text-slate-600'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isAssigned}
                                onChange={(e) => {
                                  if (e.target.checked) setConnAssignedUsers([...connAssignedUsers, usr.id]);
                                  else setConnAssignedUsers(connAssignedUsers.filter((id) => id !== usr.id));
                                }}
                                className="w-3.5 h-3.5 rounded text-orange-500"
                              />
                              <span className="truncate">{usr.full_name || usr.email}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Submit Button */}
            <div className="pt-4 flex items-center justify-between border-t border-slate-200">
              <span className="text-[11px] text-slate-500 flex items-center gap-1.5 font-medium">
                <Lock size={12} className="text-emerald-600" />
                Passwords are encrypted via AES-256-GCM and never displayed again.
              </span>

              <button
                type="submit"
                disabled={connecting || !connEmail}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 font-bold text-xs text-white transition-all shadow-md shadow-orange-500/20 disabled:opacity-50 cursor-pointer"
              >
                {connecting ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
                <span>{editingAccount ? 'Save Changes & Verify' : 'Verify & Connect Mailbox'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ----------------------------------------------------------------------------- */}
      {/* TAB 3: AI EMAIL COMPOSER & SENDING HUB                                        */}
      {/* ----------------------------------------------------------------------------- */}
      {activeTab === 'composer' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: AI Assistant Prompter & Preset Cards */}
          <div className="lg:col-span-1 p-5 rounded-2xl border border-slate-200 bg-white shadow-xs space-y-4">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
              <Sparkles size={16} className="text-orange-500" />
              <span>AI Writing Assistant</span>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed font-medium">
              Generate tailored commercial emails for precision CNC machining, quotations, invoice reminders, and supplier requisitions.
            </p>

            {/* Quick 1-Click Prompt Chips */}
            <div className="space-y-2">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Instant Industry Templates
              </span>
              <div className="space-y-1.5">
                <button
                  type="button"
                  onClick={() => handleGenerateAi('Follow up politely on the quotation proposal.', 'quotation_followup')}
                  className="w-full text-left p-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-orange-50 hover:border-orange-300 text-xs font-semibold text-slate-700 hover:text-orange-900 transition-all flex items-center justify-between cursor-pointer"
                >
                  <span>📋 Quotation Follow-Up</span>
                  <ArrowRight size={12} className="opacity-50" />
                </button>

                <button
                  type="button"
                  onClick={() => handleGenerateAi('Send a polite payment reminder for the pending tax invoice.', 'payment_reminder')}
                  className="w-full text-left p-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-orange-50 hover:border-orange-300 text-xs font-semibold text-slate-700 hover:text-orange-900 transition-all flex items-center justify-between cursor-pointer"
                >
                  <span>💳 Payment & Invoice Reminder</span>
                  <ArrowRight size={12} className="opacity-50" />
                </button>

                <button
                  type="button"
                  onClick={() => handleGenerateAi('Send dispatch confirmation and delivery challan tracking details.', 'delivery_update')}
                  className="w-full text-left p-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-orange-50 hover:border-orange-300 text-xs font-semibold text-slate-700 hover:text-orange-900 transition-all flex items-center justify-between cursor-pointer"
                >
                  <span>🚚 Production Dispatch Notice</span>
                  <ArrowRight size={12} className="opacity-50" />
                </button>

                <button
                  type="button"
                  onClick={() => handleGenerateAi('Request quotation for raw material bar stock with test certificates.', 'rfq_dispatch')}
                  className="w-full text-left p-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-orange-50 hover:border-orange-300 text-xs font-semibold text-slate-700 hover:text-orange-900 transition-all flex items-center justify-between cursor-pointer"
                >
                  <span>📦 Material Supplier RFQ</span>
                  <ArrowRight size={12} className="opacity-50" />
                </button>
              </div>
            </div>

            {/* Custom AI Instructions */}
            <div className="space-y-3 pt-3 border-t border-slate-200">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                  Recipient Name / Company
                </label>
                <input
                  type="text"
                  placeholder="e.g. David Vance (AeroParts Global)"
                  value={composerRecipientName}
                  onChange={(e) => setComposerRecipientName(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-orange-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                  Tone of Voice
                </label>
                <select
                  value={composerTone}
                  onChange={(e) => setComposerTone(e.target.value as any)}
                  className="w-full px-3 py-1.5 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:outline-none focus:border-orange-500 capitalize font-medium"
                >
                  <option value="professional">Professional & Technical</option>
                  <option value="formal">Formal Executive</option>
                  <option value="friendly">Warm & Collaborative</option>
                  <option value="urgent">Urgent / Priority</option>
                  <option value="persuasive">Persuasive Commercial</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                  Custom AI Instructions
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g. Write a follow-up about the 10mm milling inserts quote sent last Monday. Offer a 5% discount if order confirmed by Friday."
                  value={composerPrompt}
                  onChange={(e) => setComposerPrompt(e.target.value)}
                  className="w-full p-2.5 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-orange-500"
                />
              </div>

              <button
                type="button"
                disabled={generatingAi}
                onClick={() => handleGenerateAi()}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 font-bold text-xs text-white shadow-md shadow-orange-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {generatingAi ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                <span>Draft with AI Assistant</span>
              </button>
            </div>
          </div>

          {/* Right Column: Outbound Compose Form & Live Preview */}
          <div className="lg:col-span-2 p-6 rounded-2xl border border-slate-200 bg-white shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <Send size={16} className="text-emerald-600" />
                <span>Outbound Mail Dispatch</span>
              </h3>
              <span className="text-[11px] text-slate-500 font-medium">
                Emails are sent directly from your connected mail server.
              </span>
            </div>

            <form onSubmit={handleSendEmail} className="space-y-3.5">
              {/* Sending Mailbox Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Send From (Connected Mailbox)</label>
                {sendingAccounts.length === 0 ? (
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-300 text-xs text-amber-900 font-medium">
                    No sending accounts available. Please connect a sending mailbox first.
                  </div>
                ) : (
                  <select
                    value={composerAccountId}
                    onChange={(e) => setComposerAccountId(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs font-medium rounded-xl bg-slate-50 border border-slate-300 text-slate-900 focus:bg-white focus:outline-none focus:border-orange-500 font-mono shadow-2xs"
                  >
                    {sendingAccounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.email})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* To, Cc, Bcc */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">To (Recipients)</label>
                  <input
                    type="text"
                    required
                    placeholder="client@aeroparts.com, buyer@precision.in (comma separated)"
                    value={composerTo}
                    onChange={(e) => setComposerTo(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-50 border border-slate-300 text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-orange-500 shadow-2xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Cc (Optional)</label>
                  <input
                    type="text"
                    placeholder="manager@company.com"
                    value={composerCc}
                    onChange={(e) => setComposerCc(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-50 border border-slate-300 text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-orange-500 shadow-2xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Bcc (Optional)</label>
                  <input
                    type="text"
                    placeholder="records@arguscnc.com"
                    value={composerBcc}
                    onChange={(e) => setComposerBcc(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-50 border border-slate-300 text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-orange-500 shadow-2xs"
                  />
                </div>
              </div>

              {/* Subject */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Subject Line</label>
                <input
                  type="text"
                  required
                  placeholder="Enter email subject..."
                  value={composerSubject}
                  onChange={(e) => setComposerSubject(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs font-bold rounded-xl bg-slate-50 border border-slate-300 text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-orange-500 shadow-2xs"
                />
              </div>

              {/* Body */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Email Body Content</label>
                <textarea
                  rows={10}
                  required
                  placeholder="Write your email or generate it using the AI Assistant on the left..."
                  value={composerBody}
                  onChange={(e) => setComposerBody(e.target.value)}
                  className="w-full p-3.5 text-xs leading-relaxed font-sans rounded-xl bg-slate-50 border border-slate-300 text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-orange-500 shadow-2xs"
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-between">
                <span className="text-[11px] text-slate-500 font-medium">
                  Ready to send via {sendingAccounts.find((a) => a.id === composerAccountId)?.email || 'connected mailbox'}
                </span>

                <button
                  type="submit"
                  disabled={sendingEmail || !composerTo || !composerSubject || !composerBody}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 font-bold text-xs text-white transition-all shadow-md shadow-emerald-600/20 disabled:opacity-50 cursor-pointer"
                >
                  {sendingEmail ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                  <span>Dispatch Email Now</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------------------------- */}
      {/* TAB 4: INBOUND MAIL VIEWER                                                    */}
      {/* ----------------------------------------------------------------------------- */}
      {activeTab === 'inbound' && (
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="flex flex-col md:flex-row gap-3 items-center justify-between p-3.5 rounded-2xl bg-white border border-slate-200 shadow-xs">
            <div className="flex items-center gap-2 w-full md:w-auto">
              <label className="text-xs text-slate-600 font-bold">Mailbox:</label>
              <select
                value={inboundAccountId}
                onChange={(e) => setInboundAccountId(e.target.value)}
                className="px-3.5 py-1.5 text-xs font-medium rounded-xl bg-slate-50 border border-slate-300 text-slate-800 font-mono focus:bg-white focus:outline-none focus:border-orange-500"
              >
                <option value="all">All Receiving Mailboxes</option>
                {receivingAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.email})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={syncingInbox}
                onClick={handleSyncInbound}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 font-bold text-xs text-white shadow-md shadow-blue-600/20 transition-colors disabled:opacity-50 cursor-pointer"
              >
                <RefreshCw size={13} className={syncingInbox ? 'animate-spin' : ''} />
                <span>{syncingInbox ? 'Syncing...' : 'Sync Mailbox'}</span>
              </button>
            </div>
          </div>

          {/* 2-Pane Split Email Client */}
          {filteredInbound.length === 0 ? (
            <div className="p-12 text-center rounded-2xl border border-slate-200 bg-white shadow-xs space-y-3">
              <div className="w-16 h-16 rounded-3xl bg-blue-50 border border-blue-200 text-blue-500 flex items-center justify-center mx-auto mb-3 shadow-xs">
                <Inbox size={32} />
              </div>
              <h3 className="text-base font-bold text-slate-800">No Received Emails Yet</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                Connect an IMAP receiving mailbox and click &quot;Sync Mailbox&quot; to fetch your latest inquiries, purchase orders, and payment advices.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-0 h-[620px] border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-xs">
              {/* Left Column: Email List (5 cols) */}
              <div className="md:col-span-5 border-r border-slate-200 overflow-y-auto divide-y divide-slate-100">
                {filteredInbound.map((email) => {
                  const isSelected = selectedInboundEmail?.id === email.id;
                  return (
                    <button
                      key={email.id}
                      type="button"
                      onClick={() => setSelectedInboundEmail(email)}
                      className={`w-full p-4 text-left transition-colors flex flex-col gap-1.5 cursor-pointer ${
                        isSelected ? 'bg-orange-50/70 border-l-4 border-l-orange-500' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-bold text-slate-900 truncate max-w-[180px]">
                          {email.from_name || email.from_address}
                        </span>
                        <span className="text-slate-400 font-mono text-[10px]">
                          {new Date(email.received_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                      <h5 className="text-xs font-bold text-slate-800 truncate">{email.subject}</h5>
                      <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                        {email.snippet || email.body_text}
                      </p>
                    </button>
                  );
                })}
              </div>

              {/* Right Column: Email Reader (7 cols) */}
              <div className="md:col-span-7 p-6 overflow-y-auto flex flex-col justify-between space-y-4 bg-slate-50/30">
                {selectedInboundEmail ? (
                  <div className="space-y-4">
                    {/* Header */}
                    <div className="pb-4 border-b border-slate-200 space-y-2.5">
                      <div className="flex items-start justify-between gap-4">
                        <h3 className="text-base font-bold text-slate-900 leading-snug">
                          {selectedInboundEmail.subject}
                        </h3>
                        <button
                          type="button"
                          onClick={() => handleReplyWithAi(selectedInboundEmail)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-orange-500 hover:bg-orange-600 font-bold text-xs text-white shrink-0 shadow-sm cursor-pointer"
                        >
                          <CornerUpLeft size={13} />
                          <span>Reply with AI</span>
                        </button>
                      </div>

                      <div className="flex flex-wrap items-center justify-between text-xs text-slate-500">
                        <div>
                          From: <span className="font-bold text-slate-800">{selectedInboundEmail.from_name}</span>{' '}
                          <span className="font-mono text-[11px] text-slate-500">&lt;{selectedInboundEmail.from_address}&gt;</span>
                        </div>
                        <div className="font-mono text-[11px] text-slate-400">
                          {new Date(selectedInboundEmail.received_at).toLocaleString()}
                        </div>
                      </div>

                      <div className="text-xs text-slate-500">
                        To: <span className="font-mono text-[11px] text-slate-700 font-semibold">{selectedInboundEmail.to_address}</span>
                      </div>
                    </div>

                    {/* Email Body */}
                    <div className="text-xs text-slate-700 leading-relaxed whitespace-pre-line font-sans p-2">
                      {selectedInboundEmail.body_text}
                    </div>
                  </div>
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                    Select an email from the left to read its contents.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ----------------------------------------------------------------------------- */}
      {/* TAB 5: USER PERMISSIONS MATRIX (Super Admin / Company Admin only)             */}
      {/* ----------------------------------------------------------------------------- */}
      {activeTab === 'permissions' && (isSuperAdmin || isCompanyAdmin) && (
        <div className="p-6 rounded-2xl border border-slate-200 bg-white shadow-xs space-y-4">
          <div className="pb-4 border-b border-slate-200">
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <ShieldCheck size={18} className="text-emerald-600" />
              <span>User Email Setup & Capability Permissions</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Control whether employees can connect their own personal/work mailboxes (Sending, Receiving, or Both), or must strictly use company-assigned mailboxes.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider bg-slate-50">
                  <th className="py-3 px-4">Employee / Colleague</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4 text-center">Can Connect Sending Mail</th>
                  <th className="py-3 px-4 text-center">Can Connect Receiving Mail</th>
                  <th className="py-3 px-4 text-center">Can Connect Both</th>
                  <th className="py-3 px-4 text-center">AI Email Composer</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {userPermissions.map((usr) => {
                  const isSaving = savingPermUserId === usr.user_id;
                  const isBoth = usr.can_connect_sending && usr.can_connect_receiving;

                  return (
                    <tr key={usr.user_id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{usr.full_name}</div>
                        <div className="text-[11px] font-mono text-slate-500">{usr.email}</div>
                      </td>

                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-slate-100 text-slate-700 border border-slate-200">
                          {usr.role}
                        </span>
                      </td>

                      {/* Can Connect Sending */}
                      <td className="py-3 px-4 text-center">
                        <input
                          type="checkbox"
                          disabled={usr.is_admin || isSaving}
                          checked={usr.can_connect_sending}
                          onChange={(e) => handleTogglePerm(usr.user_id, 'can_connect_sending', e.target.checked)}
                          className="w-4 h-4 rounded text-orange-500 bg-white border-slate-300 focus:ring-orange-500 cursor-pointer disabled:opacity-50"
                        />
                      </td>

                      {/* Can Connect Receiving */}
                      <td className="py-3 px-4 text-center">
                        <input
                          type="checkbox"
                          disabled={usr.is_admin || isSaving}
                          checked={usr.can_connect_receiving}
                          onChange={(e) => handleTogglePerm(usr.user_id, 'can_connect_receiving', e.target.checked)}
                          className="w-4 h-4 rounded text-orange-500 bg-white border-slate-300 focus:ring-orange-500 cursor-pointer disabled:opacity-50"
                        />
                      </td>

                      {/* Can Connect Both (Convenience Switch) */}
                      <td className="py-3 px-4 text-center">
                        <input
                          type="checkbox"
                          disabled={usr.is_admin || isSaving}
                          checked={isBoth}
                          onChange={(e) => handleToggleBothPerms(usr.user_id, e.target.checked)}
                          className="w-4 h-4 rounded text-emerald-600 bg-white border-slate-300 focus:ring-emerald-500 cursor-pointer disabled:opacity-50"
                        />
                      </td>

                      {/* AI Composer */}
                      <td className="py-3 px-4 text-center">
                        <input
                          type="checkbox"
                          disabled={usr.is_admin || isSaving}
                          checked={usr.can_use_ai_composer}
                          onChange={(e) => handleTogglePerm(usr.user_id, 'can_use_ai_composer', e.target.checked)}
                          className="w-4 h-4 rounded text-purple-600 bg-white border-slate-300 focus:ring-purple-500 cursor-pointer disabled:opacity-50"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------------------------- */}
      {/* TAB 6: DISPATCH & AUDIT LOGS                                                  */}
      {/* ----------------------------------------------------------------------------- */}
      {activeTab === 'logs' && (
        <div className="p-6 rounded-2xl border border-slate-200 bg-white shadow-xs space-y-4">
          <div className="pb-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <Clock size={16} className="text-orange-500" />
                <span>Email Activity & Transmission Logs</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Audit trail of all sent messages, AI prompts, and received notifications.
              </p>
            </div>
          </div>

          {logs.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">
              No transmission activity logged yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider bg-slate-50">
                    <th className="py-2.5 px-3">Timestamp</th>
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-3">From</th>
                    <th className="py-2.5 px-3">To / Recipients</th>
                    <th className="py-2.5 px-3">Subject</th>
                    <th className="py-2.5 px-3">AI Assisting</th>
                    <th className="py-2.5 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/70">
                      <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px]">
                        {new Date(log.created_at || log.received_at).toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            log.direction === 'outbound'
                              ? 'bg-purple-50 text-purple-700 border border-purple-200'
                              : 'bg-blue-50 text-blue-700 border border-blue-200'
                          }`}
                        >
                          {log.direction}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-slate-700 font-semibold">
                        {log.from_address}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600">
                        {Array.isArray(log.to_addresses) ? log.to_addresses.join(', ') : log.to_address}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-slate-800 max-w-xs truncate">
                        {log.subject}
                      </td>
                      <td className="py-2.5 px-3">
                        {log.ai_generated ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                            <Sparkles size={10} className="text-amber-500" /> AI Generated
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[10px]">—</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="text-emerald-700 font-bold text-[11px] bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          {log.status || 'Delivered'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
