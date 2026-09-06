import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { InvoicePdfData } from "./pdf-v1";

// New invoices only. Keep the issuer/layout stable once version 2 is released.
export async function createInvoicePdfV2(data: InvoicePdfData) {
  const document = await PDFDocument.create();
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.09, 0.14, 0.11), green = rgb(0.02, 0.47, 0.34), gray = rgb(0.38, 0.38, 0.36);
  const euro = (value: number) => new Intl.NumberFormat("de-AT", { style: "currency", currency: "EUR" }).format(value);
  let page = document.addPage([595.28, 841.89]);
  let y = 735;
  const text = (value: string, x: number, top: number, size = 9, strong = false) =>
    page.drawText(value, { x, y: top, size, font: strong ? bold : regular, color: ink });
  function lines(value: string, width: number, size = 9) {
    const result: string[] = [];
    for (const paragraph of value.split("\n")) {
      let line = "";
      for (const word of paragraph.split(/\s+/)) {
        if (regular.widthOfTextAtSize(line ? line + " " + word : word, size) <= width) {
          line = line ? line + " " + word : word;
        } else {
          if (line) result.push(line);
          line = "";
          for (const char of word) {
            if (regular.widthOfTextAtSize(line + char, size) > width) { result.push(line); line = ""; }
            line += char;
          }
        }
      }
      result.push(line);
    }
    return result;
  }
  function header() {
    page.drawRectangle({ x: 0, y: 775, width: 595.28, height: 67, color: ink });
    page.drawText("AUFELD21", { x: 44, y: 804, size: 21, font: bold, color: rgb(0.79, 1, 0.44) });
    page.drawText("POTLOG Immobilien KG", { x: 44, y: 788, size: 9, font: regular, color: rgb(1, 1, 1) });
  }
  function nextPage() {
    page = document.addPage([595.28, 841.89]); header();
    text("Rechnung " + data.number + " · Fortsetzung", 44, 746, 10, true);
    y = 716;
  }
  function tableHeader() {
    page.drawRectangle({ x: 44, y: y - 6, width: 507, height: 25, color: rgb(0.93, 0.96, 0.94) });
    text("LEISTUNG", 52, y + 3, 8, true); text("MENGE", 322, y + 3, 8, true);
    text("EINZEL NETTO", 386, y + 3, 8, true); text("NETTO", 505, y + 3, 8, true);
    y -= 27;
  }
  function right(value: string, edge: number, top: number, strong = false, size = 9) {
    text(value, edge - (strong ? bold : regular).widthOfTextAtSize(value, size), top, size, strong);
  }
  header();
  text("RECHNUNG", 44, y, 25, true); text(data.number, 44, y - 23, 11, true);
  ["POTLOG Immobilien KG", "Aufeldstraße 21", "4050 Traun, Österreich", "UID: ATU82243314", "Steuernummer: 46 5906493", "FN 655240p"]
    .forEach((line, index) => text(line, 365, 738 - index * 13, 8, index === 0));
  text("RECHNUNG AN", 44, 630, 8, true);
  const recipient = lines([data.recipientName, data.recipientAddress, ...(data.recipientUid ? ["UID: " + data.recipientUid] : [])].join("\n"), 285, 10);
  recipient.forEach((line, index) => text(line, 44, 610 - index * 14, 10, index === 0));
  let metaY = 626;
  for (const [label, value] of [["Rechnungsdatum", data.issueDate], ["Leistungszeitraum", data.servicePeriod], ["Zahlbar bis", data.dueDate]]) {
    page.drawText(label, { x: 365, y: metaY, size: 8, font: regular, color: gray });
    const values = lines(value, 186, 9);
    values.forEach((line, index) => text(line, 365, metaY - 13 - index * 12));
    metaY -= 29 + (values.length - 1) * 12;
  }
  y = Math.min(610 - recipient.length * 14, metaY) - 30;
  tableHeader();
  for (const item of data.items) {
    const description = lines(item.description, 252);
    const rowHeight = Math.max(description.length * 13 + 23, 43);
    if (y - Math.min(rowHeight, 500) < 78) { nextPage(); tableHeader(); }
    for (let index = 0; index < description.length; index++) {
      if (y < 92) { nextPage(); tableHeader(); }
      text(description[index], 52, y);
      if (index === 0) {
        text(item.quantity.toLocaleString("de-AT") + " " + item.unit, 322, y, 8);
        right(euro(item.unitPriceNet), 451, y);
        right(euro(item.quantity * item.unitPriceNet), 543, y, true);
      }
      y -= 13;
    }
    page.drawText(item.vatRate.toLocaleString("de-AT") + " % USt", { x: 52, y, size: 7.5, font: regular, color: gray });
    y -= 21;
    page.drawLine({ start: { x: 44, y: y + 9 }, end: { x: 551, y: y + 9 }, thickness: 0.4, color: rgb(0.85, 0.88, 0.85) });
  }
  const net = data.items.reduce((sum, item) => sum + Math.round(item.quantity * item.unitPriceNet * 100) / 100, 0);
  const vatByRate = new Map<number, number>();
  for (const item of data.items) vatByRate.set(item.vatRate, (vatByRate.get(item.vatRate) ?? 0) + item.quantity * item.unitPriceNet * item.vatRate / 100);
  const vats = [...vatByRate].map(([rate, value]) => [rate, Math.round(value * 100) / 100]);
  const gross = net + vats.reduce((sum, [, value]) => sum + value, 0);
  const totals = [["Summe netto", net], ...vats.map(([rate, value]) => [rate + " % Umsatzsteuer", value]), ["Gesamtbetrag", gross]] as Array<[string, number]>;
  if (y < 228 + totals.length * 24) nextPage();
  y -= 13;
  totals.forEach(([label, value], index) => {
    const last = index === totals.length - 1;
    text(label, 330, y, last ? 11 : 9, last);
    right(euro(value), 543, y, last, last ? 11 : 9);
    y -= 24;
  });
  y -= 22;
  page.drawRectangle({ x: 44, y: y - 105, width: 507, height: 124, color: rgb(0.93, 0.98, 0.95) });
  page.drawText("ZAHLUNGSINFORMATION", { x: 58, y, size: 8, font: bold, color: green });
  text("POTLOG Immobilien KG", 58, y - 20, 10, true);
  text("IBAN: AT31 2032 6000 0010 4455", 58, y - 38);
  text("BIC: SPNKAT21XXX", 58, y - 54);
  text("Verwendungszweck: " + data.number, 58, y - 77, 9, true);
  text("Vielen Dank für die Zusammenarbeit.", 44, y - 135, 9, true);
  const pages = document.getPages();
  pages.forEach((p, index) => {
    p.drawText("POTLOG Immobilien KG | Aufeldstraße 21 | 4050 Traun | ATU82243314 | FN 655240p", { x: 44, y: 38, size: 7, font: regular, color: gray });
    p.drawText(`${index + 1} / ${pages.length}`, { x: 526, y: 38, size: 7, font: regular, color: gray });
  });
  document.setTitle("Rechnung " + data.number);
  document.setAuthor("POTLOG Immobilien KG");
  document.setSubject("AUFELD21 Rechnung");
  return document.save();
}
