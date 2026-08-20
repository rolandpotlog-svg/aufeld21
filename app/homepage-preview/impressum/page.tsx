import { MarketingPage } from "../marketing-shell";

export default function ImprintPage() {
  return <MarketingPage eyebrow="Rechtliches" title="Impressum" intro="Informationen gemäß Unternehmensgesetzbuch, E-Commerce-Gesetz und Mediengesetz.">
    <section className="mx-auto max-w-4xl px-5 pb-16 sm:px-8 lg:pb-20">
      <div className="space-y-9 rounded-[2rem] bg-white p-7 leading-7 shadow-sm sm:p-12">
        <div><h2 className="text-xl font-bold">Medieninhaber und Diensteanbieter</h2><p className="mt-3">POTLOG Immobilien KG<br/>Aufeldstraße 21<br/>4050 Traun, Österreich</p></div>
        <div className="grid gap-7 sm:grid-cols-2"><div><h2 className="font-bold">Unternehmensdaten</h2><p className="mt-2">Rechtsform: Kommanditgesellschaft<br/>Sitz: Traun<br/>Firmenbuchnummer: FN 655240p<br/>UID-Nummer: ATU82243314<br/>Steuernummer: 46 5906493</p></div><div><h2 className="font-bold">Kontakt</h2><p className="mt-2">Telefon: +43 664 35 17 810<br/>E-Mail: roland@immo-kredit.net</p></div></div>
        <div><h2 className="font-bold">Unternehmensgegenstand</h2><p className="mt-2">Immobilienerwerb und Vermietung; Betrieb des Co-Working-Spaces AUFELD21.</p></div>
        <div><h2 className="font-bold">Vertretung</h2><p className="mt-2">Unbeschränkt haftender Gesellschafter: Roland Potlog<br/>Kommanditistin: Julia Potlog</p></div>
        <div className="rounded-2xl bg-amber-50 p-5 text-sm text-amber-950"><strong>Vor Veröffentlichung ergänzen:</strong> Firmenbuchgericht, zuständige Aufsichts-/Gewerbebehörde, Kammerzugehörigkeit und anwendbare gewerberechtliche Vorschriften müssen anhand der aktuellen Unternehmensunterlagen bestätigt werden.</div>
      </div>
    </section>
  </MarketingPage>;
}
