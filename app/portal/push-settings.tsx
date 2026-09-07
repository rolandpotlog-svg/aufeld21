'use client';

import { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';

class PushApiError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

async function pushApi(db: SupabaseClient, body?: object) {
  const { data: { session } } = await db.auth.getSession();
  if (!session) throw new Error('Bitte melde dich erneut an.');
  const response = await fetch('/api/admin/push', {
    method: body ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${session.access_token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}), cache: 'no-store',
  });
  const data = await response.json();
  if (!response.ok) throw new PushApiError(data.error || 'Push ist gerade nicht erreichbar.', response.status);
  return data;
}

export async function disconnectPushBeforeLogout(db: SupabaseClient) {
  if (!('serviceWorker' in navigator)) return;
  try {
    const registration = await navigator.serviceWorker.getRegistration('/');
    const sub = await registration?.pushManager?.getSubscription();
    if (sub) {
      try { await pushApi(db, { action: 'unsubscribe', endpoint: sub.endpoint }); } finally { await sub.unsubscribe(); }
    }
    await caches.delete('a21-push-dedupe-v1');
  } catch { /* Signing out must remain possible, even without a network. */ }
}

export function PushSettings({ supabase }: { supabase: SupabaseClient }) {
  const [supported] = useState(() => typeof window !== 'undefined' && 'Notification' in window && 'PushManager' in window && 'serviceWorker' in navigator);
  const [installFirst] = useState(() => typeof window !== 'undefined' && (/iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) && !window.matchMedia('(display-mode: standalone)').matches);
  const [wrongDomain] = useState(() => typeof window !== 'undefined' && !['www.aufeld21.at', 'localhost'].includes(location.hostname));
  const [publicKey, setPublicKey] = useState('');
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [denied, setDenied] = useState(() => typeof Notification !== 'undefined' && Notification.permission === 'denied');
  useEffect(() => {
    let active = true;
    Promise.all([pushApi(supabase), navigator.serviceWorker?.getRegistration('/')]).then(async ([status, registration]) => {
      const sub = await registration?.pushManager?.getSubscription();
      if (!active) return;
      setAllowed(true);
      setPublicKey(status.publicKey);
      setConnected(Boolean(sub && status.devices.some((device: { endpoint: string }) => device.endpoint === sub.endpoint)));
    }).catch(error => {
      if (!active) return;
      if (error instanceof PushApiError && error.status === 403) setAllowed(false);
      else setError(error.message);
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [supabase]);

  async function enable() {
    setBusy(true); setError(''); setMessage('');
    try {
      // Must be the immediate result of the user's tap, especially on iPhone.
      const permission = await Notification.requestPermission();
      setDenied(permission === 'denied');
      if (permission !== 'granted') { setMessage('Ohne Gerätefreigabe bleiben die E-Mail-Hinweise aktiv.'); return; }
      await navigator.serviceWorker.register('/push-worker.js', { scope: '/', updateViaCache: 'none' });
      const registration = await navigator.serviceWorker.ready;
      const bytes = Uint8Array.from(atob(publicKey.replace(/-/g, '+').replace(/_/g, '/')), char => char.charCodeAt(0));
      const sub = await registration.pushManager.getSubscription() || await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytes });
      await pushApi(supabase, { action: 'subscribe', subscription: sub.toJSON() });
      setConnected(true); setMessage('Dieses Gerät ist verbunden. Sende jetzt einen Test-Push, um die Handy-Zustellung zu prüfen.');
    } catch (error) { setError(error instanceof Error ? error.message : 'Push konnte nicht aktiviert werden.'); }
    finally { setBusy(false); }
  }
  async function action(value: 'test' | 'unsubscribe') {
    setBusy(true); setError(''); setMessage('');
    try {
      const registration = await navigator.serviceWorker.getRegistration('/');
      const sub = await registration?.pushManager.getSubscription();
      if (!sub) { setConnected(false); throw new Error('Bitte dieses Gerät neu verbinden.'); }
      const result = await pushApi(supabase, { action: value, endpoint: sub.endpoint });
      if (value === 'unsubscribe') { await sub.unsubscribe(); setConnected(false); setMessage('Handy-Push ist auf diesem Gerät ausgeschaltet.'); }
      else setMessage(result.message);
    } catch (error) { setError(error instanceof Error ? error.message : 'Aktion fehlgeschlagen.'); }
    finally { setBusy(false); }
  }
  // Eligibility comes from the server; private recipient addresses are never
  // bundled into the public portal JavaScript.
  if (allowed === false || (allowed === null && loading)) return null;
  return <section className="mt-6 rounded-3xl border border-emerald-200 bg-emerald-50 p-5 sm:p-7">
    <h2 className="text-xl font-semibold text-emerald-950">Handy-Push für Meldungen</h2>
    <p className="mt-2 text-sm leading-6 text-emerald-950">Nur für Julia und Roland. Auf dem Sperrbildschirm steht lediglich „Neue Meldung im Portal“ – der Inhalt bleibt im geschützten Adminbereich. E-Mails bleiben zusätzlich aktiv.</p>
    {wrongDomain ? <p className="mt-4 text-sm leading-6">Bitte öffne <a className="font-semibold underline" href="https://www.aufeld21.at/portal">www.aufeld21.at/portal</a> und aktiviere Push dort.</p>
      : installFirst ? <p className="mt-4 rounded-xl bg-white p-4 text-sm leading-6"><strong>Am iPhone:</strong> In Safari „Teilen“ → „Zum Home-Bildschirm“ wählen. Anschließend AUFELD21 über das neue Symbol öffnen, anmelden und hier „Auf diesem Handy aktivieren“ antippen. Benötigt iOS 16.4 oder neuer.</p>
      : !loading && !supported ? <p className="mt-4 text-sm leading-6">Dieser Browser unterstützt Handy-Push nicht. Bitte am Android-Handy Chrome oder am iPhone die zum Home-Bildschirm hinzugefügte Website verwenden.</p>
      : <>
        <p className="mt-4 text-sm font-semibold">{loading ? 'Gerätefreigabe wird geprüft …' : connected ? 'Dieses Gerät ist verbunden' : 'Auf diesem Gerät noch nicht aktiviert'}</p>
        {denied && <p className="mt-2 text-sm leading-6">Benachrichtigungen sind in den Browser-/Handy-Einstellungen blockiert. Erlaube sie dort für AUFELD21 und lade diese Seite neu.</p>}
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          {connected ? <><button disabled={busy} onClick={() => action('test')} className="min-h-11 rounded-xl bg-emerald-800 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">Test-Push senden</button><button disabled={busy} onClick={() => action('unsubscribe')} className="min-h-11 rounded-xl border border-emerald-300 bg-white px-5 py-3 text-sm font-semibold disabled:opacity-50">Auf diesem Gerät ausschalten</button></>
            : <button disabled={loading || busy || denied || !publicKey || !supported} onClick={enable} className="min-h-11 rounded-xl bg-emerald-800 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">Auf diesem Handy aktivieren</button>}
        </div>
      </>}
    {message && <p role="status" className="mt-4 text-sm leading-6">{message}</p>}
    {error && <p role="alert" className="mt-4 text-sm leading-6 text-red-800">{error}</p>}
    <p className="mt-4 text-xs leading-5 text-emerald-900/75">Freigabe gilt je Gerät. Fokus-/Energiesparmodus und eine fehlende Internetverbindung können die Anzeige verzögern. Beim Abmelden wird Push auf diesem Gerät getrennt.</p>
  </section>;
}
