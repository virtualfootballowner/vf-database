-- Season 3 · add Albania, Greece, USA, Norway, Switzerland, Ukraine, North Korea, Somalia.

insert into public.teams (name, abbreviation, slug, logo_url, form_label, seasons)
select
  v.name,
  v.abbr,
  v.slug,
  v.logo,
  v.form,
  v.seasons
from (
  values
    ('Albania', 'ALB', 'albania', '/Flag_of_Albania.svg.png'::text, 'National squad · Season 3'::text, array[3]::smallint[]),
    ('Greece', 'GRE', 'greece', '/Flag_of_Greece.svg.webp', 'National squad · Season 3', array[3]::smallint[]),
    ('USA', 'USA', 'usa', '/USA%20FLAG.webp', 'National squad · Season 3', array[3]::smallint[]),
    ('Norway', 'NOR', 'norway', '/Flag_of_Norway.svg.webp', 'National squad · Season 3', array[3]::smallint[]),
    ('Switzerland', 'SUI', 'switzerland', '/swiss%20flag.png', 'National squad · Season 3', array[3]::smallint[]),
    ('Ukraine', 'UKR', 'ukraine', '/Flag_of_Ukraine.svg.webp', 'National squad · Season 3', array[3]::smallint[]),
    ('North Korea', 'PRK', 'north-korea', '/Flag_of_North_Korea.svg.png', 'National squad · Season 3', array[3]::smallint[]),
    ('Somalia', 'SOM', 'somalia', '/Flag_of_Somalia.svg.png', 'National squad · Season 3', array[3]::smallint[])
) as v(name, abbr, slug, logo, form, seasons)
where not exists (
  select 1 from public.teams t where t.slug = v.slug
);

insert into public.team_season_managers (team_slug, season, manager_display_name)
select v.slug, 3, null
from (
  values
    ('albania'),
    ('greece'),
    ('usa'),
    ('norway'),
    ('switzerland'),
    ('ukraine'),
    ('north-korea'),
    ('somalia')
) as v(slug)
where exists (select 1 from public.teams t where t.slug = v.slug)
on conflict (team_slug, season) do nothing;
