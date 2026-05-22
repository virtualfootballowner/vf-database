-- Appointed managers should appear on their team squad sheet for that season.

insert into public.player_team_seasons (player_id, team_slug, season, games)
select distinct on (p.id, tsm.team_slug, tsm.season)
  p.id,
  tsm.team_slug,
  tsm.season,
  0
from public.team_season_managers tsm
join public.players p
  on (
    tsm.manager_discord_id is not null
    and p.discord_id = tsm.manager_discord_id
  )
  or lower(btrim(p.roblox_username)) = lower(btrim(tsm.manager_display_name))
where not exists (
  select 1
  from public.player_team_seasons pts
  where pts.player_id = p.id
    and pts.team_slug = tsm.team_slug
    and pts.season = tsm.season
)
order by p.id, tsm.team_slug, tsm.season, p.updated_at desc nulls last;
