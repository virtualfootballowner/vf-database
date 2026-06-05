-- Ensure fan join alert tracking is writable by the bot (service role).

grant all on table public.match_fan_join_channel_alerts to service_role;

drop policy if exists "match_fan_join_alerts_service_all"
  on public.match_fan_join_channel_alerts;

create policy "match_fan_join_alerts_service_all"
  on public.match_fan_join_channel_alerts
  for all
  to service_role
  using (true)
  with check (true);
