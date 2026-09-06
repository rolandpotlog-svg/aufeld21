import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import type { ReactNode } from "react";
import { MobileMenu } from "./mobile-menu";

export function MarketingHeader() {
  return (
    <header className="relative z-20 mx-auto flex max-w-[1440px] items-center justify-between px-4 py-4 sm:px-8 sm:py-5 lg:px-12">
      <Link href="/" className="flex items-center gap-3" aria-label="AUFELD21 Startseite">
        <span className="grid h-11 w-11 place-items-center rounded-[13px] bg-[#c9ff70] text-sm font-black tracking-[-0.06em]">A21</span>
        <span><span className="block text-[15px] font-bold tracking-[0.1em]">AUFELD21</span><span className="hidden text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-500 min-[360px]:block">Co-Working Traun</span></span>
      </Link>
      <nav className="hidden items-center gap-7 text-sm font-semibold lg:flex">
        <Link href="/#prices">Angebot</Link>
        <Link href="/buero-service">Büroservice</Link>
        <Link href="/community">Community</Link>
        <Link href="/ueber-uns">Über uns</Link>
        <Link href="/#contact">Kontakt</Link>
      </nav>
      <div className="flex items-center gap-2">
        <Link href="/portal" className="flex h-11 items-center gap-2 rounded-full bg-[#162119] px-3 text-xs font-bold text-white sm:px-5 sm:text-sm"><span className="sm:hidden">Login</span><span className="hidden sm:inline">Mitgliederportal</span><ArrowRight size={16} /></Link>
        <MobileMenu />
      </div>
    </header>
  );
}

export function MarketingFooter() {
  return (
    <footer className="mx-auto grid max-w-[1440px] gap-7 px-5 py-9 text-sm text-stone-500 sm:px-8 lg:grid-cols-[1fr_auto] lg:px-12">
      <div><p className="font-bold text-[#162119]">AUFELD21 · POTLOG Immobilien KG</p><p className="mt-1">Aufeldstraße 21 · 4050 Traun</p></div>
      <div className="flex flex-wrap gap-x-6 lg:justify-end"><Link href="/ueber-uns" className="inline-flex min-h-11 items-center">Über uns</Link><Link href="/community" className="inline-flex min-h-11 items-center">Community</Link><Link href="/impressum" className="inline-flex min-h-11 items-center">Impressum</Link><Link href="/datenschutz" className="inline-flex min-h-11 items-center">Datenschutz</Link></div>
    </footer>
  );
}

export function MarketingPage({ eyebrow, title, intro, children }: { eyebrow: string; title: string; intro: string; children: ReactNode }) {
  return (
    <main className="homepage-grid min-h-screen bg-[#f8f8fb] text-[#11131a]">
      <MarketingHeader />
      <section className="mx-auto max-w-[1440px] px-5 pb-12 pt-10 sm:px-8 sm:pb-16 sm:pt-16 lg:px-12">
        <Link href="/" className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-violet-700"><ArrowLeft size={16} /> Zur Startseite</Link>
        <p className="mt-12 text-xs font-black uppercase tracking-[0.18em] text-violet-700">{eyebrow}</p>
        <h1 className="mt-4 max-w-5xl text-[clamp(3.1rem,8vw,7rem)] font-black leading-[0.9] tracking-[-0.075em]">{title}</h1>
        <p className="mt-7 max-w-3xl text-lg leading-8 text-slate-600 sm:text-xl">{intro}</p>
      </section>
      {children}
      <MarketingFooter />
    </main>
  );
}
