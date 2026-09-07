'use client';
import { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { packages, type PackageId } from '@/lib/members/packages';
import type { ManagedMember } from '@/lib/members/directory';

type Term = { effective_month: string; account_id: string; package: PackageId; included_hours: number };
type Owner = { id: string; name: string; billing_name: string | null };
async function request(db: SupabaseClient, id: string, body?: object) {
  const { data } = await db.auth.getSession();
  const response = await fetch(`/api/admin/meeting-terms?member=${encodeURIComponent(id)}`, {
    method: body ? 'POST' : 'GET', headers: { Authorization: `Bearer ${data.session?.access_token ?? ''}`, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}), cache: 'no-store',
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Kontingent nicht erreichbar.');
  return result;
}
export function MeetingSettings({ member, supabase, onSaved }: { member: ManagedMember; supabase: SupabaseClient; onSaved: () => void }) {
  const [terms, setTerms] = useState<Term[]>([]);
  const [owners, setOwners] = useState<Owner[]>([]);
  const [packageId, setPackageId] = useState<PackageId>(member.meetingPackage ?? 'pro');
  const [hours, setHours] = useState(member.includedHours ?? 12);
  const [account, setAccount] = useState(member.meetingAccountId ?? member.id);
  const [month, setMonth] = useState('');
  const [minimum, setMinimum] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  useEffect(() => {
    let active = true;
    request(supabase, member.id).then(result => {
      if (!active) return;
      setTerms(result.terms); setOwners(result.owners); setMinimum(result.currentMonth.slice(0, 7));
      const date = new Date(`${result.currentMonth}T00:00:00Z`);
      setMonth(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1)).toISOString().slice(0, 7));
    }).catch(error => { if (active) setError(error.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [supabase, member.id]);
  async function save(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    try {
      await request(supabase, member.id, { memberId: member.id, month: `${month}-01`, package: packageId,
        hours: packageId === 'custom' ? hours : packages[packageId].hours, accountId: packageId === 'shared' ? account : member.id });
      const result = await request(supabase, member.id); setTerms(result.terms);
      setMessage('Kontingent gespeichert. Bestehende Preise und Rechnungen bleiben unverändert.'); onSaved();
    } catch (error) { setError(error instanceof Error ? error.message : 'Speichern fehlgeschlagen.'); }
    finally { setBusy(false); }
  }
  return <details className="mt-5 rounded-2xl border border-stone-200 bg-white p-5">
    <summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold">Meetingkontingent & Paket bearbeiten</summary>
    <p className="mt-3 text-sm leading-6 text-stone-600">Gilt monatlich für das Hauptkonto und seine zugeordneten Zusatzlogins. Eine Paketauswahl ändert keine Grundmiete. Genutzte Konten können frühestens für den Folgemonat umgestellt werden; bereits ausgestellte Rechnungen bleiben geschützt.</p>
    <form onSubmit={save} className="mt-5 grid gap-4 sm:grid-cols-2">
      <label className="text-sm font-medium">Paket<select disabled={loading || busy} value={packageId} onChange={event => { const id = event.target.value as PackageId; setPackageId(id); setHours(packages[id].hours); }} className="mt-2 min-h-12 w-full rounded-xl border border-stone-300 bg-white px-3">
        {Object.entries(packages).filter(([id]) => id !== 'shared' || (member.role === 'employee' && member.monthly_rent_net == null)).map(([id, pkg]) => <option key={id} value={id}>{pkg.name}{id === 'shared' ? '' : ` · ${pkg.hours} h`}</option>)}
      </select></label>
      <label className="text-sm font-medium">Gültig ab Monat<input required type="month" min={minimum} value={month} onChange={event => setMonth(event.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-stone-300 px-3" /></label>
      {packageId === 'custom' && <label className="text-sm font-medium">Inklusivstunden pro Monat<input required type="number" min="0" max="168" step="0.5" value={hours} onChange={event => setHours(Number(event.target.value))} className="mt-2 min-h-12 w-full rounded-xl border border-stone-300 px-3" /></label>}
      {packageId === 'shared' && <label className="text-sm font-medium sm:col-span-2">Kontingent mitnutzen von<select required value={account === member.id ? '' : account} onChange={event => setAccount(event.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-stone-300 bg-white px-3"><option value="">Hauptkonto auswählen</option>{owners.filter(owner => owner.id !== member.id).map(owner => <option key={owner.id} value={owner.id}>{owner.billing_name || owner.name}</option>)}</select><span className="mt-2 block font-normal leading-6 text-stone-500">Nur für noch ungenutzte Mitarbeiter-Zugänge. Kein zusätzliches Stundenpaket und keine eigene Rechnung.</span></label>}
      <button disabled={loading || busy} className="min-h-12 rounded-xl bg-emerald-700 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50 sm:col-span-2">{busy ? 'Wird gespeichert …' : 'Kontingent speichern'}</button>
    </form>
    {error && <p role="alert" className="mt-4 text-sm leading-6 text-red-700">{error}</p>}
    {message && <p role="status" className="mt-4 text-sm leading-6 text-emerald-800">{message}</p>}
    <ul className="mt-5 divide-y divide-stone-100 text-sm leading-6 text-stone-600">{terms.map(term => <li className="py-2" key={term.effective_month}>{term.effective_month === '0001-01-01' ? 'Bisherige Vereinbarung' : `Ab ${term.effective_month.slice(5, 7)}.${term.effective_month.slice(0, 4)}`} · {packages[term.package].name}{term.package !== 'shared' && ` · ${Number(term.included_hours)} h`}</li>)}</ul>
  </details>;
}
