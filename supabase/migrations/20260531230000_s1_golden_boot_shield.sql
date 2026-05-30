-- S1 Golden Boot (booskioo) and Golden Shield (vnpthu).

update public.players
set accolades = accolades || '[{"title": "Golden Boot", "season": 1}]'::jsonb
where id = '4eb430f7-3775-4efa-a939-c90f4780eaea'
  and not accolades @> '[{"title": "Golden Boot", "season": 1}]'::jsonb;

update public.players
set accolades = accolades || '[{"title": "Golden Shield", "season": 1}]'::jsonb
where id = '61d87755-457d-455f-a43b-f4f43cc71594'
  and not accolades @> '[{"title": "Golden Shield", "season": 1}]'::jsonb;
