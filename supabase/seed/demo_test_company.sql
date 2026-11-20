-- =====================================================================================================
-- DEMO DATA for the company named "test"   (July 2025 → today)
--
-- What it fills, so every one of these menus shows real-looking figures:
--   Dashboard (sales pipeline: enquiry → quotation → sales order → inward → production → DC → invoice →
--   payment), Scheduling (plans, job cards, tasks), Process Master, Bank Entry, Petty Cash, Ledger
--   Statement, Profit & Loss, Balance Sheet, Opening Balances, Product Costing, Inventory, Stock
--   Adjustment, User Management, Access Management, Settings and Report.
--
-- How to run: Supabase → SQL Editor → paste this whole file → Run.  (Takes about a minute.)
--   * Only the company "test" is touched. Every row added is written down in public.demo_seed_log, so
--     supabase/seed/demo_test_company_remove.sql removes exactly these rows and nothing else.
--   * Running it twice is refused: run the remove script first if you want to load it again.
--   * Everything is posted the same way the app posts it (journals, stock ledger, GST), so the Ledger,
--     Profit & Loss and Balance Sheet agree with the pages.
-- =====================================================================================================

begin;
set local statement_timeout = 0;

-- every demo row is recorded here (the remove script uses it). Not readable from the app.
create table if not exists public.demo_seed_log (
  id         bigserial primary key,
  company_id uuid not null,
  tbl        text not null,
  row_id     text not null,
  created_at timestamptz not null default now()
);
alter table public.demo_seed_log enable row level security;
revoke all on public.demo_seed_log from anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- helpers (temporary: they disappear when this session ends)
-- ---------------------------------------------------------------------------------------------
create temp table d_cols on commit drop as
  select table_name::text tbl, column_name::text col, column_default, data_type::text
  from information_schema.columns where table_schema = 'public';

-- unique keys (single column, or company + column) of every table, so numbers already used elsewhere are skipped
create temp table d_uniq on commit drop as
  select distinct t.relname::text tbl, a.attname::text col, ix.indnatts = 2 per_company
  from pg_index ix
  join pg_class t on t.oid = ix.indrelid
  join pg_namespace ns on ns.oid = t.relnamespace and ns.nspname = 'public'
  join pg_attribute a on a.attrelid = t.oid and a.attnum = any (ix.indkey::int2[])
  where ix.indisunique and not ix.indisprimary and a.attname not in ('company_id', 'id', 'subject_key', 'email')
    and (ix.indnatts = 1 or (ix.indnatts = 2 and exists (
          select 1 from pg_attribute a2 where a2.attrelid = t.oid and a2.attnum = any (ix.indkey::int2[]) and a2.attname = 'company_id')));

-- insert one row from JSON; keys the table does not have are skipped (so it works on any version of
-- the database); company_id and a missing text id are filled in; the row is logged. Returns the id.
create function pg_temp.d_ins(p_table text, p_company uuid, p_values jsonb) returns text
language plpgsql as $$
declare v jsonb := '{}'::jsonb; k text; cols text; r text; idc record; u record; val text; taken boolean; i int;
begin
  if to_regclass('public.' || p_table) is null then return null; end if;
  for k in select jsonb_object_keys(p_values) loop
    if exists (select 1 from d_cols where tbl = p_table and col = k) then v := v || jsonb_build_object(k, p_values -> k); end if;
  end loop;
  if exists (select 1 from d_cols where tbl = p_table and col = 'company_id') then v := v || jsonb_build_object('company_id', p_company); end if;
  select * into idc from d_cols where tbl = p_table and col = 'id';
  if found and not v ? 'id' and idc.column_default is null then v := v || jsonb_build_object('id', gen_random_uuid()::text); end if;
  for u in select * from d_uniq where tbl = p_table loop
    continue when not v ? u.col or jsonb_typeof(v -> u.col) <> 'string';
    val := v ->> u.col; i := 1;
    loop
      execute format('select exists (select 1 from public.%I where %I::text = $1 %s)', p_table, u.col,
                     case when u.per_company then 'and company_id = $2' else '' end) into taken using val, p_company;
      exit when not taken;
      i := i + 1; val := (v ->> u.col) || '-' || i;
    end loop;
    v := v || jsonb_build_object(u.col, val);
  end loop;
  select string_agg(format('%I', key), ', ') into cols from jsonb_object_keys(v) key;
  execute format('insert into public.%I (%s) select %s from jsonb_populate_record(null::public.%I, $1) returning id::text',
                 p_table, cols, cols, p_table) into r using v;
  insert into public.demo_seed_log (company_id, tbl, row_id) values (p_company, p_table, r);
  return r;
end $$;

-- update a demo row (only columns the table has)
create function pg_temp.d_upd(p_table text, p_id text, p_values jsonb) returns void
language plpgsql as $$
declare k text; sets text := '';
begin
  if p_id is null or to_regclass('public.' || p_table) is null then return; end if;
  for k in select jsonb_object_keys(p_values) loop
    if exists (select 1 from d_cols where tbl = p_table and col = k) then
      sets := sets || case when sets = '' then '' else ', ' end || format('%I = r.%I', k, k);
    end if;
  end loop;
  if sets = '' then return; end if;
  execute format('update public.%I t set %s from jsonb_populate_record(null::public.%I, $1) r where t.id::text = $2',
                 p_table, sets, p_table) using p_values, p_id;
end $$;

create function pg_temp.rnd(a int, b int) returns int language sql as $$ select a + floor(random() * (b - a + 1))::int $$;
create function pg_temp.rndn(a numeric, b numeric) returns numeric language sql as $$ select a + (random() * (b - a))::numeric $$;
-- skip Sundays
create function pg_temp.workday(d date) returns date language sql as $$ select case when extract(isodow from d) = 7 then d + 1 else d end $$;
create function pg_temp.ts(d date, minutes int) returns timestamptz language sql as
  $$ select (d::timestamp + make_interval(mins => minutes)) at time zone 'Asia/Kolkata' $$;
create function pg_temp.hhmm(minutes int) returns text language sql as
  $$ select lpad((minutes / 60)::text, 2, '0') || ':' || lpad((minutes % 60)::text, 2, '0') $$;

-- running numbers
create temp table d_seq (k text primary key, n int not null) on commit drop;
create function pg_temp.nxt(p_key text, p_start int) returns int language plpgsql as $$
declare v int;
begin
  insert into d_seq values (p_key, p_start) on conflict (k) do update set n = d_seq.n + 1 returning n into v;
  return v;
end $$;

-- next free document number: prefix + running number, skipping numbers already used in the table
-- (by any company, or only by this company when p_company is given)
create function pg_temp.num(p_table text, p_col text, p_key text, p_start int, p_prefix text, p_width int, p_company uuid default null)
returns text language plpgsql as $$
declare n int; v text; taken boolean;
begin
  loop
    n := pg_temp.nxt(p_key, p_start);
    v := p_prefix || case when length(n::text) >= p_width then n::text else lpad(n::text, p_width, '0') end;
    if not exists (select 1 from d_cols where tbl = p_table and col = p_col) then return v; end if;
    execute format('select exists (select 1 from public.%I where %I::text = $1 %s)', p_table, p_col,
                   case when p_company is not null then 'and company_id = $2' else '' end) into taken using v, p_company;
    if not taken then return v; end if;
  end loop;
end $$;

-- a journal voucher (posted exactly like the app's system postings)
create function pg_temp.jv(c uuid, d date, voucher text, narration text, ref text, lines jsonb) returns uuid
language plpgsql as $$
declare v uuid;
begin
  v := public.erp_post_system_journal(c, 'demo_seed', gen_random_uuid()::text, d, voucher, narration, ref, lines);
  if v is not null then insert into public.demo_seed_log (company_id, tbl, row_id) values (c, 'journal_entries', v::text); end if;
  return v;
end $$;

-- a bank / cash line (the posting trigger books it to the ledger)
create function pg_temp.bank(c uuid, d date, dir text, kind text, acct uuid, contra uuid, ptype text, pname text,
                             cust text, supp text, inv text, amt numeric, mode text, ref text, descr text, src text)
returns text language plpgsql as $$
declare pfx text := case when src = 'petty_cash' then (case when dir = 'IN' then 'CR' else 'CP' end)
                         when contra is not null and ptype is null then 'CV'
                         when dir = 'IN' then 'RV' else 'PV' end;
begin
  if amt is null or amt <= 0 or d > current_date then return null; end if;
  return pg_temp.d_ins('cnc_bank_transactions', c, jsonb_build_object(
    'txn_no', public.erp_next_number(c, 'public.cnc_bank_transactions'::regclass, 'txn_no', pfx),
    'txn_date', d, 'kind', kind, 'direction', dir, 'account_id', acct, 'contra_account_id', contra,
    'party_type', ptype, 'party_name', pname, 'customer_id', cust, 'supplier_id', supp, 'invoice_id', inv,
    'amount', round(amt, 2), 'mode', mode, 'reference_no', ref, 'description', descr, 'status', 'Cleared',
    'source_type', src, 'created_by', 'System', 'created_at', pg_temp.ts(d, pg_temp.rnd(600, 1080))));
end $$;

-- a stock movement (the stock ledger: the triggers update the item stock and post the journal)
create function pg_temp.move(c uuid, d date, kind text, item_id text, code text, uom text, mtype text, dir text,
                             qty numeric, rate numeric, ref_type text, ref_id text, ref_no text, remarks text, wh text,
                             at timestamptz default null)
returns text language plpgsql as $$
begin
  if qty = 0 or d > current_date then return null; end if;
  return pg_temp.d_ins('cnc_stock_movements', c, jsonb_build_object(
    'date', d, 'type', mtype, 'material', code, 'qty', abs(qty), 'uom', uom, 'reference', ref_no, 'user', 'System',
    'item_kind', kind, 'item_id', item_id, 'warehouse_id', wh, 'direction', dir, 'qty_change', qty, 'rate', rate,
    'reference_type', ref_type, 'reference_id', ref_id, 'reference_no', ref_no, 'remarks', remarks, 'created_by', 'System',
    'created_at', coalesce(at, pg_temp.ts(d, pg_temp.rnd(560, 1020)))));
end $$;

-- ---------------------------------------------------------------------------------------------
-- the data
-- ---------------------------------------------------------------------------------------------
do $seed$
declare
  c uuid;
  today date := current_date;
  first_month date := date '2025-07-01';
  opening_day date := date '2025-06-30';
  -- accounts
  a_bank uuid; a_cash uuid; a_sal uuid; a_power uuid; a_rep uuid; a_other uuid; a_direct uuid; a_loan uuid;
  a_pm uuid; a_furn uuid; a_dep uuid; a_accdep uuid; a_capital uuid; a_gst_out uuid; a_gst_in uuid; a_open_eq uuid;
  cat_raw uuid; cat_tool uuid; cat_cons uuid; cat_fg uuid;
  wh text; z_rm text; z_fg text; loc_rm text; loc_fg text;
  -- masters (filled below)
  cust jsonb := '[]'; supp jsonb := '[]'; raw jsonb := '[]'; prod jsonb := '[]'; procs jsonb := '{}';
  ops_men jsonb := '{"LT-20":"Murugan S","LT-30":"Senthil R","VMC-850":"Karthik M","HMC-500":"Prakash K","DR-01":"Arun V","CG-01":"Vignesh P","BENCH":"Saravanan T","QC-LAB":"Dinesh B"}';
  x jsonb; y jsonb; o jsonb; p jsonb; cu jsonb; rm jsonb; pr jsonb; op jsonb;
  i int; j int; k int; n int; m date; mend date; d date; d2 date;
  v text; v2 text; eno text; id_enq text; id_q text; id_so text; id_inw text; id_wo text; id_dc text; id_inv text;
  lead text; qno text; sono text; wono text; dcno text; invno text;
  qty int; price numeric; taxable numeric; cgst numeric; sgst numeric; igst numeric; total numeric; amt numeric;
  e_date date; q_date date; s_date date; i_date date; fg_date date; dc_date date; pay_date date;
  intra boolean; st text; total_min int; chunk int; left_min int; left_qty int; cq int; day date; start_min int;
  act_start int; act_min int; done_qty int; rej int; rej_total int; machine text; man text; op_status text;
  hours numeric; cost numeric; est_cost numeric; pids text[]; fg_rate numeric; kg numeric; buy_qty numeric;
  ht numeric; out_bal numeric; in_bal numeric; setoff numeric; sal numeric; loan_bal numeric := 2350000; intr numeric;
  petty jsonb := '[
    {"t":"Tea & snacks for shop floor","a":"5900","lo":800,"hi":1800},
    {"t":"Courier charges - DTDC","a":"5900","lo":250,"hi":900},
    {"t":"Conveyance - auto / two-wheeler","a":"5900","lo":300,"hi":1200},
    {"t":"Stationery & printing","a":"5900","lo":400,"hi":1500},
    {"t":"Diesel for DG set","a":"5400","lo":2500,"hi":6500},
    {"t":"Small tools - allen keys, taps","a":"5500","lo":600,"hi":2800},
    {"t":"Machine spares bought locally","a":"5500","lo":1200,"hi":5500},
    {"t":"Housekeeping materials","a":"5900","lo":500,"hi":1400},
    {"t":"Loading / unloading charges","a":"5200","lo":600,"hi":1500},
    {"t":"Drinking water cans","a":"5900","lo":300,"hi":700}]';
  petty_men text[] := array['Saravanan T','Dinesh B','Ramesh K','Priya S'];
  lost_why text[] := array['Price not competitive','Customer postponed the project','Lead time too long','Order placed with existing vendor'];
  pay_modes text[] := array['NEFT','RTGS','NEFT','IMPS','Cheque'];
begin
  select id into c from public.companies where lower(btrim(company_name)) = 'test';
  if c is null then raise exception 'There is no company named "test".'; end if;
  if (select count(*) from public.companies where lower(btrim(company_name)) = 'test') > 1 then
    raise exception 'More than one company is named "test".';
  end if;
  if exists (select 1 from public.demo_seed_log where company_id = c) then
    raise exception 'Demo data is already loaded for "test". Run demo_test_company_remove.sql first to load it again.';
  end if;
  perform setseed(0.2026);

  -- chart of accounts and stock categories (created with the company; this only fills gaps)
  perform public.erp_seed_chart_of_accounts(c);
  select id into a_bank    from public.chart_of_accounts where company_id = c and system_key = 'BANK_DEFAULT';
  select id into a_cash    from public.chart_of_accounts where company_id = c and system_key = 'CASH';
  select id into a_gst_out from public.chart_of_accounts where company_id = c and system_key = 'GST_OUTPUT';
  select id into a_gst_in  from public.chart_of_accounts where company_id = c and system_key = 'GST_INPUT';
  select id into a_open_eq from public.chart_of_accounts where company_id = c and system_key = 'OPENING_EQUITY';
  select id into a_capital from public.chart_of_accounts where company_id = c and system_key = 'CAPITAL';
  select id into a_accdep  from public.chart_of_accounts where company_id = c and system_key = 'ACCUMULATED_DEPRECIATION';
  select id into a_dep     from public.chart_of_accounts where company_id = c and system_key = 'DEPRECIATION';
  select id into a_sal     from public.chart_of_accounts where company_id = c and code = '5300' and not is_group;
  select id into a_power   from public.chart_of_accounts where company_id = c and code = '5400' and not is_group;
  select id into a_rep     from public.chart_of_accounts where company_id = c and code = '5500' and not is_group;
  select id into a_other   from public.chart_of_accounts where company_id = c and code = '5900' and not is_group;
  select id into a_direct  from public.chart_of_accounts where company_id = c and code = '5200' and not is_group;
  select id into a_loan    from public.chart_of_accounts where company_id = c and code = '2110' and not is_group;
  select id into a_pm      from public.chart_of_accounts where company_id = c and code = '1120' and not is_group;
  select id into a_furn    from public.chart_of_accounts where company_id = c and code = '1130' and not is_group;
  if a_bank is null or a_cash is null or a_sal is null or a_power is null or a_other is null or a_loan is null or a_pm is null then
    raise exception 'The chart of accounts of "test" is missing standard accounts (Bank, Cash, 5300, 5400, 5900, 2110, 1120).';
  end if;
  select id into cat_raw  from public.inventory_categories where company_id = c and code = 'RAW';
  select id into cat_tool from public.inventory_categories where company_id = c and code = 'TOOL';
  select id into cat_cons from public.inventory_categories where company_id = c and code = 'CONSUMABLE';
  select id into cat_fg   from public.inventory_categories where company_id = c and code = 'FG';

  -- ===================================== SETTINGS (company details, only blanks are filled) =====
  select to_jsonb(co) into y from public.companies co where co.id = c;
  o := '{}';
  for v, x in select key, value from jsonb_each('{"gstin":"33AAKCT4821M1ZP","state_code":"33","industry":"CNC Precision Machining",
      "email":"accounts@testdemo.example","phone":"0422 400 1234","address":"Plot 14, SIDCO Industrial Estate, Kurichi",
      "city":"Coimbatore","state":"Tamil Nadu","pin":"641021","pan":"AAKCT4821M",
      "bank_details":"Bank: State Bank of India, Kurichi Branch · A/c 3912 0045 6618 · IFSC SBIN0011823"}'::jsonb) loop
    if y ? v and coalesce(y ->> v, '') = '' then
      o := o || jsonb_build_object(v, x);
      insert into public.demo_seed_log (company_id, tbl, row_id) values (c, 'companies.' || v, c::text);
    end if;
  end loop;
  perform pg_temp.d_upd('companies', c::text, o);

  -- ===================================== USERS + ACCESS =======================================
  for x in select * from jsonb_array_elements('[
      {"e":"ramesh.production@testdemo.example","n":"Ramesh Kumar","r":"Production Manager","m":["sales-pipeline","scheduling","process-master","project-costing","inventory","dashboard"]},
      {"e":"priya.accounts@testdemo.example","n":"Priya Sundar","r":"Accounts Executive","m":["bank-entry","petty-cash","ledger","profit-loss","balance-sheet","opening-balances","dashboard"]},
      {"e":"suresh.stores@testdemo.example","n":"Suresh Babu","r":"Stores In-charge","m":["inventory","stock-adjustment"]},
      {"e":"kavitha.sales@testdemo.example","n":"Kavitha Raman","r":"Sales Executive","m":["sales-pipeline","dashboard"]},
      {"e":"anand.plant@testdemo.example","n":"Anand Krishnan","r":"Plant Head","m":["sales-pipeline","scheduling","process-master","bank-entry","petty-cash","ledger","profit-loss","balance-sheet","opening-balances","project-costing","inventory","stock-adjustment","dashboard"]}
    ]'::jsonb) loop
    if exists (select 1 from public.company_users where email = x ->> 'e') then continue; end if;
    v := pg_temp.d_ins('company_users', c, jsonb_build_object('email', x ->> 'e', 'full_name', x ->> 'n', 'role', 'USER',
           'status', 'Active', 'mobile', '90000 ' || lpad(pg_temp.rnd(10000, 99999)::text, 5, '0'), 'created_at', '2025-07-01T10:00:00+05:30'));
    for y in select * from jsonb_array_elements(x -> 'm') loop
      exit when to_regclass('public.user_module_permissions') is null;
      insert into public.user_module_permissions (user_id, module_key, can_view, can_create, can_edit, can_delete, can_approve, can_export)
      values (v::uuid, y #>> '{}', true, true, true, (x ->> 'r') in ('Plant Head', 'Accounts Executive'), (x ->> 'r') = 'Plant Head', true)
      on conflict do nothing;
    end loop;
  end loop;

  -- ===================================== MASTERS ================================================
  -- customers (Tamil Nadu = CGST+SGST, others = IGST)
  for x in select * from jsonb_array_elements('[
      {"n":"Sri Lakshmi Auto Components Pvt Ltd","c":"R. Senthil Kumar","city":"Coimbatore","g":"33AAGCS5512Q1Z8","in":"Automotive"},
      {"n":"Kovai Pumps & Valves","c":"M. Karthikeyan","city":"Coimbatore","g":"33ABKFK2231L1ZT","in":"Pumps"},
      {"n":"Precision Hydraulics India Pvt Ltd","c":"S. Ramesh","city":"Chennai","g":"33AAHCP7781D1Z2","in":"Hydraulics"},
      {"n":"Annai Textile Machinery Works","c":"P. Muthusamy","city":"Tiruppur","g":"33ACNPA4410G1ZK","in":"Textile machinery"},
      {"n":"Velan Engineering Works","c":"K. Velmurugan","city":"Erode","g":"33AQWPV1189R1Z6","in":"General engineering"},
      {"n":"Shakthi Motors Ltd","c":"A. Prabhu","city":"Hosur","g":"33AAECS9035H1ZB","in":"Automotive"},
      {"n":"Nila Aerospace Systems","c":"Deepa Rao","city":"Bengaluru","g":"29AAJCN6624P1Z4","in":"Aerospace"},
      {"n":"Deccan Agro Implements","c":"V. Srinivas","city":"Hyderabad","g":"36AAFFD3307K1ZQ","in":"Agriculture"}
    ]'::jsonb) loop
    i := jsonb_array_length(cust) + 1;
    v := pg_temp.d_ins('cnc_customers', c, jsonb_build_object('name', x ->> 'n', 'industry', x ->> 'in', 'contact', x ->> 'c',
           'email', 'purchase' || i || '@customer.example', 'phone', '90000 1' || lpad(i::text, 4, '0'), 'city', x ->> 'city',
           'gst', x ->> 'g', 'source', 'Direct', 'status', 'Active', 'rating', 4, 'created_at', '2025-06-20T10:00:00+05:30'));
    cust := cust || jsonb_build_array(x || jsonb_build_object('id', v, 'intra', left(x ->> 'g', 2) = '33',
              'phone', '90000 1' || lpad(i::text, 4, '0'), 'email', 'purchase' || i || '@customer.example'));
  end loop;

  for x in select * from jsonb_array_elements('[
      {"code":"SUP-001","n":"Coimbatore Steel Traders","cat":"Raw Material","c":"N. Balaji","city":"Coimbatore","g":"33AAIFC1290B1Z3"},
      {"code":"SUP-002","n":"Salem Alloys & Metals","cat":"Raw Material","c":"T. Rajkumar","city":"Salem","g":"33ABEFS6612C1ZJ"},
      {"code":"SUP-003","n":"Bronze & Non-Ferrous Mart","cat":"Raw Material","c":"J. Imran","city":"Chennai","g":"33AAQFB4471A1Z9"},
      {"code":"SUP-004","n":"Tool Point Engineering Supplies","cat":"Tooling","c":"G. Mohan","city":"Coimbatore","g":"33AJDPM2290K1ZD"},
      {"code":"SUP-005","n":"Kumaran Heat Treaters","cat":"Job Work / Service","c":"S. Kumaran","city":"Coimbatore","g":"33AKZPK5520F1ZW"},
      {"code":"SUP-006","n":"Sri Ganesh Lubricants","cat":"Consumables","c":"R. Ganesan","city":"Coimbatore","g":"33AHOPG8813N1ZE"}
    ]'::jsonb) loop
    i := jsonb_array_length(supp) + 1;
    v := pg_temp.d_ins('cnc_suppliers', c, jsonb_build_object('code', x ->> 'code', 'name', x ->> 'n', 'category', x ->> 'cat',
           'contact_person', x ->> 'c', 'phone', '90000 2' || lpad(i::text, 4, '0'), 'email', 'sales' || i || '@supplier.example',
           'city', x ->> 'city', 'state', 'Tamil Nadu', 'country', 'India', 'gst_number', x ->> 'g', 'payment_terms', 'Net 30',
           'status', 'Active', 'created_at', '2025-06-20T10:00:00+05:30'));
    supp := supp || jsonb_build_array(x || jsonb_build_object('id', v));
  end loop;

  -- warehouse
  select id into wh from public.cnc_warehouses where company_id = c and coalesce(is_default, false) limit 1;
  if wh is null then
    wh := pg_temp.d_ins('cnc_warehouses', c, jsonb_build_object('code', 'MAIN', 'name', 'Main Stores', 'type', 'Main',
            'description', 'Raw material and finished goods stores', 'status', 'Active', 'is_default', true));
  end if;
  z_rm := pg_temp.d_ins('cnc_warehouse_zones', c, jsonb_build_object('warehouse_id', wh, 'code', 'RMZ', 'name', 'Raw Material Zone'));
  z_fg := pg_temp.d_ins('cnc_warehouse_zones', c, jsonb_build_object('warehouse_id', wh, 'code', 'FGZ', 'name', 'Finished Goods Zone'));
  loc_rm := pg_temp.d_ins('cnc_warehouse_locations', c, jsonb_build_object('zone_id', z_rm, 'code', 'RM-A1', 'name', 'Rack A1'));
  loc_fg := pg_temp.d_ins('cnc_warehouse_locations', c, jsonb_build_object('zone_id', z_fg, 'code', 'FG-B1', 'name', 'Rack B1'));

  -- raw materials, tools, consumables   (s = supplier index 1..6, open = opening stock)
  for x in select * from jsonb_array_elements('[
      {"code":"RM-EN8-50","n":"EN8 Round Bar Ø50","g":"EN8","f":"Round Bar","u":"Kg","r":78,"s":1,"cat":"RAW","min":300,"open":850},
      {"code":"RM-SS410-40","n":"SS410 Round Bar Ø40","g":"SS410","f":"Round Bar","u":"Kg","r":245,"s":2,"cat":"RAW","min":150,"open":320},
      {"code":"RM-MS-PL20","n":"MS Plate 20 mm","g":"IS2062 E250","f":"Plate","u":"Kg","r":72,"s":1,"cat":"RAW","min":400,"open":900},
      {"code":"RM-CF8M-VB","n":"CF8M Valve Body Casting 2\"","g":"CF8M","f":"Casting","u":"Kg","r":420,"s":2,"cat":"RAW","min":100,"open":180},
      {"code":"RM-BRZ-60","n":"Phosphor Bronze Rod Ø60","g":"PB2","f":"Round Bar","u":"Kg","r":780,"s":3,"cat":"RAW","min":60,"open":120},
      {"code":"RM-AL6061-80","n":"Aluminium 6061-T6 Bar Ø80","g":"Al 6061-T6","f":"Round Bar","u":"Kg","r":310,"s":3,"cat":"RAW","min":120,"open":260},
      {"code":"TL-CNMG-12","n":"Carbide Insert CNMG 120408","g":"P25","f":"Insert","u":"Nos","r":385,"s":4,"cat":"TOOL","min":40,"open":60},
      {"code":"CN-COOL-SOL","n":"Soluble Cutting Oil","g":"Servocut S","f":"Liquid","u":"Ltr","r":165,"s":6,"cat":"CONSUMABLE","min":50,"open":120}
    ]'::jsonb) loop
    v := pg_temp.d_ins('cnc_raw_materials', c, jsonb_build_object('material_code', x ->> 'code', 'name', x ->> 'n', 'grade', x ->> 'g',
           'form', x ->> 'f', 'uom', x ->> 'u', 'stock_qty', 0, 'min_stock', (x ->> 'min')::numeric, 'reorder_qty', (x ->> 'min')::numeric * 2,
           'unit_price', (x ->> 'r')::numeric, 'preferred_supplier_id', supp -> ((x ->> 's')::int - 1) ->> 'id', 'location', 'Rack A1',
           'location_id', loc_rm, 'status', 'Active', 'specification', (x ->> 'g') || ' · ' || (x ->> 'f'),
           'category_id', case x ->> 'cat' when 'TOOL' then cat_tool when 'CONSUMABLE' then cat_cons else cat_raw end,
           'created_at', '2025-06-25T10:00:00+05:30'));
    raw := raw || jsonb_build_array(x || jsonb_build_object('id', v));
  end loop;

  -- machines
  for x in select * from jsonb_array_elements('[
      {"code":"LT-20","n":"CNC Lathe LT-20","t":"CNC Lathe","s":"Running","u":82,"h":11840},
      {"code":"LT-30","n":"CNC Turning Centre LT-30","t":"CNC Lathe","s":"Running","u":76,"h":9420},
      {"code":"VMC-850","n":"Vertical Machining Centre 850","t":"VMC","s":"Running","u":88,"h":13210},
      {"code":"HMC-500","n":"Horizontal Machining Centre 500","t":"HMC","s":"Idle","u":54,"h":6120},
      {"code":"DR-01","n":"Radial Drilling Machine","t":"Drilling","s":"Running","u":61,"h":15400},
      {"code":"CG-01","n":"Cylindrical Grinder CG-01","t":"Grinding","s":"Maintenance","u":35,"h":7730}
    ]'::jsonb) loop
    perform pg_temp.d_ins('cnc_machines', c, jsonb_build_object('code', x ->> 'code', 'name', x ->> 'n', 'type', x ->> 't',
              'status', x ->> 's', 'utilization', (x ->> 'u')::numeric, 'spindle_hours', (x ->> 'h')::numeric, 'created_at', '2025-06-25T10:00:00+05:30'));
  end loop;

  -- process master
  for x in select * from jsonb_array_elements('[
      {"code":"TURN","n":"CNC Turning","cat":"Machining","m":"LT-20","h":650,"s":400,"min":500,"d":"Facing, turning, boring and threading on CNC lathes"},
      {"code":"VMC","n":"VMC Milling","cat":"Machining","m":"VMC-850","h":950,"s":600,"min":800,"d":"Milling, pocketing and drilling on the vertical machining centre"},
      {"code":"HMC","n":"HMC Milling","cat":"Machining","m":"HMC-500","h":1250,"s":800,"min":1000,"d":"Multi-face milling on the horizontal machining centre"},
      {"code":"DRILL","n":"Drilling & Tapping","cat":"Machining","m":"DR-01","h":350,"s":150,"min":300,"d":"PCD drilling, tapping and counter-boring"},
      {"code":"GRIND","n":"Cylindrical Grinding","cat":"Finishing","m":"CG-01","h":700,"s":300,"min":600,"d":"OD grinding to h7 / g6 tolerance"},
      {"code":"DEBURR","n":"Deburring & Washing","cat":"Finishing","m":"BENCH","h":220,"s":0,"min":200,"d":"Manual deburring, washing and oiling"},
      {"code":"INSP","n":"Final Inspection","cat":"Quality","m":"QC-LAB","h":300,"s":0,"min":250,"d":"Dimensional inspection with report"},
      {"code":"HT","n":"Heat Treatment (Outsourced)","cat":"Outsourced","m":"","h":0,"s":0,"min":1500,"d":"Hardening and tempering at the heat-treatment vendor"}
    ]'::jsonb) loop
    v := pg_temp.d_ins('cnc_processes', c, jsonb_build_object('process_code', x ->> 'code', 'process_name', x ->> 'n',
           'process_category', x ->> 'cat', 'machine_type', x ->> 'm', 'description', x ->> 'd', 'cost_per_hour', (x ->> 'h')::numeric,
           'cost_per_component', case when x ->> 'code' = 'HT' then 18 else 0 end, 'setup_cost', (x ->> 's')::numeric,
           'minimum_charge', (x ->> 'min')::numeric, 'status', 'Active', 'created_at', '2025-06-25T10:00:00+05:30'));
    procs := procs || jsonb_build_object(x ->> 'code', x || jsonb_build_object('id', v));
  end loop;

  -- finished goods (r = raw index, kg = raw per piece, ops = [process, cycle min, setup min])
  for x in select * from jsonb_array_elements('[
      {"no":"ARG-FG-101","n":"Flange 150NB Class 150","r":3,"kg":6.2,"p":1450,"hsn":"7307","q":[80,400],"ops":[["TURN",9,45],["DRILL",4,20],["DEBURR",2,0]]},
      {"no":"ARG-FG-102","n":"Pump Shaft SS410 Ø35x420","r":2,"kg":3.4,"p":2350,"hsn":"8413","q":[60,250],"ops":[["TURN",14,60],["GRIND",6,30],["INSP",2,0]]},
      {"no":"ARG-FG-103","n":"Hydraulic Cylinder Rod EN8 Ø40x600","r":1,"kg":6.5,"p":1680,"hsn":"8412","q":[60,300],"ops":[["TURN",12,45],["GRIND",8,30]]},
      {"no":"ARG-FG-104","n":"Gear Blank EN8 Ø120","r":1,"kg":4.8,"p":1050,"hsn":"8483","q":[150,600],"ops":[["TURN",7,40],["VMC",5,45]]},
      {"no":"ARG-FG-105","n":"Valve Body CF8M 2 inch","r":4,"kg":5.5,"p":5600,"hsn":"8481","q":[30,150],"ops":[["VMC",18,90],["HMC",15,90],["INSP",4,0]]},
      {"no":"ARG-FG-106","n":"Bronze Bush Ø60x80","r":5,"kg":1.6,"p":2450,"hsn":"8483","q":[80,350],"ops":[["TURN",6,30],["DEBURR",2,0]]},
      {"no":"ARG-FG-107","n":"Spindle Housing Al6061","r":6,"kg":4.2,"p":3650,"hsn":"8466","q":[30,180],"ops":[["VMC",22,90],["DRILL",6,30],["INSP",3,0]]},
      {"no":"ARG-FG-108","n":"Coupling Hub EN8 Ø90","r":1,"kg":3.2,"p":780,"hsn":"8483","q":[150,700],"ops":[["TURN",6,40],["VMC",4,40],["DRILL",3,20]]}
    ]'::jsonb) loop
    fg_rate := round((x ->> 'p')::numeric * 0.68, 2);
    v := pg_temp.d_ins('cnc_parts', c, jsonb_build_object('part_no', x ->> 'no', 'part_name', x ->> 'n', 'drawing_no', 'DRG-' || right(x ->> 'no', 3),
           'revision', 'B', 'material', raw -> ((x ->> 'r')::int - 1) ->> 'g', 'unit', 'Nos', 'stock_qty', 0, 'unit_price', fg_rate,
           'weight', (x ->> 'kg')::numeric, 'hsn', x ->> 'hsn', 'location_id', loc_fg, 'status', 'Active', 'category_id', cat_fg,
           'min_stock', 20, 'reorder_qty', 50, 'specification', 'As per customer drawing', 'created_at', '2025-06-25T10:00:00+05:30'));
    prod := prod || jsonb_build_array(x || jsonb_build_object('id', v, 'cost', fg_rate));
  end loop;

  -- ===================================== OPENING BALANCES (30 Jun 2025) =========================
  -- fixed assets, capital and term loan
  perform pg_temp.jv(c, opening_day, 'Opening', 'Opening balances: fixed assets, capital and term loan', 'OPENING', jsonb_build_array(
    jsonb_build_object('account_id', a_pm, 'debit', 6500000),
    jsonb_build_object('account_id', a_furn, 'debit', 350000),
    jsonb_build_object('account_id', a_capital, 'credit', 4500000),
    jsonb_build_object('account_id', a_loan, 'credit', 2350000)));

  -- bank and cash, customers who owe us, suppliers we owe
  for x in select * from jsonb_array_elements(jsonb_build_array(
      jsonb_build_object('t','BANK','acct',a_bank,'bt','Debit','amt',2240000,'side','DR','rem','State Bank of India current account'),
      jsonb_build_object('t','BANK','acct',a_cash,'bt','Debit','amt',25000,'side','DR','rem','Cash in hand'),
      jsonb_build_object('t','CUSTOMER','p',0,'bt','Receivable','amt',385400,'side','DR','ref','INV/24-25/0412','due','2025-07-20'),
      jsonb_build_object('t','CUSTOMER','p',1,'bt','Receivable','amt',196250,'side','DR','ref','INV/24-25/0418','due','2025-07-25'),
      jsonb_build_object('t','CUSTOMER','p',2,'bt','Receivable','amt',274800,'side','DR','ref','INV/24-25/0421','due','2025-08-05'),
      jsonb_build_object('t','SUPPLIER','p',0,'bt','Payable','amt',162300,'side','CR','ref','CST/1187','due','2025-07-15'),
      jsonb_build_object('t','SUPPLIER','p',1,'bt','Payable','amt',98450,'side','CR','ref','SAM/2290','due','2025-07-18'),
      jsonb_build_object('t','SUPPLIER','p',3,'bt','Payable','amt',36200,'side','CR','ref','TP/0981','due','2025-07-22'))) loop
    eno := pg_temp.num('cnc_opening_entries', 'entry_no', 'OBE', 1, 'OBE-', 5, c);
    if x ->> 't' = 'BANK' then
      o := jsonb_build_object('subject_key', 'BANK:' || (x ->> 'acct'), 'account_id', x ->> 'acct');
      y := jsonb_build_array(jsonb_build_object('account_id', x ->> 'acct', 'debit', x -> 'amt'), jsonb_build_object('key', 'OPENING_EQUITY', 'credit', x -> 'amt'));
    elsif x ->> 't' = 'CUSTOMER' then
      cu := cust -> ((x ->> 'p')::int);
      o := jsonb_build_object('subject_key', 'CUSTOMER:' || (cu ->> 'id') || '|' || lower(x ->> 'ref'), 'party_id', cu ->> 'id', 'party_name', cu ->> 'n',
             'invoice_ref', x ->> 'ref', 'due_date', x ->> 'due');
      y := jsonb_build_array(jsonb_build_object('key', 'TRADE_RECEIVABLES', 'debit', x -> 'amt', 'party', cu ->> 'n'), jsonb_build_object('key', 'OPENING_EQUITY', 'credit', x -> 'amt'));
    else
      cu := supp -> ((x ->> 'p')::int);
      o := jsonb_build_object('subject_key', 'SUPPLIER:' || (cu ->> 'id') || '|' || lower(x ->> 'ref'), 'party_id', cu ->> 'id', 'party_name', cu ->> 'n',
             'party_code', cu ->> 'code', 'invoice_ref', x ->> 'ref', 'due_date', x ->> 'due');
      y := jsonb_build_array(jsonb_build_object('key', 'OPENING_EQUITY', 'debit', x -> 'amt'), jsonb_build_object('key', 'TRADE_PAYABLES', 'credit', x -> 'amt', 'party', cu ->> 'n'));
    end if;
    v := gen_random_uuid()::text;
    v2 := public.erp_post_system_journal(c, 'opening_entry', v, opening_day, 'Opening', 'Opening balance ' || lower(x ->> 't'), eno, y)::text;
    perform pg_temp.d_ins('cnc_opening_entries', c, o || jsonb_build_object('id', v, 'entry_no', eno,
              'entry_type', x ->> 't', 'opening_date', opening_day, 'status', 'Posted', 'balance_type', x ->> 'bt', 'side', x ->> 'side',
              'amount', x -> 'amt', 'currency', 'INR', 'remarks', x ->> 'rem', 'journal_entry_id', v2, 'created_by', 'System',
              'posted_by', 'System', 'posted_at', '2025-07-01T10:30:00+05:30', 'created_at', '2025-07-01T10:00:00+05:30'));
    insert into public.demo_seed_log (company_id, tbl, row_id) values (c, 'journal_entries', v2);
  end loop;

  -- opening stock (raw at purchase rate, a little finished stock at cost)
  for x in select * from jsonb_array_elements(raw) loop
    v := pg_temp.move(c, opening_day, 'RAW', x ->> 'id', x ->> 'code', x ->> 'u', 'Opening', 'IN', (x ->> 'open')::numeric, (x ->> 'r')::numeric,
                      'opening', null, 'OPENING', 'Opening stock', wh, '2025-07-01T10:15:00+05:30');
    eno := pg_temp.num('cnc_opening_entries', 'entry_no', 'OBE', 1, 'OBE-', 5, c);
    perform pg_temp.d_ins('cnc_opening_entries', c, jsonb_build_object('entry_no', eno, 'entry_type', 'STOCK',
              'opening_date', opening_day, 'status', 'Posted', 'subject_key', 'STOCK:RAW:' || (x ->> 'id'), 'item_kind', 'RAW', 'item_id', x ->> 'id',
              'item_code', x ->> 'code', 'item_name', x ->> 'n', 'unit', x ->> 'u', 'warehouse_id', wh, 'qty', (x ->> 'open')::numeric,
              'unit_cost', (x ->> 'r')::numeric, 'amount', (x ->> 'open')::numeric * (x ->> 'r')::numeric, 'side', 'DR', 'currency', 'INR',
              'movement_id', v, 'created_by', 'System', 'posted_by', 'System', 'posted_at', '2025-07-01T10:30:00+05:30', 'created_at', '2025-07-01T10:00:00+05:30'));
  end loop;
  for x in select * from jsonb_array_elements(prod) loop
    qty := case x ->> 'no' when 'ARG-FG-101' then 40 when 'ARG-FG-104' then 60 when 'ARG-FG-108' then 80 else 0 end;
    continue when qty = 0;
    v := pg_temp.move(c, opening_day, 'PART', x ->> 'id', x ->> 'no', 'Nos', 'Opening', 'IN', qty, (x ->> 'cost')::numeric,
                      'opening', null, 'OPENING', 'Opening stock', wh, '2025-07-01T10:15:00+05:30');
    eno := pg_temp.num('cnc_opening_entries', 'entry_no', 'OBE', 1, 'OBE-', 5, c);
    perform pg_temp.d_ins('cnc_opening_entries', c, jsonb_build_object('entry_no', eno, 'entry_type', 'STOCK',
              'opening_date', opening_day, 'status', 'Posted', 'subject_key', 'STOCK:PART:' || (x ->> 'id'), 'item_kind', 'PART', 'item_id', x ->> 'id',
              'item_code', x ->> 'no', 'item_name', x ->> 'n', 'unit', 'Nos', 'warehouse_id', wh, 'qty', qty, 'unit_cost', (x ->> 'cost')::numeric,
              'amount', qty * (x ->> 'cost')::numeric, 'side', 'DR', 'currency', 'INR', 'movement_id', v, 'created_by', 'System',
              'posted_by', 'System', 'posted_at', '2025-07-01T10:30:00+05:30', 'created_at', '2025-07-01T10:00:00+05:30'));
  end loop;

  -- move the opening difference into the capital account (so the Balance Sheet shows a clean capital)
  select coalesce(sum(l.credit - l.debit), 0) into amt from public.journal_entry_lines l join public.journal_entries e on e.id = l.journal_entry_id
   where l.company_id = c and l.account_id = a_open_eq and e.entry_date <= opening_day;
  if amt > 0 then
    perform pg_temp.jv(c, opening_day, 'Journal', 'Opening balance difference transferred to capital', 'OPENING', jsonb_build_array(
      jsonb_build_object('account_id', a_open_eq, 'debit', amt), jsonb_build_object('account_id', a_capital, 'credit', amt)));
  end if;

  -- the opening dues are settled in July
  for i in 0..2 loop
    cu := cust -> i;
    amt := case i when 0 then 385400 when 1 then 196250 else 274800 end;
    perform pg_temp.bank(c, date '2025-07-12' + i * 6, 'IN', 'Receipt', a_bank, null, 'Customer', cu ->> 'n', cu ->> 'id', null, null,
              amt, 'NEFT', 'OLD-' || (i + 1), 'NEFT received from ' || (cu ->> 'n') || ' against last year''s invoice', 'manual_entry');
  end loop;
  for x in select * from jsonb_array_elements('[[0,162300,"2025-07-15"],[1,98450,"2025-07-18"],[3,36200,"2025-07-22"]]'::jsonb) loop
    cu := supp -> ((x ->> 0)::int);
    perform pg_temp.bank(c, (x ->> 2)::date, 'OUT', 'Payment', a_bank, null, 'Supplier', cu ->> 'n', null, cu ->> 'id', null,
              (x ->> 1)::numeric, 'NEFT', 'OLD-PAY', 'NEFT paid to ' || (cu ->> 'n') || ' - last year''s bill', 'manual_entry');
  end loop;

  -- ===================================== MONTH BY MONTH =========================================
  m := first_month;
  while m <= today loop
    mend := (m + interval '1 month - 1 day')::date;

    -- ---------- the orders of the month: enquiry → … → payment ----------
    -- the last two months are busier, so every column of the pipeline has work in it today
    n := 5 + pg_temp.rnd(0, 2) + case when m >= (date_trunc('month', today) - interval '1 month')::date then 5 else 0 end;
    for k in 1..n loop
      cu := cust -> pg_temp.rnd(0, jsonb_array_length(cust) - 1);
      pr := prod -> pg_temp.rnd(0, jsonb_array_length(prod) - 1);
      rm := raw -> ((pr ->> 'r')::int - 1);
      intra := (cu ->> 'intra')::boolean;
      qty := (round(pg_temp.rnd((pr -> 'q' ->> 0)::int, (pr -> 'q' ->> 1)::int) / 10.0) * 10)::int;
      price := round((pr ->> 'p')::numeric * pg_temp.rndn(0.95, 1.05) / 5) * 5;
      taxable := qty * price;
      e_date := m + pg_temp.rnd(0, 24);
      continue when e_date > today;

      -- enquiry
      lead := pg_temp.num('cnc_enquiries', 'lead_no', 'LEAD', 1001, '', 0);
      id_enq := pg_temp.d_ins('cnc_enquiries', c, jsonb_build_object('lead_no', lead, 'enquiry_no', lead, 'customer', cu ->> 'n',
                  'contact_person', cu ->> 'c', 'phone', cu ->> 'phone', 'email', cu ->> 'email', 'city', cu ->> 'city', 'gst', cu ->> 'g',
                  'part_name', pr ->> 'n', 'part_no', 'N/A', 'quantity', qty, 'estimated_value', taxable, 'source', 'Direct',
                  'status', 'New', 'pipeline_stage', 'Enquiry', 'expected_date', e_date + 30, 'received_date', e_date,
                  'remarks', 'RFQ received by e-mail with drawing ' || replace(pr ->> 'no', 'ARG-FG-', 'DRG-'),
                  'enquiring_for', jsonb_build_array(jsonb_build_object('productName', pr ->> 'n', 'partName', pr ->> 'n',
                                    'quantity', qty::text, 'remarks', '', 'filePaths', '[]'::jsonb))::text,
                  'created_at', pg_temp.ts(e_date, pg_temp.rnd(570, 1050))));

      q_date := pg_temp.workday(e_date + pg_temp.rnd(1, 4));
      if q_date > today then
        perform pg_temp.d_upd('cnc_enquiries', id_enq, jsonb_build_object('status', (array['New','Contacted','Qualified'])[pg_temp.rnd(1,3)]));
        continue;
      end if;

      -- quotation
      qno := pg_temp.num('cnc_quotations', 'quote_no', 'QT' || extract(year from q_date), 1001, 'QT-' || extract(year from q_date) || '-', 4);
      total := round(taxable * 1.18, 2);
      id_q := pg_temp.d_ins('cnc_quotations', c, jsonb_build_object('quote_no', qno, 'lead_id', id_enq, 'enquiry_no', lead,
                'customer', cu ->> 'n', 'customer_id', cu ->> 'id', 'contact_person', cu ->> 'c', 'phone', cu ->> 'phone', 'email', cu ->> 'email',
                'part_name', pr ->> 'n', 'part_number', pr ->> 'no', 'quantity', qty, 'unit_price', price, 'unit_discount', 0,
                'total_value', total, 'discount_percent', 0, 'gst_percent', 18, 'payment_terms', '30 days from invoice',
                'delivery_terms', 'Ex-works, 3-4 weeks from PO', 'salesperson', 'Kavitha Raman',
                'remarks', 'Price valid for the quoted quantity', 'date', q_date, 'valid_till', q_date + 30, 'status', 'Sent',
                'description', jsonb_build_array(jsonb_build_object('id', gen_random_uuid()::text, 'hsn', pr ->> 'hsn', 'partName', pr ->> 'n',
                      'partNumber', pr ->> 'no', 'quantity', qty::text, 'unit', 'Nos', 'unitPrice', price::text, 'discount', '0', 'unitDiscount', '0',
                      'gst', '18', 'cgst', case when intra then '9' else '0' end, 'sgst', case when intra then '9' else '0' end,
                      'igst', case when intra then '0' else '18' end, 'filePaths', '[]'::jsonb, 'files', '[]'::jsonb))::text,
                'created_at', pg_temp.ts(q_date, pg_temp.rnd(600, 1080))));
      perform pg_temp.d_upd('cnc_enquiries', id_enq, jsonb_build_object('status', 'Quoted', 'pipeline_stage', 'Quotation'));
      -- about one quotation in seven is lost
      if pg_temp.rnd(1, 7) = 1 and q_date + 15 <= today then
        perform pg_temp.d_upd('cnc_quotations', id_q, jsonb_build_object('status', 'Rejected',
                  'remarks', lost_why[pg_temp.rnd(1, 4)]));
        perform pg_temp.d_upd('cnc_enquiries', id_enq, jsonb_build_object('status', 'Lost'));
        continue;
      end if;

      s_date := pg_temp.workday(q_date + pg_temp.rnd(4, 10));
      if s_date > today then
        perform pg_temp.d_upd('cnc_quotations', id_q, jsonb_build_object('status', (array['Sent','Under Review'])[pg_temp.rnd(1,2)]));
        continue;
      end if;

      -- sales order
      sono := pg_temp.num('cnc_sales_orders', 'order_no', 'SO' || extract(year from s_date), 2001, 'SO-' || extract(year from s_date) || '-', 4);
      id_so := pg_temp.d_ins('cnc_sales_orders', c, jsonb_build_object('order_no', sono, 'quotation_id', id_q, 'quote_no', qno,
                 'lead_no', lead || '-' || to_char(s_date, 'DDMonYY') || '-' || to_char(pg_temp.ts(s_date, pg_temp.rnd(600, 1000)) at time zone 'Asia/Kolkata', 'HH12MIAM'),
                 'customer', cu ->> 'n', 'customer_id', cu ->> 'id', 'contact_person', cu ->> 'c', 'phone', cu ->> 'phone', 'email', cu ->> 'email',
                 'billing_address', (cu ->> 'n') || ', ' || (cu ->> 'city'), 'delivery_address', (cu ->> 'n') || ', ' || (cu ->> 'city'),
                 'shipping_contact', cu ->> 'c', 'shipping_phone', cu ->> 'phone', 'part_name', pr ->> 'n', 'part_no', '', 'part_number', '',
                 'quantity', qty, 'delivered', 0, 'value', taxable, 'total_value', total,
                 'items', jsonb_build_array(jsonb_build_object('id', gen_random_uuid()::text, 'partName', pr ->> 'n', 'productName', pr ->> 'n',
                          'partNumber', pr ->> 'no', 'description', '', 'quantity', qty::text, 'unitPrice', price::text, 'discount', '0',
                          'unitDiscount', '0', 'gst', '18', 'filePaths', '[]'::jsonb, 'rejectedQty', 0, 'status', 'Confirmed')),
                 'order_date', s_date, 'delivery_date', s_date + pg_temp.rnd(21, 35),
                 'customer_po_no', 'PO/' || to_char(s_date, 'YY') || '/' || pg_temp.rnd(1100, 9800), 'customer_po_date', s_date - 1,
                 'payment_terms', 'Net 30', 'special_instructions', 'Supply with inspection report', 'status', 'Confirmed',
                 'created_at', pg_temp.ts(s_date, pg_temp.rnd(600, 1080))));
      perform pg_temp.d_upd('cnc_quotations', id_q, jsonb_build_object('status', 'Converted'));
      perform pg_temp.d_upd('cnc_enquiries', id_enq, jsonb_build_object('status', 'Converted', 'pipeline_stage', 'Sales Order'));
      -- some orders of the last days are still waiting for the customer's material / drawing (Sales Order column)
      if s_date >= today - 7 and pg_temp.rnd(1, 3) <= 2 then continue; end if;

      -- raw material bought for the order (arrives between the order and the start of production)
      i_date := pg_temp.workday(s_date + pg_temp.rnd(1, 4));
      kg := ceil(qty * (pr ->> 'kg')::numeric * 1.08);
      d := s_date + pg_temp.rnd(0, i_date - s_date);
      if d <= today then
        y := supp -> ((rm ->> 's')::int - 1);
        amt := round(kg * (rm ->> 'r')::numeric, 2);
        v := pg_temp.d_ins('cnc_inwards', c, jsonb_build_object('inward_no', pg_temp.num('cnc_inwards', 'inward_no', 'INW' || extract(year from d), 3001, 'INW-' || extract(year from d) || '-', 4),
               'category', 'GOODS PURCHASE', 'inward_date', d, 'party_name', y ->> 'n', 'part_name', rm ->> 'n', 'product_name', rm ->> 'n',
               'part_number', rm ->> 'code', 'quantity', kg, 'price', (rm ->> 'r')::numeric, 'discount_percent', 0, 'gst_percent', 18,
               'total_amount', round(amt * 1.18, 2), 'reference_no', 'Bill ' || upper(left(y ->> 'code', 3)) || '/' || pg_temp.rnd(2000, 9999),
               'party_dc_no', 'DC-' || pg_temp.rnd(100, 999), 'project_name', lead, 'sales_order_ref', sono, 'status', 'Received',
               'remarks', 'Material for ' || sono, 'created_at', pg_temp.ts(d, pg_temp.rnd(600, 1000))));
        perform pg_temp.move(c, d, 'RAW', rm ->> 'id', rm ->> 'code', rm ->> 'u', 'Purchase Inward', 'IN', kg, (rm ->> 'r')::numeric,
                             'grn', v, 'Bill from ' || (y ->> 'n'), 'Purchase for ' || sono, wh);
        perform pg_temp.jv(c, d, 'Purchase', 'Purchase of ' || (rm ->> 'n') || ' from ' || (y ->> 'n'), sono, jsonb_build_array(
          jsonb_build_object('key', 'INV_RAW', 'debit', amt), jsonb_build_object('key', 'GST_INPUT', 'debit', round(amt * 0.18, 2)),
          jsonb_build_object('key', 'TRADE_PAYABLES', 'credit', round(amt * 1.18, 2), 'party', y ->> 'n')));
        perform pg_temp.bank(c, pg_temp.workday(d + pg_temp.rnd(28, 45)), 'OUT', 'Payment', a_bank, null, 'Supplier', y ->> 'n', null, y ->> 'id', null,
                  round(amt * 1.18, 2), pay_modes[pg_temp.rnd(1, 5)], 'Bill ' || sono, 'NEFT paid to ' || (y ->> 'n') || ' for ' || (rm ->> 'n'), 'manual_entry');
      end if;

      -- inward of the project (customer drawing / DC) on the board
      if i_date > today then continue; end if;
      st := (array['NO DC','NO DC','CUSTOMER DC','NEW PROJECT'])[pg_temp.rnd(1, 4)];
      id_inw := pg_temp.d_ins('cnc_inwards', c, jsonb_build_object('inward_no', pg_temp.num('cnc_inwards', 'inward_no', 'INW' || extract(year from i_date), 3001, 'INW-' || extract(year from i_date) || '-', 4),
                  'category', st, 'inward_date', i_date, 'party_name', cu ->> 'n', 'contact_person', cu ->> 'c', 'phone', cu ->> 'phone', 'email', cu ->> 'email',
                  'part_name', pr ->> 'n', 'product_name', pr ->> 'n', 'part_number', pr ->> 'no', 'quantity', qty, 'price', price,
                  'discount_percent', 0, 'gst_percent', 18, 'total_amount', taxable, 'project_name', lead, 'sales_order_ref', sono,
                  'enquiry_id', id_enq, 'reference_no', sono, 'party_dc_no', case when st = 'CUSTOMER DC' then 'CDC-' || pg_temp.rnd(100, 999) end,
                  'status', 'Pending', 'remarks', 'Drawing and PO received', 'created_at', pg_temp.ts(i_date, pg_temp.rnd(600, 1000))));
      perform pg_temp.d_upd('cnc_sales_orders', id_so, jsonb_build_object('status', 'Inwarded'));

      -- work order + routing
      wono := pg_temp.num('cnc_work_orders', 'wo_no', 'WO' || to_char(i_date, 'YYMM'), 1, 'WO-' || to_char(i_date, 'YYMM') || '-', 3);
      d := pg_temp.workday(i_date + 1);
      id_wo := pg_temp.d_ins('cnc_work_orders', c, jsonb_build_object('id', gen_random_uuid()::text, 'wo_no', wono, 'sales_order', sono,
                 'customer', cu ->> 'n', 'part_name', pr ->> 'n', 'product_name', pr ->> 'n', 'part_no', 'DRG-' || right(pr ->> 'no', 3),
                 'quantity', qty, 'completed', 0, 'rejected', 0, 'status', 'Released', 'priority', (array['Normal','Normal','High','Medium'])[pg_temp.rnd(1,4)],
                 'start_date', d, 'due_date', s_date + 28, 'drawing_revision', 'B', 'description', 'Machining as per drawing ' || replace(pr ->> 'no', 'ARG-FG-', 'DRG-'),
                 'warehouse_id', wh, 'is_part_order', false, 'created_at', pg_temp.ts(i_date, pg_temp.rnd(660, 1020))));
      perform pg_temp.d_upd('cnc_sales_orders', id_so, jsonb_build_object('status', 'In Production'));
      -- material issued to production
      if d <= today then
        perform pg_temp.move(c, d, 'RAW', rm ->> 'id', rm ->> 'code', rm ->> 'u', 'Production Issue', 'OUT', -ceil(qty * (pr ->> 'kg')::numeric),
                             (rm ->> 'r')::numeric, 'production_issue', id_wo, wono, 'Issued to ' || wono, wh);
      end if;

      est_cost := 0; cost := 0; ht := 0; rej_total := 0; fg_date := null; done_qty := qty; i := 0;
      day := d;
      for op in select * from jsonb_array_elements(pr -> 'ops') loop
        i := i + 1;
        p := procs -> (op ->> 0);
        machine := case when op ->> 0 = 'TURN' then (array['LT-20','LT-30'])[pg_temp.rnd(1,2)] else p ->> 'm' end;
        man := coalesce(ops_men ->> machine, 'Operator');
        total_min := (op ->> 2)::int + qty * (op ->> 1)::int;
        est_cost := est_cost + round(total_min / 60.0 * (p ->> 'h')::numeric, 2);
        left_min := total_min; left_qty := qty; op_status := 'Pending'; hours := 0; cq := 0;
        v := pg_temp.d_ins('cnc_work_order_operations', c, jsonb_build_object('work_order_id', id_wo, 'sales_order_id', id_so, 'sales_order_no', sono,
               'process_id', p ->> 'id', 'process_code', op ->> 0, 'process_name', p ->> 'n', 'operation_sequence', i, 'machine', machine, 'operator', man,
               'planned_qty', qty, 'completed_qty', 0, 'est_cycle_time', (op ->> 1)::numeric, 'setup_time', (op ->> 2)::numeric, 'status', 'Pending',
               'planned_start', pg_temp.ts(day, 510), 'created_at', pg_temp.ts(i_date, 1050)));
        while left_min > 0 loop
          day := pg_temp.workday(day);
          chunk := least(left_min, 600);
          cq := case when chunk >= left_min then left_qty else least(left_qty, greatest(1, floor(qty::numeric * chunk / total_min)::int)) end;
          start_min := 510;   -- 08:30
          perform pg_temp.d_ins('cnc_operation_plans', c, jsonb_build_object('work_order_id', id_wo, 'operation_sequence', i,
                    'process_name', p ->> 'n', 'machine', machine, 'operator', man, 'plan_date', day,
                    'start_time', pg_temp.hhmm(start_min), 'end_time', pg_temp.hhmm(least(start_min + greatest(chunk, 15), 1439)),
                    'quantity', cq, 'notes', wono || ' · ' || (pr ->> 'n'), 'created_by', 'Ramesh Kumar', 'created_at', pg_temp.ts(i_date, 1080)));
          if day < today then
            act_start := 480 + pg_temp.rnd(0, 40);
            act_min := greatest(15, round(chunk * pg_temp.rndn(0.92, 1.12))::int);
            rej := case when pg_temp.rnd(1, 6) = 1 then pg_temp.rnd(1, 3) else 0 end;
            rej := least(rej, greatest(cq - 1, 0));
            perform pg_temp.d_ins('cnc_job_cards', c, jsonb_build_object('job_no', pg_temp.num('cnc_job_cards', 'job_no', 'JC' || extract(year from day), 1, 'JC-' || extract(year from day) || '-', 4),
                      'work_order', wono, 'work_order_id', id_wo, 'op_no', i * 10, 'part_name', pr ->> 'n', 'part_no', 'DRG-' || right(pr ->> 'no', 3),
                      'operation', p ->> 'n', 'machine', machine, 'operator', man, 'tool_no', 'T0' || pg_temp.rnd(1, 9), 'qty_planned', cq,
                      'qty_completed', cq - rej, 'qty_rejected', rej, 'rework_qty', 0, 'cycle_time', (op ->> 1)::numeric, 'setup_time', (op ->> 2)::numeric,
                      'status', 'Completed', 'sales_order_no', sono, 'customer', cu ->> 'n',
                      'rejection_type', case when rej > 0 then (array['Dimension out','Surface finish','Tool mark'])[pg_temp.rnd(1,3)] end,
                      'actual_start', pg_temp.ts(day, act_start), 'actual_end', pg_temp.ts(day, least(act_start + act_min, 1430)),
                      'completed_at', pg_temp.ts(day, least(act_start + act_min, 1430)), 'created_at', pg_temp.ts(day, act_start), 'created_by', man));
            hours := hours + act_min / 60.0;
            rej_total := rej_total + rej;
            op_status := 'In Progress';
            left_qty := left_qty - cq;
          elsif day = today and extract(isodow from day) <> 7 then
            -- running today
            perform pg_temp.d_ins('cnc_job_cards', c, jsonb_build_object('job_no', pg_temp.num('cnc_job_cards', 'job_no', 'JC' || extract(year from day), 1, 'JC-' || extract(year from day) || '-', 4),
                      'work_order', wono, 'work_order_id', id_wo, 'op_no', i * 10, 'part_name', pr ->> 'n', 'operation', p ->> 'n', 'machine', machine,
                      'operator', man, 'qty_planned', cq, 'qty_completed', 0, 'qty_rejected', 0, 'rework_qty', 0, 'cycle_time', (op ->> 1)::numeric,
                      'setup_time', (op ->> 2)::numeric, 'status', 'In Progress', 'sales_order_no', sono, 'customer', cu ->> 'n',
                      'actual_start', pg_temp.ts(day, 485), 'created_at', pg_temp.ts(day, 485), 'created_by', man));
            op_status := 'In Progress';
          end if;
          left_min := left_min - chunk;
          if left_min > 0 then day := day + 1; end if;
        end loop;
        if day < today then
          op_status := 'Completed';
          perform pg_temp.d_upd('cnc_work_order_operations', v, jsonb_build_object('status', 'Completed', 'completed_qty', qty - rej_total,
                    'actual_minutes', round(hours * 60), 'actual_start', pg_temp.ts(d, 490), 'actual_finish', pg_temp.ts(day, 1000),
                    'planned_finish', pg_temp.ts(day, 1110), 'rejected_qty', rej_total));
          perform pg_temp.d_ins('process_costing', c, jsonb_build_object('project_name', wono, 'party_name', cu ->> 'n', 'part_name', pr ->> 'n',
                    'process_name', p ->> 'n', 'duration', round(hours, 2), 'quantity', qty, 'process_cost', round(hours * (p ->> 'h')::numeric, 2),
                    'total_cost', round(hours * (p ->> 'h')::numeric, 2), 'created_at', pg_temp.ts(day, 1100)));
          cost := cost + round(hours * (p ->> 'h')::numeric, 2);
          fg_date := day;
        else
          perform pg_temp.d_upd('cnc_work_order_operations', v, jsonb_build_object('status', op_status, 'planned_finish', pg_temp.ts(day, 1110)));
          fg_date := null;
        end if;
        day := day + 1;
      end loop;
      done_qty := qty - rej_total;

      -- planned cost (workings) for Product Costing
      perform pg_temp.d_ins('planned_workings', c, jsonb_build_object('project_name', wono, 'date', q_date,
                'total_amount', round(ceil(qty * (pr ->> 'kg')::numeric) * (rm ->> 'r')::numeric + est_cost, 2),
                'parts', jsonb_build_array(jsonb_build_object('partName', pr ->> 'n', 'quantity', qty, 'material', rm ->> 'n')),
                'created_at', pg_temp.ts(q_date, 900)));

      -- heat treatment for ground shafts / rods (service purchase)
      if (pr -> 'ops')::text like '%GRIND%' and d + 3 <= today then
        y := supp -> 4;
        amt := round(done_qty * 18 + 1500, 2);
        ht := amt;
        perform pg_temp.d_ins('cnc_inwards', c, jsonb_build_object('inward_no', pg_temp.num('cnc_inwards', 'inward_no', 'INW' || extract(year from d + 3), 3001, 'INW-' || extract(year from d + 3) || '-', 4),
                  'category', 'SERVICE PURCHASE', 'inward_date', d + 3, 'party_name', y ->> 'n', 'part_name', 'Heat treatment - ' || (pr ->> 'n'),
                  'product_name', pr ->> 'n', 'quantity', done_qty, 'price', round(amt / greatest(done_qty, 1), 2), 'discount_percent', 0, 'gst_percent', 18,
                  'total_amount', round(amt * 1.18, 2), 'project_name', wono, 'sales_order_ref', sono, 'reference_no', 'KHT/' || pg_temp.rnd(1000, 9999),
                  'status', 'Received', 'created_at', pg_temp.ts(d + 3, 700)));
        perform pg_temp.jv(c, d + 3, 'Purchase', 'Heat treatment for ' || wono, wono, jsonb_build_array(
          jsonb_build_object('account_id', a_direct, 'debit', amt), jsonb_build_object('key', 'GST_INPUT', 'debit', round(amt * 0.18, 2)),
          jsonb_build_object('key', 'TRADE_PAYABLES', 'credit', round(amt * 1.18, 2), 'party', y ->> 'n')));
        perform pg_temp.bank(c, pg_temp.workday(d + 3 + pg_temp.rnd(25, 40)), 'OUT', 'Payment', a_bank, null, 'Supplier', y ->> 'n', null, y ->> 'id', null,
                  round(amt * 1.18, 2), 'NEFT', wono, 'NEFT paid to ' || (y ->> 'n') || ' - heat treatment ' || wono, 'manual_entry');
      end if;

      if fg_date is null then
        -- still on the machines
        perform pg_temp.d_upd('cnc_work_orders', id_wo, jsonb_build_object('status',
                  case when exists (select 1 from public.cnc_job_cards where company_id = c and work_order = wono) then 'In Progress' else 'Released' end,
                  'completed', 0, 'rejected', rej_total));
        continue;
      end if;

      -- actual cost of the finished job (material + machining + outside work), for Product Costing
      perform pg_temp.d_ins('product_costing', c, jsonb_build_object('project_name', wono, 'party_name', cu ->> 'n', 'part_name', pr ->> 'n',
                'category', 'Raw Material', 'quantity', ceil(qty * (pr ->> 'kg')::numeric),
                'total_cost', round(ceil(qty * (pr ->> 'kg')::numeric) * (rm ->> 'r')::numeric, 2), 'created_at', pg_temp.ts(fg_date, 1100)));
      perform pg_temp.d_ins('product_costing', c, jsonb_build_object('project_name', wono, 'party_name', cu ->> 'n', 'part_name', pr ->> 'n',
                'category', 'Machining', 'quantity', done_qty, 'total_cost', cost, 'created_at', pg_temp.ts(fg_date, 1100)));
      if ht > 0 then
        perform pg_temp.d_ins('product_costing', c, jsonb_build_object('project_name', wono, 'party_name', cu ->> 'n', 'part_name', pr ->> 'n',
                  'category', 'Heat Treatment', 'quantity', done_qty, 'total_cost', ht, 'created_at', pg_temp.ts(fg_date, 1100)));
      end if;

      -- finished goods
      perform pg_temp.d_upd('cnc_work_orders', id_wo, jsonb_build_object('status', 'Completed', 'completed', done_qty, 'rejected', rej_total));
      perform pg_temp.move(c, fg_date, 'PART', pr ->> 'id', pr ->> 'no', 'Nos', 'Production Receipt', 'IN', done_qty, (pr ->> 'cost')::numeric,
                           'production', id_wo, wono, 'Finished from ' || wono, wh);
      perform pg_temp.d_upd('cnc_inwards', id_inw, jsonb_build_object('status', 'Processed'));

      dc_date := pg_temp.workday(fg_date + pg_temp.rnd(1, 2));
      if dc_date > today then continue; end if;
      -- some finished jobs of the last days are still waiting to be dispatched
      if fg_date >= today - 21 and pg_temp.rnd(1, 3) <= 2 then continue; end if;

      -- delivery challan
      dcno := pg_temp.num('cnc_deliveries', 'delivery_no', 'DC' || extract(year from dc_date), 4001, 'DC-' || extract(year from dc_date) || '-', 4);
      id_dc := pg_temp.d_ins('cnc_deliveries', c, jsonb_build_object('delivery_no', dcno, 'customer_name', cu ->> 'n', 'customer_id', cu ->> 'id',
                 'sales_order_id', id_so, 'sales_order_no', sono, 'part_name', pr ->> 'n', 'quantity', done_qty, 'dispatch_qty', done_qty,
                 'delivery_date', dc_date, 'vehicle_no', 'TN 37 ' || (array['BX','CK','DM','AZ'])[pg_temp.rnd(1,4)] || ' ' || pg_temp.rnd(1000, 9999),
                 'status', 'Delivered', 'billing_address', (cu ->> 'n') || ', ' || (cu ->> 'city'), 'customer_gstin', cu ->> 'g',
                 'po_no', 'PO/' || to_char(s_date, 'YY'), 'place_of_supply', case when intra then 'Tamil Nadu (33)' else cu ->> 'city' end,
                 'packaging_details', 'Wooden box, rust-preventive oil', 'enquiry_no', lead, 'phone', cu ->> 'phone', 'process', 'Machining',
                 'hsn', pr ->> 'hsn', 'unit', 'Nos', 'unit_price', price, 'total_amount', done_qty * price, 'receiver_name', cu ->> 'c',
                 'sender_name', 'Suresh Babu', 'created_at', pg_temp.ts(dc_date, pg_temp.rnd(600, 900))));
      perform pg_temp.move(c, dc_date, 'PART', pr ->> 'id', pr ->> 'no', 'Nos', 'Delivery', 'OUT', -done_qty, (pr ->> 'cost')::numeric,
                           'dispatch', id_dc, dcno, 'Delivered to ' || (cu ->> 'n'), wh);
      perform pg_temp.d_upd('cnc_sales_orders', id_so, jsonb_build_object('status', 'Delivered', 'delivered', done_qty));
      perform pg_temp.d_upd('cnc_work_orders', id_wo, jsonb_build_object('status', 'Dispatched'));

      -- some challans of the last week are not billed yet
      if dc_date >= today - 30 and pg_temp.rnd(1, 3) <= 2 then continue; end if;

      -- invoice (same day as the DC)
      taxable := done_qty * price;
      if intra then cgst := round(taxable * 0.09, 2); sgst := cgst; igst := 0; else cgst := 0; sgst := 0; igst := round(taxable * 0.18, 2); end if;
      total := round(taxable + cgst + sgst + igst);
      invno := public.erp_next_number(c, 'public.cnc_invoices'::regclass, 'invoice_no',
                 coalesce((select invoice_prefix from public.companies where id = c), 'INV'));
      id_inv := pg_temp.d_ins('cnc_invoices', c, jsonb_build_object('invoice_no', invno, 'invoice_type', 'Sales Invoice', 'invoice_date', dc_date,
                  'due_date', dc_date + 30, 'customer_name', cu ->> 'n', 'customer_id', cu ->> 'id', 'customer_gstin', cu ->> 'g',
                  'billing_address', (cu ->> 'n') || ', ' || (cu ->> 'city'), 'place_of_supply', case when intra then 'Tamil Nadu (33)' else cu ->> 'city' end,
                  'po_no', 'PO/' || to_char(s_date, 'YY'), 'dc_no', dcno, 'sales_order_id', id_so, 'delivery_id', id_dc, 'quotation_id', id_q,
                  'part_name', pr ->> 'n', 'quantity', done_qty, 'basic_value', taxable, 'discount_amount', 0, 'taxable_value', taxable,
                  'cgst', cgst, 'sgst', sgst, 'igst', igst, 'round_off', total - (taxable + cgst + sgst + igst), 'amount', total,
                  'status', 'Sent', 'payment_terms', 'Net 30', 'created_by', 'Priya Sundar', 'created_at', pg_temp.ts(dc_date, pg_temp.rnd(900, 1080))));
      perform pg_temp.d_ins('cnc_invoice_items', c, jsonb_build_object('invoice_id', id_inv, 'line_no', 1, 'description', pr ->> 'n', 'hsn', pr ->> 'hsn',
                'quantity', done_qty, 'unit', 'Nos', 'rate', price, 'discount_pct', 0, 'gst_rate', 18, 'amount', taxable));
      perform pg_temp.d_upd('cnc_deliveries', id_dc, jsonb_build_object('status', 'Billed'));

      -- payment from the customer (most pay in 25-60 days; a few pay in two parts)
      pay_date := pg_temp.workday(dc_date + pg_temp.rnd(25, 60));
      if pay_date <= today then
        if pg_temp.rnd(1, 8) = 1 then
          amt := round(total * 0.6);
          perform pg_temp.bank(c, pay_date, 'IN', 'Receipt', a_bank, null, 'Customer', cu ->> 'n', cu ->> 'id', null, id_inv, amt,
                    pay_modes[pg_temp.rnd(1, 5)], invno, 'NEFT received from ' || (cu ->> 'n') || ' - part payment ' || invno, 'manual_entry');
          pay_date := pg_temp.workday(pay_date + pg_temp.rnd(15, 30));
          if pay_date <= today then
            perform pg_temp.bank(c, pay_date, 'IN', 'Receipt', a_bank, null, 'Customer', cu ->> 'n', cu ->> 'id', null, id_inv, total - amt,
                      'NEFT', invno, 'NEFT received from ' || (cu ->> 'n') || ' - balance ' || invno, 'manual_entry');
            perform pg_temp.d_upd('cnc_invoices', id_inv, jsonb_build_object('pipeline_completed_at', pg_temp.ts(pay_date, 1000)));
          end if;
        else
          perform pg_temp.bank(c, pay_date, 'IN', 'Receipt', a_bank, null, 'Customer', cu ->> 'n', cu ->> 'id', null, id_inv, total,
                    pay_modes[pg_temp.rnd(1, 5)], invno, (array['NEFT','RTGS'])[pg_temp.rnd(1,2)] || ' received from ' || (cu ->> 'n') || ' against ' || invno, 'manual_entry');
          perform pg_temp.d_upd('cnc_invoices', id_inv, jsonb_build_object('pipeline_completed_at', pg_temp.ts(pay_date, 1000)));
        end if;
      end if;
    end loop;

    -- enquiries that did not turn into business
    for k in 1..pg_temp.rnd(1, 2) loop
      e_date := m + pg_temp.rnd(0, 27);
      continue when e_date > today;
      cu := cust -> pg_temp.rnd(0, jsonb_array_length(cust) - 1);
      pr := prod -> pg_temp.rnd(0, jsonb_array_length(prod) - 1);
      lead := pg_temp.num('cnc_enquiries', 'lead_no', 'LEAD', 1001, '', 0);
      qty := (round(pg_temp.rnd((pr -> 'q' ->> 0)::int, (pr -> 'q' ->> 1)::int) / 10.0) * 10)::int;
      perform pg_temp.d_ins('cnc_enquiries', c, jsonb_build_object('lead_no', lead, 'enquiry_no', lead, 'customer', cu ->> 'n',
                'contact_person', cu ->> 'c', 'phone', cu ->> 'phone', 'email', cu ->> 'email', 'city', cu ->> 'city', 'gst', cu ->> 'g',
                'part_name', pr ->> 'n', 'part_no', 'N/A', 'quantity', qty, 'estimated_value', qty * (pr ->> 'p')::numeric, 'source',
                (array['Direct','Phone','Website','Referral'])[pg_temp.rnd(1,4)],
                'status', case when e_date + 20 <= today then 'Lost' else (array['New','Contacted','Under Review'])[pg_temp.rnd(1,3)] end,
                'pipeline_stage', 'Enquiry', 'expected_date', e_date + 30, 'received_date', e_date,
                'remarks', case when e_date + 20 <= today then lost_why[pg_temp.rnd(1, 4)] else 'Awaiting drawing' end,
                'enquiring_for', jsonb_build_array(jsonb_build_object('productName', pr ->> 'n', 'partName', pr ->> 'n', 'quantity', qty::text,
                                   'remarks', '', 'filePaths', '[]'::jsonb))::text,
                'created_at', pg_temp.ts(e_date, pg_temp.rnd(570, 1050))));
    end loop;

    -- ---------- consumables and tools ----------
    d := pg_temp.workday(m + 3);
    if d <= today then
      for x in select * from jsonb_array_elements(raw) where value ->> 'cat' in ('TOOL', 'CONSUMABLE') loop
        y := supp -> ((x ->> 's')::int - 1);
        buy_qty := case x ->> 'cat' when 'TOOL' then pg_temp.rnd(3, 5) * 10 else pg_temp.rnd(4, 6) * 20 end;
        amt := round(buy_qty * (x ->> 'r')::numeric, 2);
        v := pg_temp.d_ins('cnc_inwards', c, jsonb_build_object('inward_no', pg_temp.num('cnc_inwards', 'inward_no', 'INW' || extract(year from d), 3001, 'INW-' || extract(year from d) || '-', 4),
               'category', 'GOODS PURCHASE', 'inward_date', d, 'party_name', y ->> 'n', 'part_name', x ->> 'n', 'product_name', x ->> 'n',
               'part_number', x ->> 'code', 'quantity', buy_qty, 'price', (x ->> 'r')::numeric, 'discount_percent', 0, 'gst_percent', 18,
               'total_amount', round(amt * 1.18, 2), 'reference_no', 'Bill ' || pg_temp.rnd(2000, 9999), 'status', 'Received',
               'remarks', 'Monthly stock', 'created_at', pg_temp.ts(d, 700)));
        perform pg_temp.move(c, d, 'RAW', x ->> 'id', x ->> 'code', x ->> 'u', 'Purchase Inward', 'IN', buy_qty, (x ->> 'r')::numeric,
                             'grn', v, 'Bill from ' || (y ->> 'n'), 'Monthly purchase', wh);
        perform pg_temp.jv(c, d, 'Purchase', 'Purchase of ' || (x ->> 'n') || ' from ' || (y ->> 'n'), 'Monthly purchase', jsonb_build_array(
          jsonb_build_object('key', 'INV_RAW', 'debit', amt), jsonb_build_object('key', 'GST_INPUT', 'debit', round(amt * 0.18, 2)),
          jsonb_build_object('key', 'TRADE_PAYABLES', 'credit', round(amt * 1.18, 2), 'party', y ->> 'n')));
        perform pg_temp.bank(c, pg_temp.workday(d + 30), 'OUT', 'Payment', a_bank, null, 'Supplier', y ->> 'n', null, y ->> 'id', null,
                  round(amt * 1.18, 2), 'NEFT', 'Monthly', 'NEFT paid to ' || (y ->> 'n'), 'manual_entry');
        -- used through the month (issued to the shop floor in two lots)
        for i in 1..2 loop
          d2 := pg_temp.workday(m + 8 + (i - 1) * 12);
          perform pg_temp.move(c, d2, 'RAW', x ->> 'id', x ->> 'code', x ->> 'u', 'Production Issue', 'OUT', -round(buy_qty * pg_temp.rndn(0.38, 0.47)),
                               (x ->> 'r')::numeric, 'issue', null, 'ISS-' || to_char(d2, 'YYMMDD'), 'Issued to shop floor', wh);
        end loop;
      end loop;
    end if;

    -- ---------- fixed monthly costs (bank) ----------
    sal := round(420000 * power(1.004, (extract(year from age(m, first_month)) * 12 + extract(month from age(m, first_month)))::numeric), -2);
    perform pg_temp.bank(c, pg_temp.workday(m + 4), 'OUT', 'Payment', a_bank, a_other, 'Other', 'SIDCO Estate Office', null, null, null, 85000,
              'RTGS', 'RENT-' || to_char(m, 'MON-YY'), 'RTGS - Factory shed rent for ' || to_char(m, 'Mon YYYY'), 'manual_entry');
    perform pg_temp.bank(c, pg_temp.workday(m + 7), 'OUT', 'Payment', a_bank, a_power, 'Other', 'Electricity Board', null, null, null,
              round(pg_temp.rndn(98000, 138000), -1), 'NEFT', 'HT-' || to_char(m, 'MON-YY'), 'NEFT - HT electricity bill ' || to_char(m, 'Mon YYYY'), 'manual_entry');
    intr := round(loan_bal * 0.105 / 12);
    perform pg_temp.bank(c, m + 9, 'OUT', 'Payment', a_bank, a_loan, 'Other', 'SBI Term Loan', null, null, null, 48000,
              'NEFT', 'EMI-' || to_char(m, 'MON-YY'), 'NEFT auto-debit - term loan EMI principal', 'manual_entry');
    perform pg_temp.bank(c, m + 9, 'OUT', 'Payment', a_bank, a_other, 'Other', 'SBI Term Loan', null, null, null, intr,
              'NEFT', 'EMI-' || to_char(m, 'MON-YY'), 'NEFT auto-debit - term loan interest', 'manual_entry');
    if m + 9 <= today then loan_bal := loan_bal - 48000; end if;
    perform pg_temp.bank(c, pg_temp.workday(m + 14), 'OUT', 'Payment', a_bank, a_rep, 'Other', 'Machine service vendor', null, null, null,
              round(pg_temp.rndn(12000, 46000), -2), 'UPI', 'AMC-' || to_char(m, 'MON-YY'), 'UPI - machine AMC / service visit', 'manual_entry');
    perform pg_temp.bank(c, mend, 'OUT', 'Payment', a_bank, a_other, 'Other', 'State Bank of India', null, null, null, 590,
              'Bank', 'CHG-' || to_char(m, 'MON-YY'), 'Bank charges incl. GST (NEFT/RTGS)', 'manual_entry');
    perform pg_temp.bank(c, case when extract(isodow from mend) = 7 then mend - 1 else mend end, 'OUT', 'Payment', a_bank, a_sal, 'Other',
              'Staff salaries', null, null, null, sal, 'NEFT', 'SAL-' || to_char(m, 'MON-YY'),
              'NEFT - salaries for ' || to_char(m, 'Mon YYYY') || ' (42 staff)', 'manual_entry');

    -- ---------- a new machine bought in March 2026 (capital expenditure) ----------
    if m = date '2026-03-01' and date '2026-03-16' <= today then
      perform pg_temp.bank(c, date '2026-03-16', 'OUT', 'Payment', a_bank, a_pm, 'Other', 'Machine tool dealer', null, null, null, 1850000,
                'RTGS', 'CAPEX-2603', 'RTGS - CNC turning centre LT-30 (new machine, incl. installation)', 'manual_entry');
    end if;

    -- ---------- GST of last month: set off input credit, pay the rest ----------
    d := m + 19;
    if m > first_month and d <= today then
      select coalesce(sum(case when l.account_id = a_gst_out then l.credit - l.debit end), 0),
             coalesce(sum(case when l.account_id = a_gst_in then l.debit - l.credit end), 0)
        into out_bal, in_bal
        from public.journal_entry_lines l join public.journal_entries e on e.id = l.journal_entry_id
       where l.company_id = c and e.entry_date < m and l.account_id in (a_gst_out, a_gst_in);
      setoff := least(out_bal, in_bal);
      if setoff > 0 then
        perform pg_temp.jv(c, d, 'Journal', 'GST input credit set off - GSTR-3B ' || to_char(m - 1, 'Mon YYYY'), 'GSTR3B-' || to_char(m - 1, 'MMYY'),
          jsonb_build_array(jsonb_build_object('account_id', a_gst_out, 'debit', setoff), jsonb_build_object('account_id', a_gst_in, 'credit', setoff)));
      end if;
      if out_bal - setoff > 0 then
        perform pg_temp.bank(c, d, 'OUT', 'Payment', a_bank, a_gst_out, 'Other', 'GST Department', null, null, null, out_bal - setoff,
                  'NEFT', 'GSTR3B-' || to_char(m - 1, 'MMYY'), 'NEFT - GST paid for ' || to_char(m - 1, 'Mon YYYY') || ' (GSTR-3B)', 'manual_entry');
      end if;
    end if;

    -- ---------- petty cash ----------
    perform pg_temp.bank(c, pg_temp.workday(m + 1), 'IN', 'Cash Receipt', a_cash, a_bank, null, null, null, null, null, 30000,
              'Petty cash', 'ATM-' || to_char(m, 'MON-YY'), 'Cash withdrawn from bank for petty cash', 'petty_cash');
    for k in 1..pg_temp.rnd(8, 11) loop
      x := petty -> pg_temp.rnd(0, jsonb_array_length(petty) - 1);
      d := pg_temp.workday(m + pg_temp.rnd(2, 27));
      perform pg_temp.bank(c, d, 'OUT', 'Cash Payment', a_cash,
                (select id from public.chart_of_accounts where company_id = c and code = x ->> 'a' and not is_group),
                'Other', petty_men[pg_temp.rnd(1, 4)], null, null, null, round(pg_temp.rndn((x ->> 'lo')::numeric, (x ->> 'hi')::numeric), -1),
                'Petty cash', null, x ->> 't', 'petty_cash');
    end loop;

    -- ---------- depreciation ----------
    if mend <= today then
      perform pg_temp.jv(c, mend, 'Journal', 'Depreciation for ' || to_char(m, 'Mon YYYY') || ' (plant 15%, furniture 10% p.a.)', 'DEP-' || to_char(m, 'MMYY'),
        jsonb_build_array(jsonb_build_object('account_id', a_dep, 'debit', 84170), jsonb_build_object('account_id', a_accdep, 'credit', 84170)));
    end if;

    -- ---------- non-production tasks on the timelines ----------
    d := m;
    while d <= mend loop
      if extract(isodow from d) = 6 then
        machine := (array['LT-20','LT-30','VMC-850','HMC-500','DR-01','CG-01'])[pg_temp.rnd(1, 6)];
        if d <= today or d <= today + 14 then
          perform pg_temp.d_ins('cnc_scheduled_tasks', c, jsonb_build_object('task_name', 'Machine cleaning (5S)', 'member_name', ops_men ->> machine,
                    'machine', machine, 'task_date', d, 'start_time', '16:00', 'end_time', '17:00',
                    'mode', case when d < today then 'actual' else 'planned' end, 'status', case when d < today then 'Completed' else 'Planned' end,
                    'created_at', pg_temp.ts(least(d, today), 540)));
        end if;
        if extract(day from d) <= 7 and (d <= today + 14) then
          perform pg_temp.d_ins('cnc_scheduled_tasks', c, jsonb_build_object('task_name', 'Preventive maintenance', 'member_name', 'Anand Krishnan',
                    'machine', (array['VMC-850','LT-20','CG-01','HMC-500'])[pg_temp.rnd(1, 4)], 'task_date', d, 'start_time', '09:00', 'end_time', '13:00',
                    'mode', case when d < today then 'actual' else 'planned' end, 'status', case when d < today then 'Completed' else 'Planned' end,
                    'created_at', pg_temp.ts(least(d, today), 540)));
          perform pg_temp.d_ins('cnc_scheduled_tasks', c, jsonb_build_object('task_name', (array['Operator training','Gauge calibration','Tool preset & offsets'])[pg_temp.rnd(1, 3)],
                    'member_name', (array['Murugan S','Karthik M','Dinesh B','Vignesh P'])[pg_temp.rnd(1, 4)], 'task_date', d, 'start_time', '14:00', 'end_time', '15:30',
                    'mode', case when d < today then 'actual' else 'planned' end, 'status', case when d < today then 'Completed' else 'Planned' end,
                    'created_at', pg_temp.ts(least(d, today), 540)));
        end if;
      end if;
      d := d + 1;
    end loop;

    m := (m + interval '1 month')::date;
  end loop;

  -- upcoming maintenance shown on the planned timeline
  for i in 1..3 loop
    d := pg_temp.workday(today + i * 4);
    perform pg_temp.d_ins('cnc_scheduled_tasks', c, jsonb_build_object('task_name', (array['Preventive maintenance','Gauge calibration','Machine cleaning (5S)'])[i],
              'member_name', (array['Anand Krishnan','Dinesh B','Prakash K'])[i], 'machine', (array['CG-01','','HMC-500'])[i],
              'task_date', d, 'start_time', '09:30', 'end_time', '11:30', 'mode', 'planned', 'status', 'Planned', 'created_at', now()));
  end loop;

  -- ===================================== STOCK ADJUSTMENTS ======================================
  -- (physical-count corrections; kept as the newest movements so the Stock Adjustment page lists them)
  k := 0;
  for x in select * from jsonb_array_elements('[
      [0,-12,"Physical count: short after stock verification","2025-09-30"],
      [2,-18,"Scrap: plate edges cut-off written off","2025-12-31"],
      [6,-4,"Damaged inserts (chipped during handling)","2026-01-17"],
      [7,-15,"Coolant spillage during sump cleaning","2026-03-14"],
      [1,6,"Physical count: excess found in rack A1","2026-03-31"],
      [4,-2,"Scrap: bronze turnings off-cut","2026-06-30"],
      [5,-5,"Physical count: short after stock verification","2026-09-30"],
      [0,9,"Returned unused bar from shop floor","2026-10-24"],
      [6,-3,"Damaged inserts (chipped during handling)","2026-11-07"]]'::jsonb) loop
    d := (x ->> 3)::date;
    continue when d > today;
    rm := raw -> ((x ->> 0)::int);
    k := k + 1;
    perform pg_temp.move(c, d, 'RAW', rm ->> 'id', rm ->> 'code', rm ->> 'u', 'Adjustment', 'ADJ', (x ->> 1)::numeric, (rm ->> 'r')::numeric,
                         'adjustment', null, 'ADJ-' || lpad(k::text, 4, '0'), x ->> 2, wh, now() - make_interval(mins => 60 - k));
  end loop;

  raise notice 'Demo data loaded for "test": % rows.', (select count(*) from public.demo_seed_log where company_id = c);
end
$seed$;

commit;
