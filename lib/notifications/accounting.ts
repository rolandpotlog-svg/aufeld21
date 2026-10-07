import type { SupabaseClient } from '@supabase/supabase-js';
import { exportOriginal, type ExportInvoice } from '../invoices/export.ts';
import { createInvoicePdf as createV1 } from '../invoices/pdf-v1.ts';
import { createInvoicePdfV2 as createV2 } from '../invoices/pdf-v2.ts';

export async function accountingPdf(invoice: ExportInvoice) {
  if (!['final', 'paid'].includes(invoice.status)) throw new Error('Invoice is not issued');
  const { data, version } = exportOriginal(invoice);
  const bytes = await (version === 1 ? createV1(data) : createV2(data));
  const content = Buffer.from(bytes).toString('base64');
  if (content.length > 4_000_000) throw new Error('Invoice attachment too large');
  return content;
}

// This prepares originals only. The existing database mail worker owns dispatch,
// quotas, acknowledgements and retries; no provider key enters this route.
export async function prepareAccounting(db: SupabaseClient) {
  const { data: jobs, error } = await db.rpc('accounting_claim');
  if (error) throw new Error('Accounting queue unavailable');
  let prepared = 0, deferred = 0;
  for (const job of (jobs ?? []) as { job_id: string; invoice_id: string; lease: string }[]) {
    try {
      const { data: invoice, error: invoiceError } = await db.from('invoices').select(`
        id,invoice_number,status,issue_date,due_date,service_period_start,service_period_end,paid_at,
        invoice_items(description,quantity,unit,unit_price_net,vat_rate,sort_order),
        invoice_snapshots(recipient_name,recipient_address,recipient_uid,pdf_version)
      `).eq('id', job.invoice_id).single();
      if (invoiceError || !invoice) throw new Error('Original unavailable');
      const content = await accountingPdf(invoice as ExportInvoice);
      const result = await db.rpc('accounting_prepare', {
        target_job: job.job_id, target_lease: job.lease, pdf_base64: content,
      });
      if (result.error) throw new Error('Preparation acknowledgement unavailable');
      if (result.data) prepared++; else deferred++;
    } catch {
      // No invoice data or credentials in logs. The bounded lease is retried;
      // after five attempts the existing admin mail log requests a review.
      deferred++;
    }
  }
  return { processed: jobs?.length ?? 0, prepared, deferred };
}
