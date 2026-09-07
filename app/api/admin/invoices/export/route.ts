import { zipSync, strToU8 } from 'fflate';
import { meetingAuth, meetingJson as json } from '@/lib/members/meeting-api';
import { isBillingMonth, billingPeriod } from '@/lib/invoices/billing';
import { createInvoicePdf } from '@/lib/invoices/pdf';
import { exportOriginal, exportFilename, paymentCsv, type ExportInvoice } from '@/lib/invoices/export';

export const maxDuration = 60;
export async function GET(request: Request) {
  try {
    const auth = await meetingAuth(request, true);
    if (!auth) return json({ error: 'Kein Zugriff.' }, 401);
    const params = new URL(request.url).searchParams, month = params.get('month') ?? '', basis = params.get('basis') ?? 'issue';
    if (!isBillingMonth(month) || !['issue', 'service'].includes(basis)) return json({ error: 'Bitte Monat und Auswahl prüfen.' }, 400);
    const period = billingPeriod(month);
    let query = auth.db.from('invoices').select('id,invoice_number,status,issue_date,due_date,service_period_start,service_period_end,paid_at,invoice_items(description,quantity,unit,unit_price_net,vat_rate,sort_order),invoice_snapshots(recipient_name,recipient_address,recipient_uid,pdf_version)', { count: 'exact' }).in('status', ['final', 'paid', 'cancelled']).not('invoice_number', 'is', null).order('issue_date').order('invoice_number').limit(251);
    query = basis === 'issue' ? query.gte('issue_date', period.start).lte('issue_date', period.end) : query.eq('billing_month', month);
    const { data, error, count } = await query;
    if (error) throw new Error('Rechnungen konnten nicht geladen werden.');
    if (!data?.length) return json({ error: 'Für diese Auswahl sind keine ausgestellten Rechnungen vorhanden.' }, 404);
    if ((count ?? data.length) > 250) return json({ error: 'Zu viele Rechnungen für einen Download. Bitte die Verwaltung kontaktieren.' }, 413);
    const invoices = data as unknown as ExportInvoice[], generatedAt = new Date().toLocaleString('de-AT', { timeZone: 'Europe/Vienna' });
    const files: Record<string, Uint8Array> = { 'Zahlungsuebersicht.csv': strToU8(paymentCsv(invoices, generatedAt)), 'Hinweise.txt': strToU8(`AUFELD21 – Monatsexport ${month.slice(0, 7)}\nAuswahl nach ${basis === 'issue' ? 'Rechnungsdatum' : 'Leistungsmonat'}. Stand: ${generatedAt} (Europe/Vienna).\n\nEnthalten: ausgestellte Rechnungen, Zahlungsübersicht mit aktuellem Portalstatus. Keine Entwürfe. Stornierte Originale sind zur Dokumentation enthalten, stellen aber keine offene Forderung dar. Dieser Export erzeugt keine Stornorechnungen oder Gutschriften.\n\nPDFs verwenden die gespeicherten Empfängerdaten und die ursprüngliche Dokumentversion. Keine Rechnungsnummern oder Zahlungsvermerke werden geändert. Die CSV ist eine Arbeitsübersicht, kein Bankabgleich und keine vollständige Buchhaltung. Nicht als bezahlt markierte Rechnungen bleiben offen.\nPersonenbezogene Unterlagen bitte nur geschützt an berechtigte Empfänger weitergeben.\n`) };
    let size = Object.values(files).reduce((sum, file) => sum + file.length, 0);
    for (const invoice of invoices) {
      const { data: original, version } = exportOriginal(invoice);
      const bytes = await createInvoicePdf(original, version);
      size += bytes.length;
      if (size > 4_000_000) return json({ error: 'Der Export ist für einen einzelnen Download zu groß. Bitte die PDFs einzeln herunterladen.' }, 413);
      files[exportFilename(invoice)] = bytes;
    }
    const zip = zipSync(files, { level: 0 });
    if (zip.length > 4_000_000) return json({ error: 'Der Export ist zu groß. Bitte die PDFs einzeln herunterladen.' }, 413);
    return new Response(Buffer.from(zip), { headers: { 'Content-Type': 'application/zip', 'Content-Disposition': `attachment; filename="AUFELD21-${month.slice(0, 7)}-${basis}.zip"`, 'Cache-Control': 'private, no-store' } });
  } catch (error) { return json({ error: error instanceof Error ? error.message : 'Export nicht verfügbar.' }, 503); }
}
