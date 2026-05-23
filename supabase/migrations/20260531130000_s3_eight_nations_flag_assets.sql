-- Point new S3 nations at uploaded flag assets in public/.

update public.teams set logo_url = '/Flag_of_Albania.svg.png', updated_at = now()
where slug = 'albania';

update public.teams set logo_url = '/Flag_of_Greece.svg.webp', updated_at = now()
where slug = 'greece';

update public.teams set logo_url = '/USA%20FLAG.webp', updated_at = now()
where slug = 'usa';

update public.teams set logo_url = '/Flag_of_Norway.svg.webp', updated_at = now()
where slug = 'norway';

update public.teams set logo_url = '/swiss%20flag.png', updated_at = now()
where slug = 'switzerland';

update public.teams set logo_url = '/Flag_of_Ukraine.svg.webp', updated_at = now()
where slug = 'ukraine';

update public.teams set logo_url = '/Flag_of_North_Korea.svg.png', updated_at = now()
where slug = 'north-korea';

update public.teams set logo_url = '/Flag_of_Somalia.svg.png', updated_at = now()
where slug = 'somalia';
