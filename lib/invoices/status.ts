import { invoiceIsOpen, invoiceIsOverdue, type InvoiceState } from './billing.ts';

// Presentation only: never infer a payment from a date or alter invoice state.
export function invoiceStatus(invoice: InvoiceState, today: string) {
  if (invoice.status === 'paid') return {
    label: 'Bezahlt', icon: 'check',
    badge: 'border-emerald-200 bg-emerald-100 text-emerald-900',
    surface: 'border-emerald-200 border-l-emerald-600 bg-emerald-50/60',
  } as const;
  if (invoiceIsOpen(invoice, today)) return {
    label: invoiceIsOverdue(invoice, today) ? 'Offen · überfällig' : 'Offen', icon: 'alert',
    badge: 'border-red-200 bg-red-100 text-red-900',
    surface: 'border-red-200 border-l-red-600 bg-red-50/60',
  } as const;
  if (invoice.status === 'final') return {
    label: 'Vorausrechnung', icon: 'clock',
    badge: 'border-sky-200 bg-sky-50 text-sky-900',
    surface: 'border-stone-200 border-l-sky-400 bg-white',
  } as const;
  return {
    label: invoice.status === 'draft' ? 'Entwurf' : invoice.status === 'cancelled' ? 'Storniert' : 'Status unbekannt', icon: 'file',
    badge: 'border-stone-200 bg-stone-100 text-stone-700',
    surface: 'border-stone-200 border-l-stone-300 bg-white',
  } as const;
}
