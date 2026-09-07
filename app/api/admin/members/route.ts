import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { formatInTimeZone } from "date-fns-tz";
import { isPackageId, packages, type MeetingUsage, type PackageId } from "@/lib/members/packages";

export async function GET(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SECRET_KEY;
  const authorization = request.headers.get("authorization");
  if (!url || !serviceKey || !authorization?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Nicht autorisiert." }, { status: 401 });
  }
  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: userData } = await admin.auth.getUser(authorization.slice(7));
  if (!userData.user) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  const { data: requester } = await admin.from("members").select("role,active").eq("id", userData.user.id).single();
  if (requester?.role !== "admin" || !requester.active) {
    return NextResponse.json({ error: "Nur Administratoren dürfen Abrechnungsdaten sehen." }, { status: 403 });
  }
  const { data: members, error } = await admin
    .from("members")
    .select("id,email,name,role,plan,active,office_name,billing_name,billing_address,billing_uid,monthly_rent_net,contract_start,contract_end")
    .order("name");
  if (error) return NextResponse.json({ error: "Mitglieder konnten nicht geladen werden." }, { status: 500 });
  const { data: quotas, error: quotaError } = await admin.rpc('meeting_usage', { target_month: formatInTimeZone(new Date(), 'Europe/Vienna', 'yyyy-MM-01') });
  if (quotaError) return NextResponse.json({ error: 'Meetingkontingente konnten nicht geladen werden.' }, { status: 503 });
  if (!quotas || members.some(item => !(quotas as MeetingUsage[]).some(row => row.member_id === item.id))) {
    return NextResponse.json({ error: 'Ein Meetingkontingent fehlt. Bitte die Konfiguration prüfen.' }, { status: 503 });
  }
  return NextResponse.json({ members: members.map(item => {
    const quota = (quotas as MeetingUsage[]).find(row => row.member_id === item.id)!;
    return { ...item, includedHours: Number(quota.included_hours), meetingPackage: quota.package, meetingAccountId: quota.account_id, usedHours: Number(quota.used_hours), bonusHours: Number(quota.bonus_hours) };
  }) }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SECRET_KEY;
  const authorization = request.headers.get("authorization");

  if (!url || !serviceKey) {
    return NextResponse.json({ error: "Die Admin-Verbindung ist noch nicht eingerichtet." }, { status: 503 });
  }
  if (!authorization?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const token = authorization.slice(7);
  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData.user) {
    return NextResponse.json({ error: "Die Anmeldung ist nicht mehr gültig." }, { status: 401 });
  }

  const { data: requestingMember } = await admin
    .from("members")
    .select("role,active")
    .eq("id", userData.user.id)
    .single();
  if (requestingMember?.role !== "admin" || !requestingMember.active) {
    return NextResponse.json({ error: "Nur Administratoren dürfen Mitglieder einladen." }, { status: 403 });
  }

  const body = (await request.json()) as { name?: string; email?: string; role?: "member" | "partner" | "employee"; package?: PackageId };
  const name = body.name?.trim();
  const email = body.email?.trim().toLowerCase();
  const role = body.role === "employee" || body.role === "partner" ? body.role : "member";
  const packageId = body.package ?? 'pro';
  if (!isPackageId(packageId) || ['shared', 'custom'].includes(packageId)) return NextResponse.json({ error: 'Bitte ein gültiges Startpaket auswählen.' }, { status: 400 });
  if (!name || !email || !email.includes("@")) {
    return NextResponse.json({ error: "Name und gültige E-Mail-Adresse sind erforderlich." }, { status: 400 });
  }

  const { data: inviteData, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { name },
    redirectTo: `${new URL(request.url).origin}/portal?setup=password`,
  });
  if (inviteError || !inviteData.user) {
    return NextResponse.json(
      { error: inviteError?.message.includes("already") ? "Für diese E-Mail existiert bereits ein Zugang." : "Die Einladung konnte nicht versendet werden." },
      { status: 400 },
    );
  }

  const { error: memberError } = await admin.from("members").insert({
    id: inviteData.user.id,
    email,
    name,
    role,
    plan: "pro",
    active: true,
  });
  if (memberError) {
    await admin.auth.admin.deleteUser(inviteData.user.id);
    return NextResponse.json({ error: "Das Mitglied konnte nicht angelegt werden." }, { status: 500 });
  }

  if (packageId !== 'pro') {
    const { error: termsError } = await admin.rpc('set_meeting_terms', { target_member: inviteData.user.id,
      target_month: formatInTimeZone(new Date(), 'Europe/Vienna', 'yyyy-MM-01'), target_package: packageId,
      target_hours: packages[packageId].hours, target_account: inviteData.user.id, creator_id: userData.user.id });
    if (termsError) return NextResponse.json({ error: 'Der Zugang und die Einladung wurden bereits erstellt. Das gewählte Kontingent konnte nicht gespeichert werden. Bitte in der Mieterkarte unter Meetingkontingent prüfen; nicht erneut einladen.' }, { status: 409 });
  }
  return NextResponse.json({ id: inviteData.user.id, email, name, role });
}

export async function PATCH(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SECRET_KEY;
  const authorization = request.headers.get("authorization");
  if (!url || !serviceKey || !authorization?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Nicht autorisiert." }, { status: 401 });
  }
  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: userData } = await admin.auth.getUser(authorization.slice(7));
  if (!userData.user) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  const { data: requester } = await admin.from("members").select("role,active").eq("id", userData.user.id).single();
  if (requester?.role !== "admin" || !requester.active) {
    return NextResponse.json({ error: "Nur Administratoren dürfen Abrechnungsdaten ändern." }, { status: 403 });
  }
  const body = (await request.json()) as {
    id?: string;
    office_name?: string | null;
    billing_name?: string | null;
    billing_address?: string | null;
    billing_uid?: string | null;
    monthly_rent_net?: number | null;
    contract_start?: string | null;
    contract_end?: string | null;
    active?: boolean;
  };
  if (!body.id) return NextResponse.json({ error: "Mitglied fehlt." }, { status: 400 });
  if (body.active !== undefined) {
    const { data: target } = await admin.from("members").select("role").eq("id", body.id).single();
    if (body.id === userData.user.id || target?.role === "admin") {
      return NextResponse.json({ error: "Administratoren können sich nicht selbst deaktivieren." }, { status: 400 });
    }
  }
  const allowedChanges = {
    office_name: body.office_name,
    billing_name: body.billing_name,
    billing_address: body.billing_address,
    billing_uid: body.billing_uid,
    monthly_rent_net: body.monthly_rent_net,
    contract_start: body.contract_start,
    contract_end: body.contract_end,
    active: body.active,
  };
  const changes = Object.fromEntries(Object.entries(allowedChanges).filter(([, value]) => value !== undefined));
  const { error } = await admin.from("members").update(changes).eq("id", body.id);
  if (error) return NextResponse.json({ error: "Abrechnungsdaten konnten nicht gespeichert werden." }, { status: 400 });
  return NextResponse.json({ ok: true });
}
