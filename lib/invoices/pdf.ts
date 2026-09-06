import { createInvoicePdf as createV1 } from "./pdf-v1";
import { createInvoicePdfV2 } from "./pdf-v2";
import type { InvoicePdfData } from "./pdf-v1";
export function createInvoicePdf(data: InvoicePdfData, version = 2) {
  if (version === 1) return createV1(data);
  if (version === 2) return createInvoicePdfV2(data);
  throw new Error("unsupported_pdf_version");
}
export type { InvoicePdfData, InvoicePdfItem } from "./pdf-v1";
