import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';
import { fileURLToPath } from 'node:url';
import * as Y from 'yjs';
import { slateNodesToInsertDelta, yTextToSlateElement } from '@slate-yjs/core';

// SPIKE (Team First strategy, action 3): does doc-content-v1 survive a round trip
// through a Y.Doc, and do concurrent edits converge?
//
// The architecture commits to "doc-content-v1 canonical at rest ↔ CRDT in flight".
// This test is the executable evidence behind that decision — it is kept (rather than
// thrown away with the spike) because C2.6 (autosave) and C6.1 (realtime sync) both
// depend on the guarantees asserted here.
//
// Findings are written up in
// artifacts/bmad/planning-artifacts/spike-ydoc-doc-content-bridge-2026-08-18.md

const EDITOR = new URL('../../editor/src/', import.meta.url);
const FIXTURES = fileURLToPath(new URL('../../editor/tests/fixtures/doc-content/', import.meta.url));

const { registerBuiltinPluginsOnce } = await import(`${EDITOR.href}plugins/builtin/index.ts`);
registerBuiltinPluginsOnce();
const { docContentToPlate } = await import(`${EDITOR.href}converters/doc-content-to-plate.ts`);
const { plateToDocContent } = await import(`${EDITOR.href}converters/plate-to-doc-content.ts`);

/** Plate value → a fresh Y.Doc's shared XmlText, the shape @platejs/yjs binds to. */
function toYText(plateValue: unknown): { doc: Y.Doc; text: Y.XmlText } {
  const doc = new Y.Doc();
  const text = doc.get('content', Y.XmlText);
  text.applyDelta(slateNodesToInsertDelta(plateValue as never), { sanitize: false });
  return { doc, text };
}

function loadFixture(file: string): unknown {
  const raw = JSON.parse(readFileSync(`${FIXTURES}${file}`, 'utf8'));
  return raw.content ?? raw;
}

const FIXTURE_FILES = readdirSync(FIXTURES).filter((f) => f.endsWith('.json')).sort();

test('every doc-content-v1 fixture survives doc-content → Plate → Y.Doc → Plate → doc-content', () => {
  assert.ok(FIXTURE_FILES.length >= 19, `expected the full fixture set, found ${FIXTURE_FILES.length}`);

  const lossy: string[] = [];
  for (const file of FIXTURE_FILES) {
    const original = loadFixture(file);
    const { text } = toYText(docContentToPlate(original));
    const roundTripped = plateToDocContent(yTextToSlateElement(text).children);
    // Deep equality, NOT JSON.stringify: the bridge does not preserve key order.
    if (!isDeepStrictEqual(roundTripped, original)) lossy.push(file);
  }

  assert.deepEqual(lossy, [], `these fixtures lost data crossing the Y.Doc bridge:\n  ${lossy.join('\n  ')}`);
});

test('the Y.Doc leg adds no loss beyond the plain Plate round trip', () => {
  // If a fixture ever regresses, this separates "the converters broke" from
  // "the CRDT bridge broke" — they have different owners and different fixes.
  for (const file of FIXTURE_FILES) {
    const original = loadFixture(file);
    const plate = docContentToPlate(original);
    const withoutYDoc = plateToDocContent(plate);
    const { text } = toYText(plate);
    const withYDoc = plateToDocContent(yTextToSlateElement(text).children);
    assert.ok(
      isDeepStrictEqual(withYDoc, withoutYDoc),
      `${file}: Y.Doc changed the result relative to the plain Plate round trip`,
    );
  }
});

test('key order is NOT preserved — autosave must not dirty-check by string compare', () => {
  // Documented deliberately: C2.6 autosave comparing JSON.stringify(before/after)
  // would mark every synced document dirty forever. Compare structurally instead.
  const original = loadFixture('code-group-two-items.json');
  const { text } = toYText(docContentToPlate(original));
  const roundTripped = plateToDocContent(yTextToSlateElement(text).children);

  assert.ok(isDeepStrictEqual(roundTripped, original), 'structurally equal');
  assert.notEqual(
    JSON.stringify(roundTripped),
    JSON.stringify(original),
    'if this ever becomes equal, key order became stable and the warning above can be relaxed',
  );
});

test('concurrent human + agent edits converge, and the server sees the same document', () => {
  const seed = {
    version: 1,
    blocks: [
      { type: 'paragraph', children: [{ type: 'text', text: 'A' }] },
      { type: 'paragraph', children: [{ type: 'text', text: 'B' }] },
    ],
  };
  const paragraph = (t: string) => ({ version: 1, blocks: [{ type: 'paragraph', children: [{ type: 'text', text: t }] }] });

  const { doc: server, text: serverText } = toYText(docContentToPlate(seed));
  const baseline = Y.encodeStateAsUpdate(server);

  const human = new Y.Doc();
  const agent = new Y.Doc();
  Y.applyUpdate(human, baseline);
  Y.applyUpdate(agent, baseline);
  const humanText = human.get('content', Y.XmlText);
  const agentText = agent.get('content', Y.XmlText);

  // Simultaneous, non-coordinated edits at opposite ends of the document.
  humanText.applyDelta(
    [{ retain: 0 }, ...slateNodesToInsertDelta(docContentToPlate(paragraph('HUMAN')) as never)],
    { sanitize: false },
  );
  agentText.applyDelta(
    [{ retain: agentText.length }, ...slateNodesToInsertDelta(docContentToPlate(paragraph('AGENT')) as never)],
    { sanitize: false },
  );

  Y.applyUpdate(human, Y.encodeStateAsUpdate(agent));
  Y.applyUpdate(agent, Y.encodeStateAsUpdate(human));

  const fromHuman = plateToDocContent(yTextToSlateElement(humanText).children) as { blocks: unknown[] };
  const fromAgent = plateToDocContent(yTextToSlateElement(agentText).children) as { blocks: unknown[] };

  assert.ok(isDeepStrictEqual(fromHuman, fromAgent), 'peers must converge to the same document');
  assert.equal(fromHuman.blocks.length, 4, 'both edits survive the merge — neither clobbers the other');

  // Hocuspocus onStoreDocument: the server persists from its own Y.Doc, so it must
  // agree with the clients rather than needing its own merge pass.
  Y.applyUpdate(server, Y.encodeStateAsUpdate(human));
  const persisted = plateToDocContent(yTextToSlateElement(serverText).children);
  assert.ok(isDeepStrictEqual(persisted, fromHuman), 'server-side persistence matches the clients');
});
