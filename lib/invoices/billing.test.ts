import { test } from "node:test";
import assert from "node:assert/strict";
import { billingPeriod, isBillingMonth, scheduledBillingMonths, proratedRent, invoiceIsOpen, invoiceIsOverdue, isOriginalDocument } from "./billing.ts";

test("calendar months include the 31st, February and leap years", () => {
  assert.equal(billingPeriod("2026-08-01").end, "2026-08-31");
  assert.equal(billingPeriod("2026-09-01").days, 30);
  assert.equal(billingPeriod("2027-02-01").days, 28);
  assert.equal(billingPeriod("2028-02-01").days, 29);
  assert.equal(billingPeriod("2027-01-01").issueDate, "2026-12-25");
  assert.equal(billingPeriod("2027-01-01").dueDate, "2027-01-10");
});
test("reject malformed/nonexistent billing months", () => {
  for (const value of ["2026-13-01", "2026-00-01", "2026-02-30", "2026-8-01", "invalid"]) assert.equal(isBillingMonth(value), false);
});
test("proration includes first and last contractual days", () => {
  assert.equal(proratedRent("2026-08-01", 310, "2026-08-31").net, 10);
  assert.equal(proratedRent("2026-08-01", 310, "2026-08-16").net, 160);
  assert.equal(proratedRent("2026-08-01", 310, "2026-08-01", "2026-08-15").net, 150);
  assert.equal(proratedRent("2026-08-01", 310, "2026-09-01").net, 0);
});
test("schedule uses Vienna midnight, catches current month and starts next on 25th", () => {
  assert.deepEqual(scheduledBillingMonths(new Date("2026-08-24T21:59:59Z")), ["2026-08-01"]);
  assert.deepEqual(scheduledBillingMonths(new Date("2026-08-24T22:00:00Z")), ["2026-08-01", "2026-09-01"]);
  assert.deepEqual(scheduledBillingMonths(new Date("2026-09-01T12:00:00Z")), ["2026-09-01"]);
});
test("future, paid and cancelled invoices do not inflate current receivables", () => {
  const base = { status: "final", issue_date: "2026-08-25", due_date: "2026-09-10", billing_month: "2026-09-01" };
  assert.equal(invoiceIsOpen(base, "2026-09-06"), true);
  assert.equal(invoiceIsOpen({ ...base, issue_date: "2026-09-29" }, "2026-09-06"), false);
  for (const status of ["paid", "cancelled", "draft"]) assert.equal(invoiceIsOpen({ ...base, status }, "2026-09-06"), false);
  assert.equal(invoiceIsOverdue(base, "2026-09-10"), false);
  assert.equal(invoiceIsOverdue(base, "2026-09-11"), true);
});
test("generated and explicitly named drafts are not tenant originals", () => {
  assert.equal(isOriginalDocument({ title: "Vertrag", storage_path: "x/vertraege/nutzungsvereinbarung-entwurf-2026.pdf" }), false);
  assert.equal(isOriginalDocument({ title: "Nutzungsvereinbarung - Entwurf", storage_path: "x/legacy.pdf" }), false);
  assert.equal(isOriginalDocument({ title: "Unterzeichneter Vertrag", storage_path: "x/originale/vertrag.pdf" }), true);
});
