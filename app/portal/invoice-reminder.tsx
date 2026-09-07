"use client";

import { useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { useDialogFocus } from './use-portal-refresh';

type Preview = { recipient: string; subject: string; text: string; fingerprint: string };
export function InvoiceReminder({ invoice, supabase }: { invoice: string; supabase: SupabaseClient | null }) {
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [confirmed, setConfirmed] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null), [error, setError] = useState(''), [done, setDone] = useState(false), [id, setId] = useState('');
  useDialogFocus(open);
  async function request(send = false) {
    if (!supabase || busy || (send && (!confirmed || !preview))) return;
    setBusy(true); setError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`/api/admin/invoices/reminder${send ? '' : '?invoice=' + invoice}`, { method: send ? 'POST' : 'GET', headers: { Authorization: `Bearer ${session?.access_token ?? ''}`, ...(send ? { 'Content-Type': 'application/json' } : {}) }, ...(send ? { body: JSON.stringify({ invoice, id, fingerprint: preview?.fingerprint, confirmed: true }) } : {}) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      if (send) setDone(true); else setPreview(data);
    } catch (e) { setError(e instanceof Error ? e.message : 'Bitte erneut versuchen.'); }
    finally { setBusy(false); }
  }
  return <>
    <button disabled={!supabase} onClick={() => { setOpen(true); setDone(false); setPreview(null); setConfirmed(false); setId(crypto.randomUUID()); void request(); }} className="min-h-10 rounded-xl border border-amber-300 bg-amber-50 px-3 text-sm font-semibold text-amber-900 disabled:opacity-50">Erinnerung prüfen</button>
    {open && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-3 sm:p-6"><section role="dialog" aria-modal="true" aria-labelledby={`reminder-${invoice}`} className="max-h-[90dvh] w-full max-w-xl overflow-y-auto rounded-3xl bg-white p-5 shadow-xl sm:p-7">
      <div className="flex items-start justify-between gap-3"><h2 id={`reminder-${invoice}`} className="text-xl font-semibold">Zahlungserinnerung freigeben</h2><button disabled={busy} aria-label="Schließen" onClick={() => setOpen(false)} className="min-h-11 min-w-11 rounded-xl border border-stone-200">×</button></div>
      {done ? <p role="status" className="mt-5 rounded-xl bg-emerald-50 p-4 text-sm leading-6 text-emerald-900">Zum Versand freigegeben. Den Versandstatus findest du unter „E-Mail & Push“. Das ist noch keine Zustellbestätigung.</p> : <>
        <p className="mt-3 text-sm leading-6 text-stone-600">Es wird erst nach deiner Bestätigung versendet. Bitte vorher den Kontoeingang prüfen.</p>
        {busy && !preview && <p className="mt-5" role="status">Vorschau wird geladen …</p>}
        {preview && <><div className="mt-5 rounded-2xl bg-stone-50 p-4 text-sm"><p className="break-all"><strong>An:</strong> {preview.recipient}</p><p className="mt-2 break-words font-semibold">{preview.subject}</p><p className="mt-4 whitespace-pre-wrap break-words leading-6">{preview.text}</p></div><label className="mt-5 flex items-start gap-3 text-sm leading-6"><input className="mt-1 size-5 shrink-0" type="checkbox" checked={confirmed} disabled={busy} onChange={e => setConfirmed(e.target.checked)} />Ich habe den Kontoeingang geprüft. Die Rechnung ist weiterhin offen.</label><button disabled={busy || !confirmed} onClick={() => void request(true)} className="mt-4 min-h-12 w-full rounded-xl bg-[#17231c] px-5 font-semibold text-white disabled:opacity-50">{busy ? 'Wird freigegeben …' : 'Erinnerung jetzt freigeben'}</button></>}
        {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}
      </>}
    </section></div>}
  </>;
}
