-- Season 3: 16-team World Cup (4×4 groups). Drop eight nations from the old 24-team pool.
-- Re-run `npm run db:seed:fixtures` after apply to repopulate `fixtures` for S3.

alter table public.tournaments drop constraint if exists tournaments_structure_kind_check;
alter table public.tournaments add constraint tournaments_structure_kind_check
  check (
    structure_kind is null
    or structure_kind in (
      's1_euroleague_round_robin_knockout',
      's2_multi_league',
      's3_world_cup_24',
      's3_world_cup_16'
    )
  );

comment on column public.tournaments.structure_kind is
  's1_euroleague_round_robin_knockout | s2_multi_league | s3_world_cup_24 | s3_world_cup_16';

delete from public.fixtures
where season = 3 and competition = 'World Cup';

update public.tournaments
set
  name = 'Season 3 · World Cup (16 teams)',
  structure_kind = 's3_world_cup_16',
  structure_config = '{
    "format": "world_cup_16",
    "groups": 4,
    "teams_per_group": 4,
    "group_stage_matches_per_group": 6,
    "quarter_final_matches": 4,
    "semi_final_matches": 2,
    "final_matches": 1,
    "advancers_per_group": 2,
    "best_third_place_advancers": 0
  }'::jsonb
where season = 3 and competition = 'World Cup';

delete from public.player_team_seasons
where season = 3
  and team_slug in (
    'algeria',
    'ecuador',
    'colombia',
    'south-korea',
    'uruguay',
    'turkiye',
    'south-africa',
    'canada'
  );

delete from public.team_season_managers
where season = 3
  and team_slug in (
    'algeria',
    'ecuador',
    'colombia',
    'south-korea',
    'uruguay',
    'turkiye',
    'south-africa',
    'canada'
  );

delete from public.team_season_records
where season = 3
  and team_slug in (
    'algeria',
    'ecuador',
    'colombia',
    'south-korea',
    'uruguay',
    'turkiye',
    'south-africa',
    'canada'
  );

delete from public.assets
where scope = 'team'
  and ref_slug in (
    'algeria',
    'ecuador',
    'colombia',
    'south-korea',
    'uruguay',
    'turkiye',
    'south-africa',
    'canada'
  );

delete from public.teams
where slug in (
  'algeria',
  'ecuador',
  'colombia',
  'south-korea',
  'uruguay',
  'turkiye',
  'south-africa',
  'canada'
);
