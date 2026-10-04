import test from 'node:test';
import assert from 'node:assert/strict';
import { contactInput, contactOffers } from './input.ts';
import { contactHref, contactMessagePrefix, contactSelection, type ContactSelectionKey } from './selection.ts';

test('offer links select only existing contact categories and retain office sizes', () => {
  for (const key of ['flex', 'fix', 'office-17', 'office-25', 'post', 'business', 'visit'] as ContactSelectionKey[]) {
    const url = new URL(contactHref(key), 'https://www.aufeld21.at');
    assert.equal(url.pathname, '/');
    assert.equal(url.hash, '#contact');
    const selection = contactSelection(url.searchParams.get('angebot'));
    assert.equal(selection.key, key);
    assert.ok(contactOffers.includes(selection.offer));
  }
  assert.equal(contactSelection('fix').offer, 'Fix-Tisch');
  assert.equal(contactSelection('post').offer, 'Postservice');
  assert.equal(contactSelection('business').offer, 'Business-Standort');
  assert.equal(contactSelection('office-17').detail, 'Büro · 17 m²');
  assert.equal(contactSelection('office-25').detail, 'Büro · 24,78 m²');
});

test('unknown, prototype and markup query values never prefill the form', () => {
  for (const key of [null, '', 'unknown', '__proto__', 'constructor', '<script>alert(1)</script>']) {
    assert.deepEqual(contactSelection(key), { key: null, offer: 'Besichtigung / Sonstiges', detail: null });
  }
});

test('office context reaches the existing admin message without replacing the visitors draft', () => {
  const selection = contactSelection('office-17');
  const draft = 'Wir suchen ab November ein Büro.';
  const message = contactMessagePrefix(selection) + draft;
  const result = contactInput({ id: '00000000-0000-4000-8000-000000000090', name: 'Test Person', email: 'person@example.test', phone: '', offer: selection.offer, message });
  assert.equal(result.offer, 'Büro');
  assert.equal(result.message, 'Anfrage: Büro · 17 m²\n\nWir suchen ab November ein Büro.');
  assert.equal(contactMessagePrefix({ ...selection, offer: 'Flex-Tisch' }), '');
  assert.equal(contactMessagePrefix({ ...selection, detail: null }), '');
  assert.equal(contactMessagePrefix({ ...selection, detail: 'untrusted text' }), '');
  assert.equal(contactMessagePrefix(contactSelection('fix')), '');
});
