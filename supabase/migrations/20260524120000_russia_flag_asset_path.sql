-- Match Russia row to flag asset in /public/Flag_of_Russia.svg.png
update public.teams
set logo_url = '/Flag_of_Russia.svg.png'
where slug = 'russia';

update public.assets
set public_url = '/Flag_of_Russia.svg.png',
    updated_at = now()
where scope = 'team'
  and ref_slug = 'russia'
  and kind = 'logo';
