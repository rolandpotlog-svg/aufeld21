import { createClient } from "@supabase/supabase-js";
import { addDays } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

const TZ = "Europe/Vienna";

const isoDate = (date: Date) => date.toISOString().slice(0, 10);
const roundMoney = (value: number) => Math.round(value * 100) / 100;

export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SECRET_KEY;
  const authorization = request.headers.get("authorization");
  if (!url || !serviceKey || !authorization?.startsWith("Bearer ")) {
    return Response.json({ error: "Nicht autorisiert." }, { status: 401 });
  }

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const isCron = Boolean(process.env.CRON_SECRET) && authorization === `Bearer ${process.env.CRON_SECRET}`;
  let creatorId: string;
  if (isCron) {
    const { data: firstAdmin } = await admin
      .from("members")
      .select("id")
      .eq("role", "admin")
      .eq("active", true)
      .order("created_at")
      .limit(1)
      .single();
    if (!firstAdmin) return Response.json({ error: "Kein aktiver Admin vorhanden." }, { status: 409 });
    creatorId = firstAdmin.id;
  } else {
    const { data: userData } = await admin.auth.getUser(authorization.slice(7));
    if (!userData.user) return Response.json({ error: "Nicht angemeldet." }, { status: 401 });
    const { data: requester } = await admin.from("members").select("role,active").eq("id", userData.user.id).single();
    if (requester?.role !== "admin" || !requester.active) {
      return Response.json({ error: "Nur Administratoren dürfen Rechnungen erzeugen." }, { status: 403 });
    }
    creatorId = userData.user.id;
  }

  const body = (await request.json().catch(() => ({}))) as { billingMonth?: string };
  if (!body.billingMonth?.match(/^\d{4}-\d{2}-01$/)) {
    return Response.json({ error: "Ungültiger Abrechnungsmonat." }, { status: 400 });
  }

  const monthStart = new Date(`${body.billingMonth}T00:00:00Z`);
  const monthEndExclusive = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 1));
  const monthEnd = new Date(monthEndExclusive.getTime() - 86_400_000);
  // The invoice is created on the 29th for the following month's rent. Meeting-room
  // extras use the last fully completed month so bookings on the 30th/31st are never lost.
  const usageMonthStart = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() - 2, 1));
  const usageMonthEnd = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() - 1, 1));
  const usageStartVienna = fromZonedTime(`${isoDate(usageMonthStart)} 00:00:00`, TZ);
  const usageEndVienna = fromZonedTime(`${isoDate(usageMonthEnd)} 00:00:00`, TZ);
  const daysInMonth = monthEnd.getUTCDate();
  const today = new Date();
  const issueDate = formatInTimeZone(today, TZ, "yyyy-MM-dd");
  const dueDate = formatInTimeZone(addDays(fromZonedTime(`${issueDate} 12:00:00`, TZ), 14), TZ, "yyyy-MM-dd");

  const { data: members, error: membersError } = await admin
    .from("members")
    .select("id,name,billing_name,billing_address,monthly_rent_net,contract_start,contract_end")
    .eq("active", true)
    .in("role", ["member", "partner", "admin"]);
  if (membersError) return Response.json({ error: "Mitglieder konnten nicht geladen werden." }, { status: 500 });

  const { data: existing } = await admin
    .from("invoices")
    .select("member_id")
    .eq("billing_month", body.billingMonth)
    .neq("status", "cancelled");
  const existingIds = new Set((existing ?? []).map((invoice) => invoice.member_id));
  const invoiceYear = issueDate.slice(0, 4);
  const { data: latestNumber } = await admin
    .from("invoices")
    .select("invoice_number")
    .like("invoice_number", `A21-${invoiceYear}-%`)
    .order("invoice_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  let nextInvoiceSequence = Number(latestNumber?.invoice_number?.split("-").at(-1) ?? 0) + 1;
  let created = 0;
  let skipped = 0;

  for (const member of members ?? []) {
    if (existingIds.has(member.id)) {
      skipped += 1;
      continue;
    }
    const items: Array<{ description: string; quantity: number; unit: string; unit_price_net: number; vat_rate: number; sort_order: number }> = [];
    const contractStart = member.contract_start ? new Date(`${member.contract_start}T00:00:00Z`) : monthStart;
    const contractEnd = member.contract_end ? new Date(`${member.contract_end}T00:00:00Z`) : monthEnd;
    const activeStart = contractStart > monthStart ? contractStart : monthStart;
    const activeEnd = contractEnd < monthEnd ? contractEnd : monthEnd;
    if (member.monthly_rent_net != null && activeStart <= activeEnd) {
      const activeDays = Math.floor((activeEnd.getTime() - activeStart.getTime()) / 86_400_000) + 1;
      const monthlyRent = Number(member.monthly_rent_net);
      items.push({
        description:
          activeDays === daysInMonth
            ? `Grundmiete AUFELD21 ${body.billingMonth.slice(0, 7)}`
            : `Grundmiete aliquot ${isoDate(activeStart)} bis ${isoDate(activeEnd)} (${activeDays}/${daysInMonth} Tage)`,
        quantity: 1,
        unit: "Monat",
        unit_price_net: roundMoney(monthlyRent * (activeDays / daysInMonth)),
        vat_rate: 20,
        sort_order: 0,
      });
    }

    const [{ data: bookings }, { data: bonuses }] = await Promise.all([
      admin
        .from("bookings")
        .select("start_at,end_at")
        .eq("member_id", member.id)
        .gte("start_at", usageStartVienna.toISOString())
        .lt("start_at", usageEndVienna.toISOString()),
      admin
        .from("quota_adjustments")
        .select("hours")
        .eq("member_id", member.id)
        .eq("valid_month", isoDate(usageMonthStart)),
    ]);
    const usedHours = (bookings ?? []).reduce(
      (sum, booking) => sum + (new Date(booking.end_at).getTime() - new Date(booking.start_at).getTime()) / 3_600_000,
      0,
    );
    const bonusHours = (bonuses ?? []).reduce((sum, bonus) => sum + Number(bonus.hours), 0);
    const extraHours = Math.max(usedHours - 12 - bonusHours, 0);
    if (extraHours > 0) {
      items.push({
        description: `Meetingraum Zusatznutzung ${isoDate(usageMonthStart).slice(0, 7)}`,
        quantity: extraHours,
        unit: "Std.",
        unit_price_net: 12,
        vat_rate: 20,
        sort_order: 1,
      });
    }

    if (items.length === 0 || !member.billing_address) {
      skipped += 1;
      continue;
    }
    const invoiceNumber = `A21-${invoiceYear}-${String(nextInvoiceSequence).padStart(4, "0")}`;
    const { data: invoice, error: invoiceError } = await admin
      .from("invoices")
      .insert({
        member_id: member.id,
        status: "final",
        invoice_number: invoiceNumber,
        issue_date: issueDate,
        billing_month: body.billingMonth,
        service_period_start: isoDate(usageMonthStart),
        service_period_end: isoDate(monthEnd),
        due_date: dueDate,
        finalized_at: new Date().toISOString(),
        created_by: creatorId,
      })
      .select("id")
      .single();
    if (invoiceError || !invoice) {
      skipped += 1;
      continue;
    }
    const { error: itemsError } = await admin
      .from("invoice_items")
      .insert(items.map((item) => ({ ...item, invoice_id: invoice.id })));
    if (itemsError) {
      await admin.from("invoices").delete().eq("id", invoice.id);
      skipped += 1;
      continue;
    }
    nextInvoiceSequence += 1;
    created += 1;
  }

  return Response.json({ created, skipped });
}
