-- Re-add USA to Season 3 national pool (slug was removed in wc_16_trim_nations).

insert into public.teams (name, abbreviation, slug, logo_url, form_label, seasons)
select 'USA', 'USA', 'usa', '/usa.png'::text, 'National squad · Season 3'::text, array[3]::smallint[]
where not exists (select 1 from public.teams t where t.slug = 'usa');

insert into public.team_season_managers (team_slug, season, manager_display_name)
values ('usa', 3, null)
on conflict (team_slug, season) do nothing;
