"use client";

import { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';

type Enquiry = { id: string; name: string; email: string; phone: string; offer: string; message: string; status: string; notes: string; version: number; created_at: string };
const states: Record<string, string> = { new: 'Neu', appointment: 'Besichtigung', done: 'Erledigt' };
const control = 'min-h-11 rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm';

export function EnquiryBadge({ supabase, revision }: { supabase: SupabaseClient | null; revision: number }) {
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    if (!supabase) return;
    let current = true;
    void supabase.from('contact_requests').select('id', { head: true, count: 'exact' }).eq('status', 'new').then(r => { if (current) setCount(r.error ? null : r.count); });
    return () => { current = false; };
  }, [supabase, revision]);
  return count ? <span aria-label={`${count} neue Anfragen`} className="grid min-h-5 min-w-5 place-items-center rounded-full bg-red-600 px-1 text-[10px] text-white">{count > 9 ? '9+' : count}</span> : null;
}

export function ContactRequests({ supabase, revision, onChange }: { supabase: SupabaseClient | null; revision: number; onChange: () => void }) {
  const [rows, setRows] = useState<Enquiry[]>([]), [total, setTotal] = useState(0);
  const [status, setStatus] = useState('new'), [page, setPage] = useState(0), [refresh, setRefresh] = useState(0);
  const [selected, setSelected] = useState<Enquiry | null>(null);
  const [loading, setLoading] = useState(true), [saving, setSaving] = useState(false), [error, setError] = useState('');
  useEffect(() => {
    if (!supabase) return;
    let current = true;
    let query = supabase.from('contact_requests').select('*', { count: 'exact' }).order('created_at', { ascending: false }).order('id').range(page * 25, page * 25 + 24);
    if (status !== 'all') query = query.eq('status', status);
    void query.then(result => {
      if (!current) return;
      setLoading(false);
      if (result.error) { setError('Anfragen konnten nicht geladen werden. Bitte aktualisieren.'); return; }
      setRows(result.data); setTotal(result.count ?? 0);
    });
    return () => { current = false; };
  }, [supabase, revision, refresh, status, page]);
  async function save() {
    if (!supabase || !selected || saving) return;
    setSaving(true); setError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch('/api/admin/contacts', { method: 'PATCH', headers: { Authorization: `Bearer ${session?.access_token ?? ''}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ id: selected.id, notes: selected.notes, status: selected.status, version: selected.version }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error);
      setSelected(null); setRefresh(x => x + 1); onChange();
    } catch (e) { setError(e instanceof Error ? e.message : 'Speichern fehlgeschlagen.'); }
    finally { setSaving(false); }
  }
  return <section className="mt-6 rounded-3xl border border-stone-200 bg-white p-4 shadow-sm sm:p-7">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-2xl font-semibold tracking-tight">Anfragen von der Homepage</h2><p className="mt-2 text-sm leading-6 text-stone-500">Für Julia und Roland an einem Ort. Notizen und Status bleiben intern. Antworten versendet ihr bewusst selbst.</p></div><button className={control} onClick={() => { setError(''); setRefresh(x => x + 1); }}>Aktualisieren</button></div>
    {!supabase ? <p className="mt-5">In der Demo werden keine echten Anfragen geladen.</p> : <>
      {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}
      {selected ? <div className="mt-5">
        <button disabled={saving} className={control} onClick={() => { setSelected(null); setError(''); }}>← Zur Übersicht</button>
        <div className="mt-5 min-w-0 rounded-2xl bg-stone-50 p-4 sm:p-6"><p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">{selected.offer}</p><h3 className="mt-2 break-words text-xl font-semibold">{selected.name}</h3><p className="mt-2 break-all text-sm">{selected.email}{selected.phone && ` · ${selected.phone}`}</p><p className="mt-4 whitespace-pre-wrap break-words text-sm leading-6">{selected.message}</p><a href={`mailto:${encodeURIComponent(selected.email)}?subject=${encodeURIComponent('Deine Anfrage bei AUFELD21')}`} className="mt-4 inline-flex min-h-11 items-center font-semibold text-emerald-800 underline">Per E-Mail antworten ↗</a><p className="text-xs text-stone-500">Öffnet euer E-Mail-Programm. Der Status wird dadurch nicht automatisch geändert.</p></div>
        <label className="mt-5 block text-sm font-semibold">Bearbeitungsstatus<select disabled={saving} value={selected.status} onChange={e => setSelected({ ...selected, status: e.target.value })} className={`${control} mt-2 block w-full sm:max-w-xs`}>{Object.entries(states).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        <label className="mt-4 block text-sm font-semibold">Interne Notizen<textarea disabled={saving} maxLength={5000} value={selected.notes} onChange={e => setSelected({ ...selected, notes: e.target.value })} className={`${control} mt-2 min-h-28 w-full resize-y font-normal`} placeholder="Z. B. Besichtigung am Freitag um 10 Uhr vereinbart." /></label>
        <button disabled={saving} className="mt-4 min-h-11 rounded-xl bg-[#17231c] px-5 font-semibold text-white disabled:opacity-50" onClick={save}>{saving ? 'Wird gespeichert …' : 'Änderungen speichern'}</button>
      </div> : <>
        <div className="mt-5 flex flex-wrap gap-2" aria-label="Anfragen filtern">{Object.entries({ all: 'Alle', ...states }).map(([key, label]) => <button key={key} onClick={() => { setStatus(key); setPage(0); setLoading(true); }} className={`${control} ${status === key ? '!border-emerald-700 !bg-emerald-50 font-semibold text-emerald-900' : ''}`}>{label}</button>)}</div>
        {loading ? <p role="status" className="mt-5">Anfragen werden geladen …</p> : rows.length === 0 ? <p className="mt-5 rounded-2xl bg-stone-50 p-5 text-stone-500">Keine Anfragen in dieser Ansicht.</p> : <ul className="mt-5 grid gap-3 md:grid-cols-2">{rows.map(row => <li key={row.id}><button className="h-full w-full min-w-0 rounded-2xl border border-stone-200 p-5 text-left hover:border-emerald-600 focus-visible:outline-emerald-700" onClick={() => { setSelected({ ...row }); setError(''); }}><div className="flex flex-wrap justify-between gap-2"><span className="text-xs font-semibold text-emerald-700">{row.offer}</span><span className={`rounded-full px-2 py-1 text-xs font-semibold ${row.status === 'new' ? 'bg-amber-50 text-amber-800' : 'bg-stone-100 text-stone-600'}`}>{states[row.status]}</span></div><p className="mt-2 break-words font-semibold">{row.name}</p><p className="mt-1 break-all text-sm text-stone-500">{row.email}</p><p className="mt-3 line-clamp-2 break-words text-sm leading-6 text-stone-600">{row.message}</p><p className="mt-3 text-xs text-stone-400">{new Date(row.created_at).toLocaleString('de-AT', { timeZone: 'Europe/Vienna' })} · Öffnen →</p></button></li>)}</ul>}
        {total > 25 && <div className="mt-5 flex flex-wrap items-center gap-3"><button disabled={page === 0} className={control} onClick={() => setPage(p => p - 1)}>Zurück</button><span className="text-sm">Seite {page + 1} von {Math.ceil(total / 25)}</span><button disabled={(page + 1) * 25 >= total} className={control} onClick={() => setPage(p => p + 1)}>Weiter</button></div>}
      </>}
    </>}
  </section>;
}
