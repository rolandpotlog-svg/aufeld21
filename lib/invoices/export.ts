import type { InvoicePdfData } from './pdf-v1';

export type ExportItem = { description: string; quantity: number | string; unit: string; unit_price_net: number | string; vat_rate: number | string; sort_order: number };
export type ExportSnapshot = { recipient_name: string; recipient_address: string; recipient_uid: string | null; pdf_version: number };
export type ExportInvoice = { id: string; invoice_number: string | null; status: string; issue_date: string; due_date: string; service_period_start: string; service_period_end: string; paid_at: string | null; invoice_items: ExportItem[]; invoice_snapshots: ExportSnapshot | ExportSnapshot[] | null };
const date = (value: string) => new Date(value).toLocaleDateString('de-AT', { timeZone: 'Europe/Vienna' });
export function exportOriginal(invoice: ExportInvoice): { data: InvoicePdfData; version: number } {
  const snapshot = Array.isArray(invoice.invoice_snapshots) ? invoice.invoice_snapshots[0] : invoice.invoice_snapshots;
  if (!invoice.invoice_number || !['final', 'paid', 'cancelled'].includes(invoice.status) || !snapshot || ![1, 2].includes(snapshot.pdf_version)) throw new Error('Ein Rechnungsoriginal fehlt. Der Export wurde vollständig abgebrochen.');
  const items = [...invoice.invoice_items].sort((a, b) => a.sort_order - b.sort_order).map(item => ({ description: item.description, quantity: Number(item.quantity), unit: item.unit, unitPriceNet: Number(item.unit_price_net), vatRate: Number(item.vat_rate) }));
  if (!items.length || items.some(i => ![i.quantity, i.unitPriceNet, i.vatRate].every(Number.isFinite))) throw new Error('Rechnungspositionen sind nicht vollständig.');
  return { version: snapshot.pdf_version, data: { number: invoice.invoice_number, issueDate: date(invoice.issue_date), dueDate: date(invoice.due_date), servicePeriod: `${date(invoice.service_period_start)} bis ${date(invoice.service_period_end)}`, recipientName: snapshot.recipient_name, recipientAddress: snapshot.recipient_address, recipientUid: snapshot.recipient_uid, items } };
}
export function exportTotals(data: InvoicePdfData, version: number) {
  // Match the frozen renderer, including the historic version's rounding policy.
  const net = data.items.reduce((sum, i) => sum + (version === 1 ? i.quantity * i.unitPriceNet : Math.round(i.quantity * i.unitPriceNet * 100) / 100), 0);
  const rates = new Map<number, number>();
  for (const i of data.items) rates.set(i.vatRate, (rates.get(i.vatRate) ?? 0) + i.quantity * i.unitPriceNet * i.vatRate / 100);
  const vat = version === 1 ? data.items.reduce((sum, i) => sum + i.quantity * i.unitPriceNet * (i.vatRate / 100), 0) : [...rates.values()].reduce((sum, value) => sum + Math.round(value * 100) / 100, 0);
  return { net, vat, gross: net + vat };
}
export function csvCell(value: string) {
  let safe = value.replaceAll('\0', '');
  // Quoting alone does not prevent formula execution in spreadsheet applications.
  if (/^[\s\uFEFF]*[=+@-]/.test(safe) || /^[\t\r\n]/.test(safe)) safe = "'" + safe;
  return '"' + safe.replaceAll('"', '""') + '"';
}
export function paymentCsv(invoices: ExportInvoice[], generatedAt: string) {
  const rows = [['Rechnungsnummer', 'Empfänger', 'Rechnungsdatum', 'Leistung von', 'Leistung bis', 'Zahlbar bis', 'Netto EUR', 'USt EUR', 'Brutto EUR', 'Status', 'Zahlung bestätigt am', 'Export erstellt am']];
  const amount = (value: number) => value.toLocaleString('de-AT', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false });
  for (const invoice of invoices) {
    const { data, version } = exportOriginal(invoice), total = exportTotals(data, version);
    rows.push([data.number, data.recipientName, data.issueDate, date(invoice.service_period_start), date(invoice.service_period_end), data.dueDate, amount(total.net), amount(total.vat), amount(total.gross), ({ final: 'Offen', paid: 'Bezahlt', cancelled: 'Storniert – nicht als Forderung werten' })[invoice.status]!, invoice.paid_at ? date(invoice.paid_at) : '', generatedAt]);
  }
  return '\uFEFF' + rows.map(row => row.map(csvCell).join(';')).join('\r\n') + '\r\n';
}
export const exportFilename = (invoice: ExportInvoice) => `Rechnungen/${(invoice.invoice_number ?? '').replace(/[^a-zA-Z0-9-]/g, '-').slice(0, 80)}-${invoice.id.replace(/[^a-f0-9-]/gi, '')}.pdf`;
