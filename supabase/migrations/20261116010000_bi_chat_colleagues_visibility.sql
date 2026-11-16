-- ======================================================================================
-- BI Chat: Allow colleagues in the same company to discover each other
-- ======================================================================================
-- Non-admin company members need visibility of other active employees within their
-- company so they can initiate chats, view profile cards, and schedule meetings.
-- Company isolation is strictly preserved: users only see colleagues in their company
-- or global Super Admins.

begin;

-- Enable company users to view active colleagues belonging to the same company
drop policy if exists "company_users_colleagues_read" on public.company_users;

create policy "company_users_colleagues_read"
  on public.company_users
  for select
  to authenticated
  using (
    -- User can always view their own record
    id = auth.uid()
    -- Or user belongs to an authorized company and target is an active colleague or Super Admin
    or (
      company_id is not null
      and company_id in (select unnest(public.erp_visible_company_ids()))
      and (status = 'Active' or status is null)
    )
    -- Or target is a Super Admin
    or role = 'SUPER_ADMIN'
  );

commit;
