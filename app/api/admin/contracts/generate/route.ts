import { createClient } from "@supabase/supabase-js";
import { formatInTimeZone } from "date-fns-tz";
import { createContractPdf } from "@/lib/contracts/pdf";

const TZ = "Europe/Vienna";

export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SECRET_KEY;
  const authorization = request.headers.get("authorization");
  if (!url || !serviceKey || !authorization?.startsWith("Bearer ")) return Response.json({ error: "Nicht autorisiert." }, { status: 401 });
  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: userData } = await admin.auth.getUser(authorization.slice(7));
  if (!userData.user) return Response.json({ error: "Nicht angemeldet." }, { status: 401 });
  const { data: requester } = await admin.from("members").select("role,active").eq("id", userData.user.id).single();
  if (requester?.role !== "admin" || !requester.active) return Response.json({ error: "Nur Administratoren dürfen Verträge erzeugen." }, { status: 403 });

  const body = await request.json() as { memberId?: string; representative?: string; companyRegister?: string; phone?: string; contractEnd?: string; officeArea?: string };
  if (!body.memberId || !body.representative?.trim() || !body.companyRegister?.trim() || !body.contractEnd?.match(/^\d{4}-\d{2}-\d{2}$/)) {
    return Response.json({ error: "Vertretung, Firmenbuchnummer und Vertragsende sind erforderlich." }, { status: 400 });
  }
  const { data: member } = await admin.from("members").select("id,email,name,role,office_name,billing_name,billing_address,billing_uid,monthly_rent_net,contract_start").eq("id", body.memberId).single();
  if (!member || !["member", "admin"].includes(member.role) || !member.billing_address || member.monthly_rent_net == null || !member.contract_start) {
    return Response.json({ error: "Die Mieter- und Abrechnungsdaten sind noch unvollständig." }, { status: 409 });
  }
  const { data: deposit } = await admin.from("member_deposits").select("agreed_amount").eq("member_id", member.id).maybeSingle();
  const createdOn = formatInTimeZone(new Date(), TZ, "dd.MM.yyyy");
  const bytes = await createContractPdf({
    tenantName: member.billing_name || member.name,
    tenantAddress: member.billing_address,
    tenantUid: member.billing_uid,
    representative: body.representative.trim(),
    companyRegister: body.companyRegister.trim(),
    phone: body.phone?.trim(),
    email: member.email,
    officeName: member.office_name || "Büro",
    officeArea: body.officeArea?.trim(),
    contractStart: new Date(member.contract_start).toLocaleDateString("de-AT"),
    contractEnd: new Date(body.contractEnd).toLocaleDateString("de-AT"),
    monthlyRentNet: Number(member.monthly_rent_net),
    deposit: Number(deposit?.agreed_amount ?? 0),
    createdOn,
  });
  const dateStamp = formatInTimeZone(new Date(), TZ, "yyyy-MM-dd");
  const storagePath = `${member.id}/vertraege/nutzungsvereinbarung-entwurf-${dateStamp}-${crypto.randomUUID()}.pdf`;
  const upload = await admin.storage.from("member-documents").upload(storagePath, bytes, { contentType: "application/pdf" });
  if (upload.error) return Response.json({ error: "Der Vertragsentwurf konnte nicht abgelegt werden." }, { status: 500 });
  const title = `Nutzungsvereinbarung - Entwurf ${dateStamp}`;
  const { error: documentError } = await admin.from("member_documents").insert({ member_id: member.id, document_type: "mietvertrag", title, storage_path: storagePath, visible_to_member: true, valid_from: member.contract_start, valid_until: body.contractEnd, uploaded_by: userData.user.id });
  if (documentError) { await admin.storage.from("member-documents").remove([storagePath]); return Response.json({ error: "Der Vertragsentwurf konnte nicht registriert werden." }, { status: 500 }); }
  await admin.from("members").update({ contract_end: body.contractEnd }).eq("id", member.id);
  return new Response(Buffer.from(bytes), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="Nutzungsvereinbarung-${member.name.replace(/[^A-Za-z0-9-]/g, "-")}-Entwurf.pdf"`, "Cache-Control": "private, no-store", "X-Document-Title": encodeURIComponent(title) } });
}
