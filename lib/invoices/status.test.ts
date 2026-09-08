import test from 'node:test';
import assert from 'node:assert/strict';
import { invoiceStatus } from './status.ts';

const invoice = { status: 'final', issue_date: '2026-08-25', due_date: '2026-09-10', billing_month: '2026-09-01' };
test('invoice display: open is red before its due date, paid is green with or without payment date', () => {
  const open = invoiceStatus(invoice, '2026-09-08');
  assert.equal(open.label, 'Offen');
  assert.equal(open.icon, 'alert');
  assert.match(open.badge, /bg-red-100/);
  assert.match(open.surface, /border-l-red-600/);
  const paid = invoiceStatus({ ...invoice, status: 'paid' }, '2026-09-08');
  assert.equal(paid.label, 'Bezahlt');
  assert.equal(paid.icon, 'check');
  assert.match(paid.badge, /bg-emerald-100/);
  assert.match(paid.surface, /border-l-emerald-600/);
});
test('invoice display: overdue starts after the deadline; future/draft/cancelled are never shown as unpaid', () => {
  assert.equal(invoiceStatus(invoice, '2026-09-10').label, 'Offen');
  assert.equal(invoiceStatus(invoice, '2026-09-11').label, 'Offen · überfällig');
  const future = { ...invoice, issue_date: '2026-09-25' };
  assert.equal(invoiceStatus(future, '2026-09-08').label, 'Vorausrechnung');
  for (const status of ['draft', 'cancelled', 'unknown']) {
    const display = invoiceStatus({ ...invoice, status }, '2026-09-11');
    assert.doesNotMatch(display.badge, /red|emerald/);
  }
  assert.equal(invoiceStatus({ ...future, status: 'paid' }, '2026-09-08').label, 'Bezahlt');
  const before = JSON.stringify(invoice);
  invoiceStatus(Object.freeze(invoice), '2026-09-11');
  assert.equal(JSON.stringify(invoice), before);
});
