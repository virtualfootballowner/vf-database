-- Revert broad contract labels (e.g. "Midfielder (CM)") back to tactical codes ("CM").

update public.players
set position = upper(substring(position from '\(([^)]+)\)$'))
where position ~ '^(Goalkeeper|Defender|Midfielder|Attacker) \([^)]+\)$';

update public.players
set position = case position
  when 'Goalkeeper' then 'GK'
  when 'Defender' then 'DEF'
  when 'Midfielder' then 'MID'
  when 'Attacker' then 'FWD'
  else position
end
where position in ('Goalkeeper', 'Defender', 'Midfielder', 'Attacker');

update public.player_team_seasons
set roster_position = upper(substring(roster_position from '\(([^)]+)\)$'))
where roster_position ~ '^(Goalkeeper|Defender|Midfielder|Attacker) \([^)]+\)$';

update public.player_team_seasons
set roster_position = case roster_position
  when 'Goalkeeper' then 'GK'
  when 'Defender' then 'DEF'
  when 'Midfielder' then 'MID'
  when 'Attacker' then 'FWD'
  else roster_position
end
where roster_position in ('Goalkeeper', 'Defender', 'Midfielder', 'Attacker');

update public.contract_offers
set roster_position = upper(substring(roster_position from '\(([^)]+)\)$'))
where roster_position ~ '^(Goalkeeper|Defender|Midfielder|Attacker) \([^)]+\)$';

update public.contract_offers
set roster_position = case roster_position
  when 'Goalkeeper' then 'GK'
  when 'Defender' then 'DEF'
  when 'Midfielder' then 'MID'
  when 'Attacker' then 'FWD'
  else roster_position
end
where roster_position in ('Goalkeeper', 'Defender', 'Midfielder', 'Attacker');
