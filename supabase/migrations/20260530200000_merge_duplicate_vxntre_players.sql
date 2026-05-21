-- Merge duplicate Vxntre profiles: keep verified row (Roblox id + Golden Glove), drop orphan stub.

do $$
declare
  keep_id uuid := 'c6b944d3-976e-4cdd-969b-7037f48d8563';
  drop_id uuid := 'b3d20715-b3b4-42ae-a18b-69900e3557bf';
  keep_roblox text;
  keep_uname text;
begin
  select roblox_user_id, roblox_username
    into keep_roblox, keep_uname
  from public.players
  where id = keep_id;

  if keep_id is null or drop_id is null then
    raise exception 'merge_vxntre: missing player ids';
  end if;

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

  delete from public.player_team_seasons where player_id = drop_id;

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

  update public.match_events me
  set
    player_id = keep_id,
    details = jsonb_set(
      coalesce(me.details, '{}'::jsonb),
      '{player}',
      to_jsonb(keep_uname),
      true
    )
  where me.player_id = drop_id;

  update public.contract_offers
  set signee_player_id = keep_id
  where signee_player_id = drop_id;

  delete from public.players where id = drop_id;
end $$;

select public.refresh_player_goal_assist_totals();
