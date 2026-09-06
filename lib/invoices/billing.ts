import { formatInTimeZone } from "date-fns-tz";

export const BILLING_TZ = "Europe/Vienna";
export const dateOnly = (date: Date) => date.toISOString().slice(0, 10);

export function isBillingMonth(value: string): boolean {
  if (!/^\d{4}-\d{2}-01$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && dateOnly(date) === value;
}

export function billingPeriod(month: string) {
  if (!isBillingMonth(month)) throw new Error("invalid_billing_month");
  const start = new Date(`${month}T00:00:00Z`);
  const next = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
  const end = new Date(next.getTime() - 86_400_000);
  return {
    start: month, end: dateOnly(end), days: end.getUTCDate(),
    issueDate: dateOnly(new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() - 1, 25))),
    dueDate: dateOnly(new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 10))),
  };
}

export function scheduledBillingMonths(now = new Date()): string[] {
  const current = formatInTimeZone(now, BILLING_TZ, "yyyy-MM-01");
  const month = new Date(`${current}T00:00:00Z`);
  return Number(formatInTimeZone(now, BILLING_TZ, "d")) >= 25
    ? [current, dateOnly(new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 1)))]
    : [current];
}

export function proratedRent(month: string, rent: number, from: string, until?: string | null) {
  const period = billingPeriod(month);
  const start = from > period.start ? from : period.start;
  const end = until && until < period.end ? until : period.end;
  const days = start > end ? 0 : Math.round((Date.parse(end) - Date.parse(start)) / 86_400_000) + 1;
  return { start, end, days, net: Math.round(rent * days / period.days * 100) / 100, totalDays: period.days };
}

export type InvoiceState = { status: string; issue_date: string; due_date: string; billing_month: string };
export function invoiceIsOpen(invoice: InvoiceState, today: string) {
  return invoice.status === "final" && invoice.issue_date <= today;
}
export function invoiceIsOverdue(invoice: InvoiceState, today: string) {
  return invoiceIsOpen(invoice, today) && invoice.due_date < today;
}

export function isOriginalDocument(document: { title: string; storage_path: string }) {
  return !document.storage_path.includes("/vertraege/nutzungsvereinbarung-entwurf-")
    && !/\bEntwurf\b/i.test(document.title);
}
