import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

// Real Postgres in memory. Never connects to Supabase or consumes live numbers.
test("atomic invoice migration: periods, retries, snapshots, rollback and permissions", async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql as $$select null::uuid$$;
      create function auth.jwt() returns jsonb language sql as $$select '{"role":"service_role"}'::jsonb$$;
      create function public.is_admin() returns boolean language sql as $$select true$$;
      create function public.is_member() returns boolean language sql as $$select true$$;
    `);
    const initial = await readFile(new URL("../../supabase/migrations/001_initial_schema.sql", import.meta.url), "utf8");
    await db.exec(initial.slice(initial.indexOf("create table if not exists public.members"), initial.indexOf("alter table public.bookings\n  add constraint bookings_no_overlap")));
    await db.exec("create sequence public.invoice_number_seq");
    await db.exec(await readFile(new URL("../../supabase/migrations/011_atomic_invoice_numbers.sql", import.meta.url), "utf8"));
    await db.exec(await readFile(new URL("../../supabase/migrations/20260906183145_invoice_reliability_and_portal_safety.sql", import.meta.url), "utf8"));
    const admin = "00000000-0000-4000-8000-000000000001";
    const tenant = "00000000-0000-4000-8000-000000000002";
    const employee = "00000000-0000-4000-8000-000000000003";
    await db.exec(`
      insert into auth.users values('${admin}'),('${tenant}'),('${employee}');
      insert into members(id,email,name,role,billing_address,monthly_rent_net,contract_start) values
      ('${admin}','admin@example.test','Admin','admin',null,null,null),
      ('${tenant}','tenant@example.test','Original Name','member','Original Address',310,'2024-01-31'),
      ('${employee}','employee@example.test','Employee','employee',null,null,null);
    `);
    const create = async (month: string, member = tenant) => (await db.query<{ result: { created: boolean; id: string; reason: string } }>(
      "select public.create_monthly_invoice($1,$2,$3) as result", [member, month, admin],
    )).rows[0].result;
    const january = await create("2024-01-01");
    assert.equal(january.created, true);
    assert.equal((await create("2024-01-01")).created, false);
    const row = (await db.query<{ net: string; end: string; issue: string; due: string }>(`select it.unit_price_net::text net, i.service_period_end::text as end, i.issue_date::text issue, i.due_date::text due from invoices i join invoice_items it on it.invoice_id=i.id where i.id=$1`, [january.id])).rows[0];
    assert.deepEqual(row, { net: "10.00", end: "2024-01-31", issue: "2023-12-25", due: "2024-01-10" });
    assert.equal((await create("2024-01-01", employee)).reason, "not_billable");
    assert.equal((await create("2024-01-01", admin)).reason, "not_billable");
    await assert.rejects(create("2099-01-01"), /invalid_billing_month/);
    await assert.rejects(create("2024-02-02"), /invalid_billing_month/);
    await db.exec(`update members set billing_name='Changed Name',billing_address='Changed Address' where id='${tenant}'`);
    assert.equal((await db.query<{ recipient_name: string }>("select recipient_name from invoice_snapshots where invoice_id=$1", [january.id])).rows[0].recipient_name, "Original Name");
    await assert.rejects(db.exec(`update invoices set issue_date='2024-01-01' where id='${january.id}'`), /immutable/);
    await assert.rejects(db.exec(`update invoices set status='draft' where id='${january.id}'`), /immutable/);
    await assert.rejects(db.exec(`update invoice_items set unit_price_net=1 where invoice_id='${january.id}'`), /immutable/);
    await assert.rejects(db.exec(`delete from invoice_items where invoice_id='${january.id}'`), /immutable/);
    await assert.rejects(db.exec(`update invoice_snapshots set recipient_name='Changed' where invoice_id='${january.id}'`), /immutable/);
    await db.exec(`update invoices set status='paid',paid_at='2024-01-10T12:00:00Z' where id='${january.id}'; update invoices set status='final',paid_at=null where id='${january.id}'`);
    // Fault injected at finalization: all invoice and position writes must roll back.
    await db.exec(`create function fail_test_invoice() returns trigger language plpgsql as $$begin raise exception 'injected_failure'; end;$$;
      create trigger fail_test_invoice before update on invoices for each row execute function fail_test_invoice();`);
    await assert.rejects(create("2024-02-01"), /injected_failure/);
    assert.equal((await db.query<{ count: number }>("select count(*)::int count from invoices")).rows[0].count, 1);
    assert.equal((await db.query<{ count: number }>("select count(*)::int count from invoice_items")).rows[0].count, 1);
    await db.exec("drop trigger fail_test_invoice on invoices; drop function fail_test_invoice()");
    const feb = await create("2024-02-01");
    assert.equal((await db.query<{ end: string }>("select service_period_end::text as end from invoices where id=$1", [feb.id])).rows[0].end, "2024-02-29");
    // Completed extra hours are billed once, even when a later month is retried.
    await db.exec(`insert into bookings(member_id,start_at,end_at) values ('${tenant}','2024-02-01T07:00:00+01','2024-02-01T20:00:00+01');`);
    await create("2024-04-01"); await create("2024-05-01");
    assert.equal((await db.query<{ count: number }>("select count(*)::int count from invoice_items where description like 'Meetingraum Zusatznutzung%'")).rows[0].count, 1);
    const rights = (await db.query<{ allowed: boolean }>("select has_function_privilege('authenticated','public.create_monthly_invoice(uuid,date,uuid)','EXECUTE') as allowed")).rows[0];
    assert.equal(rights.allowed, false);
    assert.equal((await db.query<{ count: number }>("select count(*)::int count from (select invoice_number from invoices group by invoice_number having count(*)>1) d")).rows[0].count, 0);
  } finally { await db.close(); }
});
