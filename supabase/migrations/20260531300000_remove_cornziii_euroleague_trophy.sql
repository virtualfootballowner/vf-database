-- cornziii moved to Milton; S1 EuroLeague (Andover) trophy was incorrect — keep Euroblox only.

update public.players
set trophies = (
  select coalesce(jsonb_agg(elem), '[]'::jsonb)
  from jsonb_array_elements(trophies) elem
  where not (
    elem->>'title' = 'EuroLeague champions'
    and (elem->>'season')::int = 1
  )
)
where roblox_user_id = '111729984';
