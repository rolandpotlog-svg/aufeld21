import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowDownRight,
  ArrowRight,
  Building2,
  CalendarDays,
  Coffee,
  DoorOpen,
  Fan,
  MapPin,
  Network,
  ParkingCircle,
  Presentation,
  Printer,
  Sparkles,
  Users,
  Wifi,
} from "lucide-react";

export const metadata: Metadata = {
  title: "AUFELD21 · Co-Working in Traun",
  description: "Ein persönlicher Co-Working-Space für Selbstständige und kleine Unternehmen in Traun.",
};

const benefits = [
  {
    icon: Building2,
    number: "01",
    title: "Professionell arbeiten",
    text: "Ruhige Büros, schnelle Infrastruktur und alles, was ein guter Arbeitstag braucht.",
  },
  {
    icon: Users,
    number: "02",
    title: "Bewusst persönlich",
    text: "Eine kleine Gemeinschaft, in der man sich kennt und trotzdem konzentriert arbeiten kann.",
  },
  {
    icon: Network,
    number: "03",
    title: "Ehrlich vernetzt",
    text: "Austausch, Empfehlungen und neue Ideen entstehen hier ganz unkompliziert im Alltag.",
  },
];

export default function HomepagePreview() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#f5f5ef] text-[#162119]">
      <header className="relative z-20 mx-auto flex max-w-[1440px] items-center justify-between px-5 py-5 sm:px-8 lg:px-12">
        <Link href="/homepage-preview" className="flex items-center gap-3" aria-label="AUFELD21 Startseite">
          <span className="grid h-11 w-11 place-items-center rounded-[13px] bg-[#c9ff70] text-sm font-black tracking-[-0.06em] text-[#162119]">A21</span>
          <span>
            <span className="block text-[15px] font-bold tracking-[0.1em]">AUFELD21</span>
            <span className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-500">Co-Working Traun</span>
          </span>
        </Link>
        <nav className="hidden items-center gap-8 text-sm font-semibold lg:flex">
          <a href="#space" className="transition hover:text-emerald-700">Der Space</a>
          <a href="#rooms" className="transition hover:text-emerald-700">Räume</a>
          <a href="#about" className="transition hover:text-emerald-700">Über uns</a>
          <a href="#contact" className="transition hover:text-emerald-700">Kontakt</a>
        </nav>
        <Link href="/" className="flex h-11 items-center gap-2 rounded-full bg-[#162119] px-5 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-[#243429]">
          Mitgliederportal <ArrowRight size={16} />
        </Link>
      </header>

      <section className="relative mx-auto max-w-[1440px] px-5 pb-8 pt-7 sm:px-8 lg:px-12 lg:pb-14 lg:pt-12">
        <div className="grid min-h-[680px] overflow-hidden rounded-[2rem] bg-[#162119] text-white shadow-[0_30px_100px_rgba(22,33,25,0.16)] lg:grid-cols-[1.08fr_0.92fr] lg:rounded-[2.7rem]">
          <div className="relative flex flex-col justify-between px-7 py-9 sm:px-10 sm:py-12 lg:px-16 lg:py-16">
            <div className="absolute -left-28 -top-28 h-80 w-80 rounded-full border border-white/10" />
            <div className="absolute -left-12 -top-12 h-80 w-80 rounded-full border border-white/5" />
            <div className="relative">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.15em] text-[#c9ff70]">
                <span className="h-2 w-2 rounded-full bg-[#c9ff70]" /> Aufeldstraße 21 · Traun
              </div>
              <h1 className="mt-9 max-w-3xl text-[clamp(3.4rem,8vw,7.7rem)] font-semibold leading-[0.86] tracking-[-0.075em]">
                Raum für<br />gute Arbeit.
              </h1>
              <p className="mt-8 max-w-xl text-lg leading-8 text-stone-300 sm:text-xl">
                Ein kleiner Co-Working-Space für Menschen, die professionell arbeiten, persönlich verbunden bleiben und gemeinsam mehr bewegen wollen.
              </p>
            </div>
            <div className="relative mt-12 flex flex-col gap-4 sm:flex-row sm:items-center">
              <a href="#contact" className="flex h-14 items-center justify-center gap-3 rounded-full bg-[#c9ff70] px-7 font-bold text-[#162119] transition hover:-translate-y-0.5 hover:bg-[#d6ff96]">
                AUFELD21 kennenlernen <ArrowDownRight size={19} />
              </a>
              <a href="#space" className="flex h-14 items-center justify-center rounded-full border border-white/20 px-7 font-semibold transition hover:bg-white/10">Space entdecken</a>
            </div>
          </div>

          <div className="relative min-h-[520px] overflow-hidden lg:m-3 lg:ml-0 lg:rounded-[2.05rem]">
            <Image src="/julia-roland-potlog.jpg" alt="Julia und Roland Potlog, Gastgeber von AUFELD21" fill priority sizes="(min-width: 1024px) 45vw, 100vw" className="object-cover object-center" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#162119]/75 via-transparent to-transparent" />
            <div className="absolute inset-x-5 bottom-5 rounded-[1.5rem] border border-white/25 bg-white/90 p-5 text-[#162119] shadow-xl backdrop-blur sm:inset-x-7 sm:bottom-7 sm:p-6">
              <p className="text-xs font-bold uppercase tracking-[0.15em] text-emerald-700">Persönlich geführt</p>
              <div className="mt-2 flex items-end justify-between gap-5">
                <p className="text-2xl font-semibold tracking-[-0.04em]">Julia & Roland Potlog</p>
                <span className="hidden text-sm font-medium text-stone-500 sm:block">Gastgeber aus Überzeugung</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="rooms" className="mx-auto max-w-[1440px] px-5 pb-20 sm:px-8 lg:px-12 lg:pb-28">
        <div className="overflow-hidden rounded-[2.3rem] border border-[#162119]/10 bg-white">
          <div className="grid gap-8 border-b border-stone-200 p-7 sm:p-10 lg:grid-cols-[1fr_auto] lg:items-end lg:p-14">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">Die Räume</p>
              <h2 className="mt-5 max-w-3xl text-4xl font-semibold leading-[1.02] tracking-[-0.06em] sm:text-6xl">Vier Büros. Ein gemeinsamer Mittelpunkt.</h2>
            </div>
            <div className="max-w-sm rounded-2xl bg-amber-50 px-5 py-4 text-sm leading-6 text-amber-900">
              <p className="font-bold">Aktuell gut ausgelastet</p>
              <p className="mt-1 text-amber-800/75">Fixbüros sind derzeit vermietet. Flex-Arbeitsplätze und künftige Verfügbarkeiten gerne anfragen.</p>
            </div>
          </div>

          <div className="grid gap-px bg-stone-200 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Büro 1", "16,31 m²", "Vermietet", "bg-[#eff7df]"],
              ["Büro 2", "12,62 m²", "Eigenes Team", "bg-[#f4f6e9]"],
              ["Büro 3", "14,13 m²", "Vermietet", "bg-[#eff7df]"],
              ["Büro 4", "24,78 m²", "Flexbüro · 4 Plätze", "bg-[#dff4e6]"],
            ].map(([name, size, status, tone], index) => (
              <article key={name} className={`flex min-h-[260px] flex-col justify-between p-7 sm:p-8 ${tone}`}>
                <div className="flex items-start justify-between">
                  <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white/80 shadow-sm"><DoorOpen size={20} strokeWidth={1.8} /></span>
                  <span className="text-xs font-bold text-stone-400">0{index + 1}</span>
                </div>
                <div>
                  <p className="text-2xl font-semibold tracking-[-0.04em]">{name}</p>
                  <p className="mt-2 font-semibold text-emerald-800">{status}</p>
                  <p className="mt-1 text-sm text-stone-500">{size}</p>
                </div>
              </article>
            ))}
          </div>

          <div className="grid gap-px bg-stone-200 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="bg-[#162119] p-7 text-white sm:p-10 lg:p-14">
              <div className="flex items-center gap-3 text-[#c9ff70]"><Presentation size={23} /><p className="text-xs font-bold uppercase tracking-[0.18em]">Meetingraum · 15,64 m²</p></div>
              <h3 className="mt-8 max-w-2xl text-3xl font-semibold tracking-[-0.05em] sm:text-5xl">Kundentermine und Besprechungen, ohne Umwege.</h3>
              <p className="mt-5 max-w-2xl leading-7 text-stone-300">Der gemeinsame Meetingraum lässt sich von Mitgliedern direkt über das AUFELD21-Portal reservieren – auch unterwegs am Handy.</p>
            </div>
            <div className="bg-[#f6efd4] p-7 sm:p-10 lg:p-14">
              <Coffee size={24} className="text-amber-800" />
              <h3 className="mt-8 text-3xl font-semibold tracking-[-0.05em]">Küche & Balkon</h3>
              <p className="mt-4 leading-7 text-stone-600">Gemeinsame Küche und ein 17,15 m² großer Balkon schaffen Platz für eine Pause und unkomplizierten Austausch.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-[#162119]/10 bg-white py-20 lg:py-28">
        <div className="mx-auto max-w-[1440px] px-5 sm:px-8 lg:px-12">
          <div className="grid gap-8 lg:grid-cols-[0.72fr_1.28fr] lg:gap-20">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">Ausstattung</p>
              <h2 className="mt-5 text-4xl font-semibold tracking-[-0.06em] sm:text-6xl">Einziehen und loslegen.</h2>
              <p className="mt-6 max-w-md leading-7 text-stone-500">Die wichtigsten Dinge funktionieren einfach – damit der Kopf für die eigene Arbeit frei bleibt.</p>
            </div>
            <div className="grid gap-x-8 sm:grid-cols-2">
              {[
                [Wifi, "Highspeed-Internet", "Stabil verbunden im ganzen Space."],
                [Fan, "Klimatisierte Räume", "Angenehm arbeiten, auch im Sommer."],
                [Presentation, "Meetingraum", "Digital buchbar für Termine und Gespräche."],
                [ParkingCircle, "Parkmöglichkeiten", "Kurze Wege für Mitglieder und Gäste."],
                [Printer, "Drucker & Scanner", "Gemeinsam und unkompliziert nutzbar."],
                [Sparkles, "Reinigung", "Gepflegte Gemeinschaftsflächen inklusive."],
              ].map(([Icon, title, text]) => {
                const FeatureIcon = Icon as typeof Wifi;
                return (
                  <div key={String(title)} className="flex gap-4 border-t border-stone-200 py-6">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-800"><FeatureIcon size={20} strokeWidth={1.8} /></span>
                    <div><h3 className="font-semibold">{String(title)}</h3><p className="mt-1 text-sm leading-6 text-stone-500">{String(text)}</p></div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section id="space" className="mx-auto max-w-[1440px] px-5 py-20 sm:px-8 lg:px-12 lg:py-28">
        <div className="grid gap-10 lg:grid-cols-[0.75fr_1.25fr] lg:gap-20">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">Was AUFELD21 besonders macht</p>
            <h2 className="mt-5 max-w-xl text-4xl font-semibold leading-[1.02] tracking-[-0.06em] sm:text-6xl">Klein im Maßstab. Groß im Miteinander.</h2>
          </div>
          <p className="max-w-2xl self-end text-lg leading-8 text-stone-600 sm:text-xl">Kein anonymes Großraumbüro, sondern vier Büros, ein gemeinsamer Meetingraum und Menschen, die einander beim Namen kennen. Genau so viel Gemeinschaft, wie gut tut.</p>
        </div>

        <div className="mt-14 grid gap-4 md:grid-cols-3">
          {benefits.map(({ icon: Icon, number, title, text }) => (
            <article key={number} className="group flex min-h-[330px] flex-col justify-between rounded-[2rem] border border-[#162119]/10 bg-white p-7 transition duration-300 hover:-translate-y-1 hover:shadow-xl sm:p-9">
              <div className="flex items-start justify-between">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#eaf8df] text-emerald-800"><Icon size={22} strokeWidth={1.8} /></span>
                <span className="text-sm font-bold text-stone-300">{number}</span>
              </div>
              <div>
                <h3 className="text-2xl font-semibold tracking-[-0.04em]">{title}</h3>
                <p className="mt-3 leading-7 text-stone-500">{text}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="bg-[#dff4e6] py-20 lg:py-28">
        <div className="mx-auto grid max-w-[1440px] gap-12 px-5 sm:px-8 lg:grid-cols-[1fr_0.8fr] lg:px-12">
          <div className="rounded-[2.2rem] bg-[#162119] p-7 text-white sm:p-10 lg:p-14">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#c9ff70]">Ein Ort, alles da</p>
              <MapPin className="text-[#c9ff70]" size={26} />
            </div>
            <h2 className="mt-16 max-w-xl text-4xl font-semibold tracking-[-0.055em] sm:text-6xl">Arbeiten, besprechen, ankommen.</h2>
            <div className="mt-12 grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-white/15">
              {[
                ["4", "Büros"],
                ["1", "Meetingraum"],
                ["~100", "m² Space"],
                ["6–10", "Menschen"],
              ].map(([value, label]) => (
                <div key={label} className="bg-[#1d2b21] p-5 sm:p-7"><p className="text-3xl font-semibold text-[#c9ff70] sm:text-4xl">{value}</p><p className="mt-1 text-sm text-stone-400">{label}</p></div>
              ))}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            <div className="flex flex-col justify-between rounded-[2rem] bg-white p-7 sm:p-9">
              <CalendarDays size={26} className="text-emerald-700" />
              <div className="mt-12"><h3 className="text-2xl font-semibold tracking-[-0.04em]">Meetingraum einfach buchen</h3><p className="mt-3 leading-7 text-stone-500">Mitglieder reservieren Termine unterwegs in wenigen Sekunden über das eigene Portal.</p></div>
            </div>
            <div className="flex flex-col justify-between rounded-[2rem] bg-[#c9ff70] p-7 sm:p-9">
              <Coffee size={26} />
              <div className="mt-12"><h3 className="text-2xl font-semibold tracking-[-0.04em]">Raum für Begegnung</h3><p className="mt-3 leading-7 text-[#314125]">Küche, Balkon und kurze Wege schaffen Platz für Gespräche, ohne die Ruhe beim Arbeiten zu verlieren.</p></div>
            </div>
          </div>
        </div>
      </section>

      <section id="about" className="mx-auto max-w-[1440px] px-5 py-20 sm:px-8 lg:px-12 lg:py-28">
        <div className="mx-auto max-w-4xl text-center">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">Unsere Geschichte</p>
          <h2 className="mt-5 text-4xl font-semibold leading-[1.05] tracking-[-0.06em] sm:text-6xl">Aus einem eigenen Büro wurde eine gemeinsame Idee.</h2>
          <p className="mx-auto mt-7 max-w-3xl text-lg leading-8 text-stone-600">Wir wollten einen Arbeitsplatz schaffen, den wir selbst jeden Tag gerne betreten. Modern, ruhig und unkompliziert. Dabei entstand ein Ort, den wir mit anderen Selbstständigen und kleinen Unternehmen teilen möchten – persönlich geführt und offen für echte Zusammenarbeit.</p>
          <p className="mt-7 font-semibold">Julia & Roland Potlog · Potlog Immobilien KG</p>
        </div>
      </section>

      <section id="contact" className="px-5 pb-5 sm:px-8 sm:pb-8 lg:px-12 lg:pb-12">
        <div className="mx-auto max-w-[1344px] overflow-hidden rounded-[2.3rem] bg-[#c9ff70] p-7 sm:p-10 lg:p-14">
          <div className="grid gap-10 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-900">Interesse?</p>
              <h2 className="mt-5 max-w-3xl text-4xl font-semibold leading-[1] tracking-[-0.06em] sm:text-6xl">Lernen wir uns einfach kennen.</h2>
              <p className="mt-6 text-lg text-[#3a4a2d]">Aufeldstraße 21 · 4050 Traun · +43 664 35 17 810</p>
            </div>
            <a href="mailto:roland@immo-kredit.net?subject=Interesse%20an%20AUFELD21" className="flex h-14 items-center justify-center gap-3 rounded-full bg-[#162119] px-7 font-bold text-white transition hover:-translate-y-0.5">
              Verfügbarkeit anfragen <ArrowRight size={18} />
            </a>
          </div>
        </div>
      </section>

      <footer className="mx-auto flex max-w-[1440px] flex-col gap-4 px-5 py-8 text-sm text-stone-500 sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-12">
        <p>© 2026 POTLOG Immobilien KG · AUFELD21</p>
        <div className="flex gap-6"><span>Impressum</span><span>Datenschutz</span></div>
      </footer>
    </main>
  );
}
