-- Backfill manager_discord_id on team_season_managers from linked VF players.
-- Sync teams.manager_discord_id / manager_roblox_id from each team's latest season manager.

update public.team_season_managers tsm
set
  manager_discord_id = p.discord_id,
  updated_at = now()
from public.players p
where tsm.manager_discord_id is null
  and tsm.manager_display_name is not null
  and trim(tsm.manager_display_name) <> ''
  and lower(trim(p.roblox_username)) = lower(trim(tsm.manager_display_name))
  and p.discord_id is not null
  and trim(p.discord_id) <> '';

with latest_manager as (
  select distinct on (team_slug)
    team_slug,
    season,
    manager_display_name,
    manager_discord_id
  from public.team_season_managers
  where manager_display_name is not null
    and trim(manager_display_name) <> ''
  order by team_slug, season desc
)
update public.teams t
set
  manager_discord_id = coalesce(lm.manager_discord_id, p.discord_id),
  manager_roblox_id = p.roblox_user_id::text
from latest_manager lm
inner join public.players p
  on lower(trim(p.roblox_username)) = lower(trim(lm.manager_display_name))
where t.slug = lm.team_slug
  and p.roblox_user_id is not null
  and trim(p.roblox_user_id::text) <> '';

-- Discord id from team_season_managers when there is no players row (e.g. Norway / buckuus).
update public.teams t
set manager_discord_id = tsm.manager_discord_id
from public.team_season_managers tsm
where t.slug = tsm.team_slug
  and tsm.season = 3
  and t.manager_discord_id is null
  and tsm.manager_discord_id is not null;
