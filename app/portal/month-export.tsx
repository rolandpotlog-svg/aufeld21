"use client";

import { useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';

export function MonthExport({ supabase }: { supabase: SupabaseClient | null }) {
  const [month, setMonth] = useState(() => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Vienna', year: 'numeric', month: '2-digit' }).format(new Date()));
  const [basis, setBasis] = useState('issue'), [busy, setBusy] = useState(false), [error, setError] = useState('');
  async function download() {
    if (!supabase || busy) return;
    setBusy(true); setError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`/api/admin/invoices/export?month=${encodeURIComponent(month + '-01')}&basis=${basis}`, { headers: { Authorization: `Bearer ${session?.access_token ?? ''}` } });
      if (!response.ok) { const body = await response.json(); throw new Error(body.error); }
      const url = URL.createObjectURL(await response.blob()), link = document.createElement('a');
      link.href = url; link.download = `AUFELD21-${month}-${basis}.zip`; document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e) { setError(e instanceof Error ? e.message : 'Download nicht möglich.'); }
    finally { setBusy(false); }
  }
  return <section className="mt-4 rounded-2xl border border-stone-200 bg-white p-4 sm:p-5">
    <h3 className="font-semibold">Monatsexport für die Buchhaltung</h3><p className="mt-1 text-sm leading-6 text-stone-500">Rechnungs-PDFs und Zahlungsübersicht (CSV) gemeinsam als ZIP. Bestehende Rechnungen bleiben unverändert.</p>
    <div className="mt-4 flex flex-col items-stretch gap-3 sm:flex-row sm:items-end"><label className="min-w-0 text-sm">Monat<input type="month" required value={month} onChange={e => setMonth(e.target.value)} disabled={busy} className="mt-1 block min-h-11 w-full min-w-0 rounded-xl border border-stone-300 bg-white px-3" /></label><label className="min-w-0 text-sm">Auswahl nach<select value={basis} onChange={e => setBasis(e.target.value)} disabled={busy} className="mt-1 block min-h-11 w-full rounded-xl border border-stone-300 bg-white px-3"><option value="issue">Rechnungsdatum</option><option value="service">Leistungsmonat</option></select></label><button disabled={!supabase || busy || !month} onClick={download} className="min-h-11 rounded-xl bg-[#17231c] px-5 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Export wird vorbereitet …' : 'ZIP herunterladen ↓'}</button></div>
    <p className="mt-3 text-xs leading-5 text-stone-500">Zahlungsstatus zum Downloadzeitpunkt. Stornierte Originale sind gekennzeichnet; Entwürfe werden nicht exportiert.</p>
    {error && <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
  </section>;
}
