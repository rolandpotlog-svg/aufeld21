"use client";

import { useState, type ReactNode } from "react";
import { Armchair, BriefcaseBusiness, ChefHat, DoorOpen, Presentation, Trees, Toilet } from "lucide-react";

type SpaceId = "office1" | "office2" | "office3" | "office4" | "meeting" | "kitchen" | "wc" | "balcony";

const spaces: Record<SpaceId, { name: string; usage?: string; size?: string; detail: string; icon: typeof BriefcaseBusiness; tone: string }> = {
  office1: { name: "Büro 1", usage: "Vermietet · ImmoKredit & Werbeagentur", size: "16,31 m²", detail: "Vermietetes, gemeinsames Büro von ImmoKredit und der Werbeagentur.", icon: BriefcaseBusiness, tone: "bg-[#eff7df] text-[#24301f]" },
  office2: { name: "Büro 2", usage: "Rolands Büro", size: "12,62 m²", detail: "Rolands Büro und Arbeitsplatz der Potlog Immobilien KG.", icon: BriefcaseBusiness, tone: "bg-[#eff7df] text-[#24301f]" },
  office3: { name: "Büro 3", usage: "Vermietet", size: "14,13 m²", detail: "Eigenständiges, dauerhaft vermietetes Büro.", icon: BriefcaseBusiness, tone: "bg-[#eff7df] text-[#24301f]" },
  office4: { name: "Büro 4", usage: "Flexbüro · 4 Sitzplätze", size: "24,78 m²", detail: "Flexibel nutzbares Gemeinschaftsbüro mit vier vollwertigen Arbeitsplätzen.", icon: BriefcaseBusiness, tone: "bg-[#eff7df] text-[#24301f]" },
  meeting: { name: "Meetingraum", size: "15,64 m²", detail: "Für Kundentermine und Besprechungen – direkt über den Kalender buchbar.", icon: Presentation, tone: "bg-[#dff5e9] text-[#173b2b]" },
  kitchen: { name: "Küche", size: "12,60 m²", detail: "Gemeinschaftsküche mit Geschirrspüler. Benutztes Geschirr bitte gleich einräumen.", icon: ChefHat, tone: "bg-[#fbf3d9] text-[#4a3918]" },
  wc: { name: "WC & Bad", size: "5,39 m²", detail: "Gemeinsamer Sanitärbereich neben der Küche. Das Pissoir ist derzeit außer Betrieb.", icon: Toilet, tone: "bg-[#e9f1f2] text-[#243638]" },
  balcony: { name: "Balkon", size: "17,15 m²", detail: "Durchgehender Außenbereich an der Ostseite – erreichbar beim Büro- und Meetingbereich.", icon: Trees, tone: "bg-[#eef0ec] text-[#343a32]" },
};

function Zone({ id, selected, onSelect, delay, children }: { id: SpaceId; selected: SpaceId; onSelect: (id: SpaceId) => void; delay: string; children?: ReactNode }) {
  const space = spaces[id];
  const Icon = space.icon;
  return (
    <button
      type="button"
      onClick={() => onSelect(id)}
      className={`plan-zone group relative flex h-full min-h-0 w-full flex-col justify-between overflow-hidden rounded-[3px] text-left transition duration-300 hover:-translate-y-0.5 hover:brightness-[0.98] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#c9ff70] ${id === "balcony" ? "items-center px-2 py-5" : "p-5"} ${space.tone} ${selected === id ? "plan-zone-selected" : ""}`}
      style={{ animationDelay: delay }}
      aria-pressed={selected === id}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/75 shadow-sm"><Icon size={19} strokeWidth={1.8} /></span>
        {selected === id && <span className="rounded-full bg-[#17231c] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#c9ff70]">Aktiv</span>}
      </div>
      <div className={id === "balcony" ? "grid flex-1 place-items-center" : ""}>
        <p className="text-[22px] font-semibold tracking-[-0.035em]" style={id === "balcony" ? { writingMode: "vertical-rl", transform: "rotate(180deg)" } : undefined}>{space.name}</p>
        {space.usage && <p className="mt-1.5 max-w-[220px] text-xs font-semibold leading-4 text-emerald-800">{space.usage}</p>}
        {space.size && <p className="mt-1 text-sm font-medium opacity-55">{space.size}</p>}
      </div>
      {children}
    </button>
  );
}

function FixedZone({ title, subtitle, size, icon }: { title: string; subtitle: string; size: string; icon?: ReactNode }) {
  return (
    <div className="plan-zone flex flex-col justify-between rounded-[3px] bg-white p-5" style={{ animationDelay: "220ms" }}>
      {icon ?? <span className="h-1 w-12 rounded-full bg-stone-200" />}
      <div><p className="text-lg font-semibold tracking-[-0.025em]">{title}</p><p className="mt-1 text-xs font-medium text-stone-400">{subtitle} · {size}</p></div>
    </div>
  );
}

export function SpacePlan() {
  const [selected, setSelected] = useState<SpaceId>("meeting");
  const active = spaces[selected];
  const ActiveIcon = active.icon;

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_330px]">
      <div className="overflow-hidden rounded-[2rem] border border-stone-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-stone-100 px-5 py-4 sm:px-7">
          <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">AUFELD21</p><p className="mt-1 font-semibold">Raumübersicht · Obergeschoss</p></div>
          <span className="flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800"><span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />Interaktiv</span>
        </div>

        <div className="overflow-x-auto p-4 pb-6 sm:p-7" aria-label="Interaktiver Grundriss von AUFELD21">
          <div className="mb-3 flex items-center gap-2 text-xs font-medium text-stone-400 lg:hidden"><span>Seitlich wischen für den ganzen Plan</span><span aria-hidden="true">→</span></div>
          <div className="flex min-h-[570px] min-w-[950px] items-start gap-3 lg:min-w-0">
            <div
              className="grid min-h-[570px] flex-1 gap-[7px] rounded-2xl bg-[#17231c] p-[7px] shadow-[0_24px_70px_rgba(23,35,28,0.12)]"
              style={{ gridTemplateColumns: "1.1fr .86fr 1.2fr", gridTemplateRows: "1fr .78fr 1fr" }}
            >
              <Zone id="office1" selected={selected} onSelect={setSelected} delay="20ms" />
              <Zone id="office2" selected={selected} onSelect={setSelected} delay="70ms" />
              <Zone id="office3" selected={selected} onSelect={setSelected} delay="120ms" />

              <FixedZone
                title="Stiegenhaus"
                subtitle="Zugang Obergeschoss"
                size="7,70 m²"
                icon={
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-2 pt-1"><span className="block h-px w-20 bg-stone-300" /><span className="block h-px w-20 bg-stone-300" /><span className="block h-px w-20 bg-stone-300" /></div>
                    <span className="flex items-center gap-1.5 rounded-full bg-[#17231c] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[#c9ff70]"><DoorOpen size={14} strokeWidth={2} />Ausgang</span>
                  </div>
                }
              />
              <FixedZone title="Vorraum" subtitle="Zentraler Verteiler" size="13,63 m²" icon={<span className="flex items-center gap-2 text-xs font-semibold text-emerald-700"><span className="h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-500" />Eingang</span>} />
              <Zone id="meeting" selected={selected} onSelect={setSelected} delay="270ms">
                <div className="absolute right-5 top-5 flex gap-1.5 opacity-35"><span className="h-2 w-2 rounded-full bg-emerald-800" /><span className="h-2 w-2 rounded-full bg-emerald-800" /><span className="h-2 w-2 rounded-full bg-emerald-800" /><span className="h-2 w-2 rounded-full bg-emerald-800" /></div>
              </Zone>

              <div className="grid grid-cols-[1.55fr_1fr] gap-[7px] rounded-[3px] bg-[#17231c]">
                <Zone id="kitchen" selected={selected} onSelect={setSelected} delay="320ms" />
                <Zone id="wc" selected={selected} onSelect={setSelected} delay="350ms" />
              </div>
              <div className="col-span-2 h-full">
                <Zone id="office4" selected={selected} onSelect={setSelected} delay="380ms" />
              </div>
            </div>

            <div className="h-[365px] w-[135px] shrink-0 rounded-2xl bg-[#17231c] p-[7px] shadow-[0_24px_70px_rgba(23,35,28,0.10)]">
              <Zone id="balcony" selected={selected} onSelect={setSelected} delay="170ms">
                <span className="absolute inset-x-3 top-1/2 h-px bg-stone-400/20" />
              </Zone>
            </div>
          </div>
        </div>
      </div>

      <aside className="flex flex-col gap-4">
        <div className={`rounded-[2rem] p-7 shadow-sm ${active.tone}`} aria-live="polite">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white/80 shadow-sm"><ActiveIcon size={22} strokeWidth={1.8} /></div>
          <p className="mt-8 text-xs font-bold uppercase tracking-[0.16em] opacity-55">Ausgewählt</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-[-0.045em]">{active.name}</h2>
          {active.usage && <p className="mt-2 text-sm font-bold text-emerald-800">{active.usage}</p>}
          {active.size && <p className="mt-1 text-sm font-semibold opacity-50">{active.size}</p>}
          <p className="mt-5 leading-7 opacity-75">{active.detail}</p>
        </div>
        <div className="rounded-[2rem] border border-stone-200 bg-white p-7 shadow-sm">
          <div className="flex items-center gap-3"><Armchair size={20} className="text-emerald-700" /><p className="font-semibold">Orientierung auf einen Blick</p></div>
          <p className="mt-4 text-sm leading-6 text-stone-500">Tippe einen Raum an. Der Plan zeigt bewusst nur die wichtigsten Bereiche und bleibt dadurch ruhig und verständlich.</p>
          <div className="mt-5 flex items-center gap-3 rounded-2xl bg-stone-50 p-4"><DoorOpen size={19} className="text-emerald-700" /><span className="text-sm font-medium">Der grüne Punkt markiert den Eingang, der Ausgang liegt im Stiegenhaus.</span></div>
          <p className="mt-4 text-xs leading-5 text-stone-400">Vereinfachte Orientierung · kein Flucht- oder Einreichplan</p>
        </div>
      </aside>
    </div>
  );
}
