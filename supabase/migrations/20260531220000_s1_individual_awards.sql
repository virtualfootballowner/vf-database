-- Season 1 individual awards for Stats → Tournaments archive.

update public.players
set accolades = accolades || '[{"title": "Ballon d''Or", "season": 1}]'::jsonb
where id = '4eb430f7-3775-4efa-a939-c90f4780eaea'
  and not accolades @> '[{"title": "Ballon d''Or", "season": 1}]'::jsonb;

update public.players
set accolades = accolades || '[{"title": "Golden Glove", "season": 1}]'::jsonb
where id = 'c6b944d3-976e-4cdd-969b-7037f48d8563'
  and not accolades @> '[{"title": "Golden Glove", "season": 1}]'::jsonb;
