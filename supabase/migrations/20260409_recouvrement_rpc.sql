-- RPC metier recouvrement: filtrage retard calcule en base pour pagination serveur

create or replace function public.get_recouvrement_rows(
  p_page integer default 1,
  p_page_size integer default 100,
  p_term text default null,
  p_site text default 'TOUS',
  p_categorie text default 'TOUS',
  p_dimension text default 'TOUS',
  p_date_debut date default null,
  p_date_fin date default null,
  p_retard integer default null
)
returns table (
  id uuid,
  num_fiche text,
  noms text,
  categorie text,
  site text,
  telephone text,
  telephone_2 text,
  dimension text,
  date_souscription date,
  num_parcelle text,
  num_cadastral text,
  num_acte_vente text,
  email text,
  quotite_mensuelle numeric,
  acompte_initial numeric,
  retard_mois integer
)
language sql
stable
set search_path = public
as $$
with paiements_agg as (
  select
    p.num_fiche as num_fiche_key,
    coalesce(sum(p.montant), 0)::numeric as total_paiements
  from paiements p
  group by p.num_fiche
),
base as (
  select
    s.id,
    s.num_fiche as num_fiche_int,
    s.num_fiche::text as num_fiche,
    s.noms::text as noms,
    s.categorie::text as categorie,
    s.site::text as site,
    s.telephone::text as telephone,
    coalesce(s.telephone_2::text, '') as telephone_2,
    s.dimension::text as dimension,
    s.date_souscription::date as date_souscription,
    coalesce(s.num_parcelle::text, '') as num_parcelle,
    coalesce(s.num_cadastral::text, '') as num_cadastral,
    coalesce(s.num_acte_vente::text, '') as num_acte_vente,
    coalesce(s.email::text, '') as email,
    coalesce(s.quotite_mensuelle, 0)::numeric as quotite_mensuelle,
    coalesce(s.acompte_initial, 0)::numeric as acompte_initial,
    coalesce(pa.total_paiements, 0)::numeric as total_paiements,
    greatest(
      0,
      (
        (extract(year from current_date) - extract(year from s.date_souscription)) * 12
        + (extract(month from current_date) - extract(month from s.date_souscription))
        - case
            when extract(day from current_date) < extract(day from s.date_souscription) then 1
            else 0
          end
      )::int
    ) as mois_ecoules
  from souscripteurs s
  left join paiements_agg pa on pa.num_fiche_key = s.num_fiche
),
metier as (
  select
    b.*,
    case
      when b.quotite_mensuelle > 0 then floor(greatest(0, (b.total_paiements + b.acompte_initial) - b.acompte_initial) / b.quotite_mensuelle)::int
      else 0
    end as nb_mois_couverts
  from base b
),
final_data as (
  select
    m.id,
    m.num_fiche_int,
    m.num_fiche,
    m.noms,
    m.categorie,
    m.site,
    m.telephone,
    m.telephone_2,
    m.dimension,
    m.date_souscription,
    m.num_parcelle,
    m.num_cadastral,
    m.num_acte_vente,
    m.email,
    m.quotite_mensuelle,
    m.acompte_initial,
    greatest(0, m.mois_ecoules - m.nb_mois_couverts) as retard_mois
  from metier m
),
filtered as (
  select f.*
  from final_data f
  cross join (
    select
      trim(coalesce(p_term, '')) as term,
      trim(coalesce(p_term, '')) ~ '^[0-9]+$' as is_num
  ) q
  where
    (p_site = 'TOUS' or f.site = p_site)
    and (p_categorie = 'TOUS' or f.categorie = p_categorie)
    and (p_dimension = 'TOUS' or f.dimension = p_dimension)
    and (p_date_debut is null or f.date_souscription >= p_date_debut)
    and (p_date_fin is null or f.date_souscription <= p_date_fin)
    and (
      q.term = ''
      or f.noms ilike '%' || q.term || '%'
      or f.telephone ilike '%' || q.term || '%'
      or f.telephone_2 ilike '%' || q.term || '%'
      or f.email ilike '%' || q.term || '%'
      or (
        q.is_num
        and (
          f.num_fiche_int = q.term::integer
          or f.num_parcelle = q.term
          or f.num_cadastral = q.term
          or f.num_acte_vente = q.term
        )
      )
    )
    and (
      p_retard is null
      or (p_retard = 3 and f.retard_mois >= 3)
      or (p_retard in (1, 2) and f.retard_mois = p_retard)
    )
)
select
  id,
  num_fiche,
  noms,
  categorie,
  site,
  telephone,
  telephone_2,
  dimension,
  date_souscription,
  num_parcelle,
  num_cadastral,
  num_acte_vente,
  email,
  quotite_mensuelle,
  acompte_initial,
  retard_mois
from filtered
order by num_fiche asc
offset (greatest(p_page, 1) - 1) * greatest(p_page_size, 1)
limit greatest(p_page_size, 1);
$$;

create or replace function public.get_recouvrement_count(
  p_term text default null,
  p_site text default 'TOUS',
  p_categorie text default 'TOUS',
  p_dimension text default 'TOUS',
  p_date_debut date default null,
  p_date_fin date default null,
  p_retard integer default null
)
returns bigint
language sql
stable
set search_path = public
as $$
with paiements_agg as (
  select
    p.num_fiche as num_fiche_key,
    coalesce(sum(p.montant), 0)::numeric as total_paiements
  from paiements p
  group by p.num_fiche
),
base as (
  select
    s.id,
    s.num_fiche as num_fiche_int,
    s.num_fiche::text as num_fiche,
    s.noms::text as noms,
    s.categorie::text as categorie,
    s.site::text as site,
    s.telephone::text as telephone,
    coalesce(s.telephone_2::text, '') as telephone_2,
    s.dimension::text as dimension,
    s.date_souscription::date as date_souscription,
    coalesce(s.num_parcelle::text, '') as num_parcelle,
    coalesce(s.num_cadastral::text, '') as num_cadastral,
    coalesce(s.num_acte_vente::text, '') as num_acte_vente,
    coalesce(s.email::text, '') as email,
    coalesce(s.quotite_mensuelle, 0)::numeric as quotite_mensuelle,
    coalesce(s.acompte_initial, 0)::numeric as acompte_initial,
    coalesce(pa.total_paiements, 0)::numeric as total_paiements,
    greatest(
      0,
      (
        (extract(year from current_date) - extract(year from s.date_souscription)) * 12
        + (extract(month from current_date) - extract(month from s.date_souscription))
        - case
            when extract(day from current_date) < extract(day from s.date_souscription) then 1
            else 0
          end
      )::int
    ) as mois_ecoules
  from souscripteurs s
  left join paiements_agg pa on pa.num_fiche_key = s.num_fiche
),
metier as (
  select
    b.*,
    case
      when b.quotite_mensuelle > 0 then floor(greatest(0, (b.total_paiements + b.acompte_initial) - b.acompte_initial) / b.quotite_mensuelle)::int
      else 0
    end as nb_mois_couverts
  from base b
),
final_data as (
  select
    m.*,
    greatest(0, m.mois_ecoules - m.nb_mois_couverts) as retard_mois
  from metier m
),
filtered as (
  select f.*
  from final_data f
  cross join (
    select
      trim(coalesce(p_term, '')) as term,
      trim(coalesce(p_term, '')) ~ '^[0-9]+$' as is_num
  ) q
  where
    (p_site = 'TOUS' or f.site = p_site)
    and (p_categorie = 'TOUS' or f.categorie = p_categorie)
    and (p_dimension = 'TOUS' or f.dimension = p_dimension)
    and (p_date_debut is null or f.date_souscription >= p_date_debut)
    and (p_date_fin is null or f.date_souscription <= p_date_fin)
    and (
      q.term = ''
      or f.noms ilike '%' || q.term || '%'
      or f.telephone ilike '%' || q.term || '%'
      or f.telephone_2 ilike '%' || q.term || '%'
      or f.email ilike '%' || q.term || '%'
      or (
        q.is_num
        and (
          f.num_fiche_int = q.term::integer
          or f.num_parcelle = q.term
          or f.num_cadastral = q.term
          or f.num_acte_vente = q.term
        )
      )
    )
    and (
      p_retard is null
      or (p_retard = 3 and f.retard_mois >= 3)
      or (p_retard in (1, 2) and f.retard_mois = p_retard)
    )
)
select count(*)::bigint
from filtered;
$$;
