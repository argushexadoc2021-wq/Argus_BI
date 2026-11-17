-- Migration: AI Face Recognition Attendance System
-- Multi-tenant schema supporting face vector storage (128-d embeddings),
-- tablet kiosks, attendance state machine, shift management, anti-spoofing, and audit logs.

begin;

-- 1. Add attendance_enabled platform switch to companies
alter table public.companies add column if not exists attendance_enabled boolean not null default true;

-- Update platform switcher function to support attendance
create or replace function public.erp_set_company_platforms(
  p_company_id uuid,
  p_bi boolean,
  p_retail boolean,
  p_attendance boolean default true
)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me public.company_users := public.erp_current_user();
begin
  if me.id is null or me.role != 'SUPER_ADMIN' then
    raise exception 'Only Super Admin can switch a company''s platforms' using errcode = '42501';
  end if;
  if p_company_id is null then raise exception 'Company ID is required'; end if;
  if not coalesce(p_bi, true) and not coalesce(p_retail, true) and not coalesce(p_attendance, true) then
    raise exception 'Keep at least one platform on for the company';
  end if;
  update public.companies
     set bi_enabled = coalesce(p_bi, true),
         retail_enabled = coalesce(p_retail, true),
         attendance_enabled = coalesce(p_attendance, true),
         updated_at = now()
   where id = p_company_id;
  if not found then raise exception 'Company not found'; end if;
  return jsonb_build_object(
    'bi_enabled', coalesce(p_bi, true),
    'retail_enabled', coalesce(p_retail, true),
    'attendance_enabled', coalesce(p_attendance, true)
  );
end;
$$;

revoke all on function public.erp_set_company_platforms(uuid, boolean, boolean, boolean) from public, anon;
grant execute on function public.erp_set_company_platforms(uuid, boolean, boolean, boolean) to authenticated;

-- 2. Attendance Settings Table (Per Company Shift & Geofence Policy)
create table if not exists public.bi_attendance_settings (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade unique,
  work_start_time text not null default '09:00',
  work_end_time text not null default '18:00',
  late_grace_minutes integer not null default 15,
  half_day_hours numeric(4,2) not null default 4.50,
  full_day_hours numeric(4,2) not null default 8.00,
  geofence_enabled boolean not null default false,
  geofence_latitude numeric(10,7),
  geofence_longitude numeric(10,7),
  geofence_radius_meters integer not null default 200,
  liveness_strict boolean not null default true,
  similarity_threshold numeric(4,2) not null default 0.80,
  auto_checkout_enabled boolean not null default false,
  auto_checkout_time text default '22:00',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists bi_attendance_settings_company_idx on public.bi_attendance_settings(company_id);
alter table public.bi_attendance_settings enable row level security;
revoke all on public.bi_attendance_settings from anon;
grant select, insert, update on public.bi_attendance_settings to authenticated;

-- 3. Biometric Employees Table (Workforce Directory & 128-d Face Embeddings)
create table if not exists public.bi_attendance_employees (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  user_id uuid references public.company_users (id) on delete set null,
  employee_code text not null,
  first_name text not null,
  last_name text not null default '',
  email text,
  phone text,
  department text not null default 'General',
  designation text not null default 'Staff',
  employment_type text not null default 'FULL_TIME', -- 'FULL_TIME', 'PART_TIME', 'DAILY_WAGE', 'CONTRACT', 'INTERN'
  shift_type text not null default 'FIXED', -- 'FIXED', 'FLEXIBLE', 'ROTATING'
  shift_start text default '09:00',
  shift_end text default '18:00',
  hourly_rate numeric(10,2) not null default 250.00,
  face_embeddings jsonb not null default '[]'::jsonb, -- Array of 128-d unit-normalized float arrays
  enrolled_samples_count integer not null default 0,
  biometric_consent boolean not null default false,
  consent_timestamp timestamptz,
  is_active boolean not null default true,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, employee_code)
);

create index if not exists bi_attendance_employees_company_idx on public.bi_attendance_employees(company_id);
create index if not exists bi_attendance_employees_code_idx on public.bi_attendance_employees(company_id, employee_code);
create index if not exists bi_attendance_employees_active_idx on public.bi_attendance_employees(company_id, is_active);
alter table public.bi_attendance_employees enable row level security;
revoke all on public.bi_attendance_employees from anon;
grant select, insert, update, delete on public.bi_attendance_employees to authenticated;

-- 4. Daily Attendance Records Table (Punches, Shift Hours, Liveness & Overtime)
create table if not exists public.bi_attendance_records (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  employee_id uuid not null references public.bi_attendance_employees (id) on delete cascade,
  log_date date not null,
  check_in_time text,
  check_out_time text,
  first_punch_in timestamptz,
  last_punch_out timestamptz,
  total_hours numeric(5,2) not null default 0.00,
  status text not null default 'PRESENT', -- 'PRESENT', 'LATE', 'HALF_DAY', 'ABSENT', 'ON_LEAVE', 'OVERTIME'
  shift_status text not null default 'ON-TIME', -- 'ON-TIME', 'LATE', 'EARLY_EXIT', 'FLEXIBLE', 'MANUAL_OVERRIDE'
  is_currently_in boolean not null default false,
  confidence_score numeric(5,4) default 0.0000,
  liveness_verified boolean not null default true,
  punch_mode text not null default 'FACE_AI', -- 'FACE_AI', 'MANUAL', 'KIOSK', 'FIELD_GPS'
  punches jsonb not null default '[]'::jsonb, -- Array of { action, time, timestamp, confidence, kiosk_id, lat, lng }
  latitude numeric(10,7),
  longitude numeric(10,7),
  geofence_status text default 'VERIFIED',
  kiosk_id text default 'main-kiosk',
  remarks text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, employee_id, log_date)
);

create index if not exists bi_attendance_records_company_date_idx on public.bi_attendance_records(company_id, log_date);
create index if not exists bi_attendance_records_employee_idx on public.bi_attendance_records(employee_id);
create index if not exists bi_attendance_records_status_idx on public.bi_attendance_records(company_id, status);
alter table public.bi_attendance_records enable row level security;
revoke all on public.bi_attendance_records from anon;
grant select, insert, update, delete on public.bi_attendance_records to authenticated;

-- 5. Tablet Hardware Kiosks Table (Entrance Terminals & Turnstiles)
create table if not exists public.bi_attendance_kiosks (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  kiosk_code text not null,
  name text not null,
  branch_location text not null default 'Headquarters',
  device_type text not null default 'Tablet Terminal',
  secret_token text,
  is_active boolean not null default true,
  last_heartbeat timestamptz default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, kiosk_code)
);

create index if not exists bi_attendance_kiosks_company_idx on public.bi_attendance_kiosks(company_id);
alter table public.bi_attendance_kiosks enable row level security;
revoke all on public.bi_attendance_kiosks from anon;
grant select, insert, update, delete on public.bi_attendance_kiosks to authenticated;

-- 6. Leave Applications Table
create table if not exists public.bi_attendance_leaves (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  employee_id uuid not null references public.bi_attendance_employees (id) on delete cascade,
  leave_type text not null default 'Casual Leave',
  start_date date not null,
  end_date date not null,
  days numeric(4,1) not null default 1.0,
  reason text not null,
  status text not null default 'Approved', -- 'Pending', 'Approved', 'Rejected'
  approved_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists bi_attendance_leaves_company_idx on public.bi_attendance_leaves(company_id);
alter table public.bi_attendance_leaves enable row level security;
revoke all on public.bi_attendance_leaves from anon;
grant select, insert, update, delete on public.bi_attendance_leaves to authenticated;

-- 7. Biometric Compliance & Audit Trail Table (GDPR / BIPA Compliance)
create table if not exists public.bi_attendance_audit_logs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  action text not null, -- 'ENROLLMENT', 'CONSENT_GRANTED', 'MANUAL_OVERRIDE', 'DELETION', 'KIOSK_REGISTERED'
  actor_email text,
  employee_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists bi_attendance_audit_logs_company_idx on public.bi_attendance_audit_logs(company_id);
alter table public.bi_attendance_audit_logs enable row level security;
revoke all on public.bi_attendance_audit_logs from anon;
grant select, insert on public.bi_attendance_audit_logs to authenticated;

commit;
