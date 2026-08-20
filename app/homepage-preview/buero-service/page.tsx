import { Check, Mail, MapPin } from "lucide-react";
import { MarketingPage } from "../marketing-shell";

const packages = [
  { name:"Postservice", price:"39 €", icon:Mail, items:["Postadresse bei AUFELD21","Annahme von Briefpost und normalen Paketen","Benachrichtigung bei Posteingang","Abholung vor Ort"], note:"Keine Firmenbuch- oder Gewerbeadresse." },
  { name:"Business-Standort", price:"69 €", icon:MapPin, items:["Alle Leistungen aus Postservice","Firmenname am Postkasten","1 Stunde Meetingraum pro Monat","Nutzung der Anschrift nach individueller Prüfung"], note:"Voraussetzungen und Tätigkeit werden vor Vertragsabschluss geprüft." },
];

export default function OfficeServicePage() {
  return <MarketingPage eyebrow="Post & Büroservice" title="Eine professionelle Adresse. Persönlich betreut." intro="Geschäftspost zuverlässig empfangen und bei Bedarf einen echten Arbeitsplatz in Traun nutzen – ohne unnötig komplizierte Pakete.">
    <section className="mx-auto max-w-[1200px] px-5 pb-16 sm:px-8 lg:px-12 lg:pb-20">
      <div className="grid gap-4 md:grid-cols-2">{packages.map(({name,price,icon:Icon,items,note},index)=><article key={name} className={`flex flex-col rounded-[2rem] p-7 sm:p-10 ${index ? "bg-[#162119] text-white" : "bg-white"}`}><Icon className={index?"text-[#c9ff70]":"text-violet-700"}/><p className={`mt-9 text-xs font-black uppercase tracking-[0.18em] ${index?"text-[#c9ff70]":"text-violet-700"}`}>{name}</p><p className="mt-3 text-5xl font-black tracking-[-0.06em]">{price}</p><p className={`mt-1 text-sm ${index?"text-stone-400":"text-stone-500"}`}>pro Monat · netto</p><ul className={`mt-8 space-y-4 border-t pt-7 ${index?"border-white/15":"border-stone-200"}`}>{items.map(item=><li key={item} className="flex gap-3 leading-6"><Check size={18} className="mt-1 shrink-0 text-emerald-500"/>{item}</li>)}</ul><p className={`mt-8 text-sm leading-6 ${index?"text-stone-400":"text-stone-500"}`}>{note}</p><a href="mailto:roland@immo-kredit.net?subject=AUFELD21%20B%C3%BCroservice" className={`mt-8 flex h-13 items-center justify-center rounded-full font-bold ${index?"bg-[#c9ff70] text-[#162119]":"bg-[#162119] text-white"}`}>Unverbindlich anfragen</a></article>)}</div>
      <div className="mt-5 rounded-[1.7rem] border border-amber-200 bg-amber-50 p-6 text-sm leading-6 text-amber-950"><strong>Wichtiger Hinweis:</strong> Eine reine virtuelle Adresse oder ein Postfach reicht in Österreich grundsätzlich nicht als Gewerbestandort. Ob AUFELD21 als Geschäftsanschrift oder Unternehmensstandort verwendet werden kann, hängt von Rechtsform, Tätigkeit und tatsächlicher Nutzung ab.</div>
    </section>
  </MarketingPage>;
}
