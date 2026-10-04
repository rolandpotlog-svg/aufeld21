import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowRight, ArrowUpRight, Newspaper, ZoomIn } from "lucide-react";
import { MarketingFooter, MarketingHeader } from "@/app/homepage-preview/marketing-shell";
import { siteUrl } from "@/lib/site";

const pagePath = "/presse/aufeld21-im-trauner";
const articleImage = "/presse/aufeld21-trauner-4-2026-seite-4.jpg";
const originalIssue = "https://www.stadtmarketing-traun.at/wp-content/uploads/2026/09/Trauner_4_2026_web-1.pdf#page=4";
const description = "Der TRAUNER stellt AUFELD21 vor: Coworking und Büros in Traun Oedt, persönlich geführt von Julia und Roland Potlog. Den Beitrag aus Ausgabe 4/2026 hier lesen.";

export const metadata: Metadata = {
  title: "AUFELD21 im TRAUNER: Coworking in Traun",
  description,
  alternates: { canonical: siteUrl + pagePath },
  openGraph: {
    title: "AUFELD21 im TRAUNER",
    description,
    url: siteUrl + pagePath,
    siteName: "AUFELD21",
    locale: "de_AT",
    type: "website",
    images: [{ url: siteUrl + "/julia-roland-potlog.jpg", alt: "Julia und Roland Potlog, die Gastgeber von AUFELD21 in Traun" }],
  },
};

const focusRing = "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-700";

export default function TraunerPressPage() {
  return (
    <main className="homepage-grid min-h-screen bg-[#f8f8fb] text-[#11131a]">
      <MarketingHeader />

      <article className="mx-auto max-w-[1200px] px-5 pb-10 pt-3 sm:px-8 sm:pb-14 sm:pt-6 lg:px-12">
        <Link href="/#presse" className={`inline-flex min-h-11 items-center gap-2 rounded-lg text-sm font-semibold text-emerald-800 ${focusRing}`}>
          <ArrowLeft size={17} aria-hidden="true" /> Zur Startseite
        </Link>

        <header className="pb-7 pt-5 sm:pb-10 sm:pt-7">
          <div className="flex items-center gap-2 text-emerald-800">
            <Newspaper size={19} aria-hidden="true" className="shrink-0" />
            <p className="text-xs font-bold uppercase tracking-[0.15em]">In der Presse · September 2026</p>
          </div>
          <h1 className="mt-5 max-w-4xl text-[clamp(2.25rem,7vw,4.5rem)] font-semibold leading-[1.02] tracking-[-0.055em]">AUFELD21 im TRAUNER.</h1>
          <p className="mt-5 max-w-3xl text-base leading-7 text-stone-600 sm:text-lg sm:leading-8">Unser Coworking-Space in Traun Oedt im Porträt: Das Stadtmarketing-Traun-Magazin erzählt, wie aus einem Büro für Julia und Roland ein gemeinsamer Arbeitsort wurde.</p>
          <p className="mt-4 text-sm leading-6 text-stone-500">TRAUNER · Ausgabe 4/2026 · Seite 4</p>
        </header>

        <section aria-labelledby="article-page-title" className="overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-stone-200 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div className="min-w-0">
              <h2 id="article-page-title" className="text-xl font-semibold tracking-[-0.03em]">Der Beitrag zum Nachlesen</h2>
              <p className="mt-1 text-sm leading-6 text-stone-600">Zum Vergrößern auf die Zeitungsseite tippen.</p>
            </div>
            <a href={articleImage} target="_blank" rel="noopener noreferrer" className={`inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-full bg-[#162119] px-5 py-3 text-sm font-bold text-white ${focusRing}`}>
              <ZoomIn size={18} aria-hidden="true" className="shrink-0" /> Seite vergrößern
              <span className="sr-only"> (Bild in voller Auflösung, öffnet in neuem Tab)</span>
            </a>
          </div>

          <figure>
            <a href={articleImage} target="_blank" rel="noopener noreferrer" aria-label="Zeitungsseite 4 des TRAUNER 4/2026 in voller Auflösung öffnen (neuer Tab)" className="block cursor-zoom-in focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-emerald-700">
              <Image
                src={articleImage}
                alt="Originalbeitrag ‚Co-Working Space Aufeld21‘ im TRAUNER 4/2026, Seite 4: Julia und Roland Potlog, die Büroräume und der Besuch von Daniela Krebelder vom Stadtmarketing Traun."
                width={1980}
                height={2800}
                sizes="(max-width: 639px) calc(100vw - 40px), (max-width: 1023px) calc(100vw - 64px), (max-width: 1199px) calc(100vw - 96px), 1104px"
                className="h-auto w-full"
                preload
              />
            </a>
            <figcaption className="border-t border-stone-200 px-5 py-4 text-xs leading-5 text-stone-600 sm:px-6">
              Quelle: TRAUNER 4/2026, Seite 4. Herausgeber: Stadtmarketing Traun GmbH. Fotos: StaMa.
            </figcaption>
          </figure>

          <div className="flex flex-col gap-3 border-t border-stone-200 bg-stone-50 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <p className="max-w-xl text-sm leading-6 text-stone-600">Der Artikel zeigt den Stand zur Veröffentlichung. Unsere aktuellen Angebote findest du auf der <Link href="/#prices" className="font-semibold text-emerald-800 underline underline-offset-4">Startseite</Link>.</p>
            <a href={originalIssue} target="_blank" rel="noopener noreferrer" className={`inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg text-sm font-semibold text-emerald-800 ${focusRing}`}>
              Originalausgabe (PDF) <ArrowUpRight size={17} aria-hidden="true" />
              <span className="sr-only"> (öffnet in neuem Tab)</span>
            </a>
          </div>
        </section>

        <div className="mt-9 grid items-start gap-7 sm:mt-12 lg:grid-cols-[1.15fr_0.85fr] lg:gap-10">
          <section aria-labelledby="space-story-title">
            <p className="text-xs font-bold uppercase tracking-[0.15em] text-emerald-800">Die Geschichte dahinter</p>
            <h2 id="space-story-title" className="mt-3 text-2xl font-semibold leading-tight tracking-[-0.04em] sm:text-3xl">Ein Büro. Viele eigene Ideen.</h2>
            <div className="mt-5 space-y-4 text-base leading-7 text-stone-600">
              <p>Am Anfang stand ein Büro für uns selbst. Weil die Räume mehr Platz boten, entstand Ende 2025 die Idee, sie mit anderen Selbstständigen und kleinen Unternehmen zu teilen. Seit Juni 2026 wird im AUFELD21 gemeinsam gearbeitet. Genau diese Entwicklung greift der TRAUNER in seinem Porträt auf.</p>
              <p>Heute verbinden wir an der Aufeldstraße 21 in Traun Oedt private Büros und Coworking-Arbeitsplätze mit gemeinsam genutzter Infrastruktur. Für Kundentermine gibt es einen digital buchbaren Meetingraum. Küche, Balkon und die Spazierwege in der Nähe schaffen Raum für Pausen und Gespräche.</p>
              <p>Wir, Julia und Roland Potlog, führen den Standort persönlich. AUFELD21 ist die Marke unseres Coworking-Spaces; betrieben wird er von der <strong className="font-semibold text-[#162119]">Potlog Immobilien KG</strong>. Uns ist wichtig, dass jeder konzentriert arbeiten kann und zugleich Menschen für Austausch und neue Kontakte findet.</p>
            </div>
            <Link href="/ueber-uns" className={`mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg text-sm font-semibold text-emerald-800 ${focusRing}`}>Mehr über Julia & Roland <ArrowRight size={17} aria-hidden="true" /></Link>
          </section>

          <aside aria-labelledby="visit-title" className="rounded-3xl bg-[#c9ff70] p-6 sm:p-8">
            <p className="text-xs font-bold uppercase tracking-[0.15em] text-emerald-900">Lernen wir uns kennen</p>
            <h2 id="visit-title" className="mt-4 text-2xl font-semibold leading-tight tracking-[-0.04em] sm:text-3xl">Dein nächster Arbeitsplatz in Traun?</h2>
            <p className="mt-4 text-base leading-7 text-[#314125]">Schau dir die Räume in Ruhe an. Wir zeigen dir persönlich, wie Arbeiten im AUFELD21 aussieht und welches Angebot zu dir passt.</p>
            <Link href="/#contact" className={`mt-6 flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#162119] px-4 py-3 text-center text-sm font-bold text-white ${focusRing}`}>Besichtigung anfragen <ArrowRight size={17} aria-hidden="true" className="shrink-0" /></Link>
            <Link href="/#prices" className={`mt-2 flex min-h-11 items-center justify-center rounded-lg text-center text-sm font-semibold text-[#162119] ${focusRing}`}>Büros & Preise ansehen</Link>
          </aside>
        </div>
      </article>

      <MarketingFooter />
    </main>
  );
}
