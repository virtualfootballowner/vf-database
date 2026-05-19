-- Season 3 Golden Shield (best defender) → vnpthu.

update public.players
set accolades = '[{"title": "Golden Shield", "season": 3}]'::jsonb
where id = '61d87755-457d-455f-a43b-f4f43cc71594';
