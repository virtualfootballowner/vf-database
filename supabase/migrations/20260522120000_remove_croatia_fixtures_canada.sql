-- Remove Croatia from the international catalog; fixture slots that named
-- "Croatia" become Canada. Repoint match/event FKs if a croatia team row exists.

update public.fixtures
set home_team_name = 'Canada',
    updated_at = now()
where btrim(home_team_name) = 'Croatia';

update public.fixtures
set away_team_name = 'Canada',
    updated_at = now()
where btrim(away_team_name) = 'Croatia';

do $$
declare
  croatia_id uuid;
  canada_id uuid;
begin
  select id into croatia_id from public.teams where slug = 'croatia' limit 1;
  select id into canada_id from public.teams where slug = 'canada' limit 1;
  if croatia_id is not null and canada_id is not null then
    update public.matches
    set home_team_id = canada_id,
        updated_at = now()
    where home_team_id = croatia_id;
    update public.matches
    set away_team_id = canada_id,
        updated_at = now()
    where away_team_id = croatia_id;
    update public.match_events
    set team_id = canada_id
    where team_id = croatia_id;
  end if;
end $$;

delete from public.contract_offers where team_slug = 'croatia';
delete from public.roster_release_requests where team_slug = 'croatia';

delete from public.player_team_seasons where team_slug = 'croatia';
delete from public.team_season_managers where team_slug = 'croatia';
delete from public.team_season_records where team_slug = 'croatia';
delete from public.team_season_honors where team_slug = 'croatia';
delete from public.assets where scope = 'team' and ref_slug = 'croatia';

delete from public.teams where slug = 'croatia';
