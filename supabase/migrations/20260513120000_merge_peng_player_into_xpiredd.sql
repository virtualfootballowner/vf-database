-- Merge duplicate profiles: match history was under "peng"; "Xpiredd" is the canonical account.
-- Reassigns match_events, player_team_seasons, contract_offers, roster_release_requests; deletes the peng row.

do $$
declare
  keep_id uuid;
  drop_id uuid;
  keep_roblox text;
  keep_uname text;
  drop_roblox text;
begin
  select id, roblox_user_id, roblox_username
    into keep_id, keep_roblox, keep_uname
  from public.players
  where lower(btrim(roblox_username)) = lower('Xpiredd')
  limit 1;

  select id, roblox_user_id
    into drop_id, drop_roblox
  from public.players
  where lower(btrim(roblox_username)) = lower('peng')
  limit 1;

  if keep_id is null then
    raise exception 'merge_peng_xpiredd: no player row with roblox_username Xpiredd';
  end if;
  if drop_id is null then
    raise exception 'merge_peng_xpiredd: no player row with roblox_username peng';
  end if;
  if keep_id = drop_id then
    raise notice 'merge_peng_xpiredd: same row, nothing to do';
    return;
  end if;

  -- Profile: keep Xpiredd identity; fill position only if still unset
  update public.players k
  set position = coalesce(k.position, d.position)
  from public.players d
  where k.id = keep_id
    and d.id = drop_id;

  -- Events linked to the peng player row
  update public.match_events me
  set
    player_id = keep_id,
    details =
      case
        when keep_roblox is not null and btrim(keep_roblox) <> '' then
          jsonb_set(
            jsonb_set(
              coalesce(me.details, '{}'::jsonb),
              '{player}',
              to_jsonb(keep_uname),
              true
            ),
            '{roblox_user_id}',
            to_jsonb(keep_roblox),
            true
          )
        else
          jsonb_set(
            coalesce(me.details, '{}'::jsonb),
            '{player}',
            to_jsonb(keep_uname),
            true
          )
      end
  where me.player_id = drop_id;

  -- Orphan events that only matched peng by Roblox id in details (no / wrong player_id)
  if drop_roblox is not null and btrim(drop_roblox) <> ''
     and (keep_roblox is distinct from drop_roblox) then
    update public.match_events me
    set
      player_id = keep_id,
      details =
        jsonb_set(
          jsonb_set(
            coalesce(me.details, '{}'::jsonb),
            '{player}',
            to_jsonb(keep_uname),
            true
          ),
          '{roblox_user_id}',
          to_jsonb(keep_roblox),
          true
        )
    where coalesce(me.details ->> 'roblox_user_id', '') = drop_roblox
      and (me.player_id is null or me.player_id = drop_id);
  end if;

  -- Roster: move rows that do not collide on (player, team, season)
  update public.player_team_seasons pts
  set player_id = keep_id
  where pts.player_id = drop_id
    and not exists (
      select 1
      from public.player_team_seasons x
      where x.player_id = keep_id
        and x.team_slug = pts.team_slug
        and x.season = pts.season
    );

  -- Same slot on both profiles: merge counts and keep one row
  update public.player_team_seasons k
  set
    games = coalesce(k.games, 0) + coalesce(d.games, 0),
    roster_position = coalesce(k.roster_position, d.roster_position),
    roster_role = coalesce(k.roster_role, d.roster_role)
  from public.player_team_seasons d
  where k.player_id = keep_id
    and d.player_id = drop_id
    and k.team_slug = d.team_slug
    and k.season = d.season;

  delete from public.player_team_seasons
  where player_id = drop_id;

  -- Pending release requests: drop duplicates then reassign
  delete from public.roster_release_requests r
  where r.player_id = drop_id
    and exists (
      select 1
      from public.roster_release_requests x
      where x.player_id = keep_id
        and x.team_slug = r.team_slug
        and x.season = r.season
        and x.status = r.status
    );

  update public.roster_release_requests
  set player_id = keep_id
  where player_id = drop_id;

  update public.contract_offers
  set signee_player_id = keep_id
  where signee_player_id = drop_id;

  delete from public.players
  where id = drop_id;
end $$;

select public.refresh_player_goal_assist_totals();
