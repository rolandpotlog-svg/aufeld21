import { CircleAlert, CircleCheck, Clock3, FileText } from 'lucide-react';
import { invoiceStatus } from '@/lib/invoices/status';
import type { InvoiceState } from '@/lib/invoices/billing';

export function InvoiceStatusBadge({ invoice, today }: { invoice: InvoiceState; today: string }) {
  const status = invoiceStatus(invoice, today);
  const Icon = { check: CircleCheck, alert: CircleAlert, clock: Clock3, file: FileText }[status.icon];
  return <span className={`inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold ${status.badge}`}>
    <Icon size={16} aria-hidden="true" className="shrink-0" />{status.label}
  </span>;
}
