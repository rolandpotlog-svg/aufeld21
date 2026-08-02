-- Nutzungspartner erhalten Rechnungen und Raumkontingente, aber keine Mietverträge oder Kautionen.
alter table public.members drop constraint if exists members_role_check;
alter table public.members add constraint members_role_check
  check (role in ('member', 'partner', 'employee', 'admin'));

create or replace function public.is_billing_member()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members where id = auth.uid() and role in ('member', 'partner', 'admin') and active = true);
$$;
revoke all on function public.is_billing_member() from public;
grant execute on function public.is_billing_member() to authenticated;

create or replace function public.is_tenant()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members where id = auth.uid() and role in ('member', 'admin') and active = true);
$$;
revoke all on function public.is_tenant() from public;
grant execute on function public.is_tenant() to authenticated;

drop policy if exists "Members read own deposit and admins read all deposits" on public.member_deposits;
create policy "Members read own deposit and admins read all deposits"
  on public.member_deposits for select to authenticated
  using ((member_id = auth.uid() and public.is_tenant()) or public.is_admin());

drop policy if exists "Members read own visible documents and admins read all documents" on public.member_documents;
create policy "Members read own visible documents and admins read all documents"
  on public.member_documents for select to authenticated
  using ((member_id = auth.uid() and visible_to_member and (document_type <> 'mietvertrag' or public.is_tenant())) or public.is_admin());

drop policy if exists "Members download own documents and admins download all" on storage.objects;
create policy "Members download own documents and admins download all"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'member-documents' and (
      public.is_admin() or exists (
        select 1 from public.member_documents
        where storage_path = name and member_id = auth.uid() and visible_to_member
          and (document_type <> 'mietvertrag' or public.is_tenant())
      )
    )
  );
