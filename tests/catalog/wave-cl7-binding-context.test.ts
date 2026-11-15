// @vitest-environment node
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { isWaveCl7Row } from './launch-reassessment';
import { WAVE_CL7_KEYS, waveCl7Closure } from './wave-cl7-binding-context';

const BATCHES = [519, 521, 522, 528, 538, 541] as const;
// Shadow Conjuration, Greater links shadow conjuration (#528); spells-519's
// preview strips that link, so its complete entry is read from the committed
// spell-bindings-738 full context.
const GREATER = 'pf1/44nj6jzo81o9mng9';

const fixtureEntries = (path: string) =>
  (
    JSON.parse(readFileSync(`tests/fixtures/${path}`, 'utf8')) as {
      entries: { externalKey: string; description: string }[];
    }
  ).entries;

it('assembles the wave CL7 binding context for exactly the rows the inventories record as wave CL7', () => {
  expect(WAVE_CL7_KEYS).toHaveLength(47);
  // The 47 keys and the admitted Spells their closures reach (Summon
  // Nature's Ally I and Cure Light Wounds, Mass).
  expect(waveCl7Closure).toHaveLength(49);
  expect(
    waveCl7Closure
      .map((entry) => entry.externalKey)
      .filter((key) => !WAVE_CL7_KEYS.includes(key)),
  ).toEqual(['pf1/0jwi6xovzukorxok', 'pf1/ejk08uk2e3h5eg3a']);
  const recorded = BATCHES.flatMap((batch) =>
    (
      JSON.parse(
        readFileSync(`scripts/catalog/legal/spells-${batch}.json`, 'utf8'),
      ) as { candidates: { externalKey: string }[] }
    ).candidates
      .filter((row) => isWaveCl7Row(row))
      .map((row) => row.externalKey),
  );
  expect(recorded).toEqual(WAVE_CL7_KEYS);
});

it("reads Shadow Conjuration, Greater complete, ahead of its batch preview's stripped copy", () => {
  const entry = waveCl7Closure.find((item) => item.externalKey === GREATER);
  expect(entry?.description).toMatch(/href="catalog:pf1\/ed7fvzc2p4m6n7a2"/);
  expect(entry).toEqual(
    fixtureEntries('spell-bindings-738/full-context.json').find(
      (item) => item.externalKey === GREATER,
    ),
  );
  const stripped = fixtureEntries('spells-519/preview.json').find(
    (item) => item.externalKey === GREATER,
  );
  expect(stripped).toBeDefined();
  expect(stripped).not.toEqual(entry);
});
