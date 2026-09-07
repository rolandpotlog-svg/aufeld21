"use client";

import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

type Mail = { id:string; kind:"invoice"|"issue"; recipient_email:string; status:string; created_at:string; last_error:string|null; provider_id:string|null };
type Settings = { enabled:boolean; last_run_at:string|null; last_error:string|null };
const labels: Record<string,string> = { pending:"Wartet auf Versand",processing:"Wird versendet",accepted:"An Maildienst übergeben",failed:"Versand fehlgeschlagen",review:"Prüfung erforderlich",skipped:"Nicht versendet" };
const date = (value:string) => new Date(value).toLocaleString("de-AT",{timeZone:"Europe/Vienna",dateStyle:"short",timeStyle:"short"});

export function EmailNotifications({supabase,revision}:{supabase:SupabaseClient|null;revision:number}) {
  const [mails,setMails]=useState<Mail[]>([]);
  const [settings,setSettings]=useState<Settings|null>(null);
  const [error,setError]=useState("");
  const [loading,setLoading]=useState(true);
  const [refresh,setRefresh]=useState(0);
  const [problems,setProblems]=useState(0);
  const [stale,setStale]=useState(false);
  useEffect(()=>{
    if(!supabase) return;
    let active=true;
    Promise.all([
      supabase.from("email_notifications").select("id,kind,recipient_email,status,created_at,last_error,provider_id").order("created_at",{ascending:false}).limit(50),
      supabase.from("email_notification_settings").select("enabled,last_run_at,last_error").eq("id",true).single(),
      supabase.from("email_notifications").select("id",{count:"exact",head:true}).in("status",["failed","review"]),
    ]).then(([messages,config,problemCount])=>{
      if(!active) return;
      setLoading(false);
      if(messages.error||config.error||problemCount.error) { setError("Das Versandprotokoll konnte nicht geladen werden."); return; }
      setError(""); setMails((messages.data??[]) as Mail[]); setSettings(config.data); setProblems(problemCount.count??0);
      setStale(!config.data.last_run_at || Date.now()-Date.parse(config.data.last_run_at)>300_000);
    }).catch(()=>{ if(active) { setLoading(false); setError("Das Versandprotokoll konnte nicht geladen werden."); } });
    return ()=>{active=false;};
  },[supabase,revision,refresh]);
  return <section className="mt-6 rounded-3xl border border-stone-200 bg-white p-4 shadow-sm sm:p-7">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div><h2 className="text-xl font-semibold">E-Mail-Benachrichtigungen</h2><p className="mt-2 text-sm leading-6 text-stone-600">Neue Rechnungen gehen an den jeweiligen Mieter. Neue Meldungen gehen an Julia. Vertrauliche Details bleiben im Portal.</p></div>
      <button type="button" onClick={()=>setRefresh(x=>x+1)} className="min-h-11 shrink-0 rounded-xl border border-stone-200 px-4 text-sm font-semibold">Aktualisieren</button>
    </div>
    {!supabase ? <p className="mt-5 text-sm text-stone-600">In der Demo werden keine E-Mails versendet.</p> : loading ? <p role="status" className="mt-5 text-sm text-stone-600">Versandprotokoll wird geladen …</p> : <>
      {error ? <p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p> : <>
        <div className={`mt-5 rounded-2xl p-4 text-sm leading-6 ${settings?.enabled&&!stale&&!settings.last_error?"bg-emerald-50 text-emerald-900":"bg-amber-50 text-amber-950"}`}>
          <p className="font-semibold">{!settings?.enabled?"Automatischer Versand ist pausiert":stale?"Versandprüfung ist überfällig":"Automatischer Versand ist aktiviert"}</p>
          <p>Die Warteschlange wird jede Minute geprüft. Bei Versandlimits bleiben Nachrichten gespeichert.</p>
          {settings?.last_error&&<p>{settings.last_error}</p>}
          {settings?.last_run_at&&<p className="mt-1 text-xs">Letzte Prüfung: {date(settings.last_run_at)}</p>}
        </div>
        {problems>0&&<p role="alert" className="mt-4 rounded-xl bg-amber-50 p-4 text-sm font-semibold text-amber-950">{problems} Nachricht(en) benötigen eine Prüfung. Unklare Versandversuche werden nicht blind erneut versendet.</p>}
        <p className="mt-5 text-sm text-stone-500">Letzte 50 Nachrichten. „An Maildienst übergeben“ bestätigt die Annahme; die tatsächliche Zustellung ist bei Resend ersichtlich.</p>
        {mails.length===0?<p className="mt-4 rounded-2xl bg-stone-50 p-5 text-sm text-stone-600">Noch keine Benachrichtigungen. Bereits vorhandene Rechnungen und Meldungen werden nicht nachträglich verschickt.</p>:<ul className="mt-4 divide-y divide-stone-100">
          {mails.map(mail=><li key={mail.id} className="flex min-w-0 flex-col gap-3 py-5 sm:flex-row sm:justify-between">
            <div className="min-w-0"><p className="font-semibold">{mail.kind==="invoice"?"Neue Rechnung":"Neue Meldung"}</p><p className="mt-1 break-all text-sm text-stone-600">{mail.recipient_email}</p><p className="mt-1 text-xs text-stone-500">{date(mail.created_at)}</p>{mail.last_error&&<p className="mt-2 max-w-xl text-sm text-amber-900">{mail.last_error}</p>}</div>
            <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end"><span className={`rounded-full px-3 py-1.5 text-sm font-medium ${mail.status==='accepted'?'bg-emerald-50 text-emerald-800':['failed','review'].includes(mail.status)?'bg-red-50 text-red-800':'bg-stone-100 text-stone-700'}`}>{labels[mail.status]??mail.status}</span>{mail.provider_id&&<a href={`https://resend.com/emails/${encodeURIComponent(mail.provider_id)}`} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center text-sm font-semibold text-emerald-800">Zustellung bei Resend prüfen ↗</a>}</div>
          </li>)}
        </ul>}
      </>}
    </>}
  </section>;
}
