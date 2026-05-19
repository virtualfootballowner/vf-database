-- Season 3 individual awards (Ballon d'Or, Golden Boot, Golden Glove).

update public.players
set accolades = '[
  {"title": "Ballon d''Or", "season": 3},
  {"title": "Golden Boot", "season": 3}
]'::jsonb
where id = '4eb430f7-3775-4efa-a939-c90f4780eaea';

update public.players
set accolades = '[{"title": "Golden Glove", "season": 3}]'::jsonb
where id = 'c6b944d3-976e-4cdd-969b-7037f48d8563';
