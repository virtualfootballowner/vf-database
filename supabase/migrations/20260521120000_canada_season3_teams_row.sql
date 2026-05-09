-- Ensure Canada remains in the Season 3 national pool if `seasons` was stripped in DB.
update public.teams
set seasons = (
  select array_agg(distinct e order by e)
  from unnest(coalesce(seasons, '{}'::smallint[]) || array[3]::smallint[]) as e
)
where slug = 'canada'
  and (seasons is null or not (3 = any (seasons)));

insert into public.teams (name, abbreviation, slug, logo_url, form_label, seasons)
select 'Canada', 'CAN', 'canada', '/Canada.png', 'National squad · Season 3', array[3]::smallint[]
where not exists (select 1 from public.teams t where t.slug = 'canada');

insert into public.team_season_managers (team_slug, season, manager_display_name)
values ('canada', 3, null)
on conflict (team_slug, season) do nothing;
