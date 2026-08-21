import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowDownRight,
  ArrowRight,
  Building2,
  CalendarDays,
  Coffee,
  Check,
  DoorOpen,
  FileText,
  Fan,
  MapPin,
  Network,
  ParkingCircle,
  Presentation,
  Printer,
  ScanLine,
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
    <main className="homepage-grid min-h-screen overflow-hidden bg-[#f8f8fb] text-[#11131a]">
      <header className="relative z-20 mx-auto flex max-w-[1440px] items-center justify-between px-4 py-4 sm:px-8 sm:py-5 lg:px-12">
        <Link href="/" className="flex items-center gap-3" aria-label="AUFELD21 Startseite">
          <span className="grid h-11 w-11 place-items-center rounded-[13px] bg-[#c9ff70] text-sm font-black tracking-[-0.06em] text-[#162119]">A21</span>
          <span>
            <span className="block text-[15px] font-bold tracking-[0.1em]">AUFELD21</span>
            <span className="hidden text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-500 min-[360px]:block">Co-Working Traun</span>
          </span>
        </Link>
        <nav className="hidden items-center gap-8 text-sm font-semibold lg:flex">
          <a href="#prices" className="transition hover:text-emerald-700">Angebot</a>
          <Link href="/buero-service" className="transition hover:text-emerald-700">Büroservice</Link>
          <Link href="/community" className="transition hover:text-emerald-700">Community</Link>
          <Link href="/ueber-uns" className="transition hover:text-emerald-700">Über uns</Link>
          <a href="#contact" className="transition hover:text-emerald-700">Kontakt</a>
        </nav>
        <Link href="/portal" className="flex h-11 items-center gap-2 rounded-full bg-[#162119] px-4 text-xs font-bold text-white transition hover:-translate-y-0.5 hover:bg-[#243429] sm:px-5 sm:text-sm">
          <span className="sm:hidden">Login</span><span className="hidden sm:inline">Mitgliederportal</span> <ArrowRight size={16} />
        </Link>
      </header>

      <section className="relative mx-auto max-w-[1440px] px-5 pb-12 pt-5 sm:px-8 sm:pt-8 lg:px-12 lg:pb-20 lg:pt-14">
        <div className="pointer-events-none absolute left-[15%] top-0 h-72 w-72 rounded-full bg-violet-400/15 blur-[100px]" />
        <div className="pointer-events-none absolute right-[10%] top-32 h-72 w-72 rounded-full bg-cyan-300/20 blur-[110px]" />
        <div className="relative flex items-center py-6 sm:py-8 lg:py-12">
          <div className="max-w-5xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-white/80 px-4 py-2 text-xs font-black uppercase tracking-[0.15em] text-violet-700 shadow-sm backdrop-blur">
              <span className="h-2 w-2 rounded-full bg-[#7c3aed] shadow-[0_0_12px_#7c3aed]" /> Neubau · Traun · persönlich geführt
            </div>
            <h1 className="mt-7 max-w-3xl text-[clamp(3.35rem,15vw,7.5rem)] font-black leading-[0.88] tracking-[-0.078em] sm:mt-8">
              Dein Büro<br /><span className="bg-[linear-gradient(105deg,#7c3aed_4%,#2563eb_49%,#0891b2_72%,#65a30d_104%)] bg-clip-text text-transparent">in Traun.</span>
            </h1>
            <p className="mt-7 max-w-2xl text-base font-medium leading-7 text-slate-600 sm:mt-8 sm:text-xl sm:leading-8">Einziehen. Loslegen. Möblierte Büros, flexible Arbeitsplätze und ein digital buchbarer Meetingraum – unkompliziert an einem Ort.</p>
            <div className="mt-10 flex flex-col gap-3 sm:flex-row">
              <a href="#contact" className="flex h-14 items-center justify-center gap-3 rounded-full bg-[linear-gradient(105deg,#7c3aed,#2563eb_52%,#0891b2)] px-7 font-black text-white shadow-lg transition hover:-translate-y-0.5">Besichtigung anfragen <ArrowDownRight size={19} /></a>
              <a href="#prices" className="flex h-14 items-center justify-center rounded-full border border-slate-300 bg-white/75 px-7 font-bold backdrop-blur transition hover:border-violet-300 hover:bg-white">Preise ansehen</a>
            </div>
            <div className="mt-9 grid max-w-2xl grid-cols-3 gap-5 border-t border-slate-200 pt-6">
              {[["~100 m²", "Gesamtfläche"], ["24/7", "Zutritt"], ["12 h", "Meeting inkl."]].map(([value, label]) => <div key={label}><p className="text-xl font-black tracking-[-0.04em] sm:text-2xl">{value}</p><p className="mt-1 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400 sm:text-xs">{label}</p></div>)}
            </div>
          </div>
        </div>
      </section>

      <section id="offers" className="mx-auto max-w-[1440px] px-4 pb-12 sm:px-8 sm:pb-16 lg:px-12 lg:pb-20">
        <div className="overflow-hidden rounded-[2.3rem] border border-[#162119]/10 bg-white">
          <div className="grid gap-6 border-b border-stone-200 p-6 sm:gap-8 sm:p-10 lg:grid-cols-[1fr_auto] lg:items-end lg:p-14">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">Die Räume</p>
              <h2 className="mt-4 max-w-3xl text-[2rem] font-semibold leading-[1.02] tracking-[-0.06em] sm:mt-5 sm:text-6xl">Vier Büros. Ein Raum, der flexibel bleibt.</h2>
            </div>
            <div className="max-w-sm rounded-2xl bg-emerald-50 px-5 py-4 text-sm leading-6 text-emerald-950">
              <p className="font-bold">Privates Büro oder Coworking</p>
              <p className="mt-1 text-emerald-900/70">Der große Raum funktioniert als Team-Büro oder mit vier einzelnen Arbeitsplätzen. Verfügbarkeit einfach anfragen.</p>
            </div>
          </div>

          <div className="grid gap-px bg-stone-200 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Büro 1", "16,31 m²", "Kompaktes Teambüro", "bg-[#eff7df]"],
              ["Büro 2", "12,62 m²", "Ruhiges Einzelbüro", "bg-[#f4f6e9]"],
              ["Büro 3", "14,13 m²", "Büro für kleine Teams", "bg-[#eff7df]"],
              ["Büro 4", "24,78 m²", "Büro oder 4 Coworking-Plätze", "bg-[#dff4e6]"],
            ].map(([name, size, status, tone], index) => (
              <article key={name} className={`flex min-h-[180px] flex-col justify-between p-6 sm:min-h-[230px] sm:p-8 ${tone}`}>
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

      <section id="prices" className="border-y border-[#162119]/10 bg-[#eef0e9] py-12 sm:py-16 lg:py-20">
        <div className="mx-auto max-w-[1440px] px-5 sm:px-8 lg:px-12">
          <div className="max-w-3xl">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">Arbeitsplätze & Büro</p>
            <h2 className="mt-4 text-[2rem] font-semibold leading-[1.02] tracking-[-0.06em] sm:mt-5 sm:text-6xl">Einfach wählen. Alles Wesentliche ist dabei.</h2>
            <p className="mt-6 text-lg leading-8 text-stone-600">Keine komplizierten Optionen. Drei klare Möglichkeiten – je nachdem, wie viel eigener Raum gerade richtig ist.</p>
          </div>

          <div className="mt-9 grid gap-4 sm:mt-12 lg:grid-cols-3">
            {[
              {
                name: "Flex",
                price: "180 €",
                detail: "Freie Platzwahl im Coworking-Bereich",
                items: ["12 Stunden Meetingraum / Monat", "Highspeed-Internet", "Küche & Getränke", "Flexible Platzwahl"],
              },
              {
                name: "Fix",
                price: "250 €",
                detail: "Dein persönlicher Schreibtisch",
                items: ["12 Stunden Meetingraum / Monat", "Eigener fixer Arbeitsplatz", "Highspeed-Internet", "Küche & Getränke"],
                featured: true,
              },
              {
                name: "Privates Büro",
                price: "590 €",
                detail: "Ca. 25–27 m² für ein kleines Team",
                items: ["12 Stunden Meetingraum / Monat", "Abschließbarer eigener Raum", "Highspeed-Internet", "Gemeinsame Infrastruktur"],
              },
            ].map((offer) => (
              <article key={offer.name} className={`relative flex min-h-[400px] flex-col rounded-[1.7rem] p-7 sm:min-h-[440px] sm:rounded-[2rem] sm:p-9 ${offer.featured ? "bg-[#162119] text-white shadow-2xl" : "border border-[#162119]/10 bg-white"}`}>
                {offer.featured && <span className="absolute right-7 top-7 rounded-full bg-[#c9ff70] px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-[#162119]">Beliebt</span>}
                <p className={`text-sm font-bold uppercase tracking-[0.15em] ${offer.featured ? "text-[#c9ff70]" : "text-emerald-700"}`}>{offer.name}</p>
                <p className="mt-8 text-5xl font-semibold tracking-[-0.065em]">{offer.price}</p>
                <p className={`mt-2 text-sm ${offer.featured ? "text-stone-400" : "text-stone-500"}`}>pro Monat · netto</p>
                <p className={`mt-8 leading-7 ${offer.featured ? "text-stone-300" : "text-stone-600"}`}>{offer.detail}</p>
                <ul className={`mt-8 space-y-4 border-t pt-7 ${offer.featured ? "border-white/15" : "border-stone-200"}`}>
                  {offer.items.map((item) => <li key={item} className="flex gap-3 text-sm leading-6"><Check size={18} className="mt-0.5 shrink-0 text-emerald-500" />{item}</li>)}
                </ul>
                <a href="#contact" className={`mt-auto flex h-12 items-center justify-center rounded-full font-bold transition hover:-translate-y-0.5 ${offer.featured ? "bg-[#c9ff70] text-[#162119]" : "bg-[#162119] text-white"}`}>Verfügbarkeit anfragen</a>
              </article>
            ))}
          </div>
          <p className="mt-5 text-sm leading-6 text-stone-500">Weitere Meetingraum-Zeit wird in 30-Minuten-Schritten mit 12 € netto pro Stunde verrechnet. Verfügbarkeit und konkrete Vertragsdetails nach persönlicher Abstimmung.</p>
        </div>
      </section>

      <section id="service" className="mx-auto max-w-[1440px] px-4 py-12 sm:px-8 sm:py-16 lg:px-12 lg:py-20">
        <div className="overflow-hidden rounded-[2.4rem] bg-[#162119] text-white">
          <div className="grid gap-12 p-7 sm:p-10 lg:grid-cols-[0.82fr_1.18fr] lg:p-14">
            <div className="flex flex-col justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#c9ff70]">Post & Büroservice</p>
                <h2 className="mt-4 text-[2rem] font-semibold leading-[1.02] tracking-[-0.06em] sm:mt-5 sm:text-6xl">Eine professionelle Adresse. Persönlich betreut.</h2>
                <p className="mt-6 max-w-xl leading-7 text-stone-300">Für Selbstständige und kleine Unternehmen, die Geschäftspost zuverlässig empfangen möchten – und bei Bedarf einen echten Arbeitsplatz in Traun nutzen.</p>
              </div>
              <Link href="/buero-service" className="mt-10 flex h-14 w-fit items-center gap-3 rounded-full bg-[#c9ff70] px-7 font-bold text-[#162119] transition hover:-translate-y-0.5">Büroservice ansehen <ArrowRight size={18} /></Link>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <article className="flex min-h-[310px] flex-col rounded-[1.8rem] bg-white p-7 text-[#162119] sm:min-h-[350px] sm:p-8">
                <FileText className="text-emerald-700" size={28} />
                <p className="mt-10 text-sm font-bold uppercase tracking-[0.15em] text-emerald-700">Postservice</p>
                <p className="mt-3 text-4xl font-semibold tracking-[-0.055em]">39 €</p><p className="mt-1 text-sm text-stone-500">monatlich · netto</p>
                <ul className="mt-7 space-y-3 text-sm leading-6 text-stone-600">
                  {["Postadresse bei AUFELD21", "Annahme und Sortierung", "Benachrichtigung bei Eingang", "Abholung vor Ort"].map((item) => <li key={item} className="flex gap-3"><Check size={17} className="mt-1 shrink-0 text-emerald-600" />{item}</li>)}
                </ul>
              </article>
              <article className="flex min-h-[310px] flex-col rounded-[1.8rem] bg-[#dff4e6] p-7 text-[#162119] sm:min-h-[350px] sm:p-8">
                <ScanLine className="text-emerald-700" size={28} />
                <p className="mt-10 text-sm font-bold uppercase tracking-[0.15em] text-emerald-700">Business-Standort</p>
                <p className="mt-3 text-4xl font-semibold tracking-[-0.055em]">69 €</p><p className="mt-1 text-sm text-stone-500">monatlich · netto</p>
                <ul className="mt-7 space-y-3 text-sm leading-6 text-stone-600">
                  {["Alles aus Postservice", "Firmenname am Postkasten", "1 Stunde Meetingraum / Monat", "Nutzung der Anschrift nach Prüfung"].map((item) => <li key={item} className="flex gap-3"><Check size={17} className="mt-1 shrink-0 text-emerald-600" />{item}</li>)}
                </ul>
              </article>
            </div>
          </div>
          <div className="border-t border-white/10 px-7 py-5 text-xs leading-5 text-stone-400 sm:px-10 lg:px-14">Die Nutzung als Geschäftsanschrift oder Unternehmensstandort ist von Tätigkeit und rechtlichen Voraussetzungen abhängig und wird vor Vertragsabschluss individuell geprüft.</div>
        </div>
      </section>

      <section className="border-y border-[#162119]/10 bg-white py-12 sm:py-16 lg:py-20">
        <div className="mx-auto max-w-[1440px] px-5 sm:px-8 lg:px-12">
          <div className="grid gap-8 lg:grid-cols-[0.72fr_1.28fr] lg:gap-20">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">Ausstattung</p>
              <h2 className="mt-4 text-[2rem] font-semibold tracking-[-0.06em] sm:mt-5 sm:text-6xl">Einziehen und loslegen.</h2>
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

      <section id="space" className="mx-auto max-w-[1440px] px-5 py-12 sm:px-8 sm:py-16 lg:px-12 lg:py-20">
        <div className="grid gap-10 lg:grid-cols-[0.75fr_1.25fr] lg:gap-20">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">Was AUFELD21 besonders macht</p>
            <h2 className="mt-4 max-w-xl text-[2rem] font-semibold leading-[1.02] tracking-[-0.06em] sm:mt-5 sm:text-6xl">Klein im Maßstab. Groß im Miteinander.</h2>
          </div>
          <p className="max-w-2xl self-end text-lg leading-8 text-stone-600 sm:text-xl">Kein anonymes Großraumbüro, sondern vier Büros, ein gemeinsamer Meetingraum und Menschen, die einander beim Namen kennen. Genau so viel Gemeinschaft, wie gut tut.</p>
        </div>

        <div className="mt-14 grid gap-4 md:grid-cols-3">
          {benefits.map(({ icon: Icon, number, title, text }) => (
            <article key={number} className="group flex min-h-[240px] flex-col justify-between rounded-[1.7rem] border border-[#162119]/10 bg-white p-7 transition duration-300 hover:-translate-y-1 hover:shadow-xl sm:min-h-[290px] sm:rounded-[2rem] sm:p-9">
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

      <section className="bg-[#dff4e6] py-12 sm:py-16 lg:py-20">
        <div className="mx-auto grid max-w-[1440px] gap-12 px-5 sm:px-8 lg:grid-cols-[1fr_0.8fr] lg:px-12">
          <div className="rounded-[2.2rem] bg-[#162119] p-7 text-white sm:p-10 lg:p-14">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#c9ff70]">Ein Ort, alles da</p>
              <MapPin className="text-[#c9ff70]" size={26} />
            </div>
            <h2 className="mt-10 max-w-xl text-[2rem] font-semibold leading-[1.02] tracking-[-0.055em] sm:mt-14 sm:text-6xl">Zentral gelegen. Schnell überall.</h2>
            <p className="mt-5 max-w-xl leading-7 text-stone-300">Nah an Linz, schnell auf den wichtigsten Wegen und mit allem für den Alltag direkt in der Umgebung.</p>
            <div className="mt-9 grid grid-cols-1 gap-px overflow-hidden rounded-2xl bg-white/15 sm:grid-cols-2">
              {[
                ["6 Min.", "PlusCity", "mit dem Auto"],
                ["15 Min.", "Linz", "mit dem Auto"],
                ["8 Min.", "Marchtrenk", "mit dem Auto"],
                ["5 Min.", "Trauner Hauptplatz", "mit dem Auto"],
                ["3 Min.", "Oedter See", "mit dem Auto"],
                ["1 Min.", "Naturschutzgebiet & Spazierwege", "zu Fuß"],
                ["3 Min.", "Bushaltestelle", "zu Fuß"],
                ["5 Min.", "SPAR & Bäcker", "zu Fuß"],
              ].map(([value, label, mode]) => (
                <div key={label} className="flex items-center justify-between gap-4 bg-[#1d2b21] p-5 sm:p-6">
                  <div><p className="font-semibold text-white">{label}</p><p className="mt-1 text-xs text-stone-400">{mode}</p></div>
                  <p className="shrink-0 text-xl font-semibold text-[#c9ff70]">{value}</p>
                </div>
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

      <section className="mx-auto max-w-[1440px] px-5 py-12 sm:px-8 sm:py-16 lg:px-12 lg:py-20">
        <div className="overflow-hidden rounded-[2.3rem] border border-stone-200 bg-white">
          <div className="grid gap-7 p-7 sm:p-10 lg:grid-cols-[1fr_auto] lg:items-end lg:p-14">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-700">Unsere Community</p>
              <h2 className="mt-4 max-w-3xl text-[2rem] font-semibold leading-[1.02] tracking-[-0.06em] sm:text-6xl">Unternehmen, die AUFELD21 mit Leben füllen.</h2>
              <p className="mt-5 max-w-2xl leading-7 text-stone-500">Vier Unternehmen, unterschiedliche Kompetenzen und kurze Wege für einen unkomplizierten Austausch.</p>
            </div>
            <Link href="/community" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#162119] px-6 font-bold text-white">Community entdecken <ArrowRight size={17} /></Link>
          </div>
          <div className="grid gap-px bg-stone-200 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["IK", "ImmoKredit", "Immobilienfinanzierung"],
              ["PX", "Potlox", "Marketing Agentur"],
              ["N", "Neugebauer GmbH", "Buchhandel"],
              ["WA", "Wuff Academy", "Hundeschule"],
            ].map(([initials, name, sector]) => (
              <article key={name} className="flex min-h-[170px] flex-col justify-between bg-[#fafaf8] p-6 sm:min-h-[200px] sm:p-8">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-violet-100 text-xs font-black text-violet-900">{initials}</span>
                <div className="mt-9"><h3 className="text-xl font-bold tracking-[-0.035em]">{name}</h3><p className="mt-1 text-sm text-stone-500">{sector}</p></div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="about" className="mx-auto max-w-[1440px] px-4 py-12 sm:px-8 sm:py-16 lg:px-12 lg:py-20">
        <div className="grid items-center gap-10 overflow-hidden rounded-[2.4rem] bg-white p-5 shadow-[0_30px_100px_rgba(42,35,80,0.10)] lg:grid-cols-[0.9fr_1.1fr] lg:p-7">
          <div className="relative min-h-[340px] overflow-hidden rounded-[1.8rem] sm:min-h-[400px] lg:min-h-[500px]">
            <Image src="/julia-roland-potlog.jpg" alt="Julia und Roland Potlog, Gastgeber von AUFELD21" fill sizes="(min-width: 1024px) 42vw, 100vw" className="object-cover object-center" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#10131c]/55 via-transparent to-transparent" />
            <span className="absolute bottom-5 left-5 rounded-full border border-white/25 bg-white/85 px-4 py-2 text-xs font-black uppercase tracking-[0.14em] backdrop-blur">Julia & Roland</span>
          </div>
          <div className="px-2 py-8 sm:px-8 lg:px-10">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-700">Unsere Geschichte</p>
            <h2 className="mt-4 text-[2rem] font-semibold leading-[1.05] tracking-[-0.06em] sm:mt-5 sm:text-6xl">Aus einem eigenen Büro wurde eine gemeinsame Idee.</h2>
            <p className="mt-7 max-w-3xl text-lg leading-8 text-stone-600">Wir wollten einen Arbeitsplatz schaffen, den wir selbst jeden Tag gerne betreten. Modern, ruhig und unkompliziert. Dabei entstand ein Ort, den wir mit anderen Selbstständigen und kleinen Unternehmen teilen möchten – persönlich geführt und offen für echte Zusammenarbeit.</p>
            <p className="mt-7 font-semibold">Julia & Roland Potlog · Potlog Immobilien KG</p>
            <Link href="/ueber-uns" className="mt-5 inline-flex min-h-11 items-center gap-2 font-bold text-violet-700">Unsere Geschichte lesen <ArrowRight size={17}/></Link>
          </div>
        </div>
      </section>

      <section id="contact" className="px-5 pb-5 sm:px-8 sm:pb-8 lg:px-12 lg:pb-12">
        <div className="mx-auto max-w-[1344px] overflow-hidden rounded-[2.3rem] bg-[#c9ff70] p-7 sm:p-10 lg:p-14">
          <div className="grid gap-10 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-900">Interesse?</p>
              <h2 className="mt-4 max-w-3xl text-[2rem] font-semibold leading-[1] tracking-[-0.06em] sm:mt-5 sm:text-6xl">Lernen wir uns einfach kennen.</h2>
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
        <div className="flex flex-wrap gap-x-6"><Link href="/community" className="inline-flex min-h-11 items-center">Community</Link><Link href="/impressum" className="inline-flex min-h-11 items-center">Impressum</Link><Link href="/datenschutz" className="inline-flex min-h-11 items-center">Datenschutz</Link></div>
      </footer>
    </main>
  );
}
