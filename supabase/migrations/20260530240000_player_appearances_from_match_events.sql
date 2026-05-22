-- Career appearances derived from match_events (distinct matches per player).
alter table public.players
  add column if not exists appearances_total integer not null default 0;

create or replace function public.refresh_player_goal_assist_totals()
returns void
language sql
security definer
set search_path = public
as $$
  update public.players
  set goals_total = 0,
      assists_total = 0,
      appearances_total = 0,
      updated_at = now()
  where true;

  update public.players p
  set
    goals_total = coalesce(s.g, 0),
    assists_total = coalesce(s.a, 0),
    appearances_total = coalesce(s.apps, 0),
    updated_at = now()
  from (
    select
      player_id,
      sum(
        case
          when event_type = 'goal' then coalesce(nullif(trim(details ->> 'count'), '')::integer, 1)
          else 0
        end
      ) as g,
      sum(
        case
          when event_type = 'assist' then coalesce(nullif(trim(details ->> 'count'), '')::integer, 1)
          else 0
        end
      ) as a,
      count(distinct match_id) as apps
    from public.match_events
    where player_id is not null
    group by player_id
  ) s
  where p.id = s.player_id;

  update public.player_team_seasons
  set games = 0;

  update public.player_team_seasons pts
  set games = sub.cnt
  from (
    select
      pts2.id as pts_id,
      count(distinct m.id)::integer as cnt
    from public.player_team_seasons pts2
    join public.teams t on t.slug = pts2.team_slug
    join public.match_events me on me.player_id = pts2.player_id
    join public.matches m
      on m.id = me.match_id
      and m.season = pts2.season
    where me.player_id is not null
      and (m.home_team_id = t.id or m.away_team_id = t.id)
    group by pts2.id
  ) sub
  where pts.id = sub.pts_id;
$$;

select public.refresh_player_goal_assist_totals();
