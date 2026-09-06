"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";

export function MobileMenu() {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative lg:hidden" onKeyDown={(event) => { if (event.key === "Escape") setOpen(false); }}>
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls="mobile-navigation" aria-label={open ? "Menü schließen" : "Menü öffnen"}
        className="grid h-11 w-11 place-items-center rounded-full border border-stone-300 bg-white">
        {open ? <X size={20} /> : <Menu size={20} />}
      </button>
      {open && <nav id="mobile-navigation" aria-label="Mobile Hauptnavigation" className="absolute right-0 top-14 z-50 w-64 max-w-[calc(100vw-2rem)] rounded-2xl border border-stone-200 bg-white p-2 shadow-xl">
        {[["/#prices", "Angebot & Preise"], ["/buero-service", "Büroservice"], ["/community", "Community"], ["/ueber-uns", "Über uns"], ["/#contact", "Kontakt"], ["/portal", "Mitgliederportal"]].map(([href, title]) => (
          <Link key={href} href={href} onClick={() => setOpen(false)} className="flex min-h-12 items-center rounded-xl px-4 text-sm font-semibold hover:bg-emerald-50">{title}</Link>
        ))}
      </nav>}
    </div>
  );
}
