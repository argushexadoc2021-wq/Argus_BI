-- =====================================================================================
-- Retail sales partners as their own companies
--
-- A Regional / Channel / Referral partner gets their OWN company in Argus BI, so their
-- BI login only ever sees their own company's data, never the main company's.
-- In the Retail Store they still sell the main company's products, with the price tier
-- of their partner type, and they see only their own orders plus the orders of the
-- partners under them.
--
--   companies.partner_of        the main company whose Retail Store the partner sells from
--   companies.partner_type      'regional' | 'channel' | 'referral'
--   companies.partner_parent_id the partner company they come under (null = directly under the main company)
--
-- Who can come under whom:
--   Regional partner  -> directly under the main company
--   Channel partner   -> under a Regional partner, or directly under the main company
--   Referral partner  -> under a Channel or Regional partner, or directly under the main company
--
-- Only the Super Admin sets this (Company Management > Edit company > Retail partner).
-- Safe to run more than once.
-- =====================================================================================
begin;

alter table public.companies add column if not exists partner_of        uuid references public.companies(id) on delete set null;
alter table public.companies add column if not exists partner_type      text;
alter table public.companies add column if not exists partner_parent_id uuid references public.companies(id) on delete set null;

do $$ begin
  alter table public.companies add constraint companies_partner_type_check
    check (partner_type is null or partner_type in ('regional', 'channel', 'referral'));
exception when duplicate_object then null; end $$;

create index if not exists companies_partner_of_idx        on public.companies (partner_of);
create index if not exists companies_partner_parent_id_idx on public.companies (partner_parent_id);

create or replace function public.erp_set_company_partner(p_company_id uuid, p_partner_of uuid, p_partner_type text, p_parent_id uuid)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me     public.company_users := public.erp_current_user();
  co     public.companies;
  main   public.companies;
  parent public.companies;
  t      text := nullif(lower(btrim(coalesce(p_partner_type, ''))), '');
  rank   int;
  bad    text;
begin
  if me.id is null or me.role <> 'SUPER_ADMIN' then
    raise exception 'Only the Super Admin can set retail partners' using errcode = '42501';
  end if;
  select * into co from public.companies where id = p_company_id;
  if co.id is null then raise exception 'Company not found'; end if;

  -- not a partner (any more)
  if p_partner_of is null then
    select string_agg(company_name, ', ' order by company_name) into bad
      from public.companies where partner_parent_id = co.id;
    if bad is not null then
      raise exception 'Move the partners under % first: %', co.company_name, bad;
    end if;
    update public.companies set partner_of = null, partner_type = null, partner_parent_id = null, updated_at = now() where id = co.id;
    return jsonb_build_object('partner_of', null, 'partner_type', null, 'partner_parent_id', null);
  end if;

  if t is null or t not in ('regional', 'channel', 'referral') then
    raise exception 'Choose the partner type: Regional, Channel or Referral';
  end if;
  rank := case t when 'regional' then 1 when 'channel' then 2 else 3 end;

  if p_partner_of = co.id then raise exception 'A company cannot be a partner of itself'; end if;
  select * into main from public.companies where id = p_partner_of;
  if main.id is null then raise exception 'Main company not found'; end if;
  if main.partner_of is not null then
    raise exception '% is itself a partner. Choose the main company the partners sell for.', main.company_name;
  end if;
  select string_agg(company_name, ', ' order by company_name) into bad from public.companies where partner_of = co.id;
  if bad is not null then
    raise exception '% has its own partners (%), so it cannot become a partner', co.company_name, bad;
  end if;

  -- the partner it comes under
  if p_parent_id is not null then
    if p_parent_id = co.id then raise exception 'A partner cannot come under itself'; end if;
    select * into parent from public.companies where id = p_parent_id;
    if parent.id is null then raise exception 'The partner it comes under was not found'; end if;
    if parent.partner_of is distinct from p_partner_of then
      raise exception '% is not a partner of %', parent.company_name, main.company_name;
    end if;
    if t = 'regional' then
      raise exception 'A Regional partner comes directly under %', main.company_name;
    elsif t = 'channel' and parent.partner_type <> 'regional' then
      raise exception 'A Channel partner can only come under a Regional partner';
    elsif t = 'referral' and parent.partner_type not in ('regional', 'channel') then
      raise exception 'A Referral partner can only come under a Regional or Channel partner';
    end if;
  end if;

  -- the partners already under this one must still fit
  select string_agg(c.company_name, ', ' order by c.company_name) into bad
    from public.companies c
   where c.partner_parent_id = co.id
     and (c.partner_of is distinct from p_partner_of
          or (case c.partner_type when 'regional' then 1 when 'channel' then 2 else 3 end) <= rank);
  if bad is not null then
    raise exception 'These partners come under % and would no longer fit: %. Move them first.', co.company_name, bad;
  end if;

  update public.companies
     set partner_of = p_partner_of, partner_type = t, partner_parent_id = p_parent_id, updated_at = now()
   where id = co.id;
  return jsonb_build_object('partner_of', p_partner_of, 'partner_type', t, 'partner_parent_id', p_parent_id);
end;
$$;

revoke all on function public.erp_set_company_partner(uuid, uuid, text, uuid) from public, anon;
grant execute on function public.erp_set_company_partner(uuid, uuid, text, uuid) to authenticated;

commit;
