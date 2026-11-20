-- =====================================================================================
-- Faster customer-portal helpers
--
-- The portal row policies on cnc_work_orders and cnc_deliveries call
-- erp_portal_sales_order_nos() / erp_portal_sales_order_ids(). Each helper called the
-- next one inside its WHERE clause, so it ran again for EVERY row scanned:
--   sales orders x (quotations x (enquiries x profiles))
-- With ~100 orders, quotations and enquiries that is millions of calls (15-30 s), the
-- request hits the 8 s API timeout and the app gets an error instead of the rows
-- (Kanban: Finished Goods / Delivery Challan empty, every Inward "Finished 0").
--
-- Wrapping the inner call in (select ...) makes Postgres run it once per query.
-- Same results, same security; only the speed changes. Safe to run more than once.
-- =====================================================================================
begin;

create or replace function public.erp_portal_profile_ids()
returns text[]
language sql stable security definer set search_path = ''
as $$
  select coalesce(array_agg(id::text), '{}') from public.portal_profiles where auth_user_id = (select auth.uid())
$$;

create or replace function public.erp_portal_enquiry_ids()
returns text[]
language sql stable security definer set search_path = ''
as $$
  select coalesce(array_agg(e.id::text), '{}')
  from public.cnc_enquiries e
  where (select auth.uid()) is not null
    and e.portal_profile_id::text = any ((select public.erp_portal_profile_ids())::text[])
$$;

create or replace function public.erp_portal_quotation_ids()
returns text[]
language sql stable security definer set search_path = ''
as $$
  select coalesce(array_agg(q.id::text), '{}')
  from public.cnc_quotations q
  where q.lead_id::text = any ((select public.erp_portal_enquiry_ids())::text[])
$$;

create or replace function public.erp_portal_sales_order_ids()
returns text[]
language sql stable security definer set search_path = ''
as $$
  select coalesce(array_agg(o.id::text), '{}')
  from public.cnc_sales_orders o
  where o.quotation_id::text = any ((select public.erp_portal_quotation_ids())::text[])
$$;

create or replace function public.erp_portal_sales_order_nos()
returns text[]
language sql stable security definer set search_path = ''
as $$
  select coalesce(array_agg(o.order_no::text), '{}')
  from public.cnc_sales_orders o
  where o.quotation_id::text = any ((select public.erp_portal_quotation_ids())::text[])
$$;

commit;
