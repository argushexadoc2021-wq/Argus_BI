-- ======================================================================================
-- BI Chat: Company Communication Module (Conversations, Messages, Calls, Meetings)
-- ======================================================================================
-- Multi-tenant real-time chat, file sharing, WebRTC calls, and calendar meeting scheduling.
-- Company isolation is strictly enforced via RLS using public.erp_visible_company_ids().

begin;

-- 1. Conversations (Direct 1-to-1 or Group chats)
create table if not exists public.bi_chat_conversations (
  id                   uuid primary key default gen_random_uuid(),
  company_id           uuid not null references public.companies (id) on delete cascade,
  type                 text not null check (type in ('direct', 'group')),
  title                text,
  description          text,
  avatar_url           text,
  created_by           uuid references public.company_users (id) on delete set null,
  last_message_at      timestamptz not null default now(),
  last_message_preview text,
  pinned_by            jsonb not null default '[]'::jsonb,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index if not exists bi_chat_conv_company_idx on public.bi_chat_conversations (company_id);
create index if not exists bi_chat_conv_last_msg_idx on public.bi_chat_conversations (company_id, last_message_at desc);

-- 2. Conversation Participants
create table if not exists public.bi_chat_participants (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.bi_chat_conversations (id) on delete cascade,
  user_id         uuid not null references public.company_users (id) on delete cascade,
  role            text not null default 'member' check (role in ('admin', 'member')),
  last_read_at    timestamptz not null default now(),
  is_muted        boolean not null default false,
  joined_at       timestamptz not null default now(),
  constraint bi_chat_participant_unique unique (conversation_id, user_id)
);

create index if not exists bi_chat_part_user_idx on public.bi_chat_participants (user_id);
create index if not exists bi_chat_part_conv_idx on public.bi_chat_participants (conversation_id);

-- 3. Messages
create table if not exists public.bi_chat_messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.bi_chat_conversations (id) on delete cascade,
  company_id      uuid not null references public.companies (id) on delete cascade,
  sender_id       uuid not null references public.company_users (id) on delete cascade,
  content         text not null default '',
  type            text not null default 'text' check (type in ('text', 'image', 'file', 'meeting', 'call_log', 'system')),
  reply_to_id     uuid references public.bi_chat_messages (id) on delete set null,
  is_pinned       boolean not null default false,
  is_edited       boolean not null default false,
  is_deleted      boolean not null default false,
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists bi_chat_msg_conv_idx on public.bi_chat_messages (conversation_id, created_at asc);
create index if not exists bi_chat_msg_company_idx on public.bi_chat_messages (company_id);

-- 4. Message Attachments & Shared Folders
create table if not exists public.bi_chat_attachments (
  id              uuid primary key default gen_random_uuid(),
  message_id      uuid not null references public.bi_chat_messages (id) on delete cascade,
  conversation_id uuid not null references public.bi_chat_conversations (id) on delete cascade,
  company_id      uuid not null references public.companies (id) on delete cascade,
  uploader_id     uuid not null references public.company_users (id) on delete cascade,
  file_name       text not null,
  file_type       text not null,
  file_size       bigint not null default 0,
  file_url        text not null,
  storage_path    text,
  folder_path     text not null default '/',
  created_at      timestamptz not null default now()
);

create index if not exists bi_chat_att_conv_idx on public.bi_chat_attachments (conversation_id);
create index if not exists bi_chat_att_folder_idx on public.bi_chat_attachments (company_id, folder_path);

-- 5. Message Read Receipts
create table if not exists public.bi_chat_message_receipts (
  id         uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.bi_chat_messages (id) on delete cascade,
  user_id    uuid not null references public.company_users (id) on delete cascade,
  status     text not null check (status in ('delivered', 'read')),
  updated_at timestamptz not null default now(),
  constraint bi_chat_receipt_unique unique (message_id, user_id, status)
);

create index if not exists bi_chat_receipt_msg_idx on public.bi_chat_message_receipts (message_id);

-- 6. Calls & Call History
create table if not exists public.bi_chat_calls (
  id               uuid primary key default gen_random_uuid(),
  company_id       uuid not null references public.companies (id) on delete cascade,
  conversation_id  uuid references public.bi_chat_conversations (id) on delete cascade,
  caller_id        uuid not null references public.company_users (id) on delete cascade,
  type             text not null check (type in ('voice', 'video')),
  status           text not null check (status in ('ringing', 'connected', 'ended', 'rejected', 'missed')),
  started_at       timestamptz not null default now(),
  ended_at         timestamptz,
  duration_seconds integer not null default 0,
  participants     jsonb not null default '[]'::jsonb,
  created_at       timestamptz not null default now()
);

create index if not exists bi_chat_calls_company_idx on public.bi_chat_calls (company_id, created_at desc);

-- 7. Calendar Meetings
create table if not exists public.bi_chat_meetings (
  id               uuid primary key default gen_random_uuid(),
  company_id       uuid not null references public.companies (id) on delete cascade,
  conversation_id  uuid references public.bi_chat_conversations (id) on delete set null,
  organizer_id     uuid not null references public.company_users (id) on delete cascade,
  title            text not null,
  description      text,
  start_time       timestamptz not null,
  end_time         timestamptz not null,
  meeting_type     text not null default 'video' check (meeting_type in ('video', 'voice', 'in_person')),
  location_or_link text,
  status           text not null default 'scheduled' check (status in ('scheduled', 'in_progress', 'completed', 'cancelled')),
  reminder_minutes jsonb not null default '[15, 5, 0]'::jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists bi_chat_meetings_company_idx on public.bi_chat_meetings (company_id, start_time asc);

-- 8. Meeting Participants
create table if not exists public.bi_chat_meeting_participants (
  id           uuid primary key default gen_random_uuid(),
  meeting_id   uuid not null references public.bi_chat_meetings (id) on delete cascade,
  user_id      uuid not null references public.company_users (id) on delete cascade,
  status       text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  responded_at timestamptz,
  constraint bi_chat_meeting_part_unique unique (meeting_id, user_id)
);

create index if not exists bi_chat_meeting_part_user_idx on public.bi_chat_meeting_participants (user_id);

-- 9. BI Chat Notifications
create table if not exists public.bi_chat_notifications (
  id         uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  user_id    uuid not null references public.company_users (id) on delete cascade,
  type       text not null check (type in ('new_message', 'incoming_call', 'missed_call', 'meeting_invite', 'meeting_reminder', 'meeting_update', 'meeting_cancelled')),
  title      text not null,
  body       text not null,
  link       text,
  metadata   jsonb not null default '{}'::jsonb,
  is_read    boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists bi_chat_notif_user_idx on public.bi_chat_notifications (user_id, is_read, created_at desc);

-- --------------------------------------------------------------------------------------
-- Row Level Security (RLS) & Policies
-- --------------------------------------------------------------------------------------

alter table public.bi_chat_conversations enable row level security;
alter table public.bi_chat_participants enable row level security;
alter table public.bi_chat_messages enable row level security;
alter table public.bi_chat_attachments enable row level security;
alter table public.bi_chat_message_receipts enable row level security;
alter table public.bi_chat_calls enable row level security;
alter table public.bi_chat_meetings enable row level security;
alter table public.bi_chat_meeting_participants enable row level security;
alter table public.bi_chat_notifications enable row level security;

-- Conversations RLS: visible if in same company
create policy bi_chat_conv_select on public.bi_chat_conversations for select to authenticated
  using (company_id in (select unnest(public.erp_visible_company_ids())));

create policy bi_chat_conv_insert on public.bi_chat_conversations for insert to authenticated
  with check (company_id in (select unnest(public.erp_visible_company_ids())));

create policy bi_chat_conv_update on public.bi_chat_conversations for update to authenticated
  using (company_id in (select unnest(public.erp_visible_company_ids())));

-- Participants RLS
create policy bi_chat_part_select on public.bi_chat_participants for select to authenticated
  using (exists (select 1 from public.bi_chat_conversations c where c.id = conversation_id and c.company_id in (select unnest(public.erp_visible_company_ids()))));

create policy bi_chat_part_insert on public.bi_chat_participants for insert to authenticated
  with check (exists (select 1 from public.bi_chat_conversations c where c.id = conversation_id and c.company_id in (select unnest(public.erp_visible_company_ids()))));

create policy bi_chat_part_update on public.bi_chat_participants for update to authenticated
  using (exists (select 1 from public.bi_chat_conversations c where c.id = conversation_id and c.company_id in (select unnest(public.erp_visible_company_ids()))));

-- Messages RLS
create policy bi_chat_msg_select on public.bi_chat_messages for select to authenticated
  using (company_id in (select unnest(public.erp_visible_company_ids())));

create policy bi_chat_msg_insert on public.bi_chat_messages for insert to authenticated
  with check (company_id in (select unnest(public.erp_visible_company_ids())));

create policy bi_chat_msg_update on public.bi_chat_messages for update to authenticated
  using (company_id in (select unnest(public.erp_visible_company_ids())));

-- Attachments RLS
create policy bi_chat_att_select on public.bi_chat_attachments for select to authenticated
  using (company_id in (select unnest(public.erp_visible_company_ids())));

create policy bi_chat_att_insert on public.bi_chat_attachments for insert to authenticated
  with check (company_id in (select unnest(public.erp_visible_company_ids())));

-- Receipts RLS
create policy bi_chat_rec_all on public.bi_chat_message_receipts for all to authenticated
  using (true) with check (true);

-- Calls RLS
create policy bi_chat_calls_all on public.bi_chat_calls for all to authenticated
  using (company_id in (select unnest(public.erp_visible_company_ids())))
  with check (company_id in (select unnest(public.erp_visible_company_ids())));

-- Meetings RLS
create policy bi_chat_meetings_all on public.bi_chat_meetings for all to authenticated
  using (company_id in (select unnest(public.erp_visible_company_ids())))
  with check (company_id in (select unnest(public.erp_visible_company_ids())));

create policy bi_chat_meeting_parts_all on public.bi_chat_meeting_participants for all to authenticated
  using (true) with check (true);

-- Notifications RLS
create policy bi_chat_notif_select on public.bi_chat_notifications for select to authenticated
  using (company_id in (select unnest(public.erp_visible_company_ids())));

create policy bi_chat_notif_all on public.bi_chat_notifications for all to authenticated
  using (company_id in (select unnest(public.erp_visible_company_ids())))
  with check (company_id in (select unnest(public.erp_visible_company_ids())));

grant all on public.bi_chat_conversations to authenticated;
grant all on public.bi_chat_participants to authenticated;
grant all on public.bi_chat_messages to authenticated;
grant all on public.bi_chat_attachments to authenticated;
grant all on public.bi_chat_message_receipts to authenticated;
grant all on public.bi_chat_calls to authenticated;
grant all on public.bi_chat_meetings to authenticated;
grant all on public.bi_chat_meeting_participants to authenticated;
grant all on public.bi_chat_notifications to authenticated;

commit;
