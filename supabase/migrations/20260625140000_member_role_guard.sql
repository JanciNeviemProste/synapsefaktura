-- ─────────────────────────────────────────────────────────────────────────────
-- Synapse Faktúra — harden organization_members RLS (privilege-escalation guard)
--
-- The original update/delete policies only checked that the caller is an
-- owner/admin (USING) with no WITH CHECK and no protection of the owner row. A
-- crafted client call could therefore promote a member to `owner`, or demote /
-- remove the real owner. We require, at the database level:
--   * the caller is owner/admin (unchanged), AND
--   * the TARGET row is not an `owner` row (USING role <> 'owner'), AND
--   * the RESULT row is not set to `owner` (WITH CHECK role <> 'owner').
-- The single owner is established only by create_organization_with_owner(); there
-- is no in-app ownership transfer, so blocking owner mutation here is safe.
-- ─────────────────────────────────────────────────────────────────────────────

drop policy if exists "members_update_admin" on public.organization_members;
create policy "members_update_admin" on public.organization_members
  for update
  using (
    public.has_org_role(organization_id, array['owner', 'admin']::public.org_role[])
    and role <> 'owner'
  )
  with check (
    public.has_org_role(organization_id, array['owner', 'admin']::public.org_role[])
    and role <> 'owner'
  );

drop policy if exists "members_delete_admin" on public.organization_members;
create policy "members_delete_admin" on public.organization_members
  for delete
  using (
    public.has_org_role(organization_id, array['owner', 'admin']::public.org_role[])
    and role <> 'owner'
  );
