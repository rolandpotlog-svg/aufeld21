import { CalendarDays, Coffee, Network, Users } from "lucide-react";
import { MarketingPage } from "../marketing-shell";

const companies = [
  { initials: "IK", name: "ImmoKredit", sector: "Immobilienfinanzierung & Kreditberatung", tone: "bg-[#dff4e6] text-emerald-900" },
  { initials: "PX", name: "Potlox", sector: "Marketing & digitale Kommunikation", tone: "bg-violet-100 text-violet-900" },
  { initials: "N", name: "Neugebauer GmbH", sector: "Buchhandel & Medien", tone: "bg-amber-100 text-amber-950" },
  { initials: "WA", name: "Wuff Academy", sector: "Hundeschule & professionelles Hundetraining", tone: "bg-sky-100 text-sky-950" },
];

export default function CommunityPage() {
  return <MarketingPage eyebrow="Community" title="Kontakte, die im Alltag entstehen." intro="Bei AUFELD21 ist Vernetzung kein Pflichtprogramm. Sie entsteht bei gemeinsamen Pausen, kleinen Netzwerkabenden und Veranstaltungen mit Unternehmen aus der Region.">
    <section className="mx-auto max-w-[1440px] px-5 pb-16 sm:px-8 lg:px-12 lg:pb-20">
      <div className="mb-5 overflow-hidden rounded-[2rem] border border-stone-200 bg-white">
        <div className="border-b border-stone-200 p-7 sm:p-10">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Unternehmen im AUFELD21</p>
          <h2 className="mt-4 max-w-3xl text-3xl font-bold tracking-[-0.05em] sm:text-5xl">Hier arbeiten Unternehmen, die etwas bewegen.</h2>
          <p className="mt-5 max-w-2xl leading-7 text-stone-500">Unterschiedliche Branchen, kurze Wege und ein Netzwerk, das ganz natürlich im Arbeitsalltag entsteht.</p>
        </div>
        <div className="grid gap-px bg-stone-200 sm:grid-cols-2">
          {companies.map((company) => (
            <article key={company.name} className="flex min-h-[190px] flex-col justify-between bg-white p-7 sm:min-h-[220px] sm:p-9">
              <span className={`grid h-14 w-14 place-items-center rounded-2xl text-sm font-black tracking-[-0.04em] ${company.tone}`}>{company.initials}</span>
              <div className="mt-10"><h3 className="text-2xl font-bold tracking-[-0.04em]">{company.name}</h3><p className="mt-2 leading-6 text-stone-500">{company.sector}</p></div>
            </article>
          ))}
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">{[[CalendarDays,"Netzwerkabende","Kleine, persönliche Abende für Austausch, Empfehlungen und neue Ideen."],[Users,"Firmenevents","Ausgewählte Veranstaltungen gemeinsam mit Unternehmen und Partnern aus der Region."],[Coffee,"Unkomplizierter Austausch","Manchmal beginnt die beste Zusammenarbeit einfach in der Küche oder auf dem Balkon."],[Network,"Unternehmen im Haus","Kurze Firmenprofile machen sichtbar, wer hier arbeitet und wobei man sich gegenseitig helfen kann."]].map(([Icon,title,text])=>{const I=Icon as typeof Users;return <article key={String(title)} className="min-h-[260px] rounded-[2rem] border border-violet-100 bg-white p-7 sm:p-9"><I className="text-violet-700" size={28}/><h2 className="mt-10 text-2xl font-bold tracking-[-0.04em]">{String(title)}</h2><p className="mt-3 max-w-xl leading-7 text-stone-500">{String(text)}</p></article>})}</div>
      <div className="mt-5 rounded-[2rem] bg-[#162119] p-7 text-white sm:p-10"><p className="text-xs font-black uppercase tracking-[0.18em] text-[#c9ff70]">Gut zu wissen</p><p className="mt-4 max-w-3xl text-2xl font-semibold leading-9">Events werden bewusst klein gehalten und rechtzeitig im Mitgliederportal oder in der gemeinsamen WhatsApp-Gruppe angekündigt.</p></div>
    </section>
  </MarketingPage>;
}
