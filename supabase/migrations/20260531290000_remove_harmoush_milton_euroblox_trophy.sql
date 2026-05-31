-- harmoush left Milton before the S1 Euroblox Cup win; remove mistaken trophy.

update public.players
set trophies = '[]'::jsonb
where roblox_user_id = '140245581'
  and trophies @> '[{"title": "Euroblox Cup champions", "season": 1}]'::jsonb;
