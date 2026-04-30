-- Career totals derived from match_events (goals + assists only; not own_goals).
alter table public.players add column if not exists goals_total integer not null default 0;
alter table public.players add column if not exists assists_total integer not null default 0;

create or replace function public.refresh_player_goal_assist_totals()
returns void
language sql
security definer
set search_path = public
as $$
  update public.players
  set goals_total = 0,
      assists_total = 0,
      updated_at = now()
  where true;

  update public.players p
  set
    goals_total = coalesce(s.g, 0),
    assists_total = coalesce(s.a, 0),
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
      ) as a
    from public.match_events
    where player_id is not null
    group by player_id
  ) s
  where p.id = s.player_id;
$$;

grant execute on function public.refresh_player_goal_assist_totals() to service_role;
grant execute on function public.refresh_player_goal_assist_totals() to authenticated;
