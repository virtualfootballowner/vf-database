-- Recompute team_season_records whenever a completed fixture is inserted/updated/deleted.

create or replace function public.refresh_team_season_records(p_season integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  if p_season is null then
    return;
  end if;

  for r in
    select
      t.slug as team_slug,
      coalesce(sum(case
        when m.home_team_id = t.id and coalesce(m.home_score, 0) > coalesce(m.away_score, 0) then 1
        when m.away_team_id = t.id and coalesce(m.away_score, 0) > coalesce(m.home_score, 0) then 1
        else 0
      end), 0)::integer as wins,
      coalesce(sum(case
        when m.home_team_id = t.id and coalesce(m.home_score, 0) < coalesce(m.away_score, 0) then 1
        when m.away_team_id = t.id and coalesce(m.away_score, 0) < coalesce(m.home_score, 0) then 1
        else 0
      end), 0)::integer as losses,
      coalesce(sum(case
        when coalesce(m.home_score, 0) = coalesce(m.away_score, 0) then 1
        else 0
      end), 0)::integer as draws,
      coalesce(count(m.id), 0)::integer as matches_played
    from public.teams t
    left join public.matches m
      on m.season = p_season
     and m.status = 'completed'
     and (m.home_team_id = t.id or m.away_team_id = t.id)
    group by t.slug
    having count(m.id) > 0
  loop
    insert into public.team_season_records (
      team_slug,
      season,
      wins,
      losses,
      draws,
      matches_played
    )
    values (
      r.team_slug,
      p_season,
      r.wins,
      r.losses,
      r.draws,
      r.matches_played
    )
    on conflict (team_slug, season) do update
      set
        wins = excluded.wins,
        losses = excluded.losses,
        draws = excluded.draws,
        matches_played = excluded.matches_played;
  end loop;
end;
$$;

comment on function public.refresh_team_season_records(integer) is
  'Rebuild W-D-L for every team with completed matches in the given season.';

create or replace function public.trg_matches_refresh_team_season_records()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  s integer;
begin
  if tg_op = 'DELETE' then
    if old.status = 'completed' and old.season is not null then
      perform public.refresh_team_season_records(old.season);
    end if;
    return old;
  end if;

  if new.status = 'completed'
     or (tg_op = 'UPDATE' and old.status = 'completed') then
    if new.season is not null then
      perform public.refresh_team_season_records(new.season);
    end if;
    if tg_op = 'UPDATE'
       and old.season is not null
       and old.season is distinct from new.season then
      perform public.refresh_team_season_records(old.season);
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists matches_refresh_team_season_records on public.matches;

create trigger matches_refresh_team_season_records
  after insert or update of status, home_score, away_score, season, home_team_id, away_team_id
  or delete
  on public.matches
  for each row
  execute function public.trg_matches_refresh_team_season_records();

-- Backfill all seasons that have completed fixtures.
do $$
declare
  s integer;
begin
  for s in
    select distinct season
    from public.matches
    where status = 'completed' and season is not null
    order by season
  loop
    perform public.refresh_team_season_records(s);
  end loop;
end;
$$;
