import test from 'node:test';
import assert from 'node:assert/strict';
import { contactInput, smallJson } from './input.ts';
const sample = { id: '00000000-0000-4000-8000-000000000090', name: 'Test Person', email: 'PERSON@example.test ', phone: '', offer: 'Büro', message: 'Ich suche einen Arbeitsplatz.' };
test('contact validation rejects bad fields and oversized streamed bodies', async () => {
  assert.equal(contactInput(sample).email, 'person@example.test');
  for (const patch of [{ email: 'a@b\nBcc:x@y.at' }, { message: 'kurz' }, { name: 'x'.repeat(121) }, { offer: 'arbitrary' }, { id: '../' }]) assert.throws(() => contactInput({ ...sample, ...patch }));
  const req = (body: string) => new Request('https://example.test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
  assert.deepEqual(await smallJson(req(JSON.stringify(sample))), sample);
  await assert.rejects(smallJson(req('x'.repeat(17000))), /groß/);
  await assert.rejects(smallJson(req('not json')));
});
