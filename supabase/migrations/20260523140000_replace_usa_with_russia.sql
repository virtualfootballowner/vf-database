-- Replace USA with Russia in the Season 3 national pool (catalog + FKs).

insert into public.teams (name, abbreviation, slug, logo_url, form_label, seasons)
select 'Russia', 'RUS', 'russia', '/Russia.png'::text, 'National squad · Season 3'::text, array[3]::smallint[]
where not exists (select 1 from public.teams t where t.slug = 'russia');

do $$
declare
  usa_id uuid;
  rus_id uuid;
begin
  select id into usa_id from public.teams where slug = 'usa' limit 1;
  select id into rus_id from public.teams where slug = 'russia' limit 1;

  if usa_id is not null and rus_id is not null then
    update public.matches set home_team_id = rus_id, updated_at = now() where home_team_id = usa_id;
    update public.matches set away_team_id = rus_id, updated_at = now() where away_team_id = usa_id;
    update public.match_events set team_id = rus_id where team_id = usa_id;
  end if;
end $$;

update public.fixtures
set home_team_name = 'Russia', updated_at = now()
where btrim(home_team_name) in ('USA', 'United States');

update public.fixtures
set away_team_name = 'Russia', updated_at = now()
where btrim(away_team_name) in ('USA', 'United States');

update public.contract_offers set team_slug = 'russia' where team_slug = 'usa';
update public.roster_release_requests set team_slug = 'russia' where team_slug = 'usa';
update public.player_team_seasons set team_slug = 'russia' where team_slug = 'usa';
delete from public.team_season_records where team_slug = 'usa';
delete from public.team_season_honors where team_slug = 'usa';

delete from public.team_season_managers where team_slug = 'usa';

insert into public.team_season_managers (team_slug, season, manager_display_name)
values ('russia', 3, null)
on conflict (team_slug, season) do nothing;

delete from public.assets where scope = 'team' and ref_slug = 'usa';

delete from public.teams where slug = 'usa';
