-- Canonical sheet fixes (matches data/match-events.csv + matches-data):
-- EL1-GW2-03, EL1-GW4-03, EL1-GW5-01 MOTM, EL1-GW6-01, EP1-QF-01, BP2-MN-01.

-- EL1-GW2-03 — booskioo assist ×2
update public.match_events me
set details = jsonb_set(me.details, '{count}', to_jsonb(2), true)
from public.matches m
where me.match_id = m.id
  and m.roblox_match_id = 'EL1-GW2-03'
  and me.event_type = 'assist'
  and coalesce(me.details->>'player', '') = 'booskioo'
  and coalesce(me.details->>'roblox_user_id', '') = '25796457';

-- EL1-GW4-03 — rykiraa assist ×7; add booskioo assist ×1
update public.match_events me
set details = jsonb_set(me.details, '{count}', to_jsonb(7), true)
from public.matches m
where me.match_id = m.id
  and m.roblox_match_id = 'EL1-GW4-03'
  and me.event_type = 'assist'
  and coalesce(me.details->>'player', '') = 'rykiraa'
  and coalesce(me.details->>'roblox_user_id', '') = '104144813';

insert into public.match_events (match_id, player_id, team_id, event_type, minute, details)
select
  m.id,
  p.id,
  t.id,
  'assist',
  null,
  jsonb_build_object(
    'source', 'vfl_website_csv',
    'player', 'booskioo',
    'roblox_user_id', p.roblox_user_id,
    'count', 1,
    'notes', null
  )
from public.matches m
inner join public.teams t on t.slug = 'andover-fc'
inner join public.players p on p.roblox_user_id = '25796457'
where m.roblox_match_id = 'EL1-GW4-03'
  and not exists (
    select 1
    from public.match_events x
    where x.match_id = m.id
      and x.event_type = 'assist'
      and coalesce(x.details->>'player', '') = 'booskioo'
      and coalesce(x.details->>'roblox_user_id', '') = '25796457'
  );

-- EL1-GW5-01 — MOTM rykiraa (undo any booskioo MOTM row)
update public.match_events me
set
  player_id = p.id,
  team_id = t.id,
  details = jsonb_build_object(
    'source', 'vfl_website_csv',
    'player', 'rykiraa',
    'roblox_user_id', p.roblox_user_id,
    'count', 1,
    'notes', null
  )
from public.matches m
inner join public.teams t on t.slug = 'andover-fc'
inner join public.players p on p.roblox_user_id = '104144813'
where me.match_id = m.id
  and m.roblox_match_id = 'EL1-GW5-01'
  and me.event_type = 'motm'
  and coalesce(me.details->>'player', '') = 'booskioo';

-- EL1-GW6-01 — booskioo goal count 2; + rykiraa goal; rebuild Andover assists (booskioo+vnpthu + shared lines)
update public.match_events me
set details = jsonb_set(me.details, '{count}', to_jsonb(2), true)
from public.matches m
where me.match_id = m.id
  and m.roblox_match_id = 'EL1-GW6-01'
  and me.event_type = 'goal'
  and coalesce(me.details->>'player', '') = 'booskioo'
  and coalesce(me.details->>'roblox_user_id', '') = '25796457';

insert into public.match_events (match_id, player_id, team_id, event_type, minute, details)
select
  m.id,
  p.id,
  t.id,
  'goal',
  null,
  jsonb_build_object(
    'source', 'vfl_website_csv',
    'player', 'rykiraa',
    'roblox_user_id', p.roblox_user_id,
    'count', 1,
    'notes', null
  )
from public.matches m
inner join public.teams t on t.slug = 'andover-fc'
inner join public.players p on p.roblox_user_id = '104144813'
where m.roblox_match_id = 'EL1-GW6-01'
  and not exists (
    select 1
    from public.match_events x
    where x.match_id = m.id
      and x.event_type = 'goal'
      and coalesce(x.details->>'player', '') = 'rykiraa'
      and coalesce(x.details->>'roblox_user_id', '') = '104144813'
  );

delete from public.match_events me
using public.matches m, public.teams t
where me.match_id = m.id
  and m.roblox_match_id = 'EL1-GW6-01'
  and me.event_type = 'assist'
  and me.team_id = t.id
  and t.slug = 'andover-fc';

insert into public.match_events (match_id, player_id, team_id, event_type, minute, details)
select
  m.id,
  p.id,
  t.id,
  'assist',
  null,
  jsonb_build_object(
    'source', 'vfl_website_csv',
    'player', 'rykiraa',
    'roblox_user_id', p.roblox_user_id,
    'count', 2,
    'notes', null
  )
from public.matches m
inner join public.teams t on t.slug = 'andover-fc'
inner join public.players p on p.roblox_user_id = '104144813'
where m.roblox_match_id = 'EL1-GW6-01';

insert into public.match_events (match_id, player_id, team_id, event_type, minute, details)
select
  m.id,
  p.id,
  t.id,
  'assist',
  null,
  jsonb_build_object(
    'source', 'vfl_website_csv',
    'player', 'ahttuso',
    'roblox_user_id', p.roblox_user_id,
    'count', 1,
    'notes', null
  )
from public.matches m
inner join public.teams t on t.slug = 'andover-fc'
inner join public.players p on p.roblox_user_id = '596543819'
where m.roblox_match_id = 'EL1-GW6-01';

insert into public.match_events (match_id, player_id, team_id, event_type, minute, details)
select
  m.id,
  p.id,
  t.id,
  'assist',
  null,
  jsonb_build_object(
    'source', 'vfl_website_csv',
    'player', 'vexzema',
    'roblox_user_id', p.roblox_user_id,
    'count', 2,
    'notes', null
  )
from public.matches m
inner join public.teams t on t.slug = 'andover-fc'
inner join public.players p on p.roblox_user_id = '508865433'
where m.roblox_match_id = 'EL1-GW6-01';

insert into public.match_events (match_id, player_id, team_id, event_type, minute, details)
select
  m.id,
  p.id,
  t.id,
  'assist',
  null,
  jsonb_build_object(
    'source', 'vfl_website_csv',
    'player', 'booskioo',
    'roblox_user_id', p.roblox_user_id,
    'count', 2,
    'notes', null
  )
from public.matches m
inner join public.teams t on t.slug = 'andover-fc'
inner join public.players p on p.roblox_user_id = '25796457'
where m.roblox_match_id = 'EL1-GW6-01';

insert into public.match_events (match_id, player_id, team_id, event_type, minute, details)
select
  m.id,
  p.id,
  t.id,
  'assist',
  null,
  jsonb_build_object(
    'source', 'vfl_website_csv',
    'player', 'vnpthu',
    'roblox_user_id', p.roblox_user_id,
    'count', 1,
    'notes', null
  )
from public.matches m
inner join public.teams t on t.slug = 'andover-fc'
inner join public.players p on p.roblox_user_id = '18925142'
where m.roblox_match_id = 'EL1-GW6-01';

-- EP1-QF-01 — ahmed goal (no Roblox id in sheet)
insert into public.match_events (match_id, player_id, team_id, event_type, minute, details)
select
  m.id,
  null,
  t.id,
  'goal',
  null,
  jsonb_build_object(
    'source', 'vfl_website_csv',
    'player', 'ahmed',
    'roblox_user_id', null,
    'count', 1,
    'notes', '⚠️ No Roblox ID — verify'
  )
from public.matches m
inner join public.teams t on t.slug = 'andover-fc'
where m.roblox_match_id = 'EP1-QF-01'
  and not exists (
    select 1
    from public.match_events x
    where x.match_id = m.id
      and x.event_type = 'goal'
      and coalesce(x.details->>'player', '') = 'ahmed'
  );

-- BP2-MN-01 — 3-3; booskioo Milton goal ×2
update public.matches
set
  home_score = 3,
  away_score = 3
where roblox_match_id = 'BP2-MN-01';

update public.match_events me
set details = jsonb_set(me.details, '{count}', to_jsonb(2), true)
from public.matches m
where me.match_id = m.id
  and m.roblox_match_id = 'BP2-MN-01'
  and me.event_type = 'goal'
  and coalesce(me.details->>'player', '') = 'booskioo'
  and me.team_id = (select id from public.teams where slug = 'milton-town-fc' limit 1);

update public.matches
set match_notes = '0-0 vs Newham (pair split from BP2-MN-01 Milton–Newport 3-3). Date approximate.'
where roblox_match_id = 'BP2-MNH-01';

select public.refresh_player_goal_assist_totals();
