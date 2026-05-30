-- Drop mistaken "Golden Globe" accolade; S1 GK award is Golden Glove.

update public.players
set accolades = coalesce(
  (
    select jsonb_agg(elem)
    from jsonb_array_elements(accolades) elem
    where elem->>'title' is distinct from 'Golden Globe'
  ),
  '[]'::jsonb
)
where accolades @> '[{"title": "Golden Globe"}]'::jsonb;

update public.players
set accolades = accolades || '[{"title": "Golden Glove", "season": 1}]'::jsonb
where id = 'c6b944d3-976e-4cdd-969b-7037f48d8563'
  and not accolades @> '[{"title": "Golden Glove", "season": 1}]'::jsonb;
