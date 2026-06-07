-- li7wak (273444150) is the wrong Roblox account for Vezotu (2810936226).
-- Merge S2 history into the verified Vezotu profile and drop the stub row.

do $$
declare
  keep_id uuid := '0ff251dd-e383-49e5-bf78-238050728df1';
  drop_id uuid := 'c81dfe0c-ba24-4552-b328-4169d405875e';
  keep_roblox text;
  keep_uname text;
begin
  select roblox_user_id, roblox_username
    into keep_roblox, keep_uname
  from public.players
  where id = keep_id;

  if keep_roblox is null or keep_uname is null then
    raise exception 'merge_li7wak_vezotu: missing keep player';
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

  update public.match_events me
  set
    player_id = keep_id,
    details = jsonb_set(
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
  where me.player_id = drop_id;

  update public.contract_offers
  set signee_player_id = keep_id
  where signee_player_id = drop_id;

  delete from public.players where id = drop_id;
end $$;

select public.refresh_player_goal_assist_totals();
