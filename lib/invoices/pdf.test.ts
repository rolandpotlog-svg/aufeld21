import { test } from "node:test";
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { PDFDocument } from "pdf-lib";
import { createInvoicePdfV2 } from "./pdf-v2.ts";

test("long invoices retain every position and paginate", async () => {
  const bytes = await createInvoicePdfV2({
    number: "TEST-NICHT-ZAHLEN", issueDate: "25.09.2026", dueDate: "10.10.2026",
    servicePeriod: "01.10.2026 bis 31.10.2026",
    recipientName: "Testfirma mit einem längeren Unternehmensnamen",
    recipientAddress: "Musterstraße 1\n4050 Traun, Österreich",
    recipientUid: "ATU00000000",
    items: Array.from({ length: 22 }, (_, index) => ({
      description: `Testposition ${index + 1}: Zusatznutzung des Meetingraums mit einer ausführlichen Leistungsbeschreibung ohne abgeschnittene Wörter.`,
      quantity: 0.5, unit: "Std.", unitPriceNet: 12, vatRate: 20,
    })),
  });
  const pdf = await PDFDocument.load(bytes);
  assert.ok(pdf.getPageCount() >= 3);
  assert.equal(pdf.getTitle(), "Rechnung TEST-NICHT-ZAHLEN");
  if (process.env.PDF_TEST_OUTPUT) await writeFile(process.env.PDF_TEST_OUTPUT, bytes);
});
