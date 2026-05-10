-- Season 3 World Cup: 16-team format, trim eight nations from catalogue.
-- Drops old 24-team fixture rows (E/F groups + R16); run `npm run db:seed:fixtures` to reload.

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

delete from public.fixtures
where season = 3
  and competition = 'World Cup';

do $$
declare
  dropped text[] := array[
    'ecuador',
    'south-africa',
    'turkiye',
    'south-korea',
    'uruguay',
    'colombia',
    'algeria',
    'usa'
  ];
begin
  delete from public.match_events
  where team_id in (select id from public.teams where slug = any (dropped));

  delete from public.match_events me using public.matches m
  where me.match_id = m.id
    and m.season = 3
    and m.competition = 'World Cup'
    and (
      m.home_team_id in (select id from public.teams where slug = any (dropped))
      or m.away_team_id in (select id from public.teams where slug = any (dropped))
    );

  delete from public.matches m
  where m.season = 3
    and m.competition = 'World Cup'
    and (
      m.home_team_id in (select id from public.teams where slug = any (dropped))
      or m.away_team_id in (select id from public.teams where slug = any (dropped))
    );

  delete from public.contract_offers where team_slug = any (dropped);
  delete from public.roster_release_requests where team_slug = any (dropped);
  delete from public.player_team_seasons where team_slug = any (dropped);
  delete from public.team_season_managers where team_slug = any (dropped);
  delete from public.team_season_records where team_slug = any (dropped);
  delete from public.team_season_honors where team_slug = any (dropped);
  delete from public.assets where scope = 'team' and ref_slug = any (dropped);

  delete from public.teams where slug = any (dropped);
end $$;

update public.tournaments
set
  name = 'Season 3 · World Cup (4×4)',
  structure_kind = 's3_world_cup_16',
  structure_config = coalesce(structure_config, '{}'::jsonb) || jsonb_build_object(
    'format', 'world_cup_16',
    'groups', 4,
    'teams_per_group', 4,
    'quarter_final_matches', 4,
    'semi_final_matches', 2,
    'final_matches', 1,
    'advancers_per_group', 2,
    'best_third_place_advancers', 0
  )
where season = 3
  and competition = 'World Cup';
