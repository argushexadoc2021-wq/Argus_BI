-- Migration: Company Email Integrations & Multi-Account Setup
-- Supports multiple mail connections, user-wise assignment, sending (outbound/SMTP/AI),
-- receiving (inbound/IMAP sync), and granular user self-setup permissions.

begin;

-- 1. Connected Email Accounts Table
create table if not exists public.company_email_accounts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies (id) on delete cascade,
  name text not null,
  email text not null,
  provider text not null default 'gmail',
  type text not null default 'both', -- 'sending', 'receiving', 'both'
  is_shared boolean not null default false,
  assigned_user_ids uuid[] not null default '{}',
  smtp_host text,
  smtp_port integer default 587,
  smtp_user text,
  smtp_pass_enc text,
  imap_host text,
  imap_port integer default 993,
  imap_user text,
  imap_pass_enc text,
  imap_ssl boolean default true,
  from_name text,
  status text default 'connected',
  verified_at timestamptz,
  last_error text,
  created_by uuid references public.company_users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists company_email_accounts_company_idx on public.company_email_accounts(company_id);
create index if not exists company_email_accounts_email_idx on public.company_email_accounts(email);

alter table public.company_email_accounts enable row level security;
revoke all on public.company_email_accounts from anon, authenticated;

-- 2. User Mail Setup Permissions Table
create table if not exists public.email_integration_permissions (
  user_id uuid primary key references public.company_users (id) on delete cascade,
  company_id uuid references public.companies (id) on delete cascade,
  can_connect_sending boolean not null default false,
  can_connect_receiving boolean not null default false,
  can_use_ai_composer boolean not null default true,
  updated_at timestamptz not null default now()
);

create index if not exists email_integration_permissions_company_idx on public.email_integration_permissions(company_id);

alter table public.email_integration_permissions enable row level security;
revoke all on public.email_integration_permissions from anon, authenticated;

-- 3. Inbound / Synced Received Emails Table
create table if not exists public.company_received_emails (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references public.company_email_accounts (id) on delete cascade,
  company_id uuid references public.companies (id) on delete cascade,
  message_id text,
  from_address text not null,
  from_name text,
  to_address text not null,
  subject text,
  snippet text,
  body_text text,
  body_html text,
  is_read boolean default false,
  received_at timestamptz default now(),
  created_at timestamptz default now()
);

create index if not exists company_received_emails_account_idx on public.company_received_emails(account_id);
create index if not exists company_received_emails_company_idx on public.company_received_emails(company_id);
create index if not exists company_received_emails_received_at_idx on public.company_received_emails(received_at desc);

alter table public.company_received_emails enable row level security;
revoke all on public.company_received_emails from anon, authenticated;

-- 4. Outbound / Sent Emails Log Table
create table if not exists public.company_sent_emails (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references public.company_email_accounts (id) on delete set null,
  company_id uuid references public.companies (id) on delete cascade,
  sender_user_id uuid references public.company_users (id) on delete set null,
  from_address text not null,
  to_addresses text[] not null,
  cc_addresses text[] default '{}',
  bcc_addresses text[] default '{}',
  subject text not null,
  body_text text not null,
  ai_generated boolean default false,
  ai_prompt text,
  status text default 'sent',
  created_at timestamptz default now()
);

create index if not exists company_sent_emails_account_idx on public.company_sent_emails(account_id);
create index if not exists company_sent_emails_company_idx on public.company_sent_emails(company_id);

alter table public.company_sent_emails enable row level security;
revoke all on public.company_sent_emails from anon, authenticated;

commit;
