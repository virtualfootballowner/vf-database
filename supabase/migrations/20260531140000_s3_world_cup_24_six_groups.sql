-- Season 3 World Cup: 24 teams · 6 groups × 4 → R16 (16) → QF → SF → F.
-- Top 2 per group + best 4 third-place teams advance.
-- Re-run `npm run db:seed:fixtures` after this migration to reload fixture slots.

delete from public.fixtures
where season = 3
  and competition = 'World Cup';

update public.tournaments
set
  name = 'Season 3 · World Cup (6×4)',
  structure_kind = 's3_world_cup_24',
  structure_config = coalesce(structure_config, '{}'::jsonb) || jsonb_build_object(
    'format', 'world_cup_24',
    'groups', 6,
    'teams_per_group', 4,
    'group_stage_matches_per_group', 6,
    'round_of_16_matches', 8,
    'quarter_final_matches', 4,
    'semi_final_matches', 2,
    'final_matches', 1,
    'advancers_per_group', 2,
    'best_third_place_advancers', 4,
    'knockout_advancers_total', 16
  )
where season = 3
  and competition = 'World Cup';
