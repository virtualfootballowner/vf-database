-- Link managers by Discord id so /contract resolves reliably (not only Roblox display name).

alter table public.team_season_managers
  add column if not exists manager_discord_id text;

comment on column public.team_season_managers.manager_discord_id is
  'Discord user id for the appointed manager; used by the bot for /contract and /release.';

create index if not exists team_season_managers_discord_season_idx
  on public.team_season_managers (manager_discord_id, season)
  where manager_discord_id is not null;

-- S3 France ↔ Belgium manager swap (rosters unchanged).
update public.team_season_managers
set
  manager_display_name = 'MORTY256x1',
  manager_discord_id = '952254182440722442',
  updated_at = now()
where team_slug = 'france' and season = 3;

update public.team_season_managers
set
  manager_display_name = 'peakvxz',
  manager_discord_id = '1211658729276309577',
  updated_at = now()
where team_slug = 'belgium' and season = 3;
