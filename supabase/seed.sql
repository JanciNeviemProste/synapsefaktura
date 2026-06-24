-- ─────────────────────────────────────────────────────────────────────────────
-- Seed: VAT rates (§5.1). Effective-from/to so historical documents keep their
-- original rate. Active 23/19/5/0 from 1.1.2025; legacy 20/10 selectable for
-- documents dated before 1.1.2025.
-- TODO: verify exact valid_from dates for 5% categories against official
-- Finančná správa / § 27 zákona č. 222/2004 Z. z. before production.
-- ─────────────────────────────────────────────────────────────────────────────
insert into public.vat_rates (code, percent, valid_from, valid_to, category_note) values
  ('standard_23',        23.00, '2025-01-01', null,        'Základná sadzba (od 1.1.2025).'),
  ('reduced_19',         19.00, '2025-01-01', null,        'Znížená sadzba – príloha 7/7a (od 1.1.2025).'),
  ('reduced_5',           5.00, '2020-01-01', null,        'Znížená sadzba – základné potraviny, knihy, lieky, ubytovanie a i.'),
  ('zero',                0.00, '2004-05-01', null,        'Oslobodené / 0 % – export, intra-EU B2B (reverse charge), oslobodené plnenia.'),
  ('legacy_standard_20', 20.00, '2011-01-01', '2024-12-31', 'Historická základná sadzba (do 31.12.2024).'),
  ('legacy_reduced_10',  10.00, '2011-01-01', '2024-12-31', 'Historická znížená sadzba (do 31.12.2024).')
on conflict (code) do update set
  percent       = excluded.percent,
  valid_from    = excluded.valid_from,
  valid_to      = excluded.valid_to,
  category_note = excluded.category_note;
