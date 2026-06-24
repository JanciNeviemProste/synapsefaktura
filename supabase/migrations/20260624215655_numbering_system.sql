-- Allow system/service-role callers (cron: recurring invoices) to reserve a
-- document number. Membership is still enforced for end users (auth.uid() set);
-- service-role calls have no auth.uid() and are trusted.
create or replace function public.next_document_number(
  p_org uuid,
  p_doc_type public.document_type,
  p_year int
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_seq    public.number_sequences;
  v_num    int;
  v_result text;
begin
  if (select auth.uid()) is not null and not public.is_org_member(p_org) then
    raise exception 'Not a member of this organization';
  end if;

  insert into public.number_sequences (organization_id, doc_type, year)
  values (p_org, p_doc_type, p_year)
  on conflict (organization_id, doc_type, year) do nothing;

  select * into v_seq
  from public.number_sequences
  where organization_id = p_org and doc_type = p_doc_type and year = p_year
  for update;

  v_num := v_seq.next_number;

  update public.number_sequences
  set next_number = next_number + 1
  where id = v_seq.id;

  v_result := v_seq.format;
  v_result := replace(v_result, '{prefix}', coalesce(v_seq.prefix, ''));
  v_result := replace(v_result, '{year}', p_year::text);
  v_result := replace(v_result, '{seq}', lpad(v_num::text, v_seq.padding, '0'));
  return v_result;
end;
$$;
