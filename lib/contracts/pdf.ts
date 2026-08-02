import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from "pdf-lib";

export type ContractPdfData = {
  tenantName: string;
  tenantAddress: string;
  tenantUid?: string | null;
  representative: string;
  companyRegister: string;
  phone?: string;
  email: string;
  officeName: string;
  officeArea?: string;
  contractStart: string;
  contractEnd: string;
  monthlyRentNet: number;
  deposit: number;
  createdOn: string;
};

const euro = (value: number) => new Intl.NumberFormat("de-AT", { style: "currency", currency: "EUR" }).format(value);

function wrap(text: string, font: PDFFont, size: number, maxWidth: number) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) <= maxWidth) line = next;
    else { if (line) lines.push(line); line = word; }
  }
  if (line) lines.push(line);
  return lines;
}

export async function createContractPdf(data: ContractPdfData) {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const dark = rgb(0.09, 0.14, 0.11);
  const green = rgb(0.02, 0.47, 0.34);
  const gray = rgb(0.38, 0.38, 0.36);
  const lime = rgb(0.79, 1, 0.44);
  let page!: PDFPage;
  let y = 0;
  let pageNumber = 0;

  const newPage = () => {
    page = pdf.addPage([595.28, 841.89]);
    pageNumber += 1;
    page.drawRectangle({ x: 0, y: 786, width: 595.28, height: 56, color: dark });
    page.drawRectangle({ x: 42, y: 798, width: 36, height: 30, color: lime });
    page.drawText("A21", { x: 48, y: 808, size: 10, font: bold, color: dark });
    page.drawText("AUFELD21 · NUTZUNGSVEREINBARUNG", { x: 91, y: 808, size: 13, font: bold, color: rgb(1, 1, 1) });
    page.drawText(`Entwurf · Seite ${pageNumber}`, { x: 458, y: 808, size: 8, font: regular, color: rgb(0.78, 0.82, 0.79) });
    page.drawText("POTLOG Immobilien KG | Aufeldstraße 21 | 4050 Traun", { x: 42, y: 28, size: 7.5, font: regular, color: gray });
    y = 755;
  };
  const ensure = (height: number) => { if (y - height < 58) newPage(); };
  const heading = (title: string) => {
    ensure(34); y -= 8;
    page.drawText(title, { x: 42, y, size: 13, font: bold, color: dark });
    page.drawLine({ start: { x: 42, y: y - 7 }, end: { x: 553, y: y - 7 }, thickness: 1, color: green });
    y -= 27;
  };
  const paragraph = (text: string) => {
    const lines = wrap(text, regular, 9.2, 511);
    ensure(lines.length * 13 + 8);
    lines.forEach((line) => { page.drawText(line, { x: 42, y, size: 9.2, font: regular, color: dark }); y -= 13; });
    y -= 7;
  };
  const field = (label: string, value: string) => {
    ensure(18);
    page.drawText(label, { x: 42, y, size: 8.5, font: bold, color: green });
    page.drawText(value || "-", { x: 170, y, size: 9.2, font: regular, color: dark });
    y -= 17;
  };

  newPage();
  page.drawText("NUTZUNGSVEREINBARUNG", { x: 42, y, size: 24, font: bold, color: dark }); y -= 25;
  page.drawText("Automatisch erstellter Vertragsentwurf zur Prüfung und Unterzeichnung", { x: 42, y, size: 9, font: regular, color: gray }); y -= 30;
  heading("Vertragsparteien");
  field("Vermieter", "POTLOG Immobilien KG, Aufeldstraße 21, 4050 Traun");
  field("UID / Firmenbuch", "ATU82243314 / FN 655240p");
  field("Vertreten durch", "Roland Potlog");
  y -= 8;
  field("Nutzer", data.tenantName);
  field("Anschrift", data.tenantAddress.replace(/\n/g, ", "));
  field("UID", data.tenantUid ?? "-");
  if (data.companyRegister) field("Firmenbuchnummer", data.companyRegister);
  if (data.representative) field("Vertreten durch", data.representative);
  field("E-Mail / Telefon", `${data.email}${data.phone ? ` / ${data.phone}` : ""}`);

  heading("1. Vertragsgegenstand");
  paragraph(`Der Vermieter überlässt dem Nutzer die im Obergeschoss der Liegenschaft Aufeldstraße 21, 4050 Traun gelegene Büroeinheit ${data.officeName}${data.officeArea ? ` mit rund ${data.officeArea} m²` : ""} zur ausschließlichen Nutzung als Büro- und Arbeitsraum. Der Grundriss, das Übergabeprotokoll und die Inventarliste bilden - sofern beigefügt - Bestandteile dieser Vereinbarung.`);
  paragraph("Die Gemeinschaftsflächen, Küche, Sanitärbereiche, Besprechungsraum und der Balkon dürfen im üblichen Umfang gemeinsam genutzt werden. Ein ausschließliches Nutzungsrecht an Gemeinschaftsflächen besteht nicht.");

  heading("2. Vertragsdauer");
  paragraph(`Das Nutzungsverhältnis beginnt am ${data.contractStart} und endet am ${data.contractEnd}, ohne dass es einer Kündigung bedarf. Eine Verlängerung bedarf einer schriftlichen Vereinbarung. Das Recht zur vorzeitigen Auflösung aus wichtigem Grund bleibt unberührt.`);

  heading("3. Nutzungsentgelt und Fälligkeit");
  const vat = data.monthlyRentNet * 0.2;
  paragraph(`Das monatliche All-in-Nutzungsentgelt beträgt ${euro(data.monthlyRentNet)} netto zuzüglich 20 % Umsatzsteuer (${euro(vat)}), somit ${euro(data.monthlyRentNet + vat)} brutto. Das Entgelt ist monatlich im Voraus spätestens bis zum 10. des jeweiligen Monats auf das bekanntgegebene Konto der POTLOG Immobilien KG zu überweisen.`);
  paragraph("Im Pauschalentgelt sind bei üblichem Verbrauch Strom, Heizung, Wasser, Internet, Reinigung der Gemeinschaftsflächen und die bereitgestellte Grundausstattung enthalten. Außergewöhnlicher Mehrverbrauch und gesondert beauftragte Leistungen können zusätzlich verrechnet werden.");

  heading("4. Kaution");
  paragraph(data.deposit > 0 ? `Der Nutzer leistet eine Kaution in Höhe von ${euro(data.deposit)}. Sie dient der Sicherstellung sämtlicher Ansprüche aus dieser Vereinbarung und wird nach ordnungsgemäßer Rückgabe und Endabrechnung abgerechnet.` : "Zwischen den Vertragsparteien ist keine Kaution vereinbart.");

  heading("5. Inklusivleistungen und Meetingraum");
  paragraph("Enthalten sind die Nutzung der vereinbarten Büroeinheit, Highspeed-Internet, Gemeinschaftsküche, Sanitärbereiche, Drucker/Scanner im Fair-use-Rahmen, Zutrittssystem sowie verfügbare Stellplätze ohne Exklusivanspruch.");
  paragraph("Dem Nutzer stehen monatlich 12 Stunden Meetingraumnutzung nach vorheriger Reservierung zur Verfügung. Nicht verbrauchte Stunden verfallen mit Monatsende. Darüber hinausgehende Nutzung wird in 30-Minuten-Schritten mit EUR 12,00 netto je Stunde verrechnet; vom Vermieter gewährte Bonusstunden werden vor Zusatzkosten berücksichtigt.");

  heading("6. Zutritt, Gäste und Hausordnung");
  paragraph("Die persönliche Zutrittsberechtigung darf nicht ohne Zustimmung weitergegeben werden. Gäste, Kundentermine und Besprechungen sind erlaubt; der Nutzer trägt für deren Verhalten Verantwortung. Die jeweils ausgehändigte Hausordnung ist einzuhalten und bildet einen Bestandteil dieser Vereinbarung.");

  heading("7. Sorgfalt, Schäden und Veränderungen");
  paragraph("Die Räume und die Einrichtung sind pfleglich zu behandeln. Schäden und Störungen sind unverzüglich zu melden. Bauliche Veränderungen und wesentliche Montagen bedürfen der vorherigen schriftlichen Zustimmung. Die gewöhnliche Abnutzung bleibt davon unberührt.");

  heading("8. Haftung, Versicherung und IT");
  paragraph("Der Nutzer trägt die Verantwortung für eingebrachte Sachen und Daten und hält eine angemessene Betriebs- bzw. Haftpflichtversicherung. Für Internet- und IT-Sicherheit, insbesondere Verschlüsselung, Virenschutz und Datensicherung, ist der Nutzer selbst verantwortlich. Gesetzlich zwingende Haftungsbestimmungen bleiben unberührt.");

  heading("9. Weitergabe und Untervermietung");
  paragraph("Eine Untervermietung, Weitergabe oder sonstige Überlassung der Büroeinheit an Dritte ist ohne vorherige schriftliche Zustimmung des Vermieters unzulässig. Die Beschäftigung eigener, dem Vermieter bekanntgegebener Mitarbeiter gilt nicht als Weitergabe.");

  heading("10. Umsatzsteuer und Verwendungszweck");
  paragraph("Der Nutzer bestätigt, den Mietgegenstand für unternehmerische Tätigkeiten zu verwenden. Änderungen der Nutzung, die Auswirkungen auf die umsatzsteuerliche Behandlung haben können, sind dem Vermieter unverzüglich mitzuteilen. Die konkrete steuerliche Behandlung ist vor Unterzeichnung zu prüfen.");

  heading("11. Rückstellung und Schlussbestimmungen");
  paragraph("Bei Vertragsende ist die Büroeinheit geräumt, besenrein und samt überlassener Zutrittsmittel zurückzugeben. Änderungen und Ergänzungen bedürfen der Schriftform. Es gilt österreichisches Recht; Gerichtsstand ist, soweit gesetzlich zulässig, Linz. Sollten einzelne Bestimmungen unwirksam sein, bleibt der übrige Vertrag unberührt.");
  paragraph("Beilagen: Grundriss, Übergabeprotokoll, Inventarliste und Hausordnung, soweit jeweils beigefügt.");

  ensure(150); y -= 12;
  page.drawText(`Erstellt am ${data.createdOn}`, { x: 42, y, size: 8.5, font: regular, color: gray }); y -= 38;
  page.drawLine({ start: { x: 42, y }, end: { x: 250, y }, thickness: 0.8, color: dark });
  page.drawLine({ start: { x: 345, y }, end: { x: 553, y }, thickness: 0.8, color: dark });
  page.drawText(data.representative ? `${data.tenantName} / ${data.representative}` : data.tenantName, { x: 42, y: y - 16, size: 8, font: regular, color: gray });
  page.drawText("POTLOG Immobilien KG / Roland Potlog", { x: 345, y: y - 16, size: 8, font: regular, color: gray });
  page.drawText("Ort, Datum, Unterschrift Nutzer", { x: 42, y: y - 29, size: 8, font: bold, color: dark });
  page.drawText("Ort, Datum, Unterschrift Vermieter", { x: 345, y: y - 29, size: 8, font: bold, color: dark });

  pdf.setTitle(`Nutzungsvereinbarung ${data.tenantName}`);
  pdf.setAuthor("POTLOG Immobilien KG");
  pdf.setSubject("AUFELD21 Nutzungsvereinbarung - Entwurf");
  return pdf.save();
}
