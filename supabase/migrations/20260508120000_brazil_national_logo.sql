update public.teams
set logo_url = '/brazil.png'
where slug = 'brazil'
  and (logo_url is distinct from '/brazil.png');
