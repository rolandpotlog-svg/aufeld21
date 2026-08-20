import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
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
  if (!userData.user) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }

  const { data: requester } = await admin
    .from("members")
    .select("role,active")
    .eq("id", userData.user.id)
    .single();
  if (requester?.role !== "admin" || !requester.active) {
    return NextResponse.json({ error: "Nur Administratoren dürfen Passwort-Links versenden." }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as { memberId?: string };
  if (!body.memberId) {
    return NextResponse.json({ error: "Mitglied fehlt." }, { status: 400 });
  }

  const { data: target } = await admin
    .from("members")
    .select("email,name,active")
    .eq("id", body.memberId)
    .single();
  if (!target?.email) {
    return NextResponse.json({ error: "Für dieses Mitglied ist keine E-Mail-Adresse hinterlegt." }, { status: 404 });
  }
  if (!target.active) {
    return NextResponse.json({ error: "Der Zugang ist deaktiviert. Aktiviere ihn zuerst wieder." }, { status: 409 });
  }

  const { error } = await admin.auth.resetPasswordForEmail(target.email, {
    redirectTo: `${new URL(request.url).origin}/portal?setup=password`,
  });
  if (error) {
    return NextResponse.json(
      { error: "Der Passwort-Link konnte gerade nicht versendet werden. Bitte SMTP und Versandlimit prüfen." },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true, recipient: target.email, name: target.name });
}
