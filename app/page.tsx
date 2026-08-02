"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import {
  addDays,
  addWeeks,
  eachDayOfInterval,
  endOfWeek,
  format,
  isSameDay,
  isSameWeek,
  startOfMonth,
  startOfWeek,
  addMonths,
} from "date-fns";
import { de } from "date-fns/locale";
import { formatInTimeZone, fromZonedTime, toZonedTime } from "date-fns-tz";
import {
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Clock3,
  DoorOpen,
  Download,
  FileText,
  LogOut,
  Plus,
  Send,
  ShieldCheck,
  Snowflake,
  Trash2,
  Upload,
  Utensils,
  Users,
  Wifi,
  Wrench,
  X,
} from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { SpacePlan } from "./space-plan";

const TZ = "Europe/Vienna";
const SLOT_HEIGHT = 52;
const START_HOUR = 7;
const END_HOUR = 20;

type Member = {
  id: string;
  email: string;
  name: string;
  role: "member" | "partner" | "employee" | "admin";
  plan: "pro";
  active: boolean;
};
type ManagedMember = Member & {
  usedHours: number;
  bonusHours: number;
  office_name?: string | null;
  billing_name?: string | null;
  billing_address?: string | null;
  billing_uid?: string | null;
  monthly_rent_net?: number | null;
  contract_start?: string | null;
  contract_end?: string | null;
};
type Booking = {
  id: string;
  member_id: string;
  start_at: string;
  end_at: string;
  note: string | null;
  members: { name: string } | { name: string }[] | null;
};

type Draft = { date: string; start: string; end: string; note: string };
type IssueDraft = { category: string; note: string };
type IssueReport = { id: string; member_id: string; category: string; note: string | null; status: "open" | "resolved"; created_at: string; members?: { name: string } | null };
type Invoice = {
  id: string;
  member_id: string;
  invoice_number: string | null;
  status: "draft" | "final" | "paid" | "cancelled";
  issue_date: string;
  due_date: string;
  billing_month: string;
  paid_at?: string | null;
  members?: { name: string; email?: string | null; billing_name?: string | null } | null;
  invoice_items: Array<{
    description: string;
    quantity: number;
    unit: string;
    unit_price_net: number;
    vat_rate: number;
  }>;
};
type Deposit = { member_id: string; agreed_amount: number; received_amount: number; returned_amount: number; received_at: string | null; note: string | null };
type MemberDocument = { id: string; member_id: string; document_type: "mietvertrag" | "hausordnung" | "sonstiges"; title: string; storage_path: string; visible_to_member: boolean; valid_until: string | null; created_at: string };

function makeDemoBookings(): Booking[] {
  const monday = startOfWeek(toZonedTime(new Date(), TZ), { weekStartsOn: 1 });
  const make = (id: string, day: number, start: string, end: string, name: string, note: string | null, own = false): Booking => ({
    id,
    member_id: own ? "demo-member" : `demo-${name}`,
    start_at: fromZonedTime(`${format(addDays(monday, day), "yyyy-MM-dd")} ${start}:00`, TZ).toISOString(),
    end_at: fromZonedTime(`${format(addDays(monday, day), "yyyy-MM-dd")} ${end}:00`, TZ).toISOString(),
    note,
    members: { name },
  });
  return [
    make("demo-1", 0, "09:00", "10:30", "Anna", "Weekly Planning"),
    make("demo-2", 1, "13:00", "14:00", "Lukas", "Kundentermin"),
    make("demo-3", 2, "10:00", "11:30", "Roland", "Projektbesprechung", true),
    make("demo-4", 3, "15:30", "17:00", "Miriam", "Workshop"),
    make("demo-5", 4, "08:30", "09:30", "Roland", "Fokuszeit", true),
  ];
}

const times = Array.from({ length: (END_HOUR - START_HOUR) * 2 + 1 }, (_, index) => {
  const minutes = START_HOUR * 60 + index * 30;
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
});

function memberName(booking: Booking) {
  if (Array.isArray(booking.members)) return booking.members[0]?.name ?? "Mitglied";
  return booking.members?.name ?? "Mitglied";
}

function utcCalendarStamp(iso: string) {
  return formatInTimeZone(new Date(iso), "UTC", "yyyyMMdd'T'HHmmss'Z'");
}

function draftDurationHours(draft: Draft) {
  const [startHour, startMinute] = draft.start.split(":").map(Number);
  const [endHour, endMinute] = draft.end.split(":").map(Number);
  return Math.max((endHour * 60 + endMinute - startHour * 60 - startMinute) / 60, 0);
}

function invoiceGross(invoice: Invoice) {
  return invoice.invoice_items.reduce(
    (sum, item) => sum + Number(item.quantity) * Number(item.unit_price_net) * (1 + Number(item.vat_rate) / 100),
    0,
  );
}

function googleCalendarUrl(booking: Booking) {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `Meetingraum – ${memberName(booking)}`,
    dates: `${utcCalendarStamp(booking.start_at)}/${utcCalendarStamp(booking.end_at)}`,
    details: booking.note ?? "Meetingraum im Co-Working-Space",
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export default function Home() {
  const configured =
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);

  if (!configured) {
    return <BookingApp demo />;
  }

  return <BookingApp demo={false} />;
}

function BookingApp({ demo }: { demo: boolean }) {
  const supabase = useMemo(() => (demo ? null : getSupabaseBrowserClient()), [demo]);
  const [session, setSession] = useState<Session | null>(null);
  const [member, setMember] = useState<Member | null>(
    demo ? { id: "demo-member", email: "demo@aufeld21.at", name: "Roland", role: "admin", plan: "pro", active: true } : null,
  );
  const [authReady, setAuthReady] = useState(demo);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [sendingLink, setSendingLink] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [showMagicLink, setShowMagicLink] = useState(false);
  const [passwordSetup, setPasswordSetup] = useState(
    () => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("setup") === "password",
  );
  const [weekStart, setWeekStart] = useState(() =>
    startOfWeek(toZonedTime(new Date(), TZ), { weekStartsOn: 1 }),
  );
  const [bookings, setBookings] = useState<Booking[]>(() => (demo ? makeDemoBookings() : []));
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [toast, setToast] = useState("");
  const [view, setView] = useState<"dashboard" | "calendar" | "tour" | "about" | "admin">("dashboard");
  const [adminTab, setAdminTab] = useState<"overview" | "people" | "invoices" | "documents">("overview");
  const [issueDraft, setIssueDraft] = useState<IssueDraft | null>(null);
  const [sendingIssue, setSendingIssue] = useState(false);
  const [issueError, setIssueError] = useState("");
  const [issueReports, setIssueReports] = useState<IssueReport[]>(demo ? [
    { id: "issue-1", member_id: "demo-anna", category: "Drucker", note: "Papierstau im großen Drucker.", status: "open", created_at: "2026-08-01T07:30:00Z", members: { name: "Anna" } },
    { id: "issue-2", member_id: "demo-romeo", category: "Kaffee", note: "Kaffeebohnen werden knapp.", status: "open", created_at: "2026-08-01T08:15:00Z", members: { name: "Romeo" } },
  ] : []);
  const [managedMembers, setManagedMembers] = useState<ManagedMember[]>(demo ? [
    { id: "demo-member", email: "roland@aufeld21.at", name: "Roland", role: "admin", plan: "pro", active: true, usedHours: 3.5, bonusHours: 2, office_name: "Büro 2", billing_name: "Roland Potlog", billing_address: "Musterstrasse 12\n4050 Traun, Oesterreich", monthly_rent_net: 250, contract_start: "2026-08-01" },
    { id: "demo-anna", email: "anna@studio-nord.at", name: "Anna", role: "member", plan: "pro", active: true, usedHours: 8.5, bonusHours: 0, office_name: "Büro 3", billing_name: "Studio Nord", billing_address: "Landstrasse 4\n4020 Linz, Oesterreich", billing_uid: "ATU12345678", monthly_rent_net: 390, contract_start: "2026-03-15", contract_end: "2029-07-31" },
    { id: "demo-lukas", email: "lukas@formwerk.at", name: "Lukas", role: "member", plan: "pro", active: true, usedHours: 12.5, bonusHours: 1, billing_name: "Formwerk e.U.", billing_address: "Hauptplatz 8\n4050 Traun, Oesterreich", monthly_rent_net: 360, contract_start: "2026-05-01" },
    { id: "demo-miriam", email: "miriam@klartext.at", name: "Miriam", role: "member", plan: "pro", active: true, usedHours: 5, bonusHours: 0, billing_name: "Miriam Huber", billing_address: "Bahnhofstrasse 3\n4060 Leonding, Oesterreich", monthly_rent_net: 340, contract_start: "2026-07-10" },
    { id: "demo-kylian", email: "kylian@aufeld21.at", name: "Kylian", role: "employee", plan: "pro", active: true, usedHours: 4, bonusHours: 2 },
    { id: "demo-romeo", email: "romeo@aufeld21.at", name: "Romeo", role: "employee", plan: "pro", active: true, usedHours: 1.5, bonusHours: 0 },
    { id: "demo-daniel", email: "daniel@beispiel.at", name: "Daniel", role: "partner", plan: "pro", active: true, usedHours: 6, bonusHours: 2, office_name: "Büro 4 · Flexbüro", billing_name: "Daniel", monthly_rent_net: 125 },
    { id: "demo-slavin", email: "slavin@beispiel.at", name: "Slavin", role: "partner", plan: "pro", active: true, usedHours: 3.5, bonusHours: 0, office_name: "Büro 4 · Flexbüro", billing_name: "Slavin", monthly_rent_net: 125 },
  ] : []);
  const [bonusTarget, setBonusTarget] = useState<ManagedMember | null>(null);
  const [bonusAmount, setBonusAmount] = useState("2");
  const [monthlyUsedHours, setMonthlyUsedHours] = useState(demo ? 3.5 : 0);
  const [monthlyBonusHours, setMonthlyBonusHours] = useState(demo ? 2 : 0);
  const [inviteDraft, setInviteDraft] = useState<{ name: string; email: string; role: "member" | "partner" | "employee" } | null>(null);
  const [paymentDraft, setPaymentDraft] = useState<{ invoice: Invoice; paidOn: string } | null>(null);
  const [inviteError, setInviteError] = useState("");
  const [inviting, setInviting] = useState(false);
  const [invoices, setInvoices] = useState<Invoice[]>(demo ? [
    {
      id: "demo-invoice-1",
      member_id: "demo-member",
      invoice_number: "A21-2026-0007",
      status: "final",
      issue_date: "2026-07-01",
      due_date: "2026-07-15",
      billing_month: "2026-07-01",
      members: { name: "Roland", email: "roland@aufeld21.at", billing_name: "Roland Potlog" },
      invoice_items: [
        { description: "Grundmiete AUFELD21 2026-07", quantity: 1, unit: "Monat", unit_price_net: 420, vat_rate: 20 },
        { description: "Meetingraum Zusatznutzung 2026-06", quantity: 1.5, unit: "Std.", unit_price_net: 12, vat_rate: 20 },
      ],
    },
    {
      id: "demo-invoice-2",
      member_id: "demo-anna",
      invoice_number: null,
      status: "draft",
      issue_date: "2026-07-31",
      due_date: "2026-08-14",
      billing_month: "2026-08-01",
      members: { name: "Anna", email: "anna@studio-nord.at", billing_name: "Studio Nord" },
      invoice_items: [
        { description: "Grundmiete AUFELD21 2026-08", quantity: 1, unit: "Monat", unit_price_net: 390, vat_rate: 20 },
      ],
    },
    {
      id: "demo-invoice-daniel",
      member_id: "demo-daniel",
      invoice_number: "A21-2026-0008",
      status: "final",
      issue_date: "2026-08-01",
      due_date: "2026-08-15",
      billing_month: "2026-08-01",
      members: { name: "Daniel", email: "daniel@beispiel.at", billing_name: "Daniel" },
      invoice_items: [{ description: "Nutzung AUFELD21 2026-08", quantity: 1, unit: "Monat", unit_price_net: 125, vat_rate: 20 }],
    },
    {
      id: "demo-invoice-slavin",
      member_id: "demo-slavin",
      invoice_number: "A21-2026-0009",
      status: "paid",
      issue_date: "2026-08-01",
      due_date: "2026-08-15",
      billing_month: "2026-08-01",
      paid_at: "2026-08-01T00:00:00.000Z",
      members: { name: "Slavin", email: "slavin@beispiel.at", billing_name: "Slavin" },
      invoice_items: [{ description: "Nutzung AUFELD21 2026-08", quantity: 1, unit: "Monat", unit_price_net: 125, vat_rate: 20 }],
    },
  ] : []);
  const [generatingInvoices, setGeneratingInvoices] = useState(false);
  const [invoiceMemberFilter, setInvoiceMemberFilter] = useState("all");
  const [billingMember, setBillingMember] = useState<ManagedMember | null>(null);
  const [selectedDossierId, setSelectedDossierId] = useState(demo ? "demo-anna" : "");
  const [deposits, setDeposits] = useState<Deposit[]>(demo ? [
    { member_id: "demo-member", agreed_amount: 0, received_amount: 0, returned_amount: 0, received_at: null, note: "Keine Kaution vereinbart" },
    { member_id: "demo-anna", agreed_amount: 780, received_amount: 780, returned_amount: 0, received_at: "2026-03-10", note: null },
    { member_id: "demo-lukas", agreed_amount: 720, received_amount: 500, returned_amount: 0, received_at: "2026-05-01", note: "Restbetrag offen" },
  ] : []);
  const [documents, setDocuments] = useState<MemberDocument[]>(demo ? [
    { id: "doc-1", member_id: "demo-member", document_type: "mietvertrag", title: "Mietvertrag AUFELD21", storage_path: "demo", visible_to_member: true, valid_until: null, created_at: "2026-01-01" },
    { id: "doc-2", member_id: "demo-member", document_type: "hausordnung", title: "Hausordnung - Version 2026", storage_path: "demo", visible_to_member: true, valid_until: null, created_at: "2026-01-01" },
  ] : []);
  const [depositMember, setDepositMember] = useState<ManagedMember | null>(null);

  useEffect(() => {
    if (!supabase) return;
    const db = supabase;
    let active = true;
    db.auth.getSession().then(({ data }) => {
      if (active) setSession(data.session);
    });
    const { data } = db.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);
      if (event === "PASSWORD_RECOVERY") setPasswordSetup(true);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    if (!supabase) return;
    const db = supabase;
    let active = true;
    async function loadMember() {
      if (!session?.user) {
        setMember(null);
        setAuthReady(true);
        return;
      }
      const { data } = await db
        .from("members")
        .select("id,email,name,role,plan,active")
        .eq("id", session.user.id)
        .maybeSingle();
      if (!active) return;
      if (!data || !data.active) {
        await db.auth.signOut();
        setAuthMessage("Diese E-Mail ist nicht für den Raumkalender freigeschaltet. Bitte wende dich an die Person, die den Space verwaltet.");
        setMember(null);
      } else {
        setMember(data);
      }
      setAuthReady(true);
    }
    loadMember();
    return () => {
      active = false;
    };
  }, [session, supabase]);

  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });
  const includedHours = 12;
  const availableHours = includedHours + monthlyBonusHours;
  const remainingHours = Math.max(availableHours - monthlyUsedHours, 0);
  const billableHours = Math.max(monthlyUsedHours - availableHours, 0);
  const billableNet = member?.role === "employee" ? 0 : billableHours * 12;
  const billingMembers = managedMembers.filter((item) => item.active && (item.role === "member" || item.role === "partner" || item.role === "admin"));
  const currentBillingMonth = formatInTimeZone(new Date(), TZ, "yyyy-MM-01");
  const monthlyGrossTarget = billingMembers.reduce((sum, item) => sum + Number(item.monthly_rent_net ?? 0) * 1.2, 0);
  const paidThisMonthGross = invoices.filter((invoice) => invoice.status === "paid" && invoice.paid_at && formatInTimeZone(invoice.paid_at, TZ, "yyyy-MM") === currentBillingMonth.slice(0, 7)).reduce((sum, invoice) => sum + invoiceGross(invoice), 0);
  const openInvoices = invoices.filter((invoice) => invoice.status === "final");
  const openInvoiceGross = openInvoices.reduce((sum, invoice) => sum + invoiceGross(invoice), 0);
  const overdueInvoices = openInvoices.filter((invoice) => new Date(`${invoice.due_date}T23:59:59`) < new Date());
  const draftInvoices = invoices.filter((invoice) => invoice.status === "draft");
  const visibleAdminInvoices = invoices.filter(
    (invoice) => invoice.status !== "cancelled" && (invoiceMemberFilter === "all" || invoice.member_id === invoiceMemberFilter),
  );
  const invoiceGroups = managedMembers
    .map((managedMember) => ({
      member: managedMember,
      invoices: visibleAdminInvoices.filter((invoice) => invoice.member_id === managedMember.id),
    }))
    .filter((group) => group.invoices.length > 0);
  const missingBillingProfiles = billingMembers.filter((item) => !item.billing_address || item.monthly_rent_net == null || !item.contract_start);
  const tenantDepositIssues = managedMembers.filter((item) => item.role === "member" || item.role === "admin").filter((item) => {
    const deposit = deposits.find((entry) => entry.member_id === item.id);
    return !deposit || Number(deposit.received_amount) < Number(deposit.agreed_amount);
  });
  const totalUsedHours = managedMembers.reduce((sum, item) => sum + Number(item.usedHours), 0);
  const openIssueReports = issueReports.filter((item) => item.status === "open");
  const selectedDossier = managedMembers.find((item) => item.id === selectedDossierId)
    ?? managedMembers.find((item) => item.role === "member" || item.role === "partner")
    ?? managedMembers[0];
  const dossierInvoices = selectedDossier
    ? invoices.filter((invoice) => invoice.member_id === selectedDossier.id && invoice.status !== "cancelled")
    : [];
  const dossierDocuments = selectedDossier ? documents.filter((document) => document.member_id === selectedDossier.id) : [];
  const dossierDeposit = selectedDossier ? deposits.find((deposit) => deposit.member_id === selectedDossier.id) : undefined;

  useEffect(() => {
    if (!member || !supabase) return;
    const db = supabase;
    let active = true;
    async function loadBookings() {
      setLoadingBookings(true);
      const utcStart = fromZonedTime(format(weekStart, "yyyy-MM-dd 00:00:00"), TZ);
      const utcEnd = fromZonedTime(format(addDays(weekStart, 7), "yyyy-MM-dd 00:00:00"), TZ);
      const { data, error } = await db
        .from("bookings")
        .select("id,member_id,start_at,end_at,note,members(name)")
        .lt("start_at", utcEnd.toISOString())
        .gt("end_at", utcStart.toISOString())
        .order("start_at");
      if (active) {
        setBookings((data as Booking[]) ?? []);
        setLoadingBookings(false);
        if (error) setToast("Buchungen konnten gerade nicht geladen werden.");
      }
    }
    loadBookings();
    return () => {
      active = false;
    };
  }, [member, supabase, weekStart]);

  useEffect(() => {
    if (!member || !supabase) return;
    const db = supabase;
    const viennaNow = toZonedTime(new Date(), TZ);
    const monthStart = fromZonedTime(format(startOfMonth(viennaNow), "yyyy-MM-dd 00:00:00"), TZ);
    const monthEnd = fromZonedTime(format(addMonths(startOfMonth(viennaNow), 1), "yyyy-MM-dd 00:00:00"), TZ);
    Promise.all([
      db
        .from("bookings")
        .select("start_at,end_at")
        .eq("member_id", member.id)
        .gte("start_at", monthStart.toISOString())
        .lt("start_at", monthEnd.toISOString()),
      db
        .from("quota_adjustments")
        .select("hours")
        .eq("member_id", member.id)
        .eq("valid_month", format(viennaNow, "yyyy-MM-01")),
    ]).then(([bookingResult, bonusResult]) => {
      const used = (bookingResult.data ?? []).reduce(
        (sum, booking) => sum + (new Date(booking.end_at).getTime() - new Date(booking.start_at).getTime()) / 3_600_000,
        0,
      );
      const bonus = (bonusResult.data ?? []).reduce((sum, adjustment) => sum + Number(adjustment.hours), 0);
      setMonthlyUsedHours(used);
      setMonthlyBonusHours(bonus);
    });
  }, [member, supabase, bookings]);

  useEffect(() => {
    if (!member || !supabase) return;
    supabase
      .from("invoices")
      .select("id,member_id,invoice_number,status,issue_date,due_date,billing_month,paid_at,members!invoices_member_id_fkey(name,email),invoice_items(description,quantity,unit,unit_price_net,vat_rate)")
      .order("issue_date", { ascending: false })
      .then(({ data, error }) => {
        if (data) setInvoices(data as unknown as Invoice[]);
        if (error) setToast("Die Rechnungen konnten nicht geladen werden. Bitte die Seite neu laden.");
      });
  }, [member, supabase]);

  useEffect(() => {
    if (!member || !supabase) return;
    Promise.all([
      supabase.from("member_deposits").select("member_id,agreed_amount,received_amount,returned_amount,received_at,note"),
      supabase.from("member_documents").select("id,member_id,document_type,title,storage_path,visible_to_member,valid_until,created_at").order("created_at", { ascending: false }),
    ]).then(([depositResult, documentResult]) => {
      if (depositResult.data) setDeposits(depositResult.data as Deposit[]);
      if (documentResult.data) setDocuments(documentResult.data as MemberDocument[]);
    });
  }, [member, supabase]);

  useEffect(() => {
    if (!member || member.role !== "admin" || !supabase) return;
    const db = supabase;
    const now = toZonedTime(new Date(), TZ);
    const monthValue = format(now, "yyyy-MM-01");
    const monthStart = fromZonedTime(`${monthValue} 00:00:00`, TZ);
    const monthEnd = fromZonedTime(`${format(addMonths(startOfMonth(now), 1), "yyyy-MM-dd")} 00:00:00`, TZ);
    db.auth.getSession().then(({ data: sessionData }) =>
      Promise.all([
        fetch("/api/admin/members", { headers: { Authorization: `Bearer ${sessionData.session?.access_token ?? ""}` } }).then((response) => response.json()),
        db.from("bookings").select("member_id,start_at,end_at").gte("start_at", monthStart.toISOString()).lt("start_at", monthEnd.toISOString()),
        db.from("quota_adjustments").select("member_id,hours").eq("valid_month", monthValue),
      ]).then(([membersResult, bookingsResult, adjustmentsResult]) => {
        if (!membersResult.members) return;
        setManagedMembers(
          (membersResult.members as Array<Omit<ManagedMember, "usedHours" | "bonusHours">>).map((item) => ({
            ...item,
            usedHours: (bookingsResult.data ?? [])
              .filter((booking) => booking.member_id === item.id)
              .reduce((sum, booking) => sum + (new Date(booking.end_at).getTime() - new Date(booking.start_at).getTime()) / 3_600_000, 0),
            bonusHours: (adjustmentsResult.data ?? [])
              .filter((adjustment) => adjustment.member_id === item.id)
              .reduce((sum, adjustment) => sum + Number(adjustment.hours), 0),
          })),
        );
      }),
    );
  }, [member, supabase, bookings]);

  useEffect(() => {
    if (!member || member.role !== "admin" || !supabase) return;
    supabase.from("issue_reports").select("id,member_id,category,note,status,created_at,members(name)").order("created_at", { ascending: false }).then(({ data }) => {
      if (data) setIssueReports(data as unknown as IssueReport[]);
    });
  }, [member, supabase]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 4000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  async function sendMagicLink(event: React.FormEvent) {
    event.preventDefault();
    if (!supabase) return;
    setSendingLink(true);
    setAuthMessage("");
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: {
        shouldCreateUser: false,
        emailRedirectTo: window.location.origin,
      },
    });
    setSendingLink(false);
    setAuthMessage(
      error
        ? "Diese E-Mail ist nicht freigeschaltet oder der Link konnte nicht gesendet werden."
        : "Magic Link gesendet. Bitte öffne deine E-Mail – du kannst dieses Fenster offen lassen.",
    );
  }

  async function signInWithPassword(event: React.FormEvent) {
    event.preventDefault();
    if (!supabase) return;
    setAuthBusy(true);
    setAuthMessage("");
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    setAuthBusy(false);
    if (error) setAuthMessage("E-Mail-Adresse oder Passwort ist nicht richtig.");
  }

  async function sendPasswordReset() {
    if (!supabase || !email.trim()) {
      setAuthMessage("Bitte gib zuerst deine E-Mail-Adresse ein.");
      return;
    }
    setAuthBusy(true);
    setAuthMessage("");
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${window.location.origin}/?setup=password`,
    });
    setAuthBusy(false);
    setAuthMessage(
      error
        ? "Der Link konnte gerade nicht gesendet werden. Bitte versuche es später erneut."
        : "Wenn die E-Mail freigeschaltet ist, erhältst du jetzt einen Link zum Zurücksetzen.",
    );
  }

  async function saveNewPassword(event: React.FormEvent) {
    event.preventDefault();
    if (!supabase) return;
    if (newPassword.length < 8) {
      setAuthMessage("Das Passwort muss mindestens 8 Zeichen lang sein.");
      return;
    }
    setAuthBusy(true);
    setAuthMessage("");
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setAuthBusy(false);
    if (error) {
      setAuthMessage("Das Passwort konnte nicht gespeichert werden. Öffne den Einladungs- oder Reset-Link bitte erneut.");
      return;
    }
    setPasswordSetup(false);
    setNewPassword("");
    window.history.replaceState({}, "", window.location.pathname);
    setToast("Dein Passwort wurde gespeichert.");
  }

  function openBooking(day: Date, time: string) {
    const [hour, minute] = time.split(":").map(Number);
    const endMinutes = hour * 60 + minute + 60;
    setFormError("");
    setDraft({
      date: format(day, "yyyy-MM-dd"),
      start: time,
      end: `${String(Math.floor(endMinutes / 60)).padStart(2, "0")}:${String(endMinutes % 60).padStart(2, "0")}`,
      note: "",
    });
  }

  async function saveBooking(event: React.FormEvent) {
    event.preventDefault();
    if (!draft || !member) return;
    setSaving(true);
    setFormError("");
    const start = fromZonedTime(`${draft.date} ${draft.start}:00`, TZ);
    const end = fromZonedTime(`${draft.date} ${draft.end}:00`, TZ);
    if (end <= start) {
      setFormError("Die Endzeit muss nach der Startzeit liegen.");
      setSaving(false);
      return;
    }
    const requestedHours = (end.getTime() - start.getTime()) / 3_600_000;
    const bookingMonth = formatInTimeZone(start, TZ, "yyyy-MM");
    const currentMonth = formatInTimeZone(new Date(), TZ, "yyyy-MM");
    if (member.role === "employee" && bookingMonth === currentMonth && monthlyUsedHours + requestedHours > availableHours) {
      setFormError(`Dein Monatskontingent reicht für diese Buchung nicht aus. Verfügbar sind noch ${remainingHours.toLocaleString("de-AT")} Stunden. Bitte wende dich für Bonusstunden an Roland.`);
      setSaving(false);
      return;
    }
    if (!supabase) {
      const booking: Booking = {
        id: crypto.randomUUID(),
        member_id: member.id,
        start_at: start.toISOString(),
        end_at: end.toISOString(),
        note: draft.note.trim() || null,
        members: { name: member.name },
      };
      const overlaps = bookings.some(
        (item) => new Date(item.start_at) < end && new Date(item.end_at) > start,
      );
      setSaving(false);
      if (overlaps) {
        setFormError("Der Raum ist in diesem Zeitraum schon gebucht.");
        return;
      }
      setBookings((current) => [...current, booking].sort((a, b) => a.start_at.localeCompare(b.start_at)));
      if (format(start, "yyyy-MM") === format(new Date(), "yyyy-MM")) {
        setMonthlyUsedHours((current) => current + (end.getTime() - start.getTime()) / 3_600_000);
      }
      setDraft(null);
      setToast("Demo-Buchung gespeichert.");
      return;
    }
    const { data, error } = await supabase
      .from("bookings")
      .insert({
        member_id: member.id,
        start_at: start.toISOString(),
        end_at: end.toISOString(),
        note: draft.note.trim() || null,
      })
      .select("id,member_id,start_at,end_at,note,members(name)")
      .single();
    setSaving(false);
    if (error) {
      const overlap =
        error.code === "23P01" ||
        error.message.toLowerCase().includes("bookings_no_overlap");
      setFormError(
        overlap
          ? "Der Raum ist in diesem Zeitraum schon gebucht."
          : error.message.includes("employee_quota_exceeded")
            ? "Dein Monatskontingent ist ausgeschöpft. Bitte wende dich für Bonusstunden an Roland."
          : "Die Buchung konnte nicht gespeichert werden. Bitte versuche es noch einmal.",
      );
      return;
    }
    setBookings((current) =>
      [...current, data as Booking].sort((a, b) => a.start_at.localeCompare(b.start_at)),
    );
    setDraft(null);
    setToast("Der Raum ist gebucht.");
  }

  async function cancelBooking(booking: Booking) {
    if (!window.confirm("Diese Buchung wirklich stornieren?")) return;
    if (!supabase) {
      setBookings((current) => current.filter((item) => item.id !== booking.id));
      setMonthlyUsedHours((current) =>
        Math.max(current - (new Date(booking.end_at).getTime() - new Date(booking.start_at).getTime()) / 3_600_000, 0),
      );
      setToast("Demo-Buchung storniert.");
      return;
    }
    const { error } = await supabase.from("bookings").delete().eq("id", booking.id);
    if (error) {
      setToast("Die Buchung konnte nicht storniert werden.");
      return;
    }
    setBookings((current) => current.filter((item) => item.id !== booking.id));
    setToast("Buchung storniert.");
  }

  async function submitIssue(event: React.FormEvent) {
    event.preventDefault();
    if (!issueDraft || !member) return;
    setSendingIssue(true);
    setIssueError("");
    if (!supabase) {
      await new Promise((resolve) => window.setTimeout(resolve, 350));
      const newReport: IssueReport = {
        id: crypto.randomUUID(),
        member_id: member.id,
        category: issueDraft.category,
        note: issueDraft.note.trim() || null,
        status: "open",
        created_at: new Date().toISOString(),
        members: { name: member.name },
      };
      setIssueReports((current) => [newReport, ...current]);
      setSendingIssue(false);
      setIssueDraft(null);
      setToast("Danke! Deine Meldung wurde aufgenommen.");
      return;
    }
    const { error } = await supabase.from("issue_reports").insert({
      member_id: member.id,
      category: issueDraft.category,
      note: issueDraft.note.trim() || null,
    });
    setSendingIssue(false);
    if (error) {
      setIssueError("Die Meldung konnte gerade nicht gesendet werden. Bitte versuche es noch einmal.");
      return;
    }
    setIssueDraft(null);
    setToast("Danke! Deine Meldung wurde aufgenommen.");
  }

  async function resolveIssue(report: IssueReport) {
    if (supabase) {
      const { error } = await supabase.from("issue_reports").update({ status: "resolved" }).eq("id", report.id);
      if (error) {
        setToast("Die Meldung konnte nicht abgeschlossen werden.");
        return;
      }
    }
    setIssueReports((current) => current.map((item) => item.id === report.id ? { ...item, status: "resolved" } : item));
    setToast("Meldung als erledigt markiert.");
  }

  async function grantBonusHours(event: React.FormEvent) {
    event.preventDefault();
    if (!bonusTarget || !member) return;
    const hours = Number(bonusAmount);
    if (!Number.isFinite(hours) || hours <= 0 || hours % 0.5 !== 0) return;
    if (supabase) {
      const { error } = await supabase.from("quota_adjustments").insert({
        member_id: bonusTarget.id,
        hours,
        valid_month: format(toZonedTime(new Date(), TZ), "yyyy-MM-01"),
        reason: "Admin-Gutschrift",
        granted_by: member.id,
      });
      if (error) {
        setToast("Die Gutschrift konnte nicht gespeichert werden.");
        return;
      }
    }
    setManagedMembers((current) =>
      current.map((item) =>
        item.id === bonusTarget.id ? { ...item, bonusHours: item.bonusHours + hours } : item,
      ),
    );
    if (bonusTarget.id === member.id) setMonthlyBonusHours((current) => current + hours);
    setBonusTarget(null);
    setToast(`${hours.toLocaleString("de-AT")} Bonusstunden für ${bonusTarget.name} gutgeschrieben.`);
  }

  async function inviteMember(event: React.FormEvent) {
    event.preventDefault();
    if (!inviteDraft) return;
    setInviting(true);
    setInviteError("");
    if (!supabase) {
      setManagedMembers((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          email: inviteDraft.email.trim().toLowerCase(),
          name: inviteDraft.name.trim(),
          role: inviteDraft.role,
          plan: "pro",
          active: true,
          usedHours: 0,
          bonusHours: 0,
        },
      ]);
      setInviting(false);
      setInviteDraft(null);
      setToast(inviteDraft.role === "employee" ? "Demo-Mitarbeiter wurde angelegt." : inviteDraft.role === "partner" ? "Demo-Nutzungspartner wurde angelegt." : "Demo-Mieter wurde angelegt.");
      return;
    }
    const { data: sessionData } = await supabase.auth.getSession();
    const response = await fetch("/api/admin/members", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionData.session?.access_token ?? ""}`,
      },
      body: JSON.stringify(inviteDraft),
    });
    const result = await response.json().catch(() => ({}));
    setInviting(false);
    if (!response.ok) {
      setInviteError(result.error ?? "Die Einladung konnte nicht versendet werden.");
      return;
    }
    setInviteDraft(null);
    setToast("Persönlicher Zugang angelegt. Der Login-Link wurde versendet.");
  }

  async function downloadInvoice(invoice: Invoice) {
    if (!supabase) {
      const { createInvoicePdf } = await import("@/lib/invoices/pdf");
      const bytes = await createInvoicePdf({
        number: invoice.invoice_number ?? "ENTWURF",
        issueDate: new Date(invoice.issue_date).toLocaleDateString("de-AT"),
        dueDate: new Date(invoice.due_date).toLocaleDateString("de-AT"),
        servicePeriod: new Date(invoice.billing_month).toLocaleDateString("de-AT", { month: "long", year: "numeric" }),
        recipientName: invoice.members?.billing_name ?? invoice.members?.name ?? member?.name ?? "Mitglied",
        recipientAddress: "Musterstrasse 12\n4050 Traun, Oesterreich",
        items: invoice.invoice_items.map((item) => ({
          description: item.description,
          quantity: Number(item.quantity),
          unit: item.unit,
          unitPriceNet: Number(item.unit_price_net),
          vatRate: Number(item.vat_rate),
        })),
      });
      const blob = new Blob([new Uint8Array(bytes)], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `Rechnung-${invoice.invoice_number ?? "Entwurf"}.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);
      return;
    }
    const { data } = await supabase.auth.getSession();
    const response = await fetch(`/api/invoices/${invoice.id}/pdf`, {
      headers: { Authorization: `Bearer ${data.session?.access_token ?? ""}` },
    });
    if (!response.ok) {
      setToast("Die Rechnung konnte nicht heruntergeladen werden.");
      return;
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `Rechnung-${invoice.invoice_number ?? "Entwurf"}.pdf`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function prepareInvoiceEmail(invoice: Invoice) {
    const recipient = invoice.members?.email ?? "";
    const number = invoice.invoice_number ?? "AUFELD21 Rechnung";
    const subject = `AUFELD21 · Rechnung ${number}`;
    const body = `Hallo ${invoice.members?.name ?? ""},\n\nim Anhang findest du die Rechnung ${number} über ${invoiceGross(invoice).toLocaleString("de-AT", { style: "currency", currency: "EUR" })}.\n\nLiebe Grüße\nRoland\nAUFELD21`;
    window.location.href = `mailto:${encodeURIComponent(recipient)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  async function generateMonthlyInvoices() {
    if (!member) return;
    setGeneratingInvoices(true);
    if (!supabase) {
      await new Promise((resolve) => window.setTimeout(resolve, 450));
      setGeneratingInvoices(false);
      setToast("Die Demo-Monatsrechnungen wurden erstellt.");
      return;
    }
    const { data } = await supabase.auth.getSession();
    const nextMonth = format(addMonths(startOfMonth(toZonedTime(new Date(), TZ)), 1), "yyyy-MM-01");
    const response = await fetch("/api/admin/invoices/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${data.session?.access_token ?? ""}`,
      },
      body: JSON.stringify({ billingMonth: nextMonth }),
    });
    const result = await response.json().catch(() => ({}));
    setGeneratingInvoices(false);
    if (response.ok && supabase) {
      const { data: refreshedInvoices } = await supabase
        .from("invoices")
        .select("id,member_id,invoice_number,status,issue_date,due_date,billing_month,paid_at,members!invoices_member_id_fkey(name,email),invoice_items(description,quantity,unit,unit_price_net,vat_rate)")
        .order("issue_date", { ascending: false });
      if (refreshedInvoices) setInvoices(refreshedInvoices as unknown as Invoice[]);
    }
    setToast(response.ok ? `${result.created} fertige Rechnungen erstellt, ${result.skipped} bereits vorhanden oder unvollständig.` : result.error ?? "Erstellung fehlgeschlagen.");
  }

  async function finalizeInvoice(invoice: Invoice) {
    if (!supabase) {
      const number = `A21-${new Date().getFullYear()}-${String(invoices.filter((item) => item.invoice_number).length + 8).padStart(4, "0")}`;
      setInvoices((current) => current.map((item) => item.id === invoice.id ? { ...item, status: "final", invoice_number: number } : item));
      setToast(`Rechnung ${number} finalisiert.`);
      return;
    }
    const { data, error } = await supabase.rpc("finalize_invoice", { target_invoice_id: invoice.id });
    if (error) {
      setToast("Die Rechnung konnte nicht finalisiert werden.");
      return;
    }
    setInvoices((current) => current.map((item) => item.id === invoice.id ? { ...item, status: "final", invoice_number: data } : item));
    setToast(`Rechnung ${data} finalisiert.`);
  }

  async function markInvoicePaid(event: React.FormEvent) {
    event.preventDefault();
    if (!paymentDraft) return;
    const { invoice, paidOn } = paymentDraft;
    if (supabase) {
      const { error } = await supabase.rpc("mark_invoice_paid", { target_invoice_id: invoice.id, target_paid_on: paidOn });
      if (error) {
        setToast("Der Zahlungseingang konnte nicht gespeichert werden.");
        return;
      }
    }
    const paidAt = fromZonedTime(`${paidOn} 00:00:00`, TZ).toISOString();
    setInvoices((current) => current.map((item) => item.id === invoice.id ? { ...item, status: "paid", paid_at: paidAt } : item));
    setPaymentDraft(null);
    setToast(`Zahlung für ${invoice.invoice_number} am ${formatInTimeZone(paidAt, TZ, "dd.MM.yyyy")} gespeichert.`);
  }

  async function undoInvoicePayment(invoice: Invoice) {
    if (!window.confirm(`Zahlung für ${invoice.invoice_number} wirklich zurücksetzen?`)) return;
    if (supabase) {
      const { error } = await supabase.rpc("undo_invoice_payment", { target_invoice_id: invoice.id });
      if (error) { setToast("Die Zahlung konnte nicht zurückgesetzt werden."); return; }
    }
    setInvoices((current) => current.map((item) => item.id === invoice.id ? { ...item, status: "final", paid_at: null } : item));
    setToast("Zahlung zurückgesetzt. Die Rechnung ist wieder offen.");
  }

  async function cancelInvoice(invoice: Invoice) {
    if (!window.confirm(`Rechnung ${invoice.invoice_number ?? "Entwurf"} wirklich stornieren?`)) return;
    if (supabase) {
      const { error } = await supabase.rpc("cancel_invoice", { target_invoice_id: invoice.id });
      if (error) { setToast("Die Rechnung konnte nicht storniert werden."); return; }
    }
    setInvoices((current) => current.map((item) => item.id === invoice.id ? { ...item, status: "cancelled" } : item));
    setToast("Rechnung storniert.");
  }

  async function toggleMemberActive(target: ManagedMember) {
    const nextActive = !target.active;
    if (!nextActive && !window.confirm(`${target.name} wirklich deaktivieren? Der Login wird sofort gesperrt.`)) return;
    if (supabase) {
      const { data } = await supabase.auth.getSession();
      const response = await fetch("/api/admin/members", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token ?? ""}` },
        body: JSON.stringify({ id: target.id, active: nextActive }),
      });
      if (!response.ok) { setToast("Der Zugangsstatus konnte nicht geändert werden."); return; }
    }
    setManagedMembers((current) => current.map((item) => item.id === target.id ? { ...item, active: nextActive } : item));
    setToast(nextActive ? `${target.name} ist wieder aktiv.` : `${target.name} wurde deaktiviert.`);
  }

  async function saveBillingMember(event: React.FormEvent) {
    event.preventDefault();
    if (!billingMember) return;
    if (supabase) {
      const { data } = await supabase.auth.getSession();
      const response = await fetch("/api/admin/members", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${data.session?.access_token ?? ""}`,
        },
        body: JSON.stringify({
          id: billingMember.id,
          office_name: billingMember.office_name || null,
          billing_name: billingMember.billing_name || null,
          billing_address: billingMember.billing_address || null,
          billing_uid: billingMember.billing_uid || null,
          monthly_rent_net: billingMember.monthly_rent_net ?? null,
          contract_start: billingMember.contract_start || null,
          contract_end: billingMember.contract_end || null,
        }),
      });
      if (!response.ok) {
        setToast("Abrechnungsdaten konnten nicht gespeichert werden.");
        return;
      }
    }
    setManagedMembers((current) => current.map((item) => item.id === billingMember.id ? billingMember : item));
    setBillingMember(null);
    setToast("Abrechnungsdaten gespeichert.");
  }

  async function saveDeposit(event: React.FormEvent) {
    event.preventDefault();
    if (!depositMember || !member) return;
    const current = deposits.find((item) => item.member_id === depositMember.id) ?? { member_id: depositMember.id, agreed_amount: 0, received_amount: 0, returned_amount: 0, received_at: null, note: null };
    if (supabase) {
      const { error } = await supabase.from("member_deposits").upsert({ ...current, updated_by: member.id, updated_at: new Date().toISOString() });
      if (error) { setToast("Kaution konnte nicht gespeichert werden."); return; }
    }
    setDeposits((items) => [...items.filter((item) => item.member_id !== current.member_id), current]);
    setDepositMember(null);
    setToast("Kaution gespeichert.");
  }

  async function uploadMemberDocument(target: ManagedMember, file: File, type: MemberDocument["document_type"]) {
    if (!member || file.type !== "application/pdf") { setToast("Bitte ausschließlich PDF-Dateien auswählen."); return; }
    const record: MemberDocument = { id: crypto.randomUUID(), member_id: target.id, document_type: type, title: file.name.replace(/\.pdf$/i, ""), storage_path: `${target.id}/${crypto.randomUUID()}-${file.name}`, visible_to_member: true, valid_until: null, created_at: new Date().toISOString() };
    if (supabase) {
      const upload = await supabase.storage.from("member-documents").upload(record.storage_path, file, { contentType: "application/pdf" });
      if (upload.error) { setToast("Dokument konnte nicht hochgeladen werden."); return; }
      const { error } = await supabase.from("member_documents").insert({ ...record, uploaded_by: member.id });
      if (error) { await supabase.storage.from("member-documents").remove([record.storage_path]); setToast("Dokument konnte nicht gespeichert werden."); return; }
    }
    setDocuments((items) => [record, ...items]);
    setToast(`${record.title} wurde sicher hinterlegt.`);
  }

  async function downloadMemberDocument(document: MemberDocument) {
    if (!supabase) { setToast("Der Dokumentdownload wird mit Supabase Storage aktiv."); return; }
    const { data, error } = await supabase.storage.from("member-documents").createSignedUrl(document.storage_path, 60);
    if (error) { setToast("Dokument konnte nicht geöffnet werden."); return; }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  if (!authReady) {
    return (
      <main className="grid min-h-screen place-items-center bg-stone-50">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-stone-200 border-t-emerald-700" aria-label="Laden" />
      </main>
    );
  }

  if (passwordSetup && session) {
    return (
      <main className="grid min-h-screen place-items-center bg-stone-50 px-5">
        <section className="w-full max-w-md rounded-3xl border border-stone-200 bg-white p-7 shadow-sm sm:p-9">
          <div className="mb-8 grid h-14 w-14 place-items-center rounded-2xl bg-[#17231c] text-sm font-black text-[#c9ff70] shadow-sm">A21</div>
          <p className="mb-2 text-sm font-bold tracking-[0.12em] text-emerald-700">AUFELD21</p>
          <h1 className="text-3xl font-semibold tracking-tight text-stone-900">Passwort festlegen</h1>
          <p className="mt-3 leading-7 text-stone-600">Wähle ein persönliches Passwort für deinen zukünftigen Zugang.</p>
          <form onSubmit={saveNewPassword} className="mt-8 space-y-4">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-stone-700">Neues Passwort</span>
              <input type="password" required minLength={8} autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className="h-13 w-full rounded-xl border border-stone-300 px-4 outline-none transition focus:border-emerald-700 focus:ring-3 focus:ring-emerald-700/10" />
              <span className="mt-2 block text-xs text-stone-500">Mindestens 8 Zeichen.</span>
            </label>
            <button className="h-13 w-full rounded-xl bg-emerald-700 px-5 font-medium text-white transition hover:bg-emerald-800 disabled:opacity-60" disabled={authBusy}>{authBusy ? "Wird gespeichert …" : "Passwort speichern"}</button>
          </form>
          {authMessage && <p className="mt-5 rounded-xl bg-stone-100 p-4 text-sm leading-6 text-stone-700" role="status">{authMessage}</p>}
        </section>
      </main>
    );
  }

  if (!member) {
    return (
      <main className="grid min-h-screen place-items-center bg-stone-50 px-5">
        <section className="w-full max-w-md rounded-3xl border border-stone-200 bg-white p-7 shadow-sm sm:p-9">
          <div className="mb-8 grid h-14 w-14 place-items-center rounded-2xl bg-[#17231c] text-sm font-black text-[#c9ff70] shadow-sm">
            A21
          </div>
          <p className="mb-2 text-sm font-bold tracking-[0.12em] text-emerald-700">AUFELD21</p>
          <h1 className="text-3xl font-semibold tracking-tight text-stone-900">Dein Raum. Deine Zeit.</h1>
          <p className="mt-3 leading-7 text-stone-600">Schnell anmelden und den Meetingraum buchen.</p>
          <form onSubmit={signInWithPassword} className="mt-8 space-y-4">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-stone-700">E-Mail-Adresse</span>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="du@beispiel.at"
                className="h-13 w-full rounded-xl border border-stone-300 px-4 outline-none transition focus:border-emerald-700 focus:ring-3 focus:ring-emerald-700/10"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-stone-700">Passwort</span>
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="h-13 w-full rounded-xl border border-stone-300 px-4 outline-none transition focus:border-emerald-700 focus:ring-3 focus:ring-emerald-700/10"
              />
            </label>
            <button className="h-13 w-full rounded-xl bg-emerald-700 px-5 font-medium text-white transition hover:bg-emerald-800 disabled:opacity-60" disabled={authBusy}>
              {authBusy ? "Wird angemeldet …" : "Anmelden"}
            </button>
          </form>
          <button type="button" onClick={sendPasswordReset} disabled={authBusy} className="mt-4 min-h-11 w-full text-sm font-medium text-emerald-800 hover:text-emerald-950 disabled:opacity-60">Passwort vergessen?</button>
          <div className="mt-5 border-t border-stone-200 pt-5">
            <button type="button" onClick={() => setShowMagicLink((value) => !value)} className="min-h-11 w-full text-sm font-medium text-stone-500 hover:text-stone-800">{showMagicLink ? "Magic Link ausblenden" : "Alternativ mit Magic Link anmelden"}</button>
            {showMagicLink && (
              <form onSubmit={sendMagicLink} className="mt-3">
                <button className="h-12 w-full rounded-xl border border-stone-300 bg-white px-5 font-medium text-stone-800 transition hover:bg-stone-50 disabled:opacity-60" disabled={sendingLink}>{sendingLink ? "Wird gesendet …" : "Magic Link senden"}</button>
              </form>
            )}
          </div>
          {authMessage && (
            <p className="mt-5 rounded-xl bg-stone-100 p-4 text-sm leading-6 text-stone-700" role="status">
              {authMessage}
            </p>
          )}
          <p className="mt-7 text-xs leading-5 text-stone-500">Nur freigeschaltete Mitglieder können sich anmelden.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_#ecfdf5_0,_#fafaf9_28rem)] text-stone-900">
      <header className="sticky top-0 z-30 border-b border-stone-200/80 bg-white/88 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-[14px] bg-[#17231c] text-sm font-black tracking-tight text-[#c9ff70] shadow-sm">A21</div>
            <div>
              <p className="text-lg font-bold tracking-[-0.04em]">AUFELD<span className="text-emerald-700">21</span></p>
              <p className="hidden text-xs text-stone-500 sm:block">Meetingraum · Hallo {member.name}</p>
            </div>
          </div>
          <nav className="hidden items-center rounded-xl bg-stone-100 p-1 md:flex" aria-label="Hauptnavigation">
            <button
              onClick={() => setView("dashboard")}
              className={`h-9 rounded-lg px-4 text-sm font-medium transition ${view === "dashboard" ? "bg-white text-stone-900 shadow-sm" : "text-stone-500 hover:text-stone-900"}`}
            >
              Startseite
            </button>
            <button
              onClick={() => setView("calendar")}
              className={`h-9 rounded-lg px-4 text-sm font-medium transition ${view === "calendar" ? "bg-white text-stone-900 shadow-sm" : "text-stone-500 hover:text-stone-900"}`}
            >
              Meetingraum
            </button>
            <button
              onClick={() => setView("tour")}
              className={`h-9 rounded-lg px-4 text-sm font-medium transition ${view === "tour" ? "bg-white text-stone-900 shadow-sm" : "text-stone-500 hover:text-stone-900"}`}
            >
              Rundgang
            </button>
            <button
              onClick={() => setView("about")}
              className={`h-9 rounded-lg px-4 text-sm font-medium transition ${view === "about" ? "bg-white text-stone-900 shadow-sm" : "text-stone-500 hover:text-stone-900"}`}
            >
              Über uns
            </button>
            {member.role === "admin" && (
              <button
                onClick={() => setView("admin")}
                className={`h-9 rounded-lg px-4 text-sm font-medium transition ${view === "admin" ? "bg-white text-stone-900 shadow-sm" : "text-stone-500 hover:text-stone-900"}`}
              >
                Admin
              </button>
            )}
          </nav>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setView("calendar");
                openBooking(new Date(), "09:00");
              }}
              className="flex h-11 items-center gap-2 rounded-xl bg-emerald-700 px-3 text-sm font-medium text-white hover:bg-emerald-800 sm:px-4"
              aria-label="Meetingraum buchen"
            >
              <Plus size={18} />
              <span>Buchen</span>
            </button>
            <button
              onClick={() => supabase?.auth.signOut()}
              className="grid h-11 w-11 place-items-center rounded-xl border border-stone-200 bg-white text-stone-600 hover:bg-stone-100"
              aria-label="Abmelden"
              title="Abmelden"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>

      {view === "dashboard" && (
        <section className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6 sm:py-10">
          {demo && (
            <div className="mb-6 flex items-center justify-between gap-4 rounded-2xl border border-lime-200 bg-lime-50 px-4 py-3 text-sm text-lime-950">
              <span><strong>Lokale Vorschau</strong> · Anwesenheit und Buchungen sind Demo-Daten.</span>
              <span className="hidden rounded-full bg-white px-3 py-1 text-xs font-semibold sm:inline">Demo-Modus</span>
            </div>
          )}

          <div className="overflow-hidden rounded-[2rem] bg-[#17231c] px-6 py-8 text-white shadow-xl shadow-emerald-950/10 sm:px-10 sm:py-11">
            <div className="grid items-end gap-8 lg:grid-cols-[1.35fr_0.65fr]">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#c9ff70]">Donnerstag · AUFELD21</p>
                <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-[-0.045em] sm:text-6xl">
                  Schön, dass du da bist, {member.name}.
                </h1>
                <p className="mt-5 max-w-2xl text-base leading-7 text-stone-300 sm:text-lg">
                  Alles Wichtige aus dem Space – und der Meetingraum ist nur einen Klick entfernt.
                </p>
              </div>
              <button
                onClick={() => setView("calendar")}
                className="group flex min-h-28 items-center justify-between rounded-2xl bg-[#c9ff70] p-5 text-left text-[#17231c] transition hover:-translate-y-0.5 hover:bg-[#d8ff99]"
              >
                <span>
                  <span className="block text-xs font-bold uppercase tracking-[0.12em] opacity-60">Raumkalender</span>
                  <span className="mt-2 block text-xl font-semibold">Meetingraum ansehen</span>
                </span>
                <ChevronRight className="transition group-hover:translate-x-1" />
              </button>
            </div>
          </div>

          <div className="mt-6 grid gap-5 md:grid-cols-3">
            <article className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm md:col-span-2">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-stone-500">Gerade im AUFELD21</p>
                  <p className="mt-2 text-5xl font-semibold tracking-[-0.06em]">7 <span className="text-xl font-medium text-stone-400">Personen</span></p>
                </div>
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-100 text-emerald-800"><Users size={22} /></div>
              </div>
              <div className="mt-7">
                <div className="mb-2 flex justify-between text-xs font-medium text-stone-500"><span>Aktuelle Auslastung</span><span>7 von ca. 18 Plätzen</span></div>
                <div className="h-3 overflow-hidden rounded-full bg-stone-100"><div className="h-full w-[39%] rounded-full bg-emerald-600" /></div>
              </div>
              <div className="mt-6 flex items-center gap-2 text-sm text-stone-500">
                <DoorOpen size={17} className="text-emerald-700" />
                Später live über den Türchip-Webhook
              </div>
            </article>

            <article className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
              <p className="text-sm font-medium text-stone-500">Meetingraum heute</p>
              <p className="mt-2 text-4xl font-semibold tracking-[-0.05em]">
                {bookings.filter((booking) => isSameDay(toZonedTime(new Date(booking.start_at), TZ), toZonedTime(new Date(), TZ))).length}
              </p>
              <p className="mt-1 text-sm text-stone-500">Buchungen</p>
              <button onClick={() => setView("calendar")} className="mt-7 flex h-11 w-full items-center justify-between rounded-xl bg-stone-100 px-4 text-sm font-semibold hover:bg-stone-200">
                Kalender öffnen <ChevronRight size={18} />
              </button>
            </article>
          </div>

          <article className="mt-6 rounded-3xl border border-stone-200 bg-white p-6 shadow-sm sm:p-7">
            <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
              <div>
                <p className="text-sm font-medium text-emerald-700">Dein Meetingraum-Kontingent · {format(new Date(), "MMMM yyyy", { locale: de })}</p>
                <h2 className="mt-2 text-3xl font-semibold tracking-[-0.04em]">
                  {remainingHours.toLocaleString("de-AT")} Stunden verfügbar
                </h2>
                <p className="mt-2 text-sm text-stone-500">
                  {monthlyUsedHours.toLocaleString("de-AT")} von {availableHours.toLocaleString("de-AT")} Stunden verwendet
                  {monthlyBonusHours > 0 ? ` · inklusive ${monthlyBonusHours.toLocaleString("de-AT")} Bonusstunden` : ""}
                </p>
              </div>
              {member.role === "employee" && billableHours > 0 ? (
                <div className="rounded-2xl bg-amber-50 px-5 py-4 text-amber-950">
                  <p className="text-xs font-bold uppercase tracking-wider text-amber-700">Kontingent ausgeschöpft</p>
                  <p className="mt-1 text-sm font-semibold">Bitte Bonusstunden anfragen</p>
                </div>
              ) : billableHours > 0 ? (
                <div className="rounded-2xl bg-amber-50 px-5 py-4 text-amber-950">
                  <p className="text-xs font-bold uppercase tracking-wider text-amber-700">Zusatznutzung</p>
                  <p className="mt-1 text-2xl font-semibold">{billableNet.toLocaleString("de-AT", { style: "currency", currency: "EUR" })} <span className="text-sm font-normal">netto</span></p>
                </div>
              ) : (
                <div className="rounded-2xl bg-emerald-50 px-5 py-4 text-emerald-950">
                  <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">Aktueller Tarif</p>
                  <p className="mt-1 text-xl font-semibold">Pro · 12 h/Monat</p>
                </div>
              )}
            </div>
            <div className="mt-6 h-3 overflow-hidden rounded-full bg-stone-100">
              <div
                className={`h-full rounded-full ${billableHours > 0 ? "bg-amber-500" : "bg-emerald-600"}`}
                style={{ width: `${Math.min((monthlyUsedHours / Math.max(availableHours, 1)) * 100, 100)}%` }}
              />
            </div>
            <p className="mt-3 text-xs text-stone-400">{member.role === "employee" ? "Wenn du mehr Zeit brauchst, kann Roland dir zusätzliche Bonusstunden freischalten." : "Weitere Nutzung wird in 30-Minuten-Schritten zu 12 € netto pro Stunde verrechnet."}</p>
          </article>

          <article className="mt-6 rounded-3xl border border-stone-200 bg-white p-6 shadow-sm sm:p-7">
            <div className="flex items-start justify-between"><div><p className="text-sm font-medium text-emerald-700">Sicher hinterlegt</p><h2 className="mt-1 text-2xl font-semibold tracking-tight">{member.role === "member" || member.role === "admin" ? "Verträge & Dokumente" : "Hausordnung & Informationen"}</h2></div><ShieldCheck className="text-emerald-700" /></div>
            <div className="mt-5 divide-y divide-stone-100">
              {documents.filter((item) => item.member_id === member.id && item.visible_to_member && (member.role === "member" || member.role === "admin" || item.document_type !== "mietvertrag")).length === 0 ? <p className="py-4 text-sm text-stone-500">Noch keine Informationen hinterlegt.</p> : documents.filter((item) => item.member_id === member.id && item.visible_to_member && (member.role === "member" || member.role === "admin" || item.document_type !== "mietvertrag")).map((document) => (
                <button key={document.id} onClick={() => downloadMemberDocument(document)} className="flex w-full items-center gap-3 py-4 text-left hover:text-emerald-800"><FileText size={18} /><span className="font-medium">{document.title}</span><Download size={16} className="ml-auto" /></button>
              ))}
            </div>
          </article>

          {member.role !== "employee" && <article className="mt-6 rounded-3xl border border-stone-200 bg-white p-6 shadow-sm sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-emerald-700">Deine Dokumente</p>
                <h2 className="mt-1 text-2xl font-semibold tracking-tight">Rechnungen</h2>
              </div>
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-stone-100 text-stone-700"><FileText size={20} /></div>
            </div>
            <div className="mt-5 divide-y divide-stone-100">
              {invoices.filter((invoice) => invoice.member_id === member.id && invoice.status !== "draft" && invoice.status !== "cancelled").length === 0 ? (
                <p className="py-4 text-sm text-stone-500">Noch keine Rechnungen verfügbar.</p>
              ) : (
                invoices.filter((invoice) => invoice.member_id === member.id && invoice.status !== "draft" && invoice.status !== "cancelled").slice(0, 4).map((invoice) => (
                  <div key={invoice.id} className="flex flex-col justify-between gap-3 py-4 first:pt-0 sm:flex-row sm:items-center">
                    <div>
                      <p className="font-semibold">{invoice.invoice_number}</p>
                      <p className="mt-1 text-sm text-stone-500">{new Date(invoice.issue_date).toLocaleDateString("de-AT")} · {invoiceGross(invoice).toLocaleString("de-AT", { style: "currency", currency: "EUR" })} brutto · {invoice.status === "paid" && invoice.paid_at ? `bezahlt am ${formatInTimeZone(invoice.paid_at, TZ, "dd.MM.yyyy")}` : "offen"}</p>
                    </div>
                    <button onClick={() => downloadInvoice(invoice)} className="flex h-10 items-center justify-center gap-2 rounded-xl border border-stone-200 px-4 text-sm font-semibold hover:bg-stone-100">
                      <Download size={16} /> PDF
                    </button>
                  </div>
                ))
              )}
            </div>
          </article>}

          <div className="mt-6 grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
            <article className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm sm:p-7">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-emerald-700">Aktuelles im Space</p>
                  <h2 className="mt-1 text-2xl font-semibold tracking-tight">Gut zu wissen</h2>
                </div>
                <span className="rounded-full bg-stone-100 px-3 py-1.5 text-xs font-medium text-stone-500">Aktuell</span>
              </div>
              <div className="mt-6 divide-y divide-stone-100">
                <div className="py-4 first:pt-0">
                  <p className="font-semibold">Gemeinsam auf eine ordentliche Küche achten</p>
                  <p className="mt-1 text-sm leading-6 text-stone-500">Benutztes Geschirr bitte direkt in den Geschirrspüler einräumen. Die Küche ist vollständig verfügbar.</p>
                </div>
                <div className="py-4">
                  <p className="font-semibold">Kopfhörer sind ausdrücklich erwünscht</p>
                  <p className="mt-1 text-sm leading-6 text-stone-500">Damit alle konzentriert arbeiten können, bitte Musik, Videos und längere Online-Termine mit Kopfhörern nutzen.</p>
                </div>
                <div className="py-4 pb-0">
                  <p className="font-semibold">Bitte Fenster schließen</p>
                  <p className="mt-1 text-sm leading-6 text-stone-500">Beim Verlassen am Abend kurz den Besprechungsraum kontrollieren.</p>
                </div>
              </div>
            </article>

            <article className="rounded-3xl bg-emerald-50 p-6 sm:p-7">
              <p className="text-sm font-medium text-emerald-800">Space-Status</p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight">Fast alles läuft.</h2>
              <div className="mt-6 space-y-3">
                <div className="flex items-center gap-3 rounded-2xl bg-white/80 p-4"><Wifi size={20} className="text-emerald-700" /><span className="font-medium">WLAN online</span><span className="ml-auto h-2.5 w-2.5 rounded-full bg-emerald-500" /></div>
                <div className="flex items-center gap-3 rounded-2xl bg-white/80 p-4"><Utensils size={20} className="text-emerald-700" /><span className="font-medium">Küche verfügbar</span><span className="ml-auto h-2.5 w-2.5 rounded-full bg-emerald-500" /></div>
                <div className="flex items-center gap-3 rounded-2xl bg-white/80 p-4"><Snowflake size={20} className="text-emerald-700" /><span className="font-medium">Klimaanlage in Betrieb</span><span className="ml-auto h-2.5 w-2.5 rounded-full bg-emerald-500" /></div>
                <div className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4"><Wrench size={20} className="text-amber-700" /><span className="font-medium text-amber-950">Pissoir außer Betrieb</span><span className="ml-auto h-2.5 w-2.5 rounded-full bg-amber-500" /></div>
              </div>
              <button
                onClick={() => {
                  setIssueError("");
                  setIssueDraft({ category: "Kaffee", note: "" });
                }}
                className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-emerald-800/15 bg-white font-semibold text-emerald-950 transition hover:-translate-y-0.5 hover:shadow-sm"
              >
                <CircleAlert size={18} />
                Etwas melden
              </button>
            </article>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-2 md:hidden">
            <button onClick={() => setView("dashboard")} className="h-12 rounded-xl bg-[#17231c] text-sm font-semibold text-white">Startseite</button>
            <button onClick={() => setView("calendar")} className="h-12 rounded-xl bg-white text-sm font-semibold shadow-sm">Meetingraum</button>
            <button onClick={() => setView("tour")} className="h-12 rounded-xl bg-white text-sm font-semibold shadow-sm">Rundgang</button>
            <button onClick={() => setView("about")} className="h-12 rounded-xl bg-white text-sm font-semibold shadow-sm">Über uns</button>
            {member.role === "admin" && <button onClick={() => setView("admin")} className="h-12 rounded-xl bg-white text-sm font-semibold shadow-sm">Admin</button>}
          </div>
        </section>
      )}

      {view === "tour" && (
        <section className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 sm:py-10">
          <div className="mb-8 max-w-3xl">
            <p className="text-sm font-bold uppercase tracking-[0.16em] text-emerald-700">Rundgang & Orientierung</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-[-0.05em] sm:text-5xl">Wo finde ich was?</h1>
            <p className="mt-4 text-lg leading-8 text-stone-500">Vier Büros, ein Meetingraum und kurze Wege. Tippe einen Bereich an und lerne das AUFELD21 kennen.</p>
          </div>
          <SpacePlan />
          <div className="mt-6 grid grid-cols-2 gap-2 md:hidden">
            <button onClick={() => setView("dashboard")} className="h-12 rounded-xl bg-white text-sm font-semibold shadow-sm">Startseite</button>
            <button onClick={() => setView("calendar")} className="h-12 rounded-xl bg-white text-sm font-semibold shadow-sm">Meetingraum</button>
            <button onClick={() => setView("tour")} className="h-12 rounded-xl bg-[#17231c] text-sm font-semibold text-white">Rundgang</button>
            <button onClick={() => setView("about")} className="h-12 rounded-xl bg-white text-sm font-semibold shadow-sm">Über uns</button>
            {member.role === "admin" && <button onClick={() => setView("admin")} className="h-12 rounded-xl bg-white text-sm font-semibold shadow-sm">Admin</button>}
          </div>
        </section>
      )}

      {view === "about" && (
        <section className="mx-auto max-w-[1250px] px-4 py-6 sm:px-6 sm:py-10">
          <div className="overflow-hidden rounded-[2rem] bg-[#17231c] text-white shadow-sm">
            <div className="grid lg:grid-cols-[1.1fr_0.9fr]">
              <div className="relative aspect-[4/3] sm:aspect-auto sm:min-h-[520px] lg:min-h-[640px]">
                <Image
                  src="/julia-roland-potlog.jpg"
                  alt="Julia und Roland Potlog"
                  fill
                  priority
                  sizes="(min-width: 1024px) 55vw, 100vw"
                  className="object-cover object-center"
                />
                <div className="absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-[#17231c]/70 to-transparent lg:hidden" />
              </div>
              <div className="flex flex-col justify-center p-7 sm:p-10 lg:p-14">
                <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#c9ff70]">Über uns</p>
                <h1 className="mt-4 text-4xl font-semibold tracking-[-0.05em] sm:text-5xl">Ein Büro, das mehr verbindet als nur Räume.</h1>
                <p className="mt-7 text-lg leading-8 text-stone-200">AUFELD21 ist ein kleiner, persönlicher Co-Working-Space in Traun – gegründet und betrieben von uns, Julia und Roland Potlog, gemeinsam mit der Potlog Immobilien KG.</p>
              </div>
            </div>
          </div>

          <div className="mx-auto grid max-w-5xl gap-8 py-12 lg:grid-cols-[1fr_0.8fr] lg:py-16">
            <article className="rounded-3xl border border-stone-200 bg-white p-7 shadow-sm sm:p-10">
              <p className="text-sm font-semibold text-emerald-700">Wie alles begann</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-[-0.04em]">Aus unserem eigenen Büro wurde eine gemeinsame Idee.</h2>
              <div className="mt-6 space-y-5 leading-7 text-stone-600">
                <p>Ursprünglich wollten wir an diesem Standort einfach ein schönes Büro für uns und unser Team schaffen: modern, ruhig und ein Ort, an dem man gerne arbeitet. Doch schon während der Planung entstand eine größere Idee.</p>
                <p>Warum sollten wir einen guten Arbeitsplatz nur für uns allein schaffen? Selbstständige und kleine Unternehmen brauchen oft keine großen Büroflächen oder anonymen Business-Center. Sie brauchen eine professionelle Umgebung, verlässliche Ansprechpartner und Menschen, mit denen ein ehrlicher Austausch möglich ist.</p>
                <p>So entstand AUFELD21 – bewusst klein, persönlich und unkompliziert.</p>
              </div>
            </article>

            <aside className="rounded-3xl bg-emerald-50 p-7 sm:p-10">
              <p className="text-sm font-semibold text-emerald-800">Unsere Haltung</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-[-0.04em]">Klein genug, um sich wirklich zu kennen.</h2>
              <p className="mt-6 leading-7 text-stone-600">Bei uns arbeitet eine kleine Gemeinschaft aus Selbstständigen, Unternehmen und unserem eigenen Team. Man kennt sich, unterstützt einander, wenn es passt, und kann trotzdem in Ruhe arbeiten.</p>
              <div className="mt-8 rounded-2xl bg-white/80 p-5">
                <p className="font-semibold">Julia & Roland Potlog</p>
                <p className="mt-1 text-sm leading-6 text-stone-500">Gastgeber und Betreiber von AUFELD21<br />Potlog Immobilien KG<br />Aufeldstraße 21 · 4050 Traun</p>
              </div>
            </aside>
          </div>

          <div className="rounded-3xl border border-stone-200 bg-white px-7 py-10 text-center shadow-sm sm:px-12 sm:py-14">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-emerald-700">AUFELD21</p>
            <p className="mx-auto mt-3 max-w-2xl text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">Gemeinsam arbeiten. Persönlich verbunden.</p>
            <p className="mx-auto mt-4 max-w-2xl leading-7 text-stone-500">Wir möchten einen Ort schaffen, den wir selbst gerne jeden Tag betreten – und an dem aus guter Nachbarschaft neue Ideen, Empfehlungen und gemeinsame Projekte entstehen können.</p>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-2 md:hidden">
            <button onClick={() => setView("dashboard")} className="h-12 rounded-xl bg-white text-sm font-semibold shadow-sm">Startseite</button>
            <button onClick={() => setView("calendar")} className="h-12 rounded-xl bg-white text-sm font-semibold shadow-sm">Meetingraum</button>
            <button onClick={() => setView("tour")} className="h-12 rounded-xl bg-white text-sm font-semibold shadow-sm">Rundgang</button>
            <button onClick={() => setView("about")} className="h-12 rounded-xl bg-[#17231c] text-sm font-semibold text-white">Über uns</button>
            {member.role === "admin" && <button onClick={() => setView("admin")} className="h-12 rounded-xl bg-white text-sm font-semibold shadow-sm">Admin</button>}
          </div>
        </section>
      )}

      {view === "admin" && member.role === "admin" && (
        <section className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6 sm:py-10">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.15em] text-emerald-700">AUFELD21 Controlling</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">Alles im Blick.</h1>
              <p className="mt-2 text-stone-500">Zentrale Verwaltung · {format(new Date(), "MMMM yyyy", { locale: de })}</p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <button onClick={() => setAdminTab("invoices")} className="flex h-11 items-center justify-center gap-2 rounded-xl border border-stone-200 bg-white px-4 text-sm font-semibold hover:bg-stone-50"><FileText size={17} /> Rechnungen prüfen</button>
              <button onClick={() => setInviteDraft({ name: "", email: "", role: "employee" })} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-[#17231c] px-4 text-sm font-semibold text-white"><Plus size={18} /> Person einladen</button>
            </div>
          </div>

          <nav className="mt-6 grid grid-cols-2 gap-2 rounded-2xl bg-stone-100 p-1 sm:grid-cols-4" aria-label="Adminbereiche">
            {([['overview', 'Übersicht'], ['people', 'Personen'], ['invoices', 'Rechnungen'], ['documents', 'Unterlagen']] as const).map(([tabValue, label]) => (
              <button key={tabValue} onClick={() => setAdminTab(tabValue)} className={`h-11 rounded-xl text-sm font-semibold transition ${adminTab === tabValue ? "bg-white text-stone-900 shadow-sm" : "text-stone-500 hover:text-stone-800"}`}>{label}</button>
            ))}
          </nav>

          <div className={`${adminTab !== "overview" ? "hidden " : ""}mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4`}>
            <article className="rounded-3xl bg-[#17231c] p-6 text-white shadow-sm">
              <p className="text-sm text-stone-300">Monatliches Soll</p>
              <p className="mt-2 text-3xl font-semibold tracking-tight">{monthlyGrossTarget.toLocaleString("de-AT", { style: "currency", currency: "EUR" })}</p>
              <p className="mt-2 text-xs text-stone-400">Brutto aus laufenden Monatspreisen</p>
            </article>
            <article className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
              <p className="text-sm text-stone-500">Bezahlt im Monat</p>
              <p className="mt-2 text-3xl font-semibold tracking-tight text-emerald-700">{paidThisMonthGross.toLocaleString("de-AT", { style: "currency", currency: "EUR" })}</p>
              <p className="mt-2 text-xs text-stone-400">Erfasste Zahlungen für {format(new Date(), "MMMM", { locale: de })}</p>
            </article>
            <article className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
              <p className="text-sm text-stone-500">Offene Rechnungen</p>
              <p className="mt-2 text-3xl font-semibold tracking-tight">{openInvoiceGross.toLocaleString("de-AT", { style: "currency", currency: "EUR" })}</p>
              <p className={`mt-2 text-xs font-medium ${overdueInvoices.length ? "text-red-700" : "text-stone-400"}`}>{overdueInvoices.length} überfällig · {openInvoices.length} offen</p>
            </article>
            <article className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
              <p className="text-sm text-stone-500">Meetingraum</p>
              <p className="mt-2 text-3xl font-semibold tracking-tight">{totalUsedHours.toLocaleString("de-AT")} h</p>
              <p className="mt-2 text-xs text-stone-400">Verbrauch aller Zugänge im Monat</p>
            </article>
          </div>

          <div className={`${adminTab !== "overview" ? "hidden " : ""}mt-6 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]`}>
            <section className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm sm:p-7">
              <div className="flex items-start justify-between gap-4"><div><p className="text-sm font-medium text-emerald-700">Prioritäten</p><h2 className="mt-1 text-xl font-semibold">Was jetzt zu tun ist</h2></div><CircleAlert className="text-emerald-700" /></div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <button onClick={() => setAdminTab("invoices")} className="rounded-2xl bg-stone-50 p-4 text-left hover:bg-stone-100"><span className="text-2xl font-semibold">{overdueInvoices.length}</span><span className="ml-2 text-sm text-stone-600">überfällige Rechnungen</span></button>
                <button onClick={() => setAdminTab("invoices")} className="rounded-2xl bg-stone-50 p-4 text-left hover:bg-stone-100"><span className="text-2xl font-semibold">{invoices.filter((invoice) => invoice.status === "paid").length}</span><span className="ml-2 text-sm text-stone-600">Zahlungen bestätigt</span></button>
                <button onClick={() => setAdminTab("people")} className="rounded-2xl bg-stone-50 p-4 text-left hover:bg-stone-100"><span className="text-2xl font-semibold">{missingBillingProfiles.length}</span><span className="ml-2 text-sm text-stone-600">Abrechnungsprofile offen</span></button>
                <button onClick={() => setAdminTab("documents")} className="rounded-2xl bg-stone-50 p-4 text-left hover:bg-stone-100"><span className="text-2xl font-semibold">{tenantDepositIssues.length}</span><span className="ml-2 text-sm text-stone-600">Kautionen prüfen</span></button>
                <button onClick={() => document.getElementById("admin-issues")?.scrollIntoView({ behavior: "smooth" })} className="rounded-2xl bg-stone-50 p-4 text-left hover:bg-stone-100"><span className="text-2xl font-semibold">{openIssueReports.length}</span><span className="ml-2 text-sm text-stone-600">offene Meldungen</span></button>
              </div>
            </section>
            <section className="rounded-3xl bg-emerald-50 p-6 sm:p-7">
              <p className="text-sm font-medium text-emerald-800">Schnellzugriff</p><h2 className="mt-1 text-xl font-semibold">Verwalten</h2>
              <div className="mt-5 grid gap-2">
                <button onClick={() => setAdminTab("people")} className="flex h-12 items-center gap-3 rounded-xl bg-white px-4 text-left font-semibold"><Users size={18} className="text-emerald-700" /> Personen & Stunden</button>
                <button onClick={() => setAdminTab("invoices")} className="flex h-12 items-center gap-3 rounded-xl bg-white px-4 text-left font-semibold"><FileText size={18} className="text-emerald-700" /> Rechnungen & Zahlungen</button>
                <button onClick={() => setAdminTab("documents")} className="flex h-12 items-center gap-3 rounded-xl bg-white px-4 text-left font-semibold"><ShieldCheck size={18} className="text-emerald-700" /> Kautionen & Unterlagen</button>
                <button onClick={() => document.getElementById("admin-issues")?.scrollIntoView({ behavior: "smooth" })} className="flex h-12 items-center gap-3 rounded-xl bg-white px-4 text-left font-semibold"><CircleAlert size={18} className="text-emerald-700" /> Meldungen aus dem Space</button>
              </div>
            </section>
          </div>

          <section id="admin-issues" className={`${adminTab !== "overview" ? "hidden " : ""}mt-6 scroll-mt-6 rounded-3xl border border-stone-200 bg-white p-6 shadow-sm sm:p-7`}>
            <div className="flex items-start justify-between gap-4"><div><p className="text-sm font-medium text-emerald-700">Aus dem Space</p><h2 className="mt-1 text-xl font-semibold">Offene Meldungen</h2></div><span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">{openIssueReports.length} offen</span></div>
            <div className="mt-5 divide-y divide-stone-100">
              {openIssueReports.length === 0 ? <p className="py-3 text-sm text-stone-500">Aktuell ist nichts offen.</p> : openIssueReports.map((report) => (
                <div key={report.id} className="flex flex-col justify-between gap-3 py-4 first:pt-0 sm:flex-row sm:items-center">
                  <div><p className="font-semibold">{report.category} · {report.members?.name ?? "Mitglied"}</p><p className="mt-1 text-sm text-stone-500">{report.note || "Keine weitere Beschreibung"} · {formatInTimeZone(report.created_at, TZ, "dd.MM.yyyy, HH:mm")}</p></div>
                  <button onClick={() => resolveIssue(report)} className="h-10 shrink-0 rounded-xl border border-emerald-200 bg-emerald-50 px-4 text-sm font-semibold text-emerald-800">Als erledigt markieren</button>
                </div>
              ))}
            </div>
          </section>

          <div id="admin-people" className={`${adminTab !== "people" ? "hidden " : ""}mt-6 scroll-mt-6 overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-sm`}>
            <div className="border-b border-stone-100 px-5 py-5 sm:px-7">
              <h2 className="text-xl font-semibold tracking-tight">Mieter, Büros & Kontingente</h2>
              <p className="mt-1 text-sm text-stone-500">Ein Dossier pro Person: Rechnungen, Vertrag, Kaution und Meetingstunden an einem Ort.</p>
            </div>
            {selectedDossier && (
              <section className="border-b border-stone-200 bg-stone-50/70 p-5 sm:p-7" aria-label="Mieter- und Bürodossier">
                <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
                  <label className="block w-full max-w-xl">
                    <span className="mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-emerald-700">Mieter oder Büro auswählen</span>
                    <select value={selectedDossier.id} onChange={(event) => setSelectedDossierId(event.target.value)} className="h-13 w-full rounded-2xl border border-stone-200 bg-white px-4 font-semibold outline-none focus:border-emerald-700">
                      {managedMembers.map((item) => <option key={item.id} value={item.id}>{item.office_name ? `${item.office_name} · ` : ""}{item.billing_name || item.name}</option>)}
                    </select>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {(selectedDossier.role === "member" || selectedDossier.role === "partner" || selectedDossier.role === "admin") && <button onClick={() => setBillingMember(selectedDossier)} className="h-11 rounded-xl bg-[#17231c] px-4 text-sm font-semibold text-white">Stammdaten bearbeiten</button>}
                    <button onClick={() => { setBonusAmount("2"); setBonusTarget(selectedDossier); }} className="h-11 rounded-xl border border-stone-200 bg-white px-4 text-sm font-semibold">Stunden schenken</button>
                  </div>
                </div>

                <div className="mt-5 overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-sm">
                  <div className="flex flex-col justify-between gap-4 bg-[#17231c] p-6 text-white sm:flex-row sm:items-center sm:p-7">
                    <div className="flex items-center gap-4">
                      <div className="grid h-14 w-14 place-items-center rounded-2xl bg-white/10 text-xl font-semibold text-[#c9ff70]">{selectedDossier.name.slice(0, 1)}</div>
                      <div><p className="text-xs font-bold uppercase tracking-[0.14em] text-[#c9ff70]">{selectedDossier.office_name || "Noch keinem Büro zugeordnet"}</p><h3 className="mt-1 text-2xl font-semibold">{selectedDossier.billing_name || selectedDossier.name}</h3><p className="mt-1 text-sm text-stone-300">{selectedDossier.name} · {selectedDossier.email}</p></div>
                    </div>
                    <span className={`w-fit rounded-full px-3 py-1.5 text-xs font-semibold ${selectedDossier.active ? "bg-emerald-400/15 text-emerald-200" : "bg-red-400/15 text-red-200"}`}>{selectedDossier.active ? "Zugang aktiv" : "Zugang deaktiviert"}</span>
                  </div>

                  <div className="grid gap-px bg-stone-200 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="bg-white p-5"><p className="text-xs font-semibold uppercase tracking-wider text-stone-400">Monatsmiete</p><p className="mt-2 text-xl font-semibold">{selectedDossier.monthly_rent_net == null ? "–" : (Number(selectedDossier.monthly_rent_net) * 1.2).toLocaleString("de-AT", { style: "currency", currency: "EUR" })}</p><p className="mt-1 text-xs text-stone-400">brutto inkl. 20 % USt</p></div>
                    <div className="bg-white p-5"><p className="text-xs font-semibold uppercase tracking-wider text-stone-400">Vertrag</p><p className="mt-2 font-semibold">{selectedDossier.contract_start ? `ab ${new Date(selectedDossier.contract_start).toLocaleDateString("de-AT")}` : "Nicht hinterlegt"}</p><p className="mt-1 text-xs text-stone-400">{selectedDossier.contract_end ? `bis ${new Date(selectedDossier.contract_end).toLocaleDateString("de-AT")}` : "unbefristet / offen"}</p></div>
                    <div className="bg-white p-5"><p className="text-xs font-semibold uppercase tracking-wider text-stone-400">Kaution</p><p className="mt-2 font-semibold">{dossierDeposit ? Number(dossierDeposit.received_amount).toLocaleString("de-AT", { style: "currency", currency: "EUR" }) : "Nicht erfasst"}</p><p className="mt-1 text-xs text-stone-400">{dossierDeposit ? `von ${Number(dossierDeposit.agreed_amount).toLocaleString("de-AT", { style: "currency", currency: "EUR" })} vereinbart` : "noch zu prüfen"}</p></div>
                    <div className="bg-white p-5"><p className="text-xs font-semibold uppercase tracking-wider text-stone-400">Meetingraum</p><p className="mt-2 text-xl font-semibold">{selectedDossier.usedHours.toLocaleString("de-AT")} h</p><p className="mt-1 text-xs text-stone-400">12 h inklusive · +{selectedDossier.bonusHours.toLocaleString("de-AT")} h Bonus</p></div>
                  </div>

                  <div className="grid gap-6 p-5 sm:p-7 xl:grid-cols-2">
                    <div>
                      <div className="flex items-center justify-between gap-3"><div><p className="text-sm font-medium text-emerald-700">Finanzen</p><h4 className="mt-1 text-lg font-semibold">Alle Rechnungen</h4></div><span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold text-stone-500">{dossierInvoices.length}</span></div>
                      <div className="mt-4 divide-y divide-stone-100 rounded-2xl border border-stone-100">
                        {dossierInvoices.length === 0 ? <p className="p-4 text-sm text-stone-500">Noch keine Rechnungen vorhanden.</p> : dossierInvoices.map((invoice) => <div key={invoice.id} className="flex flex-col justify-between gap-3 p-4 sm:flex-row sm:items-center"><div><p className="font-semibold">{invoice.invoice_number || "Entwurf"}</p><p className="mt-1 text-xs text-stone-500">{new Date(invoice.billing_month).toLocaleDateString("de-AT", { month: "long", year: "numeric" })} · {invoiceGross(invoice).toLocaleString("de-AT", { style: "currency", currency: "EUR" })} · {invoice.status === "paid" ? "bezahlt" : invoice.status === "draft" ? "Entwurf" : invoice.status === "cancelled" ? "storniert" : "offen"}</p></div><button onClick={() => downloadInvoice(invoice)} className="flex h-9 items-center justify-center gap-2 rounded-xl border border-stone-200 px-3 text-xs font-semibold"><Download size={14} /> PDF</button></div>)}
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between gap-3"><div><p className="text-sm font-medium text-emerald-700">Ablage</p><h4 className="mt-1 text-lg font-semibold">Vertrag & Unterlagen</h4></div><span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold text-stone-500">{dossierDocuments.length}</span></div>
                      <div className="mt-4 rounded-2xl border border-stone-100 p-4">
                        {dossierDocuments.length === 0 ? <p className="text-sm text-stone-500">Noch keine Unterlagen hinterlegt.</p> : dossierDocuments.map((document) => <button key={document.id} onClick={() => downloadMemberDocument(document)} className="flex w-full items-center gap-2 border-b border-stone-100 py-3 text-left text-sm font-medium last:border-0"><FileText size={16} className="text-emerald-700" />{document.title}<Download size={14} className="ml-auto text-stone-400" /></button>)}
                        <div className="mt-4 flex flex-wrap gap-2">
                          {(selectedDossier.role === "member" || selectedDossier.role === "admin") && <label className="flex h-10 cursor-pointer items-center gap-2 rounded-xl bg-stone-100 px-3 text-sm font-semibold"><Upload size={15} /> Mietvertrag hochladen<input type="file" accept="application/pdf" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) uploadMemberDocument(selectedDossier, file, "mietvertrag"); event.target.value = ""; }} /></label>}
                          {(selectedDossier.role === "member" || selectedDossier.role === "admin") && <button onClick={() => { if (!dossierDeposit) setDeposits((current) => [...current, { member_id: selectedDossier.id, agreed_amount: 0, received_amount: 0, returned_amount: 0, received_at: null, note: null }]); setDepositMember(selectedDossier); }} className="h-10 rounded-xl border border-stone-200 px-3 text-sm font-semibold">Kaution bearbeiten</button>}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            )}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[850px] text-left">
                <thead className="bg-stone-50 text-xs font-semibold uppercase tracking-wider text-stone-500">
                  <tr>
                    <th className="px-7 py-4">Mitglied</th>
                    <th className="px-5 py-4">Büro</th>
                    <th className="px-5 py-4">Tarif</th>
                    <th className="px-5 py-4">Verwendet</th>
                    <th className="px-5 py-4">Bonus</th>
                    <th className="px-5 py-4">Zusatzkosten</th>
                    <th className="px-7 py-4 text-right">Aktion</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {managedMembers.map((item) => {
                    const extra = Math.max(item.usedHours - 12 - item.bonusHours, 0);
                    return (
                      <tr key={item.id} className={`${item.active ? "" : "opacity-55 "}hover:bg-stone-50/70`}>
                        <td className="px-7 py-5">
                          <div className="flex items-center gap-3">
                            <div className="grid h-10 w-10 place-items-center rounded-full bg-emerald-100 font-semibold text-emerald-800">{item.name.slice(0, 1)}</div>
                            <div>
                              <p className="font-semibold">{item.name} {item.role === "admin" && <span className="ml-1 rounded-full bg-stone-100 px-2 py-0.5 text-[10px] uppercase text-stone-500">Admin</span>}{item.role === "employee" && <span className="ml-1 rounded-full bg-sky-50 px-2 py-0.5 text-[10px] uppercase text-sky-700">Mitarbeiter</span>}{item.role === "partner" && <span className="ml-1 rounded-full bg-violet-50 px-2 py-0.5 text-[10px] uppercase text-violet-700">Nutzungspartner</span>}</p>
                              <p className="mt-0.5 text-sm text-stone-500">{item.email}{!item.active ? " · deaktiviert" : ""}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-5 text-sm font-medium text-stone-600">{item.office_name || "–"}</td>
                        <td className="px-5 py-5"><span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">Pro · 12 h</span></td>
                        <td className="px-5 py-5 font-medium">{item.usedHours.toLocaleString("de-AT")} h</td>
                        <td className="px-5 py-5 font-medium text-emerald-700">+{item.bonusHours.toLocaleString("de-AT")} h</td>
                        <td className="px-5 py-5 font-semibold">{item.role === "employee" ? "–" : (extra * 12).toLocaleString("de-AT", { style: "currency", currency: "EUR" })}</td>
                        <td className="px-7 py-5 text-right">
                          <button onClick={() => { setSelectedDossierId(item.id); document.getElementById("admin-people")?.scrollIntoView({ behavior: "smooth" }); }} className="mr-2 h-10 rounded-xl bg-[#17231c] px-3 text-sm font-semibold text-white">Dossier</button>
                          {(item.role === "member" || item.role === "partner" || item.role === "admin") && <button onClick={() => setBillingMember(item)} className="mr-2 h-10 rounded-xl border border-stone-200 px-3 text-sm font-semibold hover:bg-stone-100">
                            Abrechnung
                          </button>}
                          <button
                            onClick={() => {
                              setBonusAmount("2");
                              setBonusTarget(item);
                            }}
                            className="h-10 rounded-xl border border-stone-200 px-3 text-sm font-semibold hover:bg-stone-100"
                          >
                            Stunden schenken
                          </button>
                          {item.role !== "admin" && <button onClick={() => toggleMemberActive(item)} className={`ml-2 h-10 rounded-xl border px-3 text-sm font-semibold ${item.active ? "border-red-100 text-red-700 hover:bg-red-50" : "border-emerald-200 text-emerald-700 hover:bg-emerald-50"}`}>{item.active ? "Deaktivieren" : "Aktivieren"}</button>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div id="admin-files" className={`${adminTab !== "documents" ? "hidden " : ""}mt-6 scroll-mt-6 grid gap-6 xl:grid-cols-2`}>
            <section className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
              <div><p className="text-sm font-medium text-emerald-700">Getrennt von Rechnungen</p><h2 className="mt-1 text-xl font-semibold">Kautionen</h2></div>
              <div className="mt-5 divide-y divide-stone-100">
                {managedMembers.filter((item) => item.role === "member" || item.role === "admin").map((item) => { const deposit = deposits.find((entry) => entry.member_id === item.id); const open = Math.max((deposit?.agreed_amount ?? 0) - (deposit?.received_amount ?? 0), 0); return (
                  <div key={item.id} className="flex items-center justify-between gap-3 py-4"><div><p className="font-semibold">{item.name}</p><p className={`mt-1 text-sm ${open > 0 ? "text-amber-700" : "text-emerald-700"}`}>{deposit ? `${Number(deposit.received_amount).toLocaleString("de-AT", { style: "currency", currency: "EUR" })} eingegangen${open > 0 ? ` · ${open.toLocaleString("de-AT", { style: "currency", currency: "EUR" })} offen` : ""}` : "Noch nicht erfasst"}</p></div><button onClick={() => { if (!deposit) setDeposits((current) => [...current, { member_id: item.id, agreed_amount: 0, received_amount: 0, returned_amount: 0, received_at: null, note: null }]); setDepositMember(item); }} className="h-10 rounded-xl border border-stone-200 px-3 text-sm font-semibold hover:bg-stone-100">Bearbeiten</button></div>
                ); })}
              </div>
            </section>

            <section className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
              <div><p className="text-sm font-medium text-emerald-700">Privater Dokumentenspeicher</p><h2 className="mt-1 text-xl font-semibold">Verträge & Hausordnung</h2></div>
              <div className="mt-5 space-y-3">
                {managedMembers.filter((item) => item.role === "member" || item.role === "admin").map((item) => (
                  <div key={item.id} className="rounded-2xl bg-stone-50 p-4"><div className="flex items-center justify-between"><div><p className="font-semibold">{item.name}</p><p className="mt-1 text-xs text-stone-500">{documents.filter((doc) => doc.member_id === item.id).length} Dokumente</p></div><label className="flex h-10 cursor-pointer items-center gap-2 rounded-xl bg-white px-3 text-sm font-semibold shadow-sm"><Upload size={15} /> Mietvertrag<input type="file" accept="application/pdf" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) uploadMemberDocument(item, file, "mietvertrag"); event.target.value = ""; }} /></label></div>{documents.filter((doc) => doc.member_id === item.id).map((doc) => <button key={doc.id} onClick={() => downloadMemberDocument(doc)} className="mt-3 flex w-full items-center gap-2 text-left text-sm text-stone-600 hover:text-emerald-800"><FileText size={15} />{doc.title}<Download size={14} className="ml-auto" /></button>)}</div>
                ))}
              </div>
            </section>
          </div>

          <div id="admin-invoices" className={`${adminTab !== "invoices" ? "hidden " : ""}mt-6 scroll-mt-6`}>
            <section className="rounded-3xl bg-[#17231c] p-5 text-white shadow-sm sm:p-7">
              <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[#c9ff70]">Automatische Abrechnung</p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Nur noch Zahlung kontrollieren.</h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-300">Am 29. jedes Monats werden die Rechnungen für den Folgemonat automatisch erstellt, nummeriert und im Portal des jeweiligen Mieters abgelegt.</p>
                </div>
                <button onClick={generateMonthlyInvoices} disabled={generatingInvoices} className="flex h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold text-stone-900 hover:bg-stone-100 disabled:opacity-60">
                  <FileText size={17} /> {generatingInvoices ? "Wird erstellt …" : "Jetzt prüfen & erstellen"}
                </button>
              </div>
            </section>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <article className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm"><p className="text-sm text-stone-500">Offen</p><p className="mt-1 text-2xl font-semibold">{openInvoices.length}</p><p className="mt-1 text-xs text-stone-400">{openInvoiceGross.toLocaleString("de-AT", { style: "currency", currency: "EUR" })} ausständig</p></article>
              <article className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm"><p className="text-sm text-stone-500">Überfällig</p><p className={`mt-1 text-2xl font-semibold ${overdueInvoices.length ? "text-red-700" : "text-stone-900"}`}>{overdueInvoices.length}</p><p className="mt-1 text-xs text-stone-400">benötigen deine Kontrolle</p></article>
              <article className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm"><p className="text-sm text-stone-500">Bezahlt</p><p className="mt-1 text-2xl font-semibold text-emerald-700">{invoices.filter((invoice) => invoice.status === "paid").length}</p><p className="mt-1 text-xs text-stone-400">Zahlungseingänge bestätigt</p></article>
            </div>

            <section className="mt-4 rounded-3xl border border-stone-200 bg-white p-4 shadow-sm sm:p-6">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <div><p className="text-sm font-medium text-emerald-700">Mieterübersicht</p><h3 className="mt-1 text-xl font-semibold">Rechnungen nach Person</h3></div>
                <select value={invoiceMemberFilter} onChange={(event) => setInvoiceMemberFilter(event.target.value)} className="h-11 min-w-56 rounded-xl border border-stone-300 bg-white px-3 text-sm font-semibold outline-none focus:border-emerald-700" aria-label="Mieter auswählen">
                  <option value="all">Alle Mieter</option>
                  {billingMembers.map((billingMemberItem) => <option key={billingMemberItem.id} value={billingMemberItem.id}>{billingMemberItem.billing_name || billingMemberItem.name}{billingMemberItem.office_name ? ` · ${billingMemberItem.office_name}` : ""}</option>)}
                </select>
              </div>
              {draftInvoices.length > 0 && <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{draftInvoices.length} älterer Entwurf ist noch vorhanden und kann einmalig finalisiert werden. Neue Rechnungen werden automatisch fertig erstellt.</p>}

              <div className="mt-5 space-y-4">
                {invoiceGroups.length === 0 ? <p className="rounded-2xl bg-stone-50 p-6 text-sm text-stone-500">Für diese Auswahl sind noch keine Rechnungen vorhanden.</p> : invoiceGroups.map((group) => {
                  const groupOpen = group.invoices.filter((invoice) => invoice.status === "final");
                  return (
                    <article key={group.member.id} className="overflow-hidden rounded-2xl border border-stone-200">
                      <div className="flex flex-col justify-between gap-3 bg-stone-50 px-4 py-4 sm:flex-row sm:items-center sm:px-5">
                        <div><p className="font-semibold">{group.member.billing_name || group.member.name}</p><p className="mt-1 text-xs text-stone-500">{group.member.office_name || group.member.email}</p></div>
                        <div className="flex items-center gap-2"><span className={`rounded-full px-3 py-1 text-xs font-semibold ${groupOpen.length ? "bg-amber-100 text-amber-900" : "bg-emerald-100 text-emerald-900"}`}>{groupOpen.length ? `${groupOpen.length} offen` : "Alles bezahlt"}</span><span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-stone-500">{group.invoices.length} Rechnungen</span></div>
                      </div>
                      <div className="divide-y divide-stone-100">
                        {group.invoices.map((invoice) => (
                          <div key={invoice.id} className="flex flex-col justify-between gap-4 p-4 sm:flex-row sm:items-center sm:px-5">
                            <div className="flex min-w-0 items-center gap-3">
                              <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${invoice.status === "paid" ? "bg-emerald-50 text-emerald-700" : "bg-stone-100 text-stone-700"}`}><FileText size={18} /></div>
                              <div className="min-w-0"><p className="truncate font-semibold">{invoice.invoice_number || "Alter Entwurf"} · {new Date(invoice.billing_month).toLocaleDateString("de-AT", { month: "long", year: "numeric" })}</p><p className="mt-1 text-sm text-stone-500">{invoiceGross(invoice).toLocaleString("de-AT", { style: "currency", currency: "EUR" })} brutto{invoice.paid_at ? ` · bezahlt am ${formatInTimeZone(invoice.paid_at, TZ, "dd.MM.yyyy")}` : ` · fällig am ${new Date(invoice.due_date).toLocaleDateString("de-AT")}`}</p></div>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                              <span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${invoice.status === "draft" ? "bg-amber-50 text-amber-800" : invoice.status === "paid" ? "bg-emerald-50 text-emerald-800" : "bg-stone-100 text-stone-700"}`}>{invoice.status === "draft" ? "Alter Entwurf" : invoice.status === "paid" ? "Bezahlt" : "Offen"}</span>
                              {invoice.status === "draft" && <button onClick={() => finalizeInvoice(invoice)} className="h-10 rounded-xl bg-[#17231c] px-3 text-sm font-semibold text-white">Einmalig finalisieren</button>}
                              {invoice.status === "final" && <button onClick={() => setPaymentDraft({ invoice, paidOn: formatInTimeZone(new Date(), TZ, "yyyy-MM-dd") })} className="h-10 rounded-xl bg-emerald-700 px-3 text-sm font-semibold text-white hover:bg-emerald-800">Als bezahlt markieren</button>}
                              {invoice.status === "paid" && <button onClick={() => undoInvoicePayment(invoice)} className="h-10 rounded-xl border border-stone-200 px-3 text-sm font-semibold hover:bg-stone-100">Korrigieren</button>}
                              {(invoice.status === "final" || invoice.status === "paid") && <button onClick={() => prepareInvoiceEmail(invoice)} className="flex h-10 items-center gap-2 rounded-xl border border-stone-200 px-3 text-sm font-semibold hover:bg-stone-100"><Send size={15} /> E-Mail</button>}
                              <button onClick={() => downloadInvoice(invoice)} className="flex h-10 items-center gap-2 rounded-xl border border-stone-200 px-3 text-sm font-semibold hover:bg-stone-100" aria-label="Rechnung herunterladen"><Download size={15} /> PDF</button>
                              {(invoice.status === "draft" || invoice.status === "final") && <button onClick={() => cancelInvoice(invoice)} className="h-10 rounded-xl px-2 text-xs font-medium text-stone-400 hover:bg-red-50 hover:text-red-700">Stornieren</button>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 md:hidden">
            <button onClick={() => setView("dashboard")} className="h-12 rounded-xl bg-white text-sm font-semibold shadow-sm">Startseite</button>
            <button onClick={() => setView("calendar")} className="h-12 rounded-xl bg-white text-sm font-semibold shadow-sm">Meetingraum</button>
            <button onClick={() => setView("tour")} className="h-12 rounded-xl bg-white text-sm font-semibold shadow-sm">Rundgang</button>
            <button onClick={() => setView("about")} className="h-12 rounded-xl bg-white text-sm font-semibold shadow-sm">Über uns</button>
            <button onClick={() => setView("admin")} className="h-12 rounded-xl bg-[#17231c] text-sm font-semibold text-white">Admin</button>
          </div>
        </section>
      )}

      {view === "calendar" && (
      <section className="mx-auto max-w-[1500px] px-4 py-5 sm:px-6 sm:py-8">
        {demo && (
          <div className="mb-5 flex items-center justify-between gap-4 rounded-2xl border border-lime-200 bg-lime-50 px-4 py-3 text-sm text-lime-950">
            <span><strong>Lokale Vorschau</strong> · Buchungen funktionieren hier als Demo und werden beim Neuladen zurückgesetzt.</span>
            <span className="hidden rounded-full bg-white px-3 py-1 text-xs font-semibold sm:inline">Demo-Modus</span>
          </div>
        )}
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              {format(weekStart, "d. MMM", { locale: de })} – {format(weekEnd, "d. MMM yyyy", { locale: de })}
            </h1>
            <p className="mt-1 text-sm text-stone-500">{loadingBookings ? "Wird aktualisiert …" : `${bookings.length} Buchung${bookings.length === 1 ? "" : "en"} in dieser Woche`}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setWeekStart((current) => addWeeks(current, -1))}
              className="grid h-11 w-11 place-items-center rounded-xl border border-stone-200 bg-white hover:bg-stone-100"
              aria-label="Vorherige Woche"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              onClick={() => setWeekStart(startOfWeek(toZonedTime(new Date(), TZ), { weekStartsOn: 1 }))}
              disabled={isSameWeek(weekStart, toZonedTime(new Date(), TZ), { weekStartsOn: 1 })}
              className="h-11 rounded-xl border border-stone-200 bg-white px-4 text-sm font-medium hover:bg-stone-100 disabled:text-stone-400"
            >
              Heute
            </button>
            <button
              onClick={() => setWeekStart((current) => addWeeks(current, 1))}
              className="grid h-11 w-11 place-items-center rounded-xl border border-stone-200 bg-white hover:bg-stone-100"
              aria-label="Nächste Woche"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>

        <div className="-mx-4 overflow-x-auto px-4 pb-5 sm:-mx-6 sm:px-6">
          <div className="grid min-w-[1120px] grid-cols-[56px_repeat(7,minmax(145px,1fr))] overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
            <div className="sticky left-0 z-20 border-r border-stone-200 bg-white" />
            {days.map((day) => {
              const today = isSameDay(day, toZonedTime(new Date(), TZ));
              return (
                <div key={day.toISOString()} className={`border-r border-stone-200 px-3 py-3 text-center last:border-r-0 ${today ? "bg-emerald-50" : ""}`}>
                  <p className="text-xs font-medium uppercase tracking-wider text-stone-500">{format(day, "EEE", { locale: de })}</p>
                  <p className={`mt-1 text-lg font-semibold ${today ? "text-emerald-800" : ""}`}>{format(day, "d.")}</p>
                </div>
              );
            })}

            <div className="sticky left-0 z-20 border-r border-t border-stone-200 bg-white">
              {times.slice(0, -1).map((time) => (
                <div key={time} style={{ height: SLOT_HEIGHT }} className="relative pr-2 text-right text-[11px] text-stone-400">
                  <span className="-translate-y-2 bg-white pl-1">{time.endsWith(":00") ? time : ""}</span>
                </div>
              ))}
            </div>

            {days.map((day) => {
              const dayBookings = bookings.filter((booking) =>
                isSameDay(toZonedTime(new Date(booking.start_at), TZ), day),
              );
              return (
                <div
                  key={day.toISOString()}
                  className="relative border-r border-t border-stone-200 last:border-r-0"
                  style={{ height: (END_HOUR - START_HOUR) * 2 * SLOT_HEIGHT }}
                >
                  {times.slice(0, -1).map((time, index) => (
                    <button
                      key={time}
                      onClick={() => openBooking(day, time)}
                      className={`absolute left-0 right-0 border-b border-stone-100 text-left hover:bg-emerald-50/70 focus:z-10 focus:bg-emerald-50 focus:outline-2 focus:outline-emerald-600 ${index % 2 === 0 ? "border-t border-t-stone-200" : ""}`}
                      style={{ top: index * SLOT_HEIGHT, height: SLOT_HEIGHT }}
                      aria-label={`${format(day, "EEEE, d. MMMM", { locale: de })}, ${time} buchen`}
                    />
                  ))}
                  {dayBookings.map((booking) => {
                    const start = toZonedTime(new Date(booking.start_at), TZ);
                    const end = toZonedTime(new Date(booking.end_at), TZ);
                    const top = ((start.getHours() * 60 + start.getMinutes() - START_HOUR * 60) / 30) * SLOT_HEIGHT;
                    const height = Math.max(((end.getTime() - start.getTime()) / 1_800_000) * SLOT_HEIGHT, 44);
                    const own = booking.member_id === member.id;
                    return (
                      <article
                        key={booking.id}
                        className={`absolute left-1 right-1 z-10 overflow-hidden rounded-lg border p-2 text-xs shadow-sm ${own ? "border-emerald-500 bg-emerald-100 text-emerald-950" : "border-sky-200 bg-sky-100 text-sky-950"}`}
                        style={{ top: Math.max(top + 2, 2), height: Math.max(height - 4, 40) }}
                      >
                        <p className="truncate font-semibold">{memberName(booking)}{own ? " · Du" : ""}</p>
                        <p className="mt-0.5 whitespace-nowrap font-medium">
                          {formatInTimeZone(booking.start_at, TZ, "HH:mm")}–{formatInTimeZone(booking.end_at, TZ, "HH:mm")}
                        </p>
                        {booking.note && <p className="mt-1 truncate text-[11px] opacity-80">{booking.note}</p>}
                        {height >= 100 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            <a
                              href={googleCalendarUrl(booking)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="grid h-8 w-8 place-items-center rounded-md bg-white/80 hover:bg-white"
                              aria-label="In Google Kalender öffnen"
                              title="In Google Kalender"
                            >
                              <CalendarPlus size={14} />
                            </a>
                            {own && (
                              <button
                                onClick={() => cancelBooking(booking)}
                                className="grid h-8 w-8 place-items-center rounded-md bg-white/80 text-red-700 hover:bg-white"
                                aria-label="Buchung stornieren"
                                title="Stornieren"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
        <p className="text-center text-xs text-stone-500 sm:hidden">Seitlich wischen für weitere Tage</p>
        <div className="mt-4 grid grid-cols-2 gap-2 md:hidden">
          <button onClick={() => setView("dashboard")} className="h-12 rounded-xl bg-white text-sm font-semibold shadow-sm">Startseite</button>
          <button onClick={() => setView("calendar")} className="h-12 rounded-xl bg-[#17231c] text-sm font-semibold text-white">Meetingraum</button>
          <button onClick={() => setView("tour")} className="h-12 rounded-xl bg-white text-sm font-semibold shadow-sm">Rundgang</button>
          <button onClick={() => setView("about")} className="h-12 rounded-xl bg-white text-sm font-semibold shadow-sm">Über uns</button>
          {member.role === "admin" && <button onClick={() => setView("admin")} className="h-12 rounded-xl bg-white text-sm font-semibold shadow-sm">Admin</button>}
        </div>
      </section>
      )}

      {draft && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-stone-950/35 p-0 sm:items-center sm:p-5" onMouseDown={(event) => event.target === event.currentTarget && setDraft(null)}>
          <section className="w-full max-w-lg rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl sm:p-7" role="dialog" aria-modal="true" aria-labelledby="booking-title">
            <div className="mb-6 flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-emerald-700">Meetingraum</p>
                <h2 id="booking-title" className="mt-1 text-2xl font-semibold tracking-tight">Buchen</h2>
              </div>
              <button onClick={() => setDraft(null)} className="grid h-11 w-11 place-items-center rounded-xl bg-stone-100 hover:bg-stone-200" aria-label="Schließen">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={saveBooking} className="space-y-5">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-stone-700">Datum</span>
                <input type="date" required value={draft.date} onChange={(event) => setDraft({ ...draft, date: event.target.value })} className="h-13 w-full rounded-xl border border-stone-300 px-4 outline-none focus:border-emerald-700 focus:ring-3 focus:ring-emerald-700/10" />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label>
                  <span className="mb-2 block text-sm font-medium text-stone-700">Von</span>
                  <select value={draft.start} onChange={(event) => setDraft({ ...draft, start: event.target.value })} className="h-13 w-full rounded-xl border border-stone-300 bg-white px-4 outline-none focus:border-emerald-700">
                    {times.slice(0, -1).map((time) => <option key={time}>{time}</option>)}
                  </select>
                </label>
                <label>
                  <span className="mb-2 block text-sm font-medium text-stone-700">Bis</span>
                  <select value={draft.end} onChange={(event) => setDraft({ ...draft, end: event.target.value })} className="h-13 w-full rounded-xl border border-stone-300 bg-white px-4 outline-none focus:border-emerald-700">
                    {times.slice(1).map((time) => <option key={time}>{time}</option>)}
                  </select>
                </label>
              </div>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-stone-700">Notiz <span className="font-normal text-stone-400">optional</span></span>
                <input maxLength={120} value={draft.note} onChange={(event) => setDraft({ ...draft, note: event.target.value })} placeholder="z. B. Kundentermin" className="h-13 w-full rounded-xl border border-stone-300 px-4 outline-none focus:border-emerald-700 focus:ring-3 focus:ring-emerald-700/10" />
              </label>
              {draftDurationHours(draft) > 0 && (
                <div className={`rounded-xl p-4 text-sm ${draftDurationHours(draft) > remainingHours ? "bg-amber-50 text-amber-950" : "bg-emerald-50 text-emerald-950"}`}>
                  <p className="font-semibold">
                    {draftDurationHours(draft).toLocaleString("de-AT")} Stunden ·{" "}
                    {draftDurationHours(draft) > remainingHours
                      ? `${((draftDurationHours(draft) - remainingHours) * 12).toLocaleString("de-AT", { style: "currency", currency: "EUR" })} netto zusätzlich`
                      : "im Monatskontingent enthalten"}
                  </p>
                  <p className="mt-1 opacity-70">Nach der Buchung bleiben {Math.max(remainingHours - draftDurationHours(draft), 0).toLocaleString("de-AT")} Freistunden.</p>
                </div>
              )}
              {formError && <p className="rounded-xl bg-red-50 p-4 text-sm font-medium text-red-800" role="alert">{formError}</p>}
              <button disabled={saving} className="flex h-13 w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 font-medium text-white hover:bg-emerald-800 disabled:opacity-60">
                <Clock3 size={18} />
                {saving ? "Wird gespeichert …" : "Raum buchen"}
              </button>
            </form>
          </section>
        </div>
      )}

      {issueDraft && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-stone-950/35 p-0 sm:items-center sm:p-5" onMouseDown={(event) => event.target === event.currentTarget && setIssueDraft(null)}>
          <section className="w-full max-w-lg rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl sm:p-7" role="dialog" aria-modal="true" aria-labelledby="issue-title">
            <div className="mb-6 flex items-start justify-between">
              <div>
                <div className="mb-4 grid h-11 w-11 place-items-center rounded-2xl bg-amber-100 text-amber-800"><CircleAlert size={21} /></div>
                <h2 id="issue-title" className="text-2xl font-semibold tracking-tight">Etwas melden</h2>
                <p className="mt-2 text-sm leading-6 text-stone-500">Kurz auswählen, abschicken – wir kümmern uns darum.</p>
              </div>
              <button onClick={() => setIssueDraft(null)} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-stone-100 hover:bg-stone-200" aria-label="Schließen">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={submitIssue} className="space-y-5">
              <fieldset>
                <legend className="mb-2 text-sm font-medium text-stone-700">Worum geht es?</legend>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {["Kaffee", "Drucker", "WLAN", "Reinigung", "Technik", "Sonstiges"].map((category) => (
                    <button
                      type="button"
                      key={category}
                      onClick={() => setIssueDraft({ ...issueDraft, category })}
                      className={`h-12 rounded-xl border text-sm font-medium transition ${issueDraft.category === category ? "border-[#17231c] bg-[#17231c] text-white" : "border-stone-200 bg-white text-stone-700 hover:bg-stone-50"}`}
                    >
                      {category}
                    </button>
                  ))}
                </div>
              </fieldset>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-stone-700">Kurzer Hinweis <span className="font-normal text-stone-400">optional</span></span>
                <textarea
                  maxLength={300}
                  rows={3}
                  value={issueDraft.note}
                  onChange={(event) => setIssueDraft({ ...issueDraft, note: event.target.value })}
                  placeholder="Was genau ist los?"
                  className="w-full resize-none rounded-xl border border-stone-300 px-4 py-3 outline-none focus:border-emerald-700 focus:ring-3 focus:ring-emerald-700/10"
                />
                <span className="mt-1 block text-right text-xs text-stone-400">{issueDraft.note.length}/300</span>
              </label>
              {issueError && <p className="rounded-xl bg-red-50 p-4 text-sm font-medium text-red-800" role="alert">{issueError}</p>}
              <button disabled={sendingIssue} className="flex h-13 w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 font-medium text-white hover:bg-emerald-800 disabled:opacity-60">
                <Send size={18} />
                {sendingIssue ? "Wird gesendet …" : "Meldung senden"}
              </button>
            </form>
          </section>
        </div>
      )}

      {bonusTarget && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-stone-950/35 p-0 sm:items-center sm:p-5" onMouseDown={(event) => event.target === event.currentTarget && setBonusTarget(null)}>
          <section className="w-full max-w-md rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl sm:p-7" role="dialog" aria-modal="true" aria-labelledby="bonus-title">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-emerald-700">Monatliche Gutschrift</p>
                <h2 id="bonus-title" className="mt-1 text-2xl font-semibold tracking-tight">Stunden für {bonusTarget.name}</h2>
                <p className="mt-2 text-sm text-stone-500">Gültig ausschließlich für {format(new Date(), "MMMM yyyy", { locale: de })}.</p>
              </div>
              <button onClick={() => setBonusTarget(null)} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-stone-100 hover:bg-stone-200" aria-label="Schließen"><X size={20} /></button>
            </div>
            <form onSubmit={grantBonusHours} className="mt-6 space-y-5">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-stone-700">Bonusstunden</span>
                <select value={bonusAmount} onChange={(event) => setBonusAmount(event.target.value)} className="h-13 w-full rounded-xl border border-stone-300 bg-white px-4 outline-none focus:border-emerald-700">
                  {[0.5, 1, 1.5, 2, 3, 4, 6, 12].map((hours) => <option key={hours} value={hours}>{hours.toLocaleString("de-AT")} Stunden</option>)}
                </select>
              </label>
              <div className="rounded-xl bg-stone-50 p-4 text-sm text-stone-600">
                Danach verfügt {bonusTarget.name} über insgesamt <strong>{(12 + bonusTarget.bonusHours + Number(bonusAmount)).toLocaleString("de-AT")} Freistunden</strong> in diesem Monat.
              </div>
              <button className="h-13 w-full rounded-xl bg-emerald-700 font-semibold text-white hover:bg-emerald-800">Gutschrift vergeben</button>
            </form>
          </section>
        </div>
      )}

      {inviteDraft && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-stone-950/35 p-0 sm:items-center sm:p-5" onMouseDown={(event) => event.target === event.currentTarget && setInviteDraft(null)}>
          <section className="w-full max-w-md rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl sm:p-7" role="dialog" aria-modal="true" aria-labelledby="invite-title">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-emerald-700">Persönlicher Zugang</p>
                <h2 id="invite-title" className="mt-1 text-2xl font-semibold tracking-tight">Person einladen</h2>
                <p className="mt-2 text-sm leading-6 text-stone-500">Die Person erhält einen sicheren Einladungslink und legt einmalig ihr eigenes Passwort fest.</p>
              </div>
              <button onClick={() => setInviteDraft(null)} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-stone-100 hover:bg-stone-200" aria-label="Schließen"><X size={20} /></button>
            </div>
            <form onSubmit={inviteMember} className="mt-6 space-y-4">
              <fieldset>
                <legend className="mb-2 text-sm font-medium text-stone-700">Zugangsart</legend>
                <div className="grid grid-cols-3 gap-2 rounded-xl bg-stone-100 p-1">
                  <button type="button" onClick={() => setInviteDraft({ ...inviteDraft, role: "employee" })} className={`h-11 rounded-lg text-sm font-semibold ${inviteDraft.role === "employee" ? "bg-white text-stone-900 shadow-sm" : "text-stone-500"}`}>Mitarbeiter</button>
                  <button type="button" onClick={() => setInviteDraft({ ...inviteDraft, role: "member" })} className={`h-11 rounded-lg text-sm font-semibold ${inviteDraft.role === "member" ? "bg-white text-stone-900 shadow-sm" : "text-stone-500"}`}>Mieter</button>
                  <button type="button" onClick={() => setInviteDraft({ ...inviteDraft, role: "partner" })} className={`h-11 rounded-lg text-sm font-semibold ${inviteDraft.role === "partner" ? "bg-white text-stone-900 shadow-sm" : "text-stone-500"}`}>Partner</button>
                </div>
              </fieldset>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-stone-700">Name</span>
                <input required value={inviteDraft.name} onChange={(event) => setInviteDraft({ ...inviteDraft, name: event.target.value })} className="h-13 w-full rounded-xl border border-stone-300 px-4 outline-none focus:border-emerald-700" placeholder="Vor- und Nachname" />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-stone-700">E-Mail-Adresse</span>
                <input required type="email" value={inviteDraft.email} onChange={(event) => setInviteDraft({ ...inviteDraft, email: event.target.value })} className="h-13 w-full rounded-xl border border-stone-300 px-4 outline-none focus:border-emerald-700" placeholder="name@beispiel.at" />
              </label>
              <div className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-950">{inviteDraft.role === "employee" ? <><strong>Mitarbeiterzugang:</strong> 12 Stunden je Kalendermonat plus Bonusstunden. Keine Rechnungen, Kautionen oder Mietverträge.</> : inviteDraft.role === "partner" ? <><strong>Nutzungspartner:</strong> 12 Stunden plus Bonusstunden und reguläre Rechnungen. Keine Kautionen oder Mietverträge.</> : <><strong>Mieterzugang:</strong> 12 Stunden je Kalendermonat; Zusatznutzung wird abgerechnet. Rechnungen und freigegebene Vertragsdokumente sind sichtbar.</>}</div>
              {inviteError && <p className="rounded-xl bg-red-50 p-4 text-sm font-medium text-red-800">{inviteError}</p>}
              <button disabled={inviting} className="h-13 w-full rounded-xl bg-emerald-700 font-semibold text-white hover:bg-emerald-800 disabled:opacity-60">{inviting ? "Einladung wird gesendet …" : "Einladung senden"}</button>
            </form>
          </section>
        </div>
      )}

      {billingMember && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-stone-950/35 p-0 sm:items-center sm:p-5" onMouseDown={(event) => event.target === event.currentTarget && setBillingMember(null)}>
          <section className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl sm:p-7" role="dialog" aria-modal="true" aria-labelledby="billing-title">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-emerald-700">Mieterprofil</p>
                <h2 id="billing-title" className="mt-1 text-2xl font-semibold tracking-tight">Abrechnung für {billingMember.name}</h2>
              </div>
              <button onClick={() => setBillingMember(null)} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-stone-100 hover:bg-stone-200" aria-label="Schließen"><X size={20} /></button>
            </div>
            <form onSubmit={saveBillingMember} className="mt-6 space-y-4">
              <label className="block"><span className="mb-2 block text-sm font-medium text-stone-700">Bürozuordnung</span><input value={billingMember.office_name ?? ""} onChange={(event) => setBillingMember({ ...billingMember, office_name: event.target.value })} className="h-12 w-full rounded-xl border border-stone-300 px-4 outline-none focus:border-emerald-700" placeholder="z. B. Büro 3" /></label>
              <label className="block"><span className="mb-2 block text-sm font-medium text-stone-700">Rechnungsempfänger</span><input required value={billingMember.billing_name ?? ""} onChange={(event) => setBillingMember({ ...billingMember, billing_name: event.target.value })} className="h-12 w-full rounded-xl border border-stone-300 px-4 outline-none focus:border-emerald-700" /></label>
              <label className="block"><span className="mb-2 block text-sm font-medium text-stone-700">Rechnungsadresse</span><textarea required rows={3} value={billingMember.billing_address ?? ""} onChange={(event) => setBillingMember({ ...billingMember, billing_address: event.target.value })} className="w-full resize-none rounded-xl border border-stone-300 px-4 py-3 outline-none focus:border-emerald-700" placeholder={"Firma oder Name\nStrasse Hausnummer\nPLZ Ort, Land"} /></label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label><span className="mb-2 block text-sm font-medium text-stone-700">UID <span className="font-normal text-stone-400">optional</span></span><input value={billingMember.billing_uid ?? ""} onChange={(event) => setBillingMember({ ...billingMember, billing_uid: event.target.value })} className="h-12 w-full rounded-xl border border-stone-300 px-4 outline-none focus:border-emerald-700" placeholder="ATU…" /></label>
                <label><span className="mb-2 block text-sm font-medium text-stone-700">Grundmiete netto/Monat</span><input required type="number" min="0" step="0.01" value={billingMember.monthly_rent_net ?? ""} onChange={(event) => setBillingMember({ ...billingMember, monthly_rent_net: event.target.value === "" ? null : Number(event.target.value) })} className="h-12 w-full rounded-xl border border-stone-300 px-4 outline-none focus:border-emerald-700" /></label>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label><span className="mb-2 block text-sm font-medium text-stone-700">Abrechnungsbeginn</span><input required type="date" value={billingMember.contract_start ?? ""} onChange={(event) => setBillingMember({ ...billingMember, contract_start: event.target.value })} className="h-12 w-full rounded-xl border border-stone-300 px-4 outline-none focus:border-emerald-700" /></label>
                <label><span className="mb-2 block text-sm font-medium text-stone-700">Abrechnungsende <span className="font-normal text-stone-400">optional</span></span><input type="date" value={billingMember.contract_end ?? ""} onChange={(event) => setBillingMember({ ...billingMember, contract_end: event.target.value || null })} className="h-12 w-full rounded-xl border border-stone-300 px-4 outline-none focus:border-emerald-700" /></label>
              </div>
              <div className="rounded-xl bg-amber-50 p-4 text-sm leading-6 text-amber-950">Aliquote Grundmieten werden nach den tatsächlichen Kalendertagen des Vertragszeitraums berechnet. Alle Beträge werden mit 20 % USt ausgewiesen.</div>
              <button className="h-13 w-full rounded-xl bg-emerald-700 font-semibold text-white hover:bg-emerald-800">Abrechnungsdaten speichern</button>
            </form>
          </section>
        </div>
      )}
      {paymentDraft && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-stone-950/40 sm:items-center sm:p-6">
          <section className="w-full max-w-md rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl sm:p-7" role="dialog" aria-modal="true" aria-labelledby="payment-title">
            <div className="flex items-start justify-between gap-4"><div><p className="text-sm font-medium text-emerald-700">Zahlungseingang</p><h2 id="payment-title" className="mt-1 text-2xl font-semibold">Bezahlt am</h2><p className="mt-2 text-sm text-stone-500">{paymentDraft.invoice.invoice_number} · {invoiceGross(paymentDraft.invoice).toLocaleString("de-AT", { style: "currency", currency: "EUR" })} brutto</p></div><button onClick={() => setPaymentDraft(null)} className="grid h-11 w-11 place-items-center rounded-full bg-stone-100" aria-label="Schließen"><X size={19} /></button></div>
            <form onSubmit={markInvoicePaid} className="mt-6 space-y-5">
              <label><span className="mb-2 block text-sm font-medium text-stone-700">Zahlungsdatum</span><input required type="date" max={formatInTimeZone(new Date(), TZ, "yyyy-MM-dd")} value={paymentDraft.paidOn} onChange={(event) => setPaymentDraft({ ...paymentDraft, paidOn: event.target.value })} className="h-12 w-full rounded-xl border border-stone-300 px-4 outline-none focus:border-emerald-700" /></label>
              <button type="submit" className="h-12 w-full rounded-xl bg-emerald-700 text-sm font-semibold text-white">Zahlung speichern</button>
            </form>
          </section>
        </div>
      )}

      {depositMember && (() => {
        const deposit = deposits.find((item) => item.member_id === depositMember.id) ?? { member_id: depositMember.id, agreed_amount: 0, received_amount: 0, returned_amount: 0, received_at: null, note: null };
        const update = (changes: Partial<Deposit>) => setDeposits((items) => [...items.filter((item) => item.member_id !== depositMember.id), { ...deposit, ...changes }]);
        return (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-stone-950/35 p-0 sm:items-center sm:p-5" onMouseDown={(event) => event.target === event.currentTarget && setDepositMember(null)}>
            <section className="w-full max-w-md rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl sm:p-7" role="dialog" aria-modal="true" aria-labelledby="deposit-title">
              <div className="flex items-start justify-between"><div><p className="text-sm font-medium text-emerald-700">Sicherheitsleistung</p><h2 id="deposit-title" className="mt-1 text-2xl font-semibold">Kaution · {depositMember.name}</h2></div><button onClick={() => setDepositMember(null)} className="grid h-11 w-11 place-items-center rounded-xl bg-stone-100"><X size={20} /></button></div>
              <form onSubmit={saveDeposit} className="mt-6 space-y-4">
                <label className="block"><span className="mb-2 block text-sm font-medium">Vereinbarte Kaution</span><input type="number" min="0" step="0.01" value={deposit.agreed_amount} onChange={(event) => update({ agreed_amount: Number(event.target.value) })} className="h-12 w-full rounded-xl border border-stone-300 px-4" /></label>
                <label className="block"><span className="mb-2 block text-sm font-medium">Bereits eingegangen</span><input type="number" min="0" step="0.01" value={deposit.received_amount} onChange={(event) => update({ received_amount: Number(event.target.value) })} className="h-12 w-full rounded-xl border border-stone-300 px-4" /></label>
                <label className="block"><span className="mb-2 block text-sm font-medium">Eingangsdatum</span><input type="date" value={deposit.received_at ?? ""} onChange={(event) => update({ received_at: event.target.value || null })} className="h-12 w-full rounded-xl border border-stone-300 px-4" /></label>
                <label className="block"><span className="mb-2 block text-sm font-medium">Notiz</span><textarea rows={2} value={deposit.note ?? ""} onChange={(event) => update({ note: event.target.value || null })} className="w-full rounded-xl border border-stone-300 px-4 py-3" /></label>
                <button className="h-13 w-full rounded-xl bg-emerald-700 font-semibold text-white">Kaution speichern</button>
              </form>
            </section>
          </div>
        );
      })()}

      {toast && <div className="fixed bottom-5 left-1/2 z-[60] -translate-x-1/2 rounded-xl bg-stone-900 px-5 py-3 text-sm font-medium text-white shadow-xl" role="status">{toast}</div>}
    </main>
  );
}
