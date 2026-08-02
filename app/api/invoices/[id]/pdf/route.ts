import { createClient } from "@supabase/supabase-js";
import { createInvoicePdf } from "@/lib/invoices/pdf";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SECRET_KEY;
  const authorization = request.headers.get("authorization");
  if (!url || !serviceKey || !authorization?.startsWith("Bearer ")) {
    return Response.json({ error: "Nicht autorisiert." }, { status: 401 });
  }

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: userData } = await admin.auth.getUser(authorization.slice(7));
  if (!userData.user) return Response.json({ error: "Nicht angemeldet." }, { status: 401 });

  const { id } = await context.params;
  const { data: invoice } = await admin
    .from("invoices")
    .select(`
      id, member_id, invoice_number, status, issue_date, due_date,
      service_period_start, service_period_end,
      members!invoices_member_id_fkey(billing_name,billing_address,billing_uid,name),
      invoice_items(description,quantity,unit,unit_price_net,vat_rate,sort_order)
    `)
    .eq("id", id)
    .single();
  if (!invoice) return Response.json({ error: "Rechnung nicht gefunden." }, { status: 404 });

  const { data: requestingMember } = await admin
    .from("members")
    .select("role,active")
    .eq("id", userData.user.id)
    .single();
  const allowed =
    requestingMember?.active &&
    (requestingMember.role === "admin" ||
      (["member", "partner"].includes(requestingMember.role) && invoice.member_id === userData.user.id));
  if (!allowed) return Response.json({ error: "Kein Zugriff." }, { status: 403 });

  const recipient = Array.isArray(invoice.members) ? invoice.members[0] : invoice.members;
  const items = [...(invoice.invoice_items ?? [])].sort((a, b) => a.sort_order - b.sort_order);
  const bytes = await createInvoicePdf({
    number: invoice.invoice_number ?? `ENTWURF-${invoice.id.slice(0, 8).toUpperCase()}`,
    issueDate: new Date(invoice.issue_date).toLocaleDateString("de-AT"),
    dueDate: new Date(invoice.due_date).toLocaleDateString("de-AT"),
    servicePeriod: `${new Date(invoice.service_period_start).toLocaleDateString("de-AT")} bis ${new Date(invoice.service_period_end).toLocaleDateString("de-AT")}`,
    recipientName: recipient?.billing_name ?? recipient?.name ?? "Mitglied",
    recipientAddress: recipient?.billing_address ?? "Rechnungsadresse nicht hinterlegt",
    recipientUid: recipient?.billing_uid,
    items: items.map((item) => ({
      description: item.description,
      quantity: Number(item.quantity),
      unit: item.unit,
      unitPriceNet: Number(item.unit_price_net),
      vatRate: Number(item.vat_rate),
    })),
  });

  const safeNumber = (invoice.invoice_number ?? `Entwurf-${invoice.id.slice(0, 8)}`).replace(/[^A-Za-z0-9-]/g, "-");
  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="Rechnung-${safeNumber}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
