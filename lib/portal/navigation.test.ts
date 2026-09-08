import assert from 'node:assert/strict';
import test from 'node:test';
import { initialPortalView, portalNavigation, visiblePortalView } from './navigation.ts';

test('members, partners and admins have a dedicated invoice tab directly after the start page', () => {
  for (const role of ['member', 'partner', 'admin']) {
    const items = portalNavigation(role);
    assert.deepEqual(items.slice(0, 2).map(item => item.view), ['dashboard', 'invoices']);
    assert.equal(items.filter(item => item.view === 'invoices').length, 1);
    assert.equal(visiblePortalView('invoices', role), 'invoices');
    assert.equal(items.some(item => item.view === 'admin'), role === 'admin');
  }
});

test('employees have no invoice tab and invoice links fall back to their start page', () => {
  assert.equal(portalNavigation('employee').some(item => item.view === 'invoices'), false);
  assert.equal(visiblePortalView('invoices', 'employee'), 'dashboard');
  assert.equal(visiblePortalView('admin', 'member'), 'dashboard');
  assert.equal(visiblePortalView('calendar', 'employee'), 'calendar');
});

test('invoice deep links and the former invoice anchor open the new tab; issue links stay intact', () => {
  assert.equal(initialPortalView('?view=invoices'), 'invoices');
  assert.equal(initialPortalView('', '#member-invoices'), 'invoices');
  assert.equal(initialPortalView('?view=issues'), 'admin');
  assert.equal(initialPortalView('?view=issues', '#member-invoices'), 'admin');
  assert.equal(initialPortalView('?view=unknown'), 'dashboard');
  assert.equal(initialPortalView(''), 'dashboard');
});
