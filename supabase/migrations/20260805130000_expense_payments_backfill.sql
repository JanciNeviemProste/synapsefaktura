-- ─────────────────────────────────────────────────────────────────────────────
--  Synapse Faktúra — úhrady nákladov ako evidencia, nie ako jedno číslo
--
--  `expense_payments` vznikla v migrácii 20260804180000 a zostala prázdna —
--  žiadny kód do nej nikdy nezapísal. Úhrady sa držali len ako
--  `expenses.paid_amount`, teda nerozložiteľné číslo bez dátumu, metódy
--  a väzby na bankový pohyb. Dôsledky:
--
--    · dvojklik na „zaevidovať úhradu" pripočítal sumu dvakrát,
--    · opätovný import toho istého výpisu zaúčtoval platbu znova,
--    · pri kontrole sa nedalo doložiť, kedy a čím bol náklad uhradený.
--
--  Odteraz je `paid_amount` SÚČTOM riadkov v `expense_payments`. Aby ten
--  invariant platil aj pre už zaevidované úhrady, prenesú sa sem ako jeden
--  riadok. Poznámka pri ňom priznáva, že rozpis neexistuje — dopĺňať dátum
--  alebo metódu, ktoré nikdy nikto nezadal, by znamenalo vydávať dohad za fakt.
-- ─────────────────────────────────────────────────────────────────────────────

insert into public.expense_payments (expense_id, amount, paid_at, method, note)
select
  e.id,
  e.paid_amount,
  -- Dátum úhrady nie je známy. Dátum vystavenia doklad aspoň zaradí do
  -- správneho obdobia; `current_date` by zaradil starý náklad do dneška.
  coalesce(e.supply_date, e.issue_date, current_date),
  'bank'::public.payment_method,
  'Prevzaté z pôvodnej evidencie — pôvodná suma bez rozpisu úhrad.'
from public.expenses e
where e.paid_amount > 0
  and not exists (
    select 1 from public.expense_payments p where p.expense_id = e.id
  );

-- Ten istý bankový pohyb sa nesmie zaúčtovať na ten istý náklad dvakrát.
-- Toto je poistka na úrovni databázy: aplikačná kontrola sa dá obísť súbežným
-- behom dvoch importov, unikátny index nie.
create unique index if not exists expense_payments_bank_tx_uidx
  on public.expense_payments (expense_id, bank_transaction_id)
  where bank_transaction_id is not null;

comment on table public.expense_payments is
  'Jednotlivé úhrady nákladu. `expenses.paid_amount` je ich súčet — nie '
  'nezávisle vedené číslo. Vďaka tomu je úhrada dohľadateľná a opakovaný '
  'import bankového výpisu nemôže zaúčtovať tú istú platbu dvakrát.';
