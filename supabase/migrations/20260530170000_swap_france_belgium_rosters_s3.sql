-- S3: swap France ↔ Belgium player rosters (and team_slug on related rows).
-- Managers (team_season_managers) are unchanged.

-- player_team_seasons
update public.player_team_seasons
set team_slug = '__swap_was_france__'
where team_slug = 'france' and season = 3;

update public.player_team_seasons
set team_slug = 'france'
where team_slug = 'belgium' and season = 3;

update public.player_team_seasons
set team_slug = 'belgium'
where team_slug = '__swap_was_france__' and season = 3;

-- contract_offers
update public.contract_offers
set team_slug = '__swap_was_france__'
where team_slug = 'france' and season = 3;

update public.contract_offers
set team_slug = 'france'
where team_slug = 'belgium' and season = 3;

update public.contract_offers
set team_slug = 'belgium'
where team_slug = '__swap_was_france__' and season = 3;

-- roster_release_requests
update public.roster_release_requests
set team_slug = '__swap_was_france__'
where team_slug = 'france' and season = 3;

update public.roster_release_requests
set team_slug = 'france'
where team_slug = 'belgium' and season = 3;

update public.roster_release_requests
set team_slug = 'belgium'
where team_slug = '__swap_was_france__' and season = 3;
