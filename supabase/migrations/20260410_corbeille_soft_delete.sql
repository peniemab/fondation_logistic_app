-- Corbeille: suppression logique, restauration et purge auto 30 jours

alter table public.souscripteurs
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by_email text,
  add column if not exists delete_note text;

create index if not exists idx_souscripteurs_deleted_at
  on public.souscripteurs (deleted_at);

create or replace function public.purge_souscripteurs_corbeille(
  p_before timestamptz default (now() - interval '30 days')
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted_count bigint := 0;
begin
  -- Supprime d'abord les paiements des dossiers qui vont etre purges.
  delete from public.paiements p
  using public.souscripteurs s
  where s.deleted_at is not null
    and s.deleted_at < p_before
    and p.num_fiche = s.num_fiche;

  with deleted_rows as (
    delete from public.souscripteurs s
    where s.deleted_at is not null
      and s.deleted_at < p_before
    returning 1
  )
  select count(*) into v_deleted_count
  from deleted_rows;

  return coalesce(v_deleted_count, 0);
end;
$$;