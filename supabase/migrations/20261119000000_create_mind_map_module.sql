-- ======================================================================================
-- Create Mind Map Module: Relational Mind Maps, Nodes, Edges & Sharing Permissions
-- ======================================================================================
-- Company-isolated, relational mind map editor integrated with existing companies and
-- company_users tables. Supports unlimited nested nodes, custom cross-edges,
-- optimistic concurrency via mind_maps.version, soft deletion, root node protection,
-- and role-based sharing (owner / editor / viewer).

begin;

-- --------------------------------------------------------------------------------------
-- 1. Tables
-- --------------------------------------------------------------------------------------

-- Table 1: mind_maps
create table if not exists public.mind_maps (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references public.companies (id) on delete cascade,
  created_by      uuid not null references public.company_users (id) on delete restrict,
  title           varchar(200) not null default 'Untitled Mind Map',
  description     text,
  status          varchar(20) not null default 'active'
                  check (status in ('active', 'archived')),
  canvas_settings jsonb not null default '{"zoom":1,"panX":0,"panY":0,"grid":true,"connectorStyle":"curved","background":"#f8fbff"}'::jsonb,
  version         integer not null default 1 check (version >= 1),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);

create index if not exists mind_maps_company_active_idx
  on public.mind_maps (company_id, updated_at desc)
  where deleted_at is null;
create index if not exists mind_maps_created_by_idx
  on public.mind_maps (created_by);
create index if not exists mind_maps_updated_at_idx
  on public.mind_maps (updated_at desc);

-- Table 2: mind_map_nodes
create table if not exists public.mind_map_nodes (
  id              uuid primary key default gen_random_uuid(),
  mind_map_id     uuid not null references public.mind_maps (id) on delete cascade,
  parent_node_id  uuid,
  title           text not null default 'New Topic',
  description     text,
  notes           text,
  node_type       varchar(40) not null default 'topic',
  position_x      numeric not null default 0,
  position_y      numeric not null default 0,
  width           numeric not null default 184 check (width > 0),
  height          numeric not null default 60 check (height > 0),
  sort_order      integer not null default 0,
  style           jsonb not null default '{}'::jsonb,
  is_collapsed    boolean not null default false,
  created_by      uuid references public.company_users (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  -- Composite uniqueness enables same-map composite FKs for parent_node_id and mind_map_edges
  constraint mind_map_nodes_id_map_unique unique (id, mind_map_id),
  -- Self-referencing FK guarantees parent node MUST belong to the exact same mind map
  -- and safely cascades deletion to descendant nodes when a non-root parent is deleted
  constraint mind_map_nodes_parent_same_map_fk
    foreign key (parent_node_id, mind_map_id)
    references public.mind_map_nodes (id, mind_map_id)
    on delete cascade,
  constraint mind_map_nodes_no_self_parent
    check (parent_node_id is null or parent_node_id <> id)
);

-- Enforce exactly one root node (parent_node_id IS NULL) per mind map
create unique index if not exists mind_map_nodes_single_root_idx
  on public.mind_map_nodes (mind_map_id)
  where parent_node_id is null;

create index if not exists mind_map_nodes_map_idx
  on public.mind_map_nodes (mind_map_id);
create index if not exists mind_map_nodes_parent_idx
  on public.mind_map_nodes (mind_map_id, parent_node_id, sort_order);
create index if not exists mind_map_nodes_updated_at_idx
  on public.mind_map_nodes (updated_at desc);

-- Table 3: mind_map_edges (non-hierarchical cross-connections between nodes in the same map)
create table if not exists public.mind_map_edges (
  id              uuid primary key default gen_random_uuid(),
  mind_map_id     uuid not null references public.mind_maps (id) on delete cascade,
  source_node_id  uuid not null,
  target_node_id  uuid not null,
  label           varchar(200),
  edge_type       varchar(40) not null default 'connection',
  style           jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  -- Composite FKs guarantee both connected nodes belong to the exact same mind map
  constraint mind_map_edges_source_same_map_fk
    foreign key (source_node_id, mind_map_id)
    references public.mind_map_nodes (id, mind_map_id)
    on delete cascade,
  constraint mind_map_edges_target_same_map_fk
    foreign key (target_node_id, mind_map_id)
    references public.mind_map_nodes (id, mind_map_id)
    on delete cascade,
  constraint mind_map_edges_no_self_loop
    check (source_node_id <> target_node_id)
);

create index if not exists mind_map_edges_map_idx
  on public.mind_map_edges (mind_map_id);
create index if not exists mind_map_edges_source_idx
  on public.mind_map_edges (source_node_id);
create index if not exists mind_map_edges_target_idx
  on public.mind_map_edges (target_node_id);

-- Table 4: mind_map_members (sharing & role-based permissions per mind map)
create table if not exists public.mind_map_members (
  id          uuid primary key default gen_random_uuid(),
  mind_map_id uuid not null references public.mind_maps (id) on delete cascade,
  user_id     uuid not null references public.company_users (id) on delete cascade,
  role        varchar(20) not null default 'viewer'
              check (role in ('owner', 'editor', 'viewer')),
  invited_by  uuid references public.company_users (id) on delete set null,
  created_at  timestamptz not null default now(),
  constraint mind_map_members_unique unique (mind_map_id, user_id)
);

create index if not exists mind_map_members_map_idx
  on public.mind_map_members (mind_map_id);
create index if not exists mind_map_members_user_idx
  on public.mind_map_members (user_id);

-- --------------------------------------------------------------------------------------
-- 2. Integrity & Audit Triggers
-- --------------------------------------------------------------------------------------

-- Auto-update updated_at on row modifications
create or replace function public.mm_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists mind_maps_touch_updated_at on public.mind_maps;
create trigger mind_maps_touch_updated_at
  before update on public.mind_maps
  for each row execute function public.mm_touch_updated_at();

drop trigger if exists mind_map_nodes_touch_updated_at on public.mind_map_nodes;
create trigger mind_map_nodes_touch_updated_at
  before update on public.mind_map_nodes
  for each row execute function public.mm_touch_updated_at();

-- Touch parent mind_maps.updated_at whenever nodes or edges change
create or replace function public.mm_touch_parent_map()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_map_id uuid;
begin
  v_map_id := coalesce(new.mind_map_id, old.mind_map_id);
  if v_map_id is not null then
    update public.mind_maps
       set updated_at = now()
     where id = v_map_id
       and deleted_at is null;
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists mind_map_nodes_touch_map on public.mind_map_nodes;
create trigger mind_map_nodes_touch_map
  after insert or update or delete on public.mind_map_nodes
  for each row execute function public.mm_touch_parent_map();

drop trigger if exists mind_map_edges_touch_map on public.mind_map_edges;
create trigger mind_map_edges_touch_map
  after insert or update or delete on public.mind_map_edges
  for each row execute function public.mm_touch_parent_map();

-- Prevent circular parent_node_id loops within a mind map
create or replace function public.mm_prevent_node_cycle()
returns trigger
language plpgsql
as $$
declare
  v_cur uuid;
  v_hops integer := 0;
begin
  if new.parent_node_id is null then
    return new;
  end if;
  v_cur := new.parent_node_id;
  while v_cur is not null loop
    if v_cur = new.id then
      raise exception 'Circular parent reference detected for node %', new.id
        using errcode = '23514';
    end if;
    v_hops := v_hops + 1;
    if v_hops > 200 then
      raise exception 'Mind map hierarchy depth exceeded maximum safe limit'
        using errcode = '23514';
    end if;
    select parent_node_id into v_cur
      from public.mind_map_nodes
     where id = v_cur
       and mind_map_id = new.mind_map_id;
  end loop;
  return new;
end;
$$;

drop trigger if exists mind_map_nodes_prevent_cycle on public.mind_map_nodes;
create trigger mind_map_nodes_prevent_cycle
  before insert or update of parent_node_id on public.mind_map_nodes
  for each row execute function public.mm_prevent_node_cycle();

-- Prevent deleting the root node while its mind map remains active
create or replace function public.mm_protect_root_node()
returns trigger
language plpgsql
as $$
declare
  v_active boolean;
begin
  if old.parent_node_id is null then
    select exists (
      select 1
        from public.mind_maps m
       where m.id = old.mind_map_id
         and m.deleted_at is null
         and m.status = 'active'
    ) into v_active;

    if v_active then
      raise exception 'Cannot delete the root node while the mind map is active'
        using errcode = 'P0001';
    end if;
  end if;
  return old;
end;
$$;

drop trigger if exists mind_map_nodes_protect_root on public.mind_map_nodes;
create trigger mind_map_nodes_protect_root
  before delete on public.mind_map_nodes
  for each row execute function public.mm_protect_root_node();

-- --------------------------------------------------------------------------------------
-- 3. Permission & Isolation Helpers (SECURITY DEFINER)
-- --------------------------------------------------------------------------------------

-- Checks mind-map module access respecting defaultOn = true when no explicit deny exists
create or replace function public.mm_has_module_access(p_action text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with me as (
    select * from public.erp_current_user()
  ),
  explicit_row as (
    select p.*
      from public.user_module_permissions p
      join me on me.id = p.user_id
     where p.module_key = 'mind-map'
     limit 1
  )
  select case
    when (select id from me) is null then false
    when (select role from me) in ('SUPER_ADMIN', 'COMPANY_ADMIN') then true
    when exists (select 1 from explicit_row) then
      coalesce((
        select case p_action
          when 'view'   then r.can_view
          when 'create' then (r.can_view and coalesce(r.can_create, r.can_view))
          when 'edit'   then (r.can_view and coalesce(r.can_edit, r.can_view))
          when 'delete' then (r.can_view and coalesce(r.can_delete, r.can_view))
          when 'export' then (r.can_view and coalesce(r.can_export, r.can_view))
          else r.can_view
        end
        from explicit_row r
      ), false)
    -- mind-map is defaultOn unless explicitly switched off
    else true
  end;
$$;

revoke all on function public.mm_has_module_access(text) from public, anon, authenticated;
grant execute on function public.mm_has_module_access(text) to authenticated;

-- Effective role for the current authenticated user on a given mind map
-- Returns 'owner' | 'editor' | 'viewer' | NULL (no access)
create or replace function public.mm_user_role(p_mind_map_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  with me as (
    select * from public.erp_current_user()
  ),
  mp as (
    select m.id, m.company_id, m.created_by, m.deleted_at
      from public.mind_maps m
     where m.id = p_mind_map_id
     limit 1
  ),
  mem as (
    select mm.role
      from public.mind_map_members mm
      join me on me.id = mm.user_id
     where mm.mind_map_id = p_mind_map_id
     limit 1
  )
  select case
    when (select id from me) is null then null
    when (select id from mp) is null then null
    when not ((select company_id from mp) = any(public.erp_visible_company_ids())) then null
    when (select role from me) in ('SUPER_ADMIN', 'COMPANY_ADMIN') then 'owner'
    when (select created_by from mp) = (select id from me) then 'owner'
    when exists (select 1 from mem) then (select role from mem)
    else null
  end;
$$;

revoke all on function public.mm_user_role(uuid) from public, anon, authenticated;
grant execute on function public.mm_user_role(uuid) to authenticated;

create or replace function public.mm_can_view(p_mind_map_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.mm_has_module_access('view')
     and public.mm_user_role(p_mind_map_id) in ('owner', 'editor', 'viewer');
$$;

create or replace function public.mm_can_edit(p_mind_map_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.mm_has_module_access('edit')
     and public.mm_user_role(p_mind_map_id) in ('owner', 'editor');
$$;

create or replace function public.mm_can_manage(p_mind_map_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.mm_has_module_access('edit')
     and public.mm_user_role(p_mind_map_id) = 'owner';
$$;

revoke all on function public.mm_can_view(uuid) from public, anon, authenticated;
revoke all on function public.mm_can_edit(uuid) from public, anon, authenticated;
revoke all on function public.mm_can_manage(uuid) from public, anon, authenticated;
grant execute on function public.mm_can_view(uuid) to authenticated;
grant execute on function public.mm_can_edit(uuid) to authenticated;
grant execute on function public.mm_can_manage(uuid) to authenticated;

-- --------------------------------------------------------------------------------------
-- 4. Row Level Security (RLS)
-- --------------------------------------------------------------------------------------

alter table public.mind_maps enable row level security;
alter table public.mind_map_nodes enable row level security;
alter table public.mind_map_edges enable row level security;
alter table public.mind_map_members enable row level security;

-- mind_maps policies
drop policy if exists mind_maps_select on public.mind_maps;
create policy mind_maps_select on public.mind_maps
  for select to authenticated
  using (
    deleted_at is null
    and company_id = any(public.erp_visible_company_ids())
    and public.mm_can_view(id)
  );

drop policy if exists mind_maps_insert on public.mind_maps;
create policy mind_maps_insert on public.mind_maps
  for insert to authenticated
  with check (
    public.mm_has_module_access('create')
    and company_id = any(public.erp_visible_company_ids())
    and created_by = (select (public.erp_current_user()).id)
  );

drop policy if exists mind_maps_update on public.mind_maps;
create policy mind_maps_update on public.mind_maps
  for update to authenticated
  using (
    deleted_at is null
    and company_id = any(public.erp_visible_company_ids())
    and public.mm_can_edit(id)
  )
  with check (
    company_id = any(public.erp_visible_company_ids())
    and public.mm_can_edit(id)
  );

-- mind_map_nodes policies
drop policy if exists mind_map_nodes_select on public.mind_map_nodes;
create policy mind_map_nodes_select on public.mind_map_nodes
  for select to authenticated
  using (public.mm_can_view(mind_map_id));

drop policy if exists mind_map_nodes_insert on public.mind_map_nodes;
create policy mind_map_nodes_insert on public.mind_map_nodes
  for insert to authenticated
  with check (public.mm_can_edit(mind_map_id));

drop policy if exists mind_map_nodes_update on public.mind_map_nodes;
create policy mind_map_nodes_update on public.mind_map_nodes
  for update to authenticated
  using (public.mm_can_edit(mind_map_id))
  with check (public.mm_can_edit(mind_map_id));

drop policy if exists mind_map_nodes_delete on public.mind_map_nodes;
create policy mind_map_nodes_delete on public.mind_map_nodes
  for delete to authenticated
  using (public.mm_can_edit(mind_map_id));

-- mind_map_edges policies
drop policy if exists mind_map_edges_select on public.mind_map_edges;
create policy mind_map_edges_select on public.mind_map_edges
  for select to authenticated
  using (public.mm_can_view(mind_map_id));

drop policy if exists mind_map_edges_insert on public.mind_map_edges;
create policy mind_map_edges_insert on public.mind_map_edges
  for insert to authenticated
  with check (public.mm_can_edit(mind_map_id));

drop policy if exists mind_map_edges_update on public.mind_map_edges;
create policy mind_map_edges_update on public.mind_map_edges
  for update to authenticated
  using (public.mm_can_edit(mind_map_id))
  with check (public.mm_can_edit(mind_map_id));

drop policy if exists mind_map_edges_delete on public.mind_map_edges;
create policy mind_map_edges_delete on public.mind_map_edges
  for delete to authenticated
  using (public.mm_can_edit(mind_map_id));

-- mind_map_members policies
drop policy if exists mind_map_members_select on public.mind_map_members;
create policy mind_map_members_select on public.mind_map_members
  for select to authenticated
  using (public.mm_can_view(mind_map_id));

drop policy if exists mind_map_members_insert on public.mind_map_members;
create policy mind_map_members_insert on public.mind_map_members
  for insert to authenticated
  with check (
    public.mm_can_manage(mind_map_id)
    and exists (
      select 1
        from public.company_users cu
        join public.mind_maps m on m.id = mind_map_id
       where cu.id = user_id
         and (cu.company_id = m.company_id or cu.role = 'SUPER_ADMIN')
    )
  );

drop policy if exists mind_map_members_update on public.mind_map_members;
create policy mind_map_members_update on public.mind_map_members
  for update to authenticated
  using (public.mm_can_manage(mind_map_id))
  with check (public.mm_can_manage(mind_map_id));

drop policy if exists mind_map_members_delete on public.mind_map_members;
create policy mind_map_members_delete on public.mind_map_members
  for delete to authenticated
  using (public.mm_can_manage(mind_map_id));

grant select, insert, update, delete on public.mind_maps to authenticated;
grant select, insert, update, delete on public.mind_map_nodes to authenticated;
grant select, insert, update, delete on public.mind_map_edges to authenticated;
grant select, insert, update, delete on public.mind_map_members to authenticated;

-- --------------------------------------------------------------------------------------
-- 5. Transactional RPC Functions
-- --------------------------------------------------------------------------------------

-- 5.1 Atomically create a mind map, owner membership, initial root node, and optional template nodes/edges
create or replace function public.mm_create_mind_map(
  p_company_id      uuid,
  p_title           text default 'Untitled Mind Map',
  p_description     text default null,
  p_canvas_settings jsonb default null,
  p_nodes           jsonb default '[]'::jsonb,
  p_edges           jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me          public.company_users;
  v_company_id  uuid;
  v_map         public.mind_maps;
  v_root_id     uuid;
  v_item        jsonb;
  v_edge        jsonb;
  v_map_ids     jsonb := '{}'::jsonb;
  v_old_id      text;
  v_new_id      uuid;
  v_parent_key  text;
  v_parent_uuid uuid;
  v_src_uuid    uuid;
  v_tgt_uuid    uuid;
  v_nodes_out   jsonb;
  v_edges_out   jsonb;
begin
  select * into v_me from public.erp_current_user();
  if v_me.id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if not public.mm_has_module_access('create') then
    raise exception 'You do not have permission to create mind maps' using errcode = '42501';
  end if;

  v_company_id := coalesce(p_company_id, v_me.active_company_id, v_me.company_id);
  if v_company_id is null or not (v_company_id = any(public.erp_visible_company_ids())) then
    raise exception 'Invalid or unauthorized company' using errcode = '42501';
  end if;

  insert into public.mind_maps (company_id, created_by, title, description, canvas_settings)
  values (
    v_company_id,
    v_me.id,
    coalesce(nullif(btrim(p_title), ''), 'Untitled Mind Map'),
    nullif(btrim(coalesce(p_description, '')), ''),
    coalesce(
      p_canvas_settings,
      '{"zoom":1,"panX":0,"panY":0,"grid":true,"connectorStyle":"curved","background":"#f8fbff"}'::jsonb
    )
  )
  returning * into v_map;

  -- Register creator as owner in mind_map_members
  insert into public.mind_map_members (mind_map_id, user_id, role, invited_by)
  values (v_map.id, v_me.id, 'owner', v_me.id)
  on conflict (mind_map_id, user_id) do nothing;

  -- Create initial root node (and any template hierarchy) in this single transaction
  if jsonb_typeof(coalesce(p_nodes, '[]'::jsonb)) = 'array' and jsonb_array_length(coalesce(p_nodes, '[]'::jsonb)) > 0 then
    -- Pass 1: assign UUIDs for every supplied template node
    for v_item in select * from jsonb_array_elements(p_nodes) loop
      v_old_id := coalesce(v_item ->> 'temp_id', v_item ->> 'id', gen_random_uuid()::text);
      v_new_id := gen_random_uuid();
      v_map_ids := v_map_ids || jsonb_build_object(v_old_id, v_new_id::text);
    end loop;

    -- Pass 2: insert root first (parent_node_id IS NULL), then children in array order
    for v_item in select * from jsonb_array_elements(p_nodes) loop
      v_old_id := coalesce(v_item ->> 'temp_id', v_item ->> 'id');
      v_new_id := (v_map_ids ->> v_old_id)::uuid;
      v_parent_key := nullif(btrim(coalesce(v_item ->> 'parent_temp_id', v_item ->> 'parent_node_id', '')), '');
      v_parent_uuid := case when v_parent_key is null then null else (v_map_ids ->> v_parent_key)::uuid end;

      insert into public.mind_map_nodes (
        id, mind_map_id, parent_node_id, title, description, notes,
        node_type, position_x, position_y, width, height, sort_order,
        style, is_collapsed, created_by
      ) values (
        v_new_id,
        v_map.id,
        v_parent_uuid,
        coalesce(nullif(v_item ->> 'title', ''), 'Central Topic'),
        v_item ->> 'description',
        v_item ->> 'notes',
        coalesce(nullif(v_item ->> 'node_type', ''), case when v_parent_uuid is null then 'root' else 'topic' end),
        coalesce((v_item ->> 'position_x')::numeric, 0),
        coalesce((v_item ->> 'position_y')::numeric, 0),
        greatest(80, coalesce((v_item ->> 'width')::numeric, case when v_parent_uuid is null then 220 else 184 end)),
        greatest(38, coalesce((v_item ->> 'height')::numeric, case when v_parent_uuid is null then 76 else 56 end)),
        coalesce((v_item ->> 'sort_order')::integer, 0),
        coalesce(v_item -> 'style', '{}'::jsonb),
        coalesce((v_item ->> 'is_collapsed')::boolean, false),
        v_me.id
      );
    end loop;

    -- Optional custom edges from template
    if jsonb_typeof(coalesce(p_edges, '[]'::jsonb)) = 'array' then
      for v_edge in select * from jsonb_array_elements(p_edges) loop
        v_src_uuid := (v_map_ids ->> coalesce(v_edge ->> 'source_temp_id', v_edge ->> 'source_node_id', ''))::uuid;
        v_tgt_uuid := (v_map_ids ->> coalesce(v_edge ->> 'target_temp_id', v_edge ->> 'target_node_id', ''))::uuid;
        if v_src_uuid is not null and v_tgt_uuid is not null and v_src_uuid <> v_tgt_uuid then
          insert into public.mind_map_edges (mind_map_id, source_node_id, target_node_id, label, edge_type, style)
          values (
            v_map.id,
            v_src_uuid,
            v_tgt_uuid,
            v_edge ->> 'label',
            coalesce(nullif(v_edge ->> 'edge_type', ''), 'connection'),
            coalesce(v_edge -> 'style', '{}'::jsonb)
          );
        end if;
      end loop;
    end if;
  else
    -- Blank mind map: create single central root node
    insert into public.mind_map_nodes (
      mind_map_id, parent_node_id, title, node_type,
      position_x, position_y, width, height, sort_order, style, created_by
    ) values (
      v_map.id,
      null,
      coalesce(nullif(btrim(p_title), ''), 'Central Idea'),
      'root',
      0,
      0,
      228,
      78,
      0,
      '{"backgroundColor":"#0f172a","borderColor":"#3b82f6","borderWidth":2,"shape":"rounded","fontSize":17,"fontColor":"#ffffff","fontWeight":"bold","lineColor":"#3b82f6"}'::jsonb,
      v_me.id
    )
    returning id into v_root_id;
  end if;

  select coalesce(jsonb_agg(to_jsonb(n) order by n.sort_order, n.created_at), '[]'::jsonb)
    into v_nodes_out
    from public.mind_map_nodes n
   where n.mind_map_id = v_map.id;

  select coalesce(jsonb_agg(to_jsonb(e) order by e.created_at), '[]'::jsonb)
    into v_edges_out
    from public.mind_map_edges e
   where e.mind_map_id = v_map.id;

  return jsonb_build_object(
    'mind_map', to_jsonb(v_map),
    'nodes', v_nodes_out,
    'edges', v_edges_out
  );
end;
$$;

-- 5.2 Update mind map metadata with optimistic concurrency check on version
create or replace function public.mm_update_mind_map_meta(
  p_id               uuid,
  p_title            text default null,
  p_description      text default null,
  p_status           text default null,
  p_canvas_settings  jsonb default null,
  p_expected_version integer default null
)
returns public.mind_maps
language plpgsql
security definer
set search_path = public
as $$
declare
  v_map public.mind_maps;
begin
  if not public.mm_can_edit(p_id) then
    raise exception 'You do not have permission to edit this mind map' using errcode = '42501';
  end if;

  select * into v_map
    from public.mind_maps
   where id = p_id
     and deleted_at is null
   for update;

  if v_map.id is null then
    raise exception 'Mind map not found' using errcode = 'P0002';
  end if;

  if p_expected_version is not null and v_map.version <> p_expected_version then
    raise exception 'VERSION_CONFLICT: Mind map was updated by another session (expected %, actual %)', p_expected_version, v_map.version
      using errcode = '40001';
  end if;

  update public.mind_maps
     set title           = coalesce(nullif(btrim(p_title), ''), title),
         description     = case when p_description is not null then nullif(btrim(p_description), '') else description end,
         status          = coalesce(p_status, status),
         canvas_settings = coalesce(p_canvas_settings, canvas_settings),
         version         = version + 1,
         updated_at      = now()
   where id = p_id
  returning * into v_map;

  return v_map;
end;
$$;

-- 5.3 Atomically insert a new parent node ABOVE a selected node (works for both root and child nodes!)
create or replace function public.mm_insert_parent_node(
  p_mind_map_id   uuid,
  p_child_node_id uuid,
  p_title         text default 'Parent Topic',
  p_position_x    numeric default null,
  p_position_y    numeric default null,
  p_width         numeric default 196,
  p_height        numeric default 62,
  p_style         jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me          public.company_users;
  v_child       public.mind_map_nodes;
  v_new_parent  public.mind_map_nodes;
  v_updated_ch  public.mind_map_nodes;
  v_px          numeric;
  v_py          numeric;
begin
  select * into v_me from public.erp_current_user();
  if not public.mm_can_edit(p_mind_map_id) then
    raise exception 'You do not have permission to edit this mind map' using errcode = '42501';
  end if;

  select * into v_child
    from public.mind_map_nodes
   where id = p_child_node_id
     and mind_map_id = p_mind_map_id
   for update;

  if v_child.id is null then
    raise exception 'Selected node not found' using errcode = 'P0002';
  end if;

  v_px := coalesce(p_position_x, v_child.position_x - 240);
  v_py := coalesce(p_position_y, v_child.position_y);

  if v_child.parent_node_id is null then
    -- Wrapping the current root node: temporarily create under child? No: single-root unique index
    -- allows one NULL parent per map. So create a placeholder id, shift child to it via deferred?
    -- Since unique partial index is immediate, we swap cleanly:
    -- 1) Insert new parent with parent_node_id = v_child.id temporarily (bypassing cycle),
    --    actually cleaner: insert new parent AFTER dropping/re-pointing is not needed if we
    --    create a temporary non-root? Wait: we cannot have 2 nulls at once, AND child cannot
    --    point to new parent before new parent exists.
    --    Solution: drop/recreate isn't needed — instead, keep v_child as the new parent slot OR
    --    insert new child copy? No, preserve v_child.id!
    --    Wait: we can make the unique index DEFERRABLE? PostgreSQL partial unique indexes cannot
    --    be deferrable. So the cleanest atomic root-wrap:
    --    Insert new node with parent_node_id = v_child.id first, then in a 2nd step? Still can't
    --    set new.parent = null while v_child.parent = null!
    --    So when wrapping root: create a new child node holding v_child's old content & re-attach
    --    v_child's direct children to the new node, and update the root node to the new parent!
    insert into public.mind_map_nodes (
      mind_map_id, parent_node_id, title, description, notes, node_type,
      position_x, position_y, width, height, sort_order, style, is_collapsed, created_by
    ) values (
      p_mind_map_id,
      v_child.id,
      v_child.title,
      v_child.description,
      v_child.notes,
      'topic',
      v_child.position_x + 250,
      v_child.position_y,
      v_child.width,
      v_child.height,
      0,
      v_child.style,
      v_child.is_collapsed,
      v_me.id
    )
    returning * into v_updated_ch;

    -- Move all existing direct children of old root under the demoted node
    update public.mind_map_nodes
       set parent_node_id = v_updated_ch.id
     where mind_map_id = p_mind_map_id
       and parent_node_id = v_child.id
       and id <> v_updated_ch.id;

    -- Re-point any custom edges attached to old root onto the demoted node
    update public.mind_map_edges
       set source_node_id = v_updated_ch.id
     where mind_map_id = p_mind_map_id and source_node_id = v_child.id;
    update public.mind_map_edges
       set target_node_id = v_updated_ch.id
     where mind_map_id = p_mind_map_id and target_node_id = v_child.id;

    -- Update the root row itself to become the new Parent Node
    update public.mind_map_nodes
       set title       = coalesce(nullif(btrim(p_title), ''), 'Central Parent'),
           description = null,
           notes       = null,
           node_type   = 'root',
           position_x  = v_child.position_x,
           position_y  = v_child.position_y,
           width       = greatest(120, coalesce(p_width, 220)),
           height      = greatest(48, coalesce(p_height, 74)),
           style       = case when p_style <> '{}'::jsonb then p_style else style end,
           is_collapsed = false
     where id = v_child.id
    returning * into v_new_parent;

    return jsonb_build_object(
      'wrapped_root', true,
      'new_parent', to_jsonb(v_new_parent),
      'child_node', to_jsonb(v_updated_ch)
    );
  end if;

  -- Normal non-root case: insert new parent under child's old parent, then reparent child
  insert into public.mind_map_nodes (
    mind_map_id, parent_node_id, title, node_type,
    position_x, position_y, width, height, sort_order, style, created_by
  ) values (
    p_mind_map_id,
    v_child.parent_node_id,
    coalesce(nullif(btrim(p_title), ''), 'Parent Topic'),
    'topic',
    v_px,
    v_py,
    greatest(80, coalesce(p_width, 190)),
    greatest(38, coalesce(p_height, 58)),
    v_child.sort_order,
    coalesce(p_style, '{}'::jsonb),
    v_me.id
  )
  returning * into v_new_parent;

  update public.mind_map_nodes
     set parent_node_id = v_new_parent.id,
         sort_order     = 0
   where id = v_child.id
  returning * into v_updated_ch;

  return jsonb_build_object(
    'wrapped_root', false,
    'new_parent', to_jsonb(v_new_parent),
    'child_node', to_jsonb(v_updated_ch)
  );
end;
$$;

-- 5.4 Atomically delete a non-root node and all its descendants
create or replace function public.mm_delete_node_subtree(
  p_mind_map_id uuid,
  p_node_id     uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_node  public.mind_map_nodes;
  v_ids   uuid[];
begin
  if not public.mm_can_edit(p_mind_map_id) then
    raise exception 'You do not have permission to edit this mind map' using errcode = '42501';
  end if;

  select * into v_node
    from public.mind_map_nodes
   where id = p_node_id
     and mind_map_id = p_mind_map_id;

  if v_node.id is null then
    raise exception 'Node not found' using errcode = 'P0002';
  end if;

  if v_node.parent_node_id is null then
    raise exception 'Cannot delete the root node while the mind map is active' using errcode = 'P0001';
  end if;

  with recursive subtree as (
    select id from public.mind_map_nodes where id = p_node_id and mind_map_id = p_mind_map_id
    union all
    select n.id
      from public.mind_map_nodes n
      join subtree s on n.parent_node_id = s.id
     where n.mind_map_id = p_mind_map_id
  )
  select array_agg(id) into v_ids from subtree;

  delete from public.mind_map_nodes
   where id = p_node_id
     and mind_map_id = p_mind_map_id;

  return jsonb_build_object('deleted_ids', coalesce(to_jsonb(v_ids), '[]'::jsonb));
end;
$$;

-- 5.5 Atomically paste / duplicate a subtree under a target parent node
create or replace function public.mm_paste_subtree(
  p_mind_map_id      uuid,
  p_target_parent_id uuid,
  p_nodes            jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me          public.company_users;
  v_parent      public.mind_map_nodes;
  v_item        jsonb;
  v_map_ids     jsonb := '{}'::jsonb;
  v_old_id      text;
  v_new_id      uuid;
  v_parent_key  text;
  v_parent_uuid uuid;
  v_inserted    uuid[] := '{}';
  v_out         jsonb;
begin
  select * into v_me from public.erp_current_user();
  if not public.mm_can_edit(p_mind_map_id) then
    raise exception 'You do not have permission to edit this mind map' using errcode = '42501';
  end if;

  select * into v_parent
    from public.mind_map_nodes
   where id = p_target_parent_id
     and mind_map_id = p_mind_map_id;

  if v_parent.id is null then
    raise exception 'Target parent node not found in this mind map' using errcode = 'P0002';
  end if;

  if jsonb_typeof(coalesce(p_nodes, '[]'::jsonb)) <> 'array' or jsonb_array_length(p_nodes) = 0 then
    return '[]'::jsonb;
  end if;

  for v_item in select * from jsonb_array_elements(p_nodes) loop
    v_old_id := coalesce(v_item ->> 'temp_id', v_item ->> 'id', gen_random_uuid()::text);
    v_map_ids := v_map_ids || jsonb_build_object(v_old_id, gen_random_uuid()::text);
  end loop;

  for v_item in select * from jsonb_array_elements(p_nodes) loop
    v_old_id := coalesce(v_item ->> 'temp_id', v_item ->> 'id');
    v_new_id := (v_map_ids ->> v_old_id)::uuid;
    v_parent_key := nullif(btrim(coalesce(v_item ->> 'parent_temp_id', '')), '');
    v_parent_uuid := case
      when v_parent_key is not null and (v_map_ids ? v_parent_key) then (v_map_ids ->> v_parent_key)::uuid
      else p_target_parent_id
    end;

    insert into public.mind_map_nodes (
      id, mind_map_id, parent_node_id, title, description, notes,
      node_type, position_x, position_y, width, height, sort_order,
      style, is_collapsed, created_by
    ) values (
      v_new_id,
      p_mind_map_id,
      v_parent_uuid,
      coalesce(nullif(v_item ->> 'title', ''), 'Copied Topic'),
      v_item ->> 'description',
      v_item ->> 'notes',
      case when coalesce(v_item ->> 'node_type', 'topic') = 'root' then 'topic' else coalesce(v_item ->> 'node_type', 'topic') end,
      coalesce((v_item ->> 'position_x')::numeric, v_parent.position_x + 240),
      coalesce((v_item ->> 'position_y')::numeric, v_parent.position_y + 40),
      greatest(80, coalesce((v_item ->> 'width')::numeric, 184)),
      greatest(38, coalesce((v_item ->> 'height')::numeric, 56)),
      coalesce((v_item ->> 'sort_order')::integer, 0),
      coalesce(v_item -> 'style', '{}'::jsonb),
      false,
      v_me.id
    );
    v_inserted := array_append(v_inserted, v_new_id);
  end loop;

  select coalesce(jsonb_agg(to_jsonb(n) order by n.created_at), '[]'::jsonb)
    into v_out
    from public.mind_map_nodes n
   where n.id = any(v_inserted);

  return v_out;
end;
$$;

-- 5.6 Atomically duplicate an entire mind map (nodes + hierarchy + edges + owner membership)
create or replace function public.mm_duplicate_mind_map(
  p_source_id uuid,
  p_new_title text default null
)
returns public.mind_maps
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me        public.company_users;
  v_src       public.mind_maps;
  v_new_map   public.mind_maps;
  v_node      public.mind_map_nodes;
  v_edge      public.mind_map_edges;
  v_id_map    jsonb := '{}'::jsonb;
begin
  select * into v_me from public.erp_current_user();
  if v_me.id is null or not public.mm_has_module_access('create') then
    raise exception 'You do not have permission to duplicate mind maps' using errcode = '42501';
  end if;
  if not public.mm_can_view(p_source_id) then
    raise exception 'Source mind map not found or inaccessible' using errcode = '42501';
  end if;

  select * into v_src
    from public.mind_maps
   where id = p_source_id
     and deleted_at is null;

  if v_src.id is null then
    raise exception 'Source mind map not found' using errcode = 'P0002';
  end if;

  insert into public.mind_maps (company_id, created_by, title, description, status, canvas_settings)
  values (
    v_src.company_id,
    v_me.id,
    coalesce(nullif(btrim(p_new_title), ''), left(v_src.title || ' (Copy)', 200)),
    v_src.description,
    'active',
    v_src.canvas_settings
  )
  returning * into v_new_map;

  insert into public.mind_map_members (mind_map_id, user_id, role, invited_by)
  values (v_new_map.id, v_me.id, 'owner', v_me.id)
  on conflict (mind_map_id, user_id) do nothing;

  -- Build old->new UUID map in breadth-first parent order so FK parent always exists first
  for v_node in
    with recursive ordered as (
      select n.*, 0 as depth
        from public.mind_map_nodes n
       where n.mind_map_id = p_source_id
         and n.parent_node_id is null
      union all
      select c.*, o.depth + 1
        from public.mind_map_nodes c
        join ordered o on c.parent_node_id = o.id
       where c.mind_map_id = p_source_id
    )
    select id, mind_map_id, parent_node_id, title, description, notes, node_type,
           position_x, position_y, width, height, sort_order, style, is_collapsed,
           created_by, created_at, updated_at
      from ordered
     order by depth asc, sort_order asc, created_at asc
  loop
    v_id_map := v_id_map || jsonb_build_object(v_node.id::text, gen_random_uuid()::text);
    insert into public.mind_map_nodes (
      id, mind_map_id, parent_node_id, title, description, notes, node_type,
      position_x, position_y, width, height, sort_order, style, is_collapsed, created_by
    ) values (
      (v_id_map ->> v_node.id::text)::uuid,
      v_new_map.id,
      case when v_node.parent_node_id is null then null else (v_id_map ->> v_node.parent_node_id::text)::uuid end,
      v_node.title,
      v_node.description,
      v_node.notes,
      v_node.node_type,
      v_node.position_x,
      v_node.position_y,
      v_node.width,
      v_node.height,
      v_node.sort_order,
      v_node.style,
      v_node.is_collapsed,
      v_me.id
    );
  end loop;

  -- Copy custom cross-edges
  for v_edge in select * from public.mind_map_edges where mind_map_id = p_source_id loop
    if (v_id_map ? v_edge.source_node_id::text) and (v_id_map ? v_edge.target_node_id::text) then
      insert into public.mind_map_edges (mind_map_id, source_node_id, target_node_id, label, edge_type, style)
      values (
        v_new_map.id,
        (v_id_map ->> v_edge.source_node_id::text)::uuid,
        (v_id_map ->> v_edge.target_node_id::text)::uuid,
        v_edge.label,
        v_edge.edge_type,
        v_edge.style
      );
    end if;
  end loop;

  return v_new_map;
end;
$$;

-- 5.7 Soft-delete a mind map (owner or admin only)
create or replace function public.mm_soft_delete_mind_map(p_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.mm_can_manage(p_id) then
    raise exception 'Only the mind map owner or company admin can delete this mind map' using errcode = '42501';
  end if;

  update public.mind_maps
     set deleted_at = now(),
         updated_at = now()
   where id = p_id
     and deleted_at is null;

  return found;
end;
$$;

revoke all on function public.mm_create_mind_map(uuid, text, text, jsonb, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.mm_update_mind_map_meta(uuid, text, text, text, jsonb, integer) from public, anon, authenticated;
revoke all on function public.mm_insert_parent_node(uuid, uuid, text, numeric, numeric, numeric, numeric, jsonb) from public, anon, authenticated;
revoke all on function public.mm_delete_node_subtree(uuid, uuid) from public, anon, authenticated;
revoke all on function public.mm_paste_subtree(uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.mm_duplicate_mind_map(uuid, text) from public, anon, authenticated;
revoke all on function public.mm_soft_delete_mind_map(uuid) from public, anon, authenticated;

grant execute on function public.mm_create_mind_map(uuid, text, text, jsonb, jsonb, jsonb) to authenticated;
grant execute on function public.mm_update_mind_map_meta(uuid, text, text, text, jsonb, integer) to authenticated;
grant execute on function public.mm_insert_parent_node(uuid, uuid, text, numeric, numeric, numeric, numeric, jsonb) to authenticated;
grant execute on function public.mm_delete_node_subtree(uuid, uuid) to authenticated;
grant execute on function public.mm_paste_subtree(uuid, uuid, jsonb) to authenticated;
grant execute on function public.mm_duplicate_mind_map(uuid, text) to authenticated;
grant execute on function public.mm_soft_delete_mind_map(uuid) to authenticated;

commit;
