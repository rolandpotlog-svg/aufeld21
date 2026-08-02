-- Bürozuordnung für das zentrale Mieter-/Büro-Dossier.
alter table public.members
  add column if not exists office_name text;

comment on column public.members.office_name is
  'Interne Bürobezeichnung, z. B. Büro 3 oder Flexbüro.';
