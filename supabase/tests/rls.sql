-- ─────────────────────────────────────────────────────────────────────────────
-- RLS tests (pgTAP) — tenant isolation + owner privilege-escalation guard.
--
-- ⚠️ STAV: NAPÍSANÉ, ZATIAĽ NESPUSTENÉ (Docker/lokálny Supabase nebežal pri
--    tvorbe). Pred tvrdením „RLS overené" spusti:  pnpm db:start && pnpm db:test
--    a over zelený výstup. Do tej doby je to PREDPOKLAD, nie dôkaz (§4).
--
-- Prehľad: bezpečnostne kritické policies z migrácií:
--   * documents_all_member  — člen vidí len doklady svojej firmy (is_org_member).
--   * members_update/delete_admin (20260625140000_member_role_guard) — admin
--     nesmie meniť/mazať owner riadok, ani povýšiť kohokoľvek na `owner`.
--
-- RLS beží pod rolou `authenticated` s auth.uid() z request.jwt.claims->>'sub'.
-- Setup robíme ako postgres (obchádza RLS), testy pod prepnutou rolou.
-- ─────────────────────────────────────────────────────────────────────────────

begin;
select plan(5);

-- ── Setup (ako superuser, RLS sa neuplatňuje) ───────────────────────────────
insert into auth.users (id, aud, role, email, instance_id)
values
  ('11111111-1111-1111-1111-111111111111', 'authenticated', 'authenticated',
   'u1@test.sk', '00000000-0000-0000-0000-000000000000'),
  ('22222222-2222-2222-2222-222222222222', 'authenticated', 'authenticated',
   'u2@test.sk', '00000000-0000-0000-0000-000000000000'),
  ('33333333-3333-3333-3333-333333333333', 'authenticated', 'authenticated',
   'u3@test.sk', '00000000-0000-0000-0000-000000000000');

insert into public.organizations (id, name)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Firma A'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Firma B');

-- Org A: u1 = owner, u3 = admin.  Org B: u2 = owner.
insert into public.organization_members (organization_id, user_id, role)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'owner'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-3333-3333-3333-333333333333', 'admin'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', 'owner');

insert into public.documents (id, organization_id, type, status, currency)
values
  ('dddddddd-dddd-dddd-dddd-dddddddddddd',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'invoice', 'issued', 'EUR');

-- ── Helper to impersonate a user ────────────────────────────────────────────
-- Sets the authenticated role and JWT sub so auth.uid() resolves to `uid`.

-- Test 1: owner of Firma A sees the org-A document.
set local role authenticated;
set local request.jwt.claims to
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
select is(
  (select count(*)::int from public.documents
   where id = 'dddddddd-dddd-dddd-dddd-dddddddddddd'),
  1,
  'owner firmy A vidí doklad firmy A'
);
reset role;

-- Test 2: member of Firma B does NOT see Firma A's document (tenant isolation).
set local role authenticated;
set local request.jwt.claims to
  '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
select is(
  (select count(*)::int from public.documents
   where id = 'dddddddd-dddd-dddd-dddd-dddddddddddd'),
  0,
  'člen firmy B NEVIDÍ doklad firmy A (izolácia tenantov)'
);
reset role;

-- Test 3: admin of A cannot modify the OWNER member row (USING role <> 'owner').
set local role authenticated;
set local request.jwt.claims to
  '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';
with upd as (
  update public.organization_members set role = 'member'
  where organization_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
    and user_id = '11111111-1111-1111-1111-111111111111'
  returning 1
)
select is((select count(*)::int from upd), 0,
  'admin nemôže degradovať ownera (0 zmenených riadkov)');

-- Test 4: admin of A cannot promote themselves to owner (WITH CHECK role <> 'owner').
select throws_ok($$
  update public.organization_members set role = 'owner'
  where organization_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
    and user_id = '33333333-3333-3333-3333-333333333333'
$$, '42501', null,
  'admin sa nemôže povýšiť na owner (WITH CHECK blokuje)');

-- Test 5: admin of A cannot delete the owner member row.
with del as (
  delete from public.organization_members
  where organization_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
    and user_id = '11111111-1111-1111-1111-111111111111'
  returning 1
)
select is((select count(*)::int from del), 0,
  'admin nemôže zmazať ownera (0 zmazaných riadkov)');
reset role;

select * from finish();
rollback;
