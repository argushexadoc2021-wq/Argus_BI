// Service client for Enterprise Multi-Mailbox Integration & Email Hub

import { supabase } from '@/lib/supabase';
import { API_BASE } from '@/retail/api';
import { isTauri } from '@/lib/desktop/isTauri';

export type MailProviderType = 'gmail' | 'outlook' | 'zoho' | 'other';
export type MailIntegrationType = 'sending' | 'receiving' | 'both';

export interface EmailAccount {
  id: string;
  company_id?: string;
  name: string;
  email: string;
  provider: MailProviderType;
  type: MailIntegrationType;
  is_shared: boolean;
  assigned_user_ids: string[];
  smtp_host?: string;
  smtp_port?: number;
  smtp_user?: string;
  has_smtp_pass?: boolean;
  imap_host?: string;
  imap_port?: number;
  imap_user?: string;
  has_imap_pass?: boolean;
  imap_ssl?: boolean;
  from_name?: string;
  status: 'connected' | 'error' | 'pending';
  verified_at: string | null;
  last_error: string | null;
  created_by?: string;
  created_at: string;
  updated_at?: string;
}

export interface UserMailPermission {
  user_id: string;
  full_name: string;
  email: string;
  role: string;
  status: string;
  can_connect_sending: boolean;
  can_connect_receiving: boolean;
  can_use_ai_composer: boolean;
  is_admin: boolean;
}

export interface InboundEmail {
  id: string;
  account_id: string;
  company_id?: string;
  message_id?: string;
  from_address: string;
  from_name?: string;
  to_address: string;
  subject: string;
  snippet?: string;
  body_text: string;
  body_html?: string;
  is_read: boolean;
  received_at: string;
  created_at: string;
}

export interface SentEmailLog {
  id: string;
  account_id: string;
  account_email: string;
  company_id?: string;
  sender_user_id: string;
  sender_name?: string;
  from_address: string;
  to_addresses: string[];
  cc_addresses?: string[];
  bcc_addresses?: string[];
  subject: string;
  body_text: string;
  ai_generated: boolean;
  ai_prompt?: string | null;
  message_id?: string;
  status: string;
  created_at: string;
  direction?: 'outbound';
}

export interface CallerPermissions {
  can_connect_sending: boolean;
  can_connect_receiving: boolean;
  can_use_ai_composer: boolean;
  is_admin: boolean;
}

const WEB_ORIGIN = 'https://with-cnc.vercel.app';

async function authHeaders(): Promise<HeadersInit> {
  const { data } = await supabase.auth.getSession();
  return {
    Authorization: `Bearer ${data.session?.access_token ?? ''}`,
    'Content-Type': 'application/json',
  };
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const base = API_BASE || (isTauri() ? WEB_ORIGIN : '');
  const url = `${base}${endpoint}`;
  const headers = await authHeaders();

  let res: Response;
  if (isTauri()) {
    const { fetch: desktopFetch } = await import('@tauri-apps/plugin-http');
    res = await desktopFetch(url, { ...options, headers: { ...headers, ...(options.headers || {}) } });
  } else {
    res = await window.fetch(url, { ...options, headers: { ...headers, ...(options.headers || {}) } });
  }

  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.ok === false) {
    const msg = json.error || `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return json as T;
}

export const mailIntegrationApi = {
  // Fetch all accessible accounts
  async getAccounts(companyId?: string): Promise<{ accounts: EmailAccount[]; caller_permissions: CallerPermissions; user_id: string }> {
    const query = companyId ? `?company_id=${encodeURIComponent(companyId)}` : '';
    return request<{ accounts: EmailAccount[]; caller_permissions: CallerPermissions; user_id: string; ok: boolean }>(
      `/api/mail-integration/accounts${query}`
    );
  },

  // Save / connect an email account
  async saveAccount(payload: {
    id?: string;
    name: string;
    email: string;
    provider: MailProviderType;
    type: MailIntegrationType;
    is_shared?: boolean;
    assigned_user_ids?: string[];
    smtp_host?: string;
    smtp_port?: number;
    smtp_user?: string;
    smtp_pass?: string;
    imap_host?: string;
    imap_port?: number;
    imap_user?: string;
    imap_pass?: string;
    imap_ssl?: boolean;
    from_name?: string;
    company_id?: string;
  }): Promise<{ account: EmailAccount; message: string }> {
    return request<{ account: EmailAccount; message: string; ok: boolean }>(
      '/api/mail-integration/accounts/save',
      { method: 'POST', body: JSON.stringify(payload) }
    );
  },

  // Test live connection
  async testConnection(payload: {
    id?: string;
    test_type: 'smtp' | 'imap';
    host?: string;
    port?: number;
    user?: string;
    pass?: string;
  }): Promise<{ ok: boolean; message: string }> {
    return request<{ ok: boolean; message: string }>('/api/mail-integration/accounts/test', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  // Disconnect / delete an account
  async deleteAccount(id: string): Promise<{ ok: boolean; message: string }> {
    return request<{ ok: boolean; message: string }>('/api/mail-integration/accounts/delete', {
      method: 'POST',
      body: JSON.stringify({ id }),
    });
  },

  // Get user permission list (admin only)
  async getPermissions(companyId?: string): Promise<{ users: UserMailPermission[] }> {
    const query = companyId ? `?company_id=${encodeURIComponent(companyId)}` : '';
    return request<{ users: UserMailPermission[]; ok: boolean }>(`/api/mail-integration/permissions${query}`);
  },

  // Save permission for a specific user
  async savePermission(payload: {
    user_id: string;
    company_id?: string;
    can_connect_sending: boolean;
    can_connect_receiving: boolean;
    can_use_ai_composer: boolean;
  }): Promise<{ ok: boolean; message: string }> {
    return request<{ ok: boolean; message: string }>('/api/mail-integration/permissions/save', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  // Send an outbound email (manual or AI-drafted)
  async sendEmail(payload: {
    account_id: string;
    to: string;
    cc?: string;
    bcc?: string;
    subject: string;
    body: string;
    is_ai_generated?: boolean;
    ai_prompt?: string;
  }): Promise<{ ok: boolean; messageId: string; sent_at: string; message: string }> {
    return request<{ ok: boolean; messageId: string; sent_at: string; message: string }>('/api/mail-integration/send', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  // Fetch inbound emails
  async getInbound(accountId?: string): Promise<{ emails: InboundEmail[] }> {
    const query = accountId ? `?account_id=${encodeURIComponent(accountId)}` : '';
    return request<{ emails: InboundEmail[]; ok: boolean }>(`/api/mail-integration/inbound${query}`);
  },

  // Trigger inbox sync via IMAP
  async syncInbound(accountId: string): Promise<{ ok: boolean; synced_count: number; emails: InboundEmail[]; message: string }> {
    return request<{ ok: boolean; synced_count: number; emails: InboundEmail[]; message: string }>(
      '/api/mail-integration/inbound/sync',
      { method: 'POST', body: JSON.stringify({ account_id: accountId }) }
    );
  },

  // AI Email Composer
  async aiCompose(payload: {
    prompt: string;
    purpose?: 'quotation_followup' | 'payment_reminder' | 'delivery_update' | 'rfq_dispatch' | 'reply_inquiry' | 'general';
    tone?: 'professional' | 'formal' | 'friendly' | 'urgent' | 'persuasive';
    recipient_name?: string;
    context?: string;
    original_message?: string;
  }): Promise<{ ok: boolean; subject: string; body: string; source: string }> {
    return request<{ ok: boolean; subject: string; body: string; source: string }>('/api/mail-integration/ai-compose', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  // Activity audit logs
  async getLogs(): Promise<{ logs: any[] }> {
    return request<{ logs: any[]; ok: boolean }>('/api/mail-integration/logs');
  },
};
