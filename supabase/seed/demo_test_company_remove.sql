-- =====================================================================================================
-- REMOVE the demo data of the company "test"
--
-- Deletes exactly the rows that demo_test_company.sql added (they are listed in public.demo_seed_log),
-- together with the ledger postings and stock movements those rows created. Anything you entered
-- yourself in "test" stays. Company details that the demo filled in (only blank ones) are cleared again.
--
-- How to run: Supabase → SQL Editor → paste this whole file → Run.
-- =====================================================================================================

begin;
set local statement_timeout = 0;

do $remove$
declare
  c uuid;
  r record;
  n int := 0;
begin
  select id into c from public.companies where lower(btrim(company_name)) = 'test';
  if c is null then raise exception 'There is no company named "test".'; end if;
  if to_regclass('public.demo_seed_log') is null or not exists (select 1 from public.demo_seed_log where company_id = c) then
    raise notice 'No demo data is loaded for "test"; nothing to remove.';
    return;
  end if;

  create temp table d_ids on commit drop as
    select distinct row_id from public.demo_seed_log where company_id = c and tbl not like 'companies.%';

  -- 1. stock movements the demo rows caused (incl. ones written by triggers), then the demo rows
  --    themselves, newest first (children before parents)
  delete from public.cnc_stock_movements
   where company_id = c and (id::text in (select row_id from d_ids) or reference_id in (select row_id from d_ids)
                             or item_id in (select row_id from d_ids));

  for r in select tbl, row_id from public.demo_seed_log
            where company_id = c and tbl not like 'companies.%' and tbl not in ('journal_entries', 'cnc_stock_movements')
            order by id desc loop
    if to_regclass('public.' || r.tbl) is not null then
      execute format('delete from public.%I where id::text = $1', r.tbl) using r.row_id;
      n := n + 1;
    end if;
  end loop;

  -- 2. ledger postings: the demo's own vouchers and everything posted from a demo row
  delete from public.journal_entries
   where company_id = c and (id::text in (select row_id from d_ids) or source_id in (select row_id from d_ids));

  -- 3. company details the demo filled in
  for r in select distinct substring(tbl from 11) col from public.demo_seed_log where company_id = c and tbl like 'companies.%' loop
    execute format('update public.companies set %I = null where id = $1', r.col) using c;
  end loop;

  delete from public.demo_seed_log where company_id = c;
  raise notice 'Demo data removed from "test" (% rows).', n;
end
$remove$;

commit;
