-- Central documents are visible to active members, never public.
-- Version matches the migration applied through Supabase MCP.
create table public.space_documents (
  id uuid primary key default gen_random_uuid(),
  title text not null check(char_length(title) between 1 and 180),
  storage_path text not null unique check(storage_path like 'space/%'),
  published boolean not null default false,
  valid_from date not null,
  created_at timestamptz not null default now()
);
alter table public.space_documents enable row level security;
revoke all on public.space_documents from anon,authenticated;
grant select on public.space_documents to authenticated;
grant all on public.space_documents to service_role;
create policy "Active members read published space documents" on public.space_documents
  for select to authenticated using ((published and public.is_member()) or public.is_admin());
create policy "Active members download published space documents" on storage.objects
  for select to authenticated using (
    bucket_id='member-documents' and public.is_member() and exists(
      select 1 from public.space_documents d where d.storage_path=name and d.published
    )
  );
