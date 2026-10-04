import { MarketingPage } from "../marketing-shell";

// Firmenbuchdaten anhand des bereitgestellten Auszugs vom 25.06.2025 geprüft.
// Gewerbeberechtigung, Kammerzugehörigkeit und Gewerbebehörde sind damit nicht
// belegt; gegebenenfalls erst nach Prüfung eines GISA-Auszuges ergänzen.
export default function ImprintPage() {
  return <MarketingPage eyebrow="Rechtliches" title="Impressum" intro="Informationen gemäß Unternehmensgesetzbuch, E-Commerce-Gesetz und Mediengesetz.">
    <section className="mx-auto max-w-4xl px-5 pb-16 sm:px-8 lg:pb-20">
      <div className="space-y-9 rounded-[2rem] bg-white p-7 leading-7 shadow-sm sm:p-12">
        <div><h2 className="text-xl font-bold">Medieninhaber und Diensteanbieter</h2><p className="mt-3">POTLOG Immobilien KG<br/>Aufeldstraße 21<br/>4050 Traun, Österreich</p><p className="mt-3">AUFELD21 ist eine Marke der POTLOG Immobilien KG. Die Gesellschaft betreibt den Co-Working-Space an dieser Adresse.</p></div>
        <div className="grid gap-7 sm:grid-cols-2"><div><h2 className="font-bold">Unternehmensdaten</h2><p className="mt-2">Rechtsform: Kommanditgesellschaft<br/>Sitz: Traun<br/>Firmenbuchnummer: FN 655240 p<br/>Firmenbuchgericht: Landesgericht Linz<br/>UID-Nummer: ATU82243314<br/>Steuernummer: 46 5906493</p></div><div className="min-w-0"><h2 className="font-bold">Kontakt</h2><p className="mt-2">Telefon: <a href="tel:+436643517810" className="underline underline-offset-4">+43 664 35 17 810</a><br/>E-Mail: <a href="mailto:roland@immo-kredit.net" className="break-words underline underline-offset-4">roland@immo-kredit.net</a></p></div></div>
        <div><h2 className="font-bold">Unternehmensgegenstand</h2><p className="mt-2">Immobilienerwerb und Vermietung; Betrieb des Co-Working-Spaces AUFELD21.</p></div>
        <div><h2 className="font-bold">Vertretung</h2><p className="mt-2">Unbeschränkt haftender Gesellschafter: Roland Potlog, selbständig vertretungsberechtigt<br/>Kommanditistin: Julia Potlog</p></div>
        <div><h2 className="font-bold">Grundlegende Richtung der Website</h2><p className="mt-2">Informationen über AUFELD21, die angebotenen Büros und Arbeitsplätze, den Meetingraum und Büroservice sowie Beiträge rund um Coworking und den Arbeitsalltag in Traun.</p></div>
      </div>
    </section>
  </MarketingPage>;
}
