-- S3 World Cup MD3: FFT forfeits + Switzerland 2–8 Germany (MOTM Gvidiasas).

-- MD3 FFT forfeits (winner 3–0)
do $$
declare
  codes text[] := array[
    'S3-WC-G-C-05',
    'S3-WC-G-D-05',
    'S3-WC-G-B-05',
    'S3-WC-G-E-05',
    'S3-WC-G-A-05',
    'S3-WC-G-C-06'
  ];
  c text;
begin
  foreach c in array codes loop
    delete from public.match_events me
    using public.matches m
    where me.match_id = m.id and m.roblox_match_id = c;

    update public.matches
    set
      home_score = 3,
      away_score = 0,
      status = 'completed',
      fft = 'Yes',
      ended_at = coalesce(ended_at, now())
    where roblox_match_id = c;
  end loop;
end;
$$;

-- Switzerland 2–8 Germany (played; not FFT)
delete from public.match_events me
using public.matches m
where me.match_id = m.id
  and m.roblox_match_id = 'S3-WC-G-E-06'
  and me.event_type = 'motm';

update public.matches
set
  home_score = 2,
  away_score = 8,
  status = 'completed',
  fft = 'No',
  ended_at = coalesce(ended_at, now())
where roblox_match_id = 'S3-WC-G-E-06';

insert into public.match_events (match_id, player_id, team_id, event_type, minute, details)
select
  m.id,
  p.id,
  t.id,
  'motm'::event_type,
  null,
  jsonb_build_object(
    'source', 'manual_stats_patch',
    'player', p.roblox_username,
    'roblox_user_id', p.roblox_user_id,
    'count', 1,
    'notes', 'MOTM backfill MD3'
  )
from public.matches m
join public.players p on lower(p.roblox_username) = 'gvidiasas'
join public.teams t on t.slug = 'germany'
where m.roblox_match_id = 'S3-WC-G-E-06'
  and not exists (
    select 1 from public.match_events me
    where me.match_id = m.id and me.event_type = 'motm'
  );

select public.refresh_player_goal_assist_totals();
