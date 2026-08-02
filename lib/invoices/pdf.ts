import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export type InvoicePdfItem = {
  description: string;
  quantity: number;
  unit: string;
  unitPriceNet: number;
  vatRate: number;
};

export type InvoicePdfData = {
  number: string;
  issueDate: string;
  dueDate: string;
  servicePeriod: string;
  recipientName: string;
  recipientAddress: string;
  recipientUid?: string | null;
  items: InvoicePdfItem[];
};

const euro = (value: number) =>
  new Intl.NumberFormat("de-AT", { style: "currency", currency: "EUR" }).format(value);

export async function createInvoicePdf(data: InvoicePdfData) {
  const document = await PDFDocument.create();
  const page = document.addPage([595.28, 841.89]);
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const dark = rgb(0.09, 0.14, 0.11);
  const green = rgb(0.02, 0.47, 0.34);
  const lime = rgb(0.79, 1, 0.44);
  const gray = rgb(0.38, 0.38, 0.36);
  const light = rgb(0.96, 0.96, 0.95);

  page.drawRectangle({ x: 0, y: 768, width: 595.28, height: 74, color: dark });
  page.drawRectangle({ x: 44, y: 786, width: 42, height: 38, color: lime });
  page.drawText("A21", { x: 53, y: 799, size: 12, font: bold, color: dark });
  page.drawText("AUFELD21", { x: 100, y: 799, size: 19, font: bold, color: rgb(1, 1, 1) });
  page.drawText("POTLOG Immobilien KG", { x: 100, y: 783, size: 8.5, font: regular, color: rgb(0.78, 0.82, 0.79) });

  page.drawText("RECHNUNG", { x: 44, y: 718, size: 28, font: bold, color: dark });
  page.drawText(data.number, { x: 44, y: 697, size: 11, font: bold, color: green });

  const senderLines = [
    "POTLOG Immobilien KG",
    "Aufeldstraße 21",
    "4050 Traun, Österreich",
    "UID: ATU82243314",
    "Steuernummer: 46 5906493",
    "FN 655240p",
  ];
  senderLines.forEach((line, index) =>
    page.drawText(line, { x: 365, y: 720 - index * 15, size: 8.5, font: index === 0 ? bold : regular, color: index === 0 ? dark : gray }),
  );

  page.drawText("RECHNUNG AN", { x: 44, y: 642, size: 8, font: bold, color: green });
  const recipientLines = [data.recipientName, ...data.recipientAddress.split("\n"), ...(data.recipientUid ? [`UID: ${data.recipientUid}`] : [])];
  recipientLines.forEach((line, index) =>
    page.drawText(line, { x: 44, y: 623 - index * 16, size: 10, font: index === 0 ? bold : regular, color: dark }),
  );

  const metaX = 365;
  const meta = [
    ["Rechnungsdatum", data.issueDate],
    ["Leistungszeitraum", data.servicePeriod],
    ["Zahlbar bis", data.dueDate],
  ];
  meta.forEach(([label, value], index) => {
    page.drawText(label, { x: metaX, y: 623 - index * 25, size: 8, font: regular, color: gray });
    page.drawText(value, { x: metaX, y: 611 - index * 25, size: 9.5, font: bold, color: dark });
  });

  const tableTop = 520;
  page.drawRectangle({ x: 44, y: tableTop, width: 507, height: 28, color: dark });
  page.drawText("LEISTUNG", { x: 54, y: tableTop + 10, size: 8, font: bold, color: rgb(1, 1, 1) });
  page.drawText("MENGE", { x: 342, y: tableTop + 10, size: 8, font: bold, color: rgb(1, 1, 1) });
  page.drawText("EINZEL NETTO", { x: 409, y: tableTop + 10, size: 8, font: bold, color: rgb(1, 1, 1) });
  page.drawText("NETTO", { x: 508, y: tableTop + 10, size: 8, font: bold, color: rgb(1, 1, 1) });

  let y = tableTop - 28;
  data.items.forEach((item, index) => {
    if (index % 2 === 0) page.drawRectangle({ x: 44, y: y - 10, width: 507, height: 34, color: light });
    page.drawText(item.description.slice(0, 54), { x: 54, y, size: 9, font: regular, color: dark });
    page.drawText(`${item.quantity.toLocaleString("de-AT")} ${item.unit}`, { x: 342, y, size: 9, font: regular, color: dark });
    page.drawText(euro(item.unitPriceNet), { x: 423, y, size: 9, font: regular, color: dark });
    page.drawText(euro(item.quantity * item.unitPriceNet), { x: 504, y, size: 9, font: bold, color: dark });
    page.drawText(`${item.vatRate.toLocaleString("de-AT")} % USt`, { x: 54, y: y - 12, size: 7.5, font: regular, color: gray });
    y -= 38;
  });

  const totalNet = data.items.reduce((sum, item) => sum + item.quantity * item.unitPriceNet, 0);
  const totalVat = data.items.reduce((sum, item) => sum + item.quantity * item.unitPriceNet * (item.vatRate / 100), 0);
  const totalGross = totalNet + totalVat;
  const totalsY = Math.min(y - 18, 390);
  [
    ["Summe netto", totalNet, regular],
    ["Umsatzsteuer 20 %", totalVat, regular],
    ["Gesamtbetrag", totalGross, bold],
  ].forEach(([label, value, font], index) => {
    const rowY = totalsY - index * 25;
    page.drawText(String(label), { x: 365, y: rowY, size: index === 2 ? 11 : 9, font: font as typeof regular, color: dark });
    page.drawText(euro(value as number), { x: 493, y: rowY, size: index === 2 ? 12 : 9, font: font as typeof regular, color: index === 2 ? green : dark });
  });

  page.drawRectangle({ x: 44, y: 120, width: 507, height: 92, color: rgb(0.93, 0.98, 0.95) });
  page.drawText("ZAHLUNGSINFORMATION", { x: 58, y: 190, size: 8, font: bold, color: green });
  page.drawText("POTLOG Immobilien KG", { x: 58, y: 171, size: 9.5, font: bold, color: dark });
  page.drawText("IBAN: AT31 2032 6000 0010 4455", { x: 58, y: 154, size: 9, font: regular, color: dark });
  page.drawText("BIC: SPNKAT21XXX", { x: 58, y: 138, size: 9, font: regular, color: dark });
  page.drawText(`Bitte ${data.number} als Verwendungszweck angeben.`, { x: 312, y: 154, size: 8.5, font: regular, color: gray });

  page.drawText("Vielen Dank für die Zusammenarbeit.", { x: 44, y: 83, size: 9, font: bold, color: dark });
  page.drawText("POTLOG Immobilien KG | Aufeldstraße 21 | 4050 Traun | ATU82243314 | FN 655240p", { x: 44, y: 50, size: 7.5, font: regular, color: gray });

  document.setTitle(`Rechnung ${data.number}`);
  document.setAuthor("POTLOG Immobilien KG");
  document.setSubject("AUFELD21 Rechnung");
  return document.save();
}
