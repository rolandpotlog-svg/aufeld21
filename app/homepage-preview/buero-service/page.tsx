import { Check, Mail, MapPin } from "lucide-react";
import { MarketingPage } from "../marketing-shell";
import { MarketingPrice } from "../marketing-price";
import { packages, extraMeetingHourNet } from "@/lib/members/packages";

const offers = [
  { name: "Postservice", net: packages.post.net, icon: Mail, items: ["Postadresse bei AUFELD21", "Annahme und Sortierung von Briefpost; Paketannahme nach Vereinbarung", "Benachrichtigung bei Posteingang", "Abholung vor Ort nach Vereinbarung", "Kein Meetingraum-Kontingent enthalten"], note: "Keine Firmenbuch- oder Gewerbeadresse." },
  { name: "Business-Standort", net: packages.business.net, icon: MapPin, items: ["Alle Leistungen aus Postservice", "Firmenname am Postkasten", `${packages.business.hours} Stunde Meetingraum je Unternehmen und Monat`, "Nutzung der Anschrift nach individueller Prüfung"], note: "Zusätzliche Firmenzugänge teilen das Kontingent. Tätigkeit und Voraussetzungen werden vor Vertragsabschluss geprüft." },
];

export default function OfficeServicePage() {
  return <MarketingPage eyebrow="Post & Büroservice" title="Eine professionelle Adresse. Persönlich betreut." intro="Geschäftspost zuverlässig empfangen und bei Bedarf einen Meetingraum in Traun nutzen. Zwei klare Pakete, ohne eigenes Büro mieten zu müssen.">
    <section className="mx-auto max-w-[1200px] px-5 pb-12 sm:px-8 lg:px-12 lg:pb-16">
      <div className="grid gap-4 md:grid-cols-2">{offers.map(({ name, net, icon: Icon, items, note }, index) => <article key={name} className={`flex min-w-0 flex-col rounded-[2rem] p-6 sm:p-9 ${index ? "bg-[#162119] text-white" : "bg-white"}`}>
        <Icon className={index ? "text-[#c9ff70]" : "text-violet-700"} />
        <h2 className={`mb-3 mt-6 text-xs font-black uppercase tracking-[0.18em] ${index ? "text-[#c9ff70]" : "text-violet-700"}`}>{name}</h2>
        <MarketingPrice net={net} unit="je Unternehmen" dark={Boolean(index)} />
        <ul className={`mt-6 space-y-3 border-t pt-6 ${index ? "border-white/15" : "border-stone-200"}`}>{items.map(item => <li key={item} className="flex gap-3 leading-6"><Check size={18} className="mt-1 shrink-0 text-emerald-500" />{item}</li>)}</ul>
        <p className={`mb-6 mt-6 text-sm leading-6 ${index ? "text-stone-300" : "text-stone-600"}`}>{note}</p>
        <a href={`mailto:roland@immo-kredit.net?subject=${encodeURIComponent(`AUFELD21 Anfrage ${name}`)}`} className={`mt-auto flex min-h-12 items-center justify-center rounded-full px-5 py-3 text-center font-bold ${index ? "bg-[#c9ff70] text-[#162119]" : "bg-[#162119] text-white"}`}>Unverbindlich anfragen</a>
      </article>)}</div>
      <div className="mt-5 rounded-3xl border border-stone-200 bg-white p-6 text-sm leading-6 text-stone-600">
        <h2 className="font-bold text-[#162119]">Was wir vor Vertragsabschluss festlegen</h2>
        <p className="mt-2">Laufzeit, Kündigung, Abholzeiten sowie zulässiges Post- und Paketvolumen vereinbaren wir schriftlich. Scannen, Öffnen von Briefen und Weiterleitung sind nicht enthalten; mögliche Zusatzleistungen und Kosten werden vorher vereinbart.</p>
        <p className="mt-2">Meetingraum nach Verfügbarkeit: zusätzliche Nutzung {extraMeetingHourNet} € netto / Stunde (14,40 € inkl. 20 % USt), in 30-Minuten-Schritten. Ungenutzte Inklusivstunden verfallen am Monatsende.</p>
        <p className="mt-2">Die Nutzung als Geschäftsanschrift oder Unternehmensstandort ist nicht automatisch zugesagt. Sie hängt von Tätigkeit, tatsächlicher Nutzung und den rechtlichen Voraussetzungen ab und wird individuell geprüft.</p>
      </div>
    </section>
  </MarketingPage>;
}
