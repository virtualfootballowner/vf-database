-- Ensure all 24 Season 3 World Cup nations exist (import script only seeds teams from played matches).
insert into public.teams (name, abbreviation, slug, logo_url, form_label, seasons)
select v.name, v.abbreviation, v.slug, v.logo_url, v.form_label, v.seasons
from (
  values
    ('France', 'FRA', 'france', '/France.png', 'National squad · Season 3', array[3]::smallint[]),
    ('Spain', 'ESP', 'spain', '/Spain.png', 'National squad · Season 3', array[3]::smallint[]),
    ('England', 'ENG', 'england', '/England.png', 'National squad · Season 3', array[3]::smallint[]),
    ('Germany', 'GER', 'germany', '/Germany.png', 'National squad · Season 3', array[3]::smallint[]),
    ('Belgium', 'BEL', 'belgium', '/belgium.png', 'National squad · Season 3', array[3]::smallint[]),
    ('Netherlands', 'NED', 'netherlands', '/netherlands.png', 'National squad · Season 3', array[3]::smallint[]),
    ('Italy', 'ITA', 'italy', '/italy.png', 'National squad · Season 3', array[3]::smallint[]),
    ('Portugal', 'POR', 'portugal', '/Portugal.png', 'National squad · Season 3', array[3]::smallint[]),
    ('Brazil', 'BRA', 'brazil', '/brazil.png', 'National squad · Season 3 · Hosts', array[3]::smallint[]),
    ('Argentina', 'ARG', 'argentina', '/Argentina.png', 'National squad · Season 3', array[3]::smallint[]),
    ('Canada', 'CAN', 'canada', '/Canada.png', 'National squad · Season 3', array[3]::smallint[]),
    ('Russia', 'RUS', 'russia', '/Flag_of_Russia.svg.png', 'National squad · Season 3', array[3]::smallint[]),
    ('Mexico', 'MEX', 'mexico', '/Mexico.png', 'National squad · Season 3', array[3]::smallint[]),
    ('Nigeria', 'NGA', 'nigeria', '/Nigeria.png', 'National squad · Season 3', array[3]::smallint[]),
    ('Morocco', 'MAR', 'morocco', '/Morocco.png', 'National squad · Season 3', array[3]::smallint[]),
    ('Japan', 'JPN', 'japan', '/japan.png', 'National squad · Season 3', array[3]::smallint[]),
    ('Albania', 'ALB', 'albania', '/Flag_of_Albania.svg.png', 'National squad · Season 3', array[3]::smallint[]),
    ('Greece', 'GRE', 'greece', '/Flag_of_Greece.svg.webp', 'National squad · Season 3', array[3]::smallint[]),
    ('USA', 'USA', 'usa', '/USA%20FLAG.webp', 'National squad · Season 3', array[3]::smallint[]),
    ('Norway', 'NOR', 'norway', '/Flag_of_Norway.svg.webp', 'National squad · Season 3', array[3]::smallint[]),
    ('Switzerland', 'SUI', 'switzerland', '/swiss%20flag.png', 'National squad · Season 3', array[3]::smallint[]),
    ('Ukraine', 'UKR', 'ukraine', '/Flag_of_Ukraine.svg.webp', 'National squad · Season 3', array[3]::smallint[]),
    ('North Korea', 'PRK', 'north-korea', '/Flag_of_North_Korea.svg.png', 'National squad · Season 3', array[3]::smallint[]),
    ('Somalia', 'SOM', 'somalia', '/Flag_of_Somalia.svg.png', 'National squad · Season 3', array[3]::smallint[])
) as v(name, abbreviation, slug, logo_url, form_label, seasons)
where not exists (
  select 1 from public.teams t where t.slug = v.slug
);
