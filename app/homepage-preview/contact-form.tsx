"use client";

import { useRef, useState } from 'react';
import Link from 'next/link';
import { contactOffers } from '@/lib/contacts/input';

export function ContactForm() {
  const requestId = useRef('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const input = 'mt-2 min-h-12 w-full min-w-0 rounded-xl border border-stone-300 bg-white px-4 py-3 text-base outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20 disabled:opacity-60';
  return <div className="mt-8 rounded-3xl bg-white p-5 sm:p-8">
    <h3 className="text-2xl font-semibold tracking-tight">Unverbindlich anfragen</h3>
    <p className="mt-2 text-sm leading-6 text-stone-600">Sag uns, was du suchst. Julia oder Roland melden sich persönlich bei dir.</p>
    {success ? <div role="status" className="mt-5 rounded-2xl bg-emerald-50 p-5 text-emerald-900"><p className="font-semibold">Danke! Deine Anfrage ist bei uns angekommen.</p><p className="mt-2">Wir melden uns über deine angegebenen Kontaktdaten.</p><button className="mt-4 min-h-11 font-semibold underline" onClick={() => setSuccess(false)}>Weitere Anfrage stellen</button></div> : <form className="mt-5" onSubmit={async event => {
      event.preventDefault(); if (busy) return;
      const form = event.currentTarget, fields = Object.fromEntries(new FormData(form));
      requestId.current ||= crypto.randomUUID();
      setBusy(true); setError('');
      try {
        const response = await fetch('/api/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...fields, id: requestId.current }) });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Anfrage nicht möglich.');
        setSuccess(true); requestId.current = ''; form.reset();
      } catch (e) { setError(e instanceof Error ? e.message : 'Bitte erneut versuchen.'); }
      finally { setBusy(false); }
    }}>
      <fieldset disabled={busy} className="grid min-w-0 gap-4 sm:grid-cols-2">
        <label className="min-w-0 text-sm font-medium">Dein Name *<input className={input} name="name" autoComplete="name" required minLength={2} maxLength={120} /></label>
        <label className="min-w-0 text-sm font-medium">E-Mail-Adresse *<input className={input} name="email" type="email" autoComplete="email" required maxLength={254} /></label>
        <label className="min-w-0 text-sm font-medium">Telefon <span className="font-normal text-stone-500">(optional)</span><input className={input} name="phone" type="tel" autoComplete="tel" maxLength={50} /></label>
        <label className="min-w-0 text-sm font-medium">Ich interessiere mich für *<select className={input} name="offer" defaultValue="Besichtigung / Sonstiges" required>{contactOffers.map(offer => <option key={offer}>{offer}</option>)}</select></label>
        <label className="min-w-0 text-sm font-medium sm:col-span-2">Deine Nachricht *<textarea className={`${input} min-h-28 resize-y`} name="message" placeholder="Was suchst du – und ab wann?" required minLength={10} maxLength={2000} /></label>
        <div aria-hidden="true" className="absolute -left-[10000px] h-px w-px overflow-hidden"><label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
      </fieldset>
      <p className="mt-4 text-xs leading-5 text-stone-500">Wir verwenden deine Angaben zur Bearbeitung deiner Anfrage. Kein Newsletter. Mehr zum <Link href="/datenschutz" className="underline underline-offset-2">Datenschutz</Link>.</p>
      {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}
      <button disabled={busy} className="mt-5 min-h-12 w-full rounded-full bg-[#17231c] px-7 font-semibold text-white disabled:opacity-60 sm:w-auto">{busy ? 'Wird gesendet …' : 'Anfrage senden →'}</button>
    </form>}
  </div>;
}
