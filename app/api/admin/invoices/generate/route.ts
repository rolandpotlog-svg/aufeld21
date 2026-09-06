import { createClient } from "@supabase/supabase-js";
import { isBillingMonth, scheduledBillingMonths } from "@/lib/invoices/billing";

export const maxDuration = 60;

export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SECRET_KEY;
  const authorization = request.headers.get("authorization");
  if (!url || !serviceKey || !authorization?.startsWith("Bearer ")) {
    return Response.json({ error: "Nicht autorisiert." }, { status: 401 });
  }
  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const isCron = Boolean(process.env.CRON_SECRET) && authorization === `Bearer ${process.env.CRON_SECRET}`;
  let creatorId: string;
  if (isCron) {
    const { data } = await admin.from("members").select("id").eq("role", "admin").eq("active", true).order("created_at").limit(1).single();
    if (!data) return Response.json({ error: "Kein aktiver Admin vorhanden." }, { status: 409 });
    creatorId = data.id;
  } else {
    const { data } = await admin.auth.getUser(authorization.slice(7));
    if (!data.user) return Response.json({ error: "Nicht angemeldet." }, { status: 401 });
    const { data: member } = await admin.from("members").select("role,active").eq("id", data.user.id).single();
    if (member?.role !== "admin" || !member.active) return Response.json({ error: "Kein Zugriff." }, { status: 403 });
    creatorId = data.user.id;
  }
  const body = await request.json().catch(() => null) as { billingMonth?: unknown } | null;
  if (!body || (body.billingMonth !== undefined && (typeof body.billingMonth !== "string" || !isBillingMonth(body.billingMonth)))) {
    return Response.json({ error: "Ungültiger Abrechnungsmonat." }, { status: 400 });
  }
  const scheduled = scheduledBillingMonths();
  const months = typeof body.billingMonth === "string" ? [body.billingMonth] : scheduled;
  if (months.some((month) => month > scheduled[scheduled.length - 1])) {
    return Response.json({ error: "Der Folgemonat kann erst ab dem 25. abgerechnet werden." }, { status: 409 });
  }
  // An interrupted process remains visibly unfinished in the admin log.
  const { data: run, error: runError } = await admin.from("billing_runs").insert({}).select("id").single();
  if (runError || !run) return Response.json({ error: "Abrechnungsprotokoll nicht verfügbar. Bitte Datenbankmigration prüfen." }, { status: 503 });
  let created = 0;
  let skipped = 0;
  const errors: Array<{ memberId?: string; name?: string; month?: string; message: string }> = [];
  const { data: members, error } = await admin.from("members").select("id,name")
    .eq("active", true).in("role", ["member", "partner", "admin"]).not("monthly_rent_net", "is", null);
  if (error) errors.push({ message: "Mieter konnten nicht geladen werden." });
  for (const month of months) {
    for (const member of members ?? []) {
      const { data, error: invoiceError } = await admin.rpc("create_monthly_invoice", {
        target_member_id: member.id, target_month: month, creator_id: creatorId,
      });
      if (invoiceError) {
        errors.push({ memberId: member.id, name: member.name, month,
          message: invoiceError.message.includes("billing_profile_incomplete")
            ? "Rechnungsadresse oder Vertragsbeginn fehlt."
            : "Erstellung fehlgeschlagen. Bitte erneut prüfen." });
      } else if (data?.created) created += 1;
      else skipped += 1;
    }
  }
  const { error: logError } = await admin.from("billing_runs").update({
    finished_at: new Date().toISOString(), created_count: created, skipped_count: skipped, errors,
  }).eq("id", run.id);
  if (logError) errors.push({ message: "Abschluss des Abrechnungslaufs konnte nicht protokolliert werden." });
  return Response.json({
    created, skipped, errors,
    ...(errors.length ? { error: `${errors.length} Problem(e) bei der Abrechnung. Details im Admin-Bereich.` } : {}),
  }, { status: errors.length ? 500 : 200 });
}
