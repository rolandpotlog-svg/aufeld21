-- Interne Ausgabeübersicht für Schlüssel und Loxone-Chips.
-- Nur Admins dürfen diese Daten sehen oder ändern.
create table if not exists public.member_access_inventory (
  member_id uuid primary key references public.members(id) on delete cascade,
  loxone_chip_count integer not null default 0 check (loxone_chip_count >= 0),
  entrance_key_count integer not null default 0 check (entrance_key_count >= 0),
  office_key_count integer not null default 0 check (office_key_count >= 0),
  issued_at date,
  note text,
  updated_at timestamptz not null default now()
);

alter table public.member_access_inventory enable row level security;

create policy "Admins manage access inventory"
  on public.member_access_inventory for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

revoke all on public.member_access_inventory from authenticated;
grant select, insert, update, delete on public.member_access_inventory to authenticated;

-- Bekannter Startbestand. Die E-Mail dient nur zur eindeutigen Zuordnung.
insert into public.member_access_inventory (member_id, loxone_chip_count, entrance_key_count, office_key_count, note)
select id, 1, 0, 0, 'Loxone-Chip für den Zugang oben ausgegeben'
from public.members where lower(email) = 'kevin.coder@outlook.com'
on conflict (member_id) do update set
  loxone_chip_count = excluded.loxone_chip_count,
  entrance_key_count = excluded.entrance_key_count,
  office_key_count = excluded.office_key_count,
  note = excluded.note,
  updated_at = now();

insert into public.member_access_inventory (member_id, loxone_chip_count, entrance_key_count, office_key_count, note)
select id, 1, 0, 0, 'Loxone-Chip ausgegeben'
from public.members where lower(email) = 'kilian.stadl@hotmail.com'
on conflict (member_id) do update set
  loxone_chip_count = excluded.loxone_chip_count,
  entrance_key_count = excluded.entrance_key_count,
  office_key_count = excluded.office_key_count,
  note = excluded.note,
  updated_at = now();

insert into public.member_access_inventory (member_id, loxone_chip_count, entrance_key_count, office_key_count, note)
select id, 1, 0, 0, 'Loxone-Chip ausgegeben'
from public.members where lower(email) = 'romeo@immo-kredit.net'
on conflict (member_id) do update set
  loxone_chip_count = excluded.loxone_chip_count,
  entrance_key_count = excluded.entrance_key_count,
  office_key_count = excluded.office_key_count,
  note = excluded.note,
  updated_at = now();

insert into public.member_access_inventory (member_id, loxone_chip_count, entrance_key_count, office_key_count, note)
select id, 0, 2, 2, 'Zwei Eingangstürschlüssel und zwei Büroschlüssel ausgegeben; Loxone-Chip noch offen'
from public.members where lower(email) = 'ak.montage@outlook.com'
on conflict (member_id) do update set
  loxone_chip_count = excluded.loxone_chip_count,
  entrance_key_count = excluded.entrance_key_count,
  office_key_count = excluded.office_key_count,
  note = excluded.note,
  updated_at = now();
