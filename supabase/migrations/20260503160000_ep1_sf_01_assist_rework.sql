-- EP1-SF-01: remove cornzua goals + old cornzua assists; wizente 1 assist; add sc_16x + cornzua 1 assist each.

delete from public.match_events me
using public.matches m
where me.match_id = m.id
  and m.roblox_match_id = 'EP1-SF-01'
  and me.event_type = 'goal'
  and coalesce(me.details->>'player', '') = 'cornzua';

delete from public.match_events me
using public.matches m
where me.match_id = m.id
  and m.roblox_match_id = 'EP1-SF-01'
  and me.event_type = 'assist'
  and coalesce(me.details->>'player', '') = 'cornzua';

update public.match_events me
set details = jsonb_set(me.details, '{count}', to_jsonb(1), true)
from public.matches m
where me.match_id = m.id
  and m.roblox_match_id = 'EP1-SF-01'
  and me.event_type = 'assist'
  and coalesce(me.details->>'player', '') = 'wizente';

insert into public.match_events (match_id, player_id, team_id, event_type, minute, details)
select
  m.id,
  p.id,
  t.id,
  'assist',
  null,
  jsonb_build_object(
    'source', 'vfl_website_csv',
    'player', 'sc_16x',
    'roblox_user_id', p.roblox_user_id,
    'count', 1,
    'notes', null
  )
from public.matches m
inner join public.teams t on t.slug = 'milton-town-fc'
inner join public.players p on p.roblox_user_id = '200344976'
where m.roblox_match_id = 'EP1-SF-01'
  and not exists (
    select 1 from public.match_events x
    where x.match_id = m.id
      and x.event_type = 'assist'
      and coalesce(x.details->>'player', '') = 'sc_16x'
  );

insert into public.match_events (match_id, player_id, team_id, event_type, minute, details)
select
  m.id,
  p.id,
  t.id,
  'assist',
  null,
  jsonb_build_object(
    'source', 'vfl_website_csv',
    'player', 'cornzua',
    'roblox_user_id', p.roblox_user_id,
    'count', 1,
    'notes', null
  )
from public.matches m
inner join public.teams t on t.slug = 'milton-town-fc'
inner join public.players p on p.roblox_user_id = '111729984'
where m.roblox_match_id = 'EP1-SF-01'
  and not exists (
    select 1 from public.match_events x
    where x.match_id = m.id
      and x.event_type = 'assist'
      and coalesce(x.details->>'player', '') = 'cornzua'
  );

select public.refresh_player_goal_assist_totals();

update public.players
set assists_total = 7
where lower(trim(roblox_username)) = 'booskioo';

update public.players
set assists_total = 8
where lower(trim(roblox_username)) = 'wizente';
