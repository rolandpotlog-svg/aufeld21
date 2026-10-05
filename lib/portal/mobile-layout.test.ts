import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

const portal = readFileSync(new URL('../../app/portal/page.tsx', import.meta.url), 'utf8');
const directory = readFileSync(new URL('../../app/portal/member-directory.tsx', import.meta.url), 'utf8');

function elements(source: string) {
  const file = ts.createSourceFile('portal.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const result: Array<Record<string, string>> = [];
  function visit(node: ts.Node) {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const attributes: Record<string, string> = { tag: node.tagName.getText(file) };
      for (const attribute of node.attributes.properties) {
        if (!ts.isJsxAttribute(attribute) || !attribute.initializer) continue;
        attributes[attribute.name.getText(file)] = ts.isStringLiteral(attribute.initializer)
          ? attribute.initializer.text : attribute.initializer.getText(file);
      }
      result.push(attributes);
    }
    ts.forEachChild(node, visit);
  }
  visit(file);
  return result;
}

test('every portal dialog fits the dynamic viewport and scrolls internally', () => {
  const dialogs = elements(portal).filter(element => element.role === 'dialog');
  assert.equal(dialogs.length, 10);
  for (const dialog of dialogs) {
    for (const required of ['max-h-[90dvh]', 'overflow-y-auto', 'overscroll-contain', 'min-w-0']) {
      assert.ok(dialog.className.split(' ').includes(required), `${dialog['aria-labelledby']}: ${required}`);
    }
  }
});

test('document grid cannot grow to its contents minimum width on small screens', () => {
  const grid = elements(portal).find(element => element.id === 'admin-files');
  assert.ok(grid);
  assert.match(grid.className, /\bmin-w-0\b/);
  assert.match(grid.className, /\bgrid-cols-1\b/);
  assert.match(grid.className, /xl:grid-cols-2/);
});

test('calendar slots and narrow-screen day selection preserve usable touch targets', () => {
  const slotHeight = Number(portal.match(/const MOBILE_SLOT_HEIGHT = (\d+);/)?.[1]);
  assert.ok(slotHeight >= 44);
  const days = elements(portal).find(element => element['aria-label'] === 'Tag auswählen');
  assert.ok(days);
  assert.match(days.className, /\bgrid-cols-4\b/);
  assert.match(days.className, /min-\[400px\]:grid-cols-7/);
  const nameButton = elements(directory).find(element => element.tag === 'button' && element.className?.includes('block') && element.onClick?.includes('props.onOpen(member)'));
  assert.ok(nameButton?.className.includes('min-h-11'));
  assert.ok(nameButton?.className.includes('min-w-11'));
});

test('mobile portal form fields use at least 16px text without disabling zoom', () => {
  const main = elements(portal).find(element => element.tag === 'main' && element.className.includes('text-stone-900'));
  assert.ok(main);
  for (const field of ['input', 'select', 'textarea']) {
    assert.ok(main.className.includes(`max-xl:[&_${field}]:text-base`));
  }
});
