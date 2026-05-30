-- S3 individual awards were seeded prematurely; season is still in progress.

update public.players
set accolades = coalesce(
  (
    select jsonb_agg(elem)
    from jsonb_array_elements(accolades) elem
    where coalesce((elem->>'season')::int, 0) <> 3
  ),
  '[]'::jsonb
)
where exists (
  select 1
  from jsonb_array_elements(accolades) elem
  where (elem->>'season')::int = 3
);
