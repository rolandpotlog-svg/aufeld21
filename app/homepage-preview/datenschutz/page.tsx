import { MarketingPage } from "../marketing-shell";

const blocks = [
  ["Verantwortlicher","POTLOG Immobilien KG, Aufeldstraße 21, 4050 Traun. Kontakt: roland@immo-kredit.net, +43 664 35 17 810."],
  ["Bereitstellung der Website","Beim Aufruf der Website verarbeitet der Hosting-Anbieter technisch notwendige Verbindungsdaten, insbesondere IP-Adresse, Zeitpunkt, aufgerufene Seite, Browser- und Geräteinformationen. Dies dient dem sicheren und stabilen Betrieb der Website."],
  ["Kontaktaufnahme","Wenn Sie uns per E-Mail oder telefonisch kontaktieren, verarbeiten wir die von Ihnen angegebenen Daten zur Bearbeitung Ihrer Anfrage und für vorvertragliche Maßnahmen. Die Daten werden nur so lange gespeichert, wie dies für die Anfrage oder gesetzliche Aufbewahrungspflichten erforderlich ist."],
  ["Mitgliederportal","Das geschützte Mitgliederportal nutzt Supabase für Anmeldung und Datenhaltung. Dabei werden insbesondere E-Mail-Adresse, Anmeldedaten und die für Buchungen oder Verwaltung notwendigen Informationen verarbeitet."],
  ["Automatische E-Mails","Für Einladungen, Passwort-Mails und Hinweise aus dem Portal nutzen wir Resend. Dabei werden Empfängeradresse, notwendiger Nachrichteninhalt und technische Versand- und Zustelldaten verarbeitet. Rechnungshinweise enthalten einen Link zum geschützten Portal, aber keine Rechnungsanhänge. Meldungshinweise an die Verwaltung enthalten keinen Meldungstext. Es handelt sich nicht um einen Werbe-Newsletter."],
  ["Optionale Geräte-Benachrichtigungen","Die freigeschaltete Verwaltung kann Web-Push auf eigenen Geräten ausdrücklich erlauben und wieder ausschalten. Dafür speichern wir die technische Geräte-Abonnementadresse und Verschlüsselungsschlüssel. Die verschlüsselten Hinweise werden über den Pushdienst des verwendeten Browsers zugestellt, beispielsweise Apple oder Google. Der Sperrbildschirm zeigt keine vertraulichen Meldungsinhalte. Es werden keine Portal-Seiten oder Rechnungsdateien für den Offline-Zugriff gespeichert."],
  ["Hosting und Dienstleister","Die Website wird über Vercel bereitgestellt. Für Authentifizierung und Datenbank wird Supabase eingesetzt. Vor dem Livegang sind eingesetzte Regionen, Auftragsverarbeitungsverträge und mögliche Drittlandübermittlungen abschließend zu dokumentieren."],
  ["Cookies","Die öffentliche Website soll ohne Analyse- oder Marketing-Cookies betrieben werden. Technisch notwendige Cookies können im Mitgliederportal für die Anmeldung eingesetzt werden."],
  ["Ihre Rechte","Sie haben nach Maßgabe der DSGVO insbesondere Rechte auf Auskunft, Berichtigung, Löschung, Einschränkung, Datenübertragbarkeit und Widerspruch. Außerdem besteht ein Beschwerderecht bei der Österreichischen Datenschutzbehörde."],
];

export default function PrivacyPage() {
  return <MarketingPage eyebrow="Rechtliches" title="Datenschutz" intro="Transparente Informationen darüber, welche personenbezogenen Daten bei der Nutzung von Website und Mitgliederportal verarbeitet werden.">
    <section className="mx-auto max-w-4xl px-5 pb-16 sm:px-8 lg:pb-20"><div className="space-y-8 rounded-[2rem] bg-white p-7 shadow-sm sm:p-12">{blocks.map(([title,text])=><div key={title}><h2 className="text-xl font-bold">{title}</h2><p className="mt-3 leading-7 text-stone-600">{text}</p></div>)}<div className="rounded-2xl bg-amber-50 p-5 text-sm leading-6 text-amber-950"><strong>Entwurf:</strong> Diese Datenschutzerklärung muss vor Veröffentlichung noch mit der endgültigen Domain, den konkret aktivierten Vercel-/Supabase-Funktionen, E-Mail-Diensten, Serverregionen und Auftragsverarbeitungsverträgen abgeglichen werden.</div></div></section>
  </MarketingPage>;
}
