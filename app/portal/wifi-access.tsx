"use client";

import { useEffect, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Check, Copy, Wifi } from "lucide-react";

type WifiAccess = { ssid: string; password: string };

export function WifiAccessCard({ supabase }: { supabase: SupabaseClient | null }) {
  const [credentials, setCredentials] = useState<WifiAccess | null>(null);
  const [loading, setLoading] = useState(Boolean(supabase));
  const [loadError, setLoadError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [copied, setCopied] = useState<keyof WifiAccess | null>(null);
  const [copyMessage, setCopyMessage] = useState("");
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    const controller = new AbortController();
    supabase.from("space_wifi").select("ssid,password").eq("id", "tenant")
      .abortSignal(controller.signal).maybeSingle().then(({ data, error }) => {
        if (!active) return;
        setCredentials(error ? null : data as WifiAccess | null);
        setLoadError(Boolean(error));
        setLoading(false);
      });
    return () => { active = false; controller.abort(); };
  }, [supabase, attempt]);

  useEffect(() => () => { if (resetTimer.current) clearTimeout(resetTimer.current); }, []);

  async function copyValue(field: keyof WifiAccess) {
    if (!credentials) return;
    if (resetTimer.current) clearTimeout(resetTimer.current);
    try {
      await navigator.clipboard.writeText(credentials[field]);
      setCopied(field);
      setCopyMessage(field === "ssid" ? "WLAN-Name kopiert." : "WLAN-Passwort kopiert.");
      resetTimer.current = setTimeout(() => { setCopied(null); setCopyMessage(""); }, 3000);
    } catch {
      setCopied(null);
      setCopyMessage("Kopieren ist hier nicht möglich. Tippe auf das Feld, um den Text zu markieren und manuell zu kopieren.");
    }
  }

  return (
    <article className="mt-6 rounded-3xl border border-emerald-200 bg-white p-5 shadow-sm sm:p-6" aria-labelledby="wifi-heading">
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-emerald-50 text-emerald-800"><Wifi size={22} aria-hidden="true" /></span>
        <h2 id="wifi-heading" className="text-xl font-semibold tracking-tight">Dein WLAN im Space</h2>
      </div>
      {loading ? <p className="mt-4 text-sm text-stone-600" role="status">WLAN-Zugang wird geladen …</p>
        : loadError ? <div className="mt-4 flex flex-wrap items-center gap-3">
          <p className="text-sm text-stone-600" role="status">Der WLAN-Zugang konnte gerade nicht geladen werden.</p>
          <button type="button" onClick={() => { setLoading(true); setLoadError(false); setAttempt(value => value + 1); }} className="min-h-11 rounded-xl border border-stone-300 px-4 text-sm font-semibold hover:bg-stone-50">Erneut laden</button>
        </div>
        : !credentials ? <p className="mt-4 text-sm text-stone-600">{supabase ? "Der WLAN-Zugang ist noch nicht hinterlegt." : "In der lokalen Vorschau werden keine WLAN-Zugangsdaten angezeigt."}</p>
        : <div className="mt-4 grid gap-4 md:grid-cols-2">
          {(["ssid", "password"] as const).map(field => (
            <div key={field} className="min-w-0">
              <label htmlFor={`wifi-${field}`} className="mb-2 block text-sm font-medium text-stone-600">{field === "ssid" ? "WLAN-Name" : "WLAN-Passwort"}</label>
              <div className="flex min-w-0 items-center gap-2">
                <input id={`wifi-${field}`} type="text" readOnly value={credentials[field]} autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false}
                  onFocus={event => event.currentTarget.select()} onClick={event => event.currentTarget.select()}
                  className="h-12 min-w-0 flex-1 rounded-xl border border-stone-200 bg-stone-50 px-3 font-mono text-base text-stone-900 focus:outline-2 focus:outline-offset-2 focus:outline-emerald-700" />
                <button type="button" onClick={() => copyValue(field)} aria-label={`${field === "ssid" ? "WLAN-Name" : "WLAN-Passwort"} kopieren`}
                  className="flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-3 text-sm font-semibold text-white hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 sm:px-4">
                  {copied === field ? <Check size={18} aria-hidden="true" /> : <Copy size={18} aria-hidden="true" />}
                  {copied === field ? "Kopiert" : "Kopieren"}
                </button>
              </div>
            </div>
          ))}
        </div>}
      <p role="status" aria-live="polite" className={copyMessage ? "mt-3 text-sm text-stone-600" : "sr-only"}>{copyMessage}</p>
    </article>
  );
}
