-- Season 3 · 24 national teams for international tournament roster.
-- Idempotent: skips slugs that already exist.
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
    ('France', 'FRA', 'france', '/France.png'::text, 'National squad · Season 3'::text, array[3]::smallint[]),
    ('Spain', 'ESP', 'spain', '/Spain.png', 'National squad · Season 3', array[3]::smallint[]),
    ('England', 'ENG', 'england', '/England.png', 'National squad · Season 3', array[3]::smallint[]),
    ('Germany', 'GER', 'germany', '/Germany.png', 'National squad · Season 3', array[3]::smallint[]),
    ('Belgium', 'BEL', 'belgium', null, 'National squad · Season 3', array[3]::smallint[]),
    ('Croatia', 'CRO', 'croatia', null, 'National squad · Season 3', array[3]::smallint[]),
    ('Netherlands', 'NED', 'netherlands', null, 'National squad · Season 3', array[3]::smallint[]),
    ('Italy', 'ITA', 'italy', null, 'National squad · Season 3', array[3]::smallint[]),
    ('Portugal', 'POR', 'portugal', null, 'National squad · Season 3', array[3]::smallint[]),
    ('Türkiye', 'TUR', 'turkiye', null, 'National squad · Season 3', array[3]::smallint[]),
    ('Brazil', 'BRA', 'brazil', null, 'National squad · Season 3 · Hosts', array[3]::smallint[]),
    ('Argentina', 'ARG', 'argentina', null, 'National squad · Season 3', array[3]::smallint[]),
    ('Colombia', 'COL', 'colombia', null, 'National squad · Season 3', array[3]::smallint[]),
    ('Uruguay', 'URU', 'uruguay', null, 'National squad · Season 3', array[3]::smallint[]),
    ('Ecuador', 'ECU', 'ecuador', null, 'National squad · Season 3', array[3]::smallint[]),
    ('USA', 'USA', 'usa', null, 'National squad · Season 3', array[3]::smallint[]),
    ('Canada', 'CAN', 'canada', null, 'National squad · Season 3', array[3]::smallint[]),
    ('Mexico', 'MEX', 'mexico', null, 'National squad · Season 3', array[3]::smallint[]),
    ('Algeria', 'ALG', 'algeria', null, 'National squad · Season 3', array[3]::smallint[]),
    ('Nigeria', 'NGA', 'nigeria', null, 'National squad · Season 3', array[3]::smallint[]),
    ('Morocco', 'MAR', 'morocco', null, 'National squad · Season 3', array[3]::smallint[]),
    ('South Africa', 'RSA', 'south-africa', null, 'National squad · Season 3', array[3]::smallint[]),
    ('Japan', 'JPN', 'japan', null, 'National squad · Season 3', array[3]::smallint[]),
    ('South Korea', 'KOR', 'south-korea', null, 'National squad · Season 3', array[3]::smallint[])
) as v(name, abbr, slug, logo, form, seasons)
where not exists (
  select 1 from public.teams t where t.slug = v.slug
);
