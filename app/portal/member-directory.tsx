"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { ChevronRight, DoorOpen, FileText, Gift, KeyRound, MoreHorizontal, Search, UserRoundCheck, UserRoundX, Users, X } from "lucide-react";
import { filterMembers, isTeamMember, meetingSummary, memberRoleLabel, type ManagedMember, type MemberFilter } from "@/lib/members/directory";

type Props = {
  members: ManagedMember[];
  monthLabel: string;
  passwordResetMemberId: string | null;
  onOpen: (member: ManagedMember) => void;
  onBilling: (member: ManagedMember) => void;
  onPasswordReset: (member: ManagedMember) => void;
  onGift: (member: ManagedMember) => void;
  onToggleActive: (member: ManagedMember) => void;
};

const hours = (value: number) => value.toLocaleString("de-AT", { maximumFractionDigits: 2 });
const money = (value: number) => value.toLocaleString("de-AT", { style: "currency", currency: "EUR" });
const filters: Array<{ value: MemberFilter; label: string }> = [
  { value: "all", label: "Alle" },
  { value: "tenants", label: "Mieter" },
  { value: "team", label: "Team" },
  { value: "inactive", label: "Deaktiviert" },
];

function MemberActions({ member, open, onClose, onToggle, ...props }: Omit<Props, "members" | "monthLabel" | "onOpen"> & {
  member: ManagedMember; open: boolean; onClose: () => void; onToggle: () => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const [opensUp, setOpensUp] = useState(false);

  useEffect(() => {
    if (!open) return;
    menuRef.current?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus();
    const onOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) onClose();
    };
    document.addEventListener("pointerdown", onOutside);
    return () => document.removeEventListener("pointerdown", onOutside);
  }, [open, onClose]);

  const run = (action: (member: ManagedMember) => void) => {
    // Return dialog focus to a persistent element, not a removed menu item.
    triggerRef.current?.focus();
    onClose();
    action(member);
  };
  const actionClass = "flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium outline-none disabled:cursor-not-allowed disabled:text-stone-400";
  const neutralActionClass = `${actionClass} text-stone-700 hover:bg-stone-100 focus:bg-stone-100`;

  return <div ref={rootRef} className={`relative ${open ? "z-30" : ""}`} onBlur={(event) => {
    if (open && !event.currentTarget.contains(event.relatedTarget as Node | null)) onClose();
  }}>
    <button ref={triggerRef} type="button" aria-label={`Weitere Aktionen für ${member.name}`} aria-haspopup="menu" aria-expanded={open} aria-controls={open ? menuId : undefined} onClick={() => {
      const triggerBottom = triggerRef.current?.getBoundingClientRect().bottom ?? 0;
      setOpensUp(window.innerHeight - triggerBottom < 240);
      onToggle();
    }}
      className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl border outline-none transition focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-2 ${open ? "border-emerald-700 bg-emerald-50 text-emerald-800" : "border-stone-200 bg-white text-stone-500 hover:bg-stone-50"}`}>
      <MoreHorizontal size={20} aria-hidden="true" />
    </button>
    {open && <div ref={menuRef} id={menuId} role="menu" aria-label={`Aktionen für ${member.name}`} className={`absolute right-0 ${opensUp ? "bottom-full mb-2" : "top-full mt-2"} w-60 max-w-[calc(100vw-4.5rem)] rounded-2xl border border-stone-200 bg-white p-1.5 shadow-xl shadow-stone-900/10`} onKeyDown={(event) => {
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); triggerRef.current?.focus(); onClose(); }
      if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
        event.preventDefault();
        const items = [...event.currentTarget.querySelectorAll<HTMLButtonElement>("button:not(:disabled)")];
        const current = items.indexOf(document.activeElement as HTMLButtonElement);
        const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : (current + (event.key === "ArrowUp" ? -1 : 1) + items.length) % items.length;
        items[next]?.focus();
      }
    }}>
      {member.role !== "employee" && <button role="menuitem" type="button" className={neutralActionClass} onClick={() => run(props.onBilling)}><FileText size={17} aria-hidden="true" /> Abrechnung bearbeiten</button>}
      <button role="menuitem" type="button" className={neutralActionClass} onClick={() => run(props.onGift)}><Gift size={17} aria-hidden="true" /> Stunden schenken</button>
      <button role="menuitem" type="button" className={neutralActionClass} disabled={!member.active || props.passwordResetMemberId === member.id} onClick={() => run(props.onPasswordReset)}><KeyRound size={17} aria-hidden="true" /> {props.passwordResetMemberId === member.id ? "Wird gesendet …" : "Passwort-Link senden"}</button>
      {member.role !== "admin" && <div className="mt-1 border-t border-stone-100 pt-1"><button role="menuitem" type="button" className={`${actionClass} ${member.active ? "text-red-700 hover:bg-red-50 focus:bg-red-50" : "text-emerald-700 hover:bg-emerald-50 focus:bg-emerald-50"}`} onClick={() => run(props.onToggleActive)}>
        {member.active ? <UserRoundX size={17} aria-hidden="true" /> : <UserRoundCheck size={17} aria-hidden="true" />}{member.active ? "Zugang deaktivieren" : "Zugang aktivieren"}
      </button></div>}
    </div>}
  </div>;
}

export function MemberDirectory(props: Props) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<MemberFilter>("all");
  const [openActionsId, setOpenActionsId] = useState<string | null>(null);
  const closeActions = useCallback(() => setOpenActionsId(null), []);
  const visibleMembers = filterMembers(props.members, query, filter);
  const activeCount = props.members.filter((member) => member.active).length;

  return <div>
    <div className="flex flex-col gap-4 border-b border-stone-100 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-stone-100 p-1 min-[400px]:flex min-[400px]:flex-wrap" role="group" aria-label="Personen filtern">
        {filters.map((item) => <button key={item.value} type="button" aria-pressed={filter === item.value} onClick={() => { setFilter(item.value); setOpenActionsId(null); }} className={`min-h-10 rounded-lg px-3 text-sm font-semibold outline-none transition focus-visible:ring-2 focus-visible:ring-emerald-700 ${filter === item.value ? "bg-white text-stone-900 shadow-sm" : "text-stone-500 hover:text-stone-800"}`}>{item.label}</button>)}
      </div>
      <div className="flex min-w-0 items-center gap-3 lg:w-80">
        <div className="relative min-w-0 flex-1">
          <Search size={17} className="pointer-events-none absolute left-3 top-3.5 text-stone-400" aria-hidden="true" />
          <input type="search" value={query} onChange={(event) => { setQuery(event.target.value); setOpenActionsId(null); }} aria-label="Person, Firma, E-Mail oder Büro suchen" placeholder="Person oder Büro suchen" className="h-11 w-full min-w-0 rounded-xl border border-stone-200 bg-white pl-10 pr-10 text-sm outline-none focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700 [&::-webkit-search-cancel-button]:appearance-none" />
          {query && <button type="button" aria-label="Suche löschen" onClick={() => setQuery("")} className="absolute right-0 top-0 grid h-11 w-10 place-items-center text-stone-500"><X size={15} /></button>}
        </div>
      </div>
    </div>
    <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-xs text-stone-500 sm:px-6">
      <p aria-live="polite">{visibleMembers.length} {visibleMembers.length === 1 ? "Person" : "Personen"}{filter === "all" && !query ? ` · ${activeCount} aktiv` : ` von ${props.members.length}`}</p>
      <p>Meetingraum · {props.monthLabel}</p>
    </div>
    <div className="hidden grid-cols-[minmax(0,2.2fr)_minmax(0,1.5fr)_minmax(0,1fr)_90px_150px] items-center gap-5 border-y border-stone-100 bg-stone-50/80 px-6 py-3 text-[11px] font-semibold uppercase tracking-wider text-stone-500 xl:grid" aria-hidden="true">
      <span>Person & Büro</span><span>Meetingstunden</span><span>Zusatznutzung</span><span>Zugang</span><span className="text-right">Verwalten</span>
    </div>
    <ul className="divide-y divide-stone-100" aria-label="Personenübersicht">
      {visibleMembers.map((member) => {
        const summary = meetingSummary(member);
        const name = member.billing_name || member.name;
        return <li key={member.id} className="px-4 py-5 transition-colors hover:bg-stone-50/40 sm:px-6 xl:py-4">
          <div className="grid min-w-0 grid-cols-2 gap-x-4 gap-y-4 xl:grid-cols-[minmax(0,2.2fr)_minmax(0,1.5fr)_minmax(0,1fr)_90px_150px] xl:items-center xl:gap-5">
            <div className="col-span-2 flex min-w-0 items-start gap-3 xl:col-span-1 xl:items-center">
              <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl text-sm font-semibold ${member.active ? "bg-emerald-50 text-emerald-800" : "bg-stone-100 text-stone-500"}`} aria-hidden="true">{name.slice(0, 1)}</div>
              <div className="min-w-0">
                <button type="button" onClick={() => props.onOpen(member)} className="block max-w-full break-words text-left text-[15px] font-semibold leading-5 text-stone-900 outline-none hover:text-emerald-800 focus-visible:rounded focus-visible:ring-2 focus-visible:ring-emerald-700">{name}</button>
                <p className="mt-1 break-all text-xs leading-5 text-stone-500">{member.email}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs leading-5">
                  {member.office_name && <span className="inline-flex items-center gap-1.5 text-stone-600"><DoorOpen size={12} className="shrink-0" aria-hidden="true" />{member.office_name}</span>}
                  <span className="inline-flex whitespace-nowrap rounded-md bg-stone-100 px-1.5 text-[10px] font-medium text-stone-600">{memberRoleLabel(member)}</span>
                </div>
              </div>
            </div>
            <div className="min-w-0">
              <p className="mb-1 text-[11px] text-stone-500 xl:hidden">Meetingstunden</p>
              <p className="text-sm tabular-nums"><span className="font-semibold text-stone-900">{hours(member.usedHours)} h</span><span className="text-stone-500"> / {hours(summary.allowance)} h</span></p>
              <div className="my-2 h-1.5 max-w-44 overflow-hidden rounded-full bg-stone-100" aria-hidden="true"><div className={`h-full rounded-full ${summary.extraHours > 0 ? "bg-amber-500" : "bg-emerald-600"}`} style={{ width: `${summary.progress}%` }} /></div>
              <p className="text-xs leading-5 text-stone-500"><span className="whitespace-nowrap">{hours(member.includedHours ?? 12)} h inklusive{member.meetingAccountId && member.meetingAccountId !== member.id ? ' · gemeinsam' : ''}</span>{member.bonusHours > 0 && <> <span className="whitespace-nowrap text-emerald-700">· +{hours(member.bonusHours)} h Bonus</span></>}</p>
            </div>
            <div className="min-w-0">
              <p className="mb-1 text-[11px] text-stone-500 xl:hidden">Zusatznutzung</p>
              {summary.extraNet === null ? <p className="text-xs leading-5 text-stone-500">Keine Abrechnung</p> : <>
                <p className={`whitespace-nowrap text-sm font-semibold tabular-nums ${summary.extraNet > 0 ? "text-amber-800" : "text-stone-500"}`}>{money(summary.extraNet)}</p>
                <p className="mt-1 text-xs leading-5 text-stone-400">{summary.extraHours > 0 ? `${hours(summary.extraHours)} h · netto` : "Keine Zusatzstunden"}</p>
              </>}
            </div>
            <div className="col-span-2 flex items-center justify-between gap-2 border-t border-stone-100 pt-3 xl:contents">
            <div className="flex items-center">
              <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-1 text-[11px] font-medium ${member.active ? "bg-emerald-50 text-emerald-800" : "bg-stone-100 text-stone-600"}`}><span className={`h-1.5 w-1.5 rounded-full ${member.active ? "bg-emerald-500" : "bg-stone-400"}`} aria-hidden="true" />{member.active ? "Aktiv" : "Deaktiviert"}</span>
            </div>
            <div className="flex items-center justify-end gap-2">
              <button type="button" aria-label={`${isTeamMember(member) ? "Personenakte" : "Mieterakte"} von ${member.name} öffnen`} onClick={() => props.onOpen(member)} className="flex h-11 items-center justify-center gap-1 rounded-xl border border-stone-200 bg-white px-3 text-sm font-semibold text-stone-800 outline-none transition hover:border-emerald-700 hover:text-emerald-800 focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-2">Öffnen<ChevronRight size={15} aria-hidden="true" /></button>
              <MemberActions member={member} open={openActionsId === member.id} onClose={closeActions} onToggle={() => setOpenActionsId((id) => id === member.id ? null : member.id)} passwordResetMemberId={props.passwordResetMemberId} onBilling={props.onBilling} onGift={props.onGift} onPasswordReset={props.onPasswordReset} onToggleActive={props.onToggleActive} />
            </div>
            </div>
          </div>
        </li>;
      })}
    </ul>
    {visibleMembers.length === 0 && <div className="px-5 py-12 text-center"><Users size={25} className="mx-auto text-stone-300" aria-hidden="true" /><p className="mt-3 font-semibold text-stone-700">Keine Personen gefunden</p><p className="mt-1 text-sm text-stone-500">Versuche einen anderen Namen oder Filter.</p>{(query || filter !== "all") && <button type="button" className="mt-4 min-h-11 rounded-xl border border-stone-200 px-4 text-sm font-semibold" onClick={() => { setQuery(""); setFilter("all"); }}>Alle Personen anzeigen</button>}</div>}
  </div>;
}
