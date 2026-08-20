import Image from "next/image";
import { HeartHandshake, Lightbulb, Users } from "lucide-react";
import { MarketingPage } from "../marketing-shell";

export default function AboutPage() {
  return <MarketingPage eyebrow="Über uns" title="Ein kleines Büro mit einer großen Idee." intro="AUFELD21 wird von Julia und Roland Potlog persönlich geführt. Entstanden ist der Space nicht am Reißbrett, sondern aus dem Wunsch nach einem Arbeitsplatz, an dem man selbst gerne jeden Tag ankommt.">
    <section className="mx-auto max-w-[1440px] px-4 pb-16 sm:px-8 lg:px-12 lg:pb-20">
      <div className="grid overflow-hidden rounded-[2.2rem] bg-white shadow-xl lg:grid-cols-2">
        <div className="relative min-h-[380px] lg:min-h-[620px]"><Image src="/julia-roland-potlog.jpg" alt="Julia und Roland Potlog" fill className="object-cover object-center" sizes="(min-width:1024px) 50vw, 100vw" priority /></div>
        <div className="p-7 sm:p-12 lg:p-16"><p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Julia & Roland</p><h2 className="mt-5 text-4xl font-semibold tracking-[-0.055em] sm:text-5xl">Gemeinsam statt anonym.</h2><div className="mt-7 space-y-5 text-lg leading-8 text-stone-600"><p>Ursprünglich wollten wir an der Aufeldstraße einfach ein modernes Büro für uns und unser Team schaffen.</p><p>Schon während der Planung wurde daraus mehr: ein überschaubarer Ort, den wir mit anderen Selbstständigen und kleinen Unternehmen teilen – ruhig genug für konzentrierte Arbeit und persönlich genug für echten Austausch.</p><p>AUFELD21 soll kein anonymer Großraum sein. Hier kennt man sich, hilft einander und lässt trotzdem jedem den Raum, den gute Arbeit braucht.</p></div></div>
      </div>
      <div className="mt-5 grid gap-4 md:grid-cols-3">{[[HeartHandshake,"Persönlich geführt","Direkte Ansprechpartner und unkomplizierte Lösungen."],[Users,"Bewusst klein","Eine Gemeinschaft, in der Menschen keine Nummern sind."],[Lightbulb,"Offen für Ideen","Raum für Austausch, Empfehlungen und neue Projekte."]].map(([Icon,title,text])=>{const I=Icon as typeof Users;return <article key={String(title)} className="rounded-[1.7rem] bg-white p-7"><I className="text-violet-700"/><h3 className="mt-8 text-xl font-bold">{String(title)}</h3><p className="mt-2 leading-7 text-stone-500">{String(text)}</p></article>})}</div>
    </section>
  </MarketingPage>;
}
