-- The actual Wi-Fi credentials are inserted separately, never committed to source.
create table public.space_wifi (
  id text primary key check (id = 'tenant'),
  ssid text not null check (octet_length(ssid) between 1 and 32),
  password text not null check (char_length(password) between 8 and 63)
);

alter table public.space_wifi enable row level security;
revoke all on public.space_wifi from public, anon, authenticated;
grant select on public.space_wifi to authenticated;
grant all on public.space_wifi to service_role;

create policy "Active members read tenant Wi-Fi" on public.space_wifi
  for select to authenticated
  using ((select public.is_member()));
