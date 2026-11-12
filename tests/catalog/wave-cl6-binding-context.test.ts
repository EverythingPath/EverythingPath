// @vitest-environment node
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { isWaveCl6Row } from './launch-reassessment';
import { WAVE_CL6_KEYS, waveCl6Closure } from './wave-cl6-binding-context';

const BATCHES = [517, 519, 520, 521, 529, 533, 541] as const;
// The roots whose batch previews strip a cross-batch link: the wave stores
// the first two; the other two are read from committed fixtures.
const FULL_CORPUS_ONLY = [
  'pf1/1dkzhi78je32sbrr', // Pain Strike, Mass
  'pf1/26vm5jhjkxpq1xm3', // Summon Monster II
];
const COMMITTED_ELSEWHERE = [
  'pf1/4mvqcqfaqv54drf3', // Shared Wrath (spell-bindings-738/full-context.json)
  'pf1/5h7qpvgnqof7oku7', // Forcecage (spells-520/binding-preview.json)
];

it('assembles the wave CL6 binding context for exactly the rows the inventories record as wave CL6', () => {
  expect(WAVE_CL6_KEYS).toHaveLength(53);
  // The 53 keys and the admitted Spell their closures reach (Summon Monster I).
  expect(waveCl6Closure).toHaveLength(54);
  expect(
    waveCl6Closure
      .map((entry) => entry.externalKey)
      .filter((key) => !WAVE_CL6_KEYS.includes(key)),
  ).toEqual(['pf1/kyo0kwhw2jhuztju']);
  const recorded = BATCHES.flatMap((batch) =>
    (
      JSON.parse(
        readFileSync(`scripts/catalog/legal/spells-${batch}.json`, 'utf8'),
      ) as { candidates: { externalKey: string }[] }
    ).candidates
      .filter((row) => isWaveCl6Row(row))
      .map((row) => row.externalKey),
  );
  expect(recorded).toEqual(WAVE_CL6_KEYS);
});

const fixtureEntries = (path: string) =>
  (
    JSON.parse(readFileSync(`tests/fixtures/${path}`, 'utf8')) as {
      entries: { externalKey: string; description: string }[];
    }
  ).entries;

it('stores only the two entries no committed fixture holds, and reads the other linked roots complete', () => {
  const stored = fixtureEntries('wave-cl6/binding-preview.json');
  expect(stored.map((entry) => entry.externalKey)).toEqual(FULL_CORPUS_ONLY);
  // Each assembled linked root is its complete entry, with the resolved
  // cross-batch link, never a batch preview's stripped copy.
  for (const key of [...FULL_CORPUS_ONLY, ...COMMITTED_ELSEWHERE]) {
    const entry = waveCl6Closure.find((item) => item.externalKey === key);
    expect(entry?.description, key).toMatch(/href="catalog:pf1\//);
  }
  expect(
    fixtureEntries('spell-bindings-738/full-context.json').find(
      (entry) => entry.externalKey === COMMITTED_ELSEWHERE[0],
    ),
  ).toEqual(
    waveCl6Closure.find(
      (entry) => entry.externalKey === COMMITTED_ELSEWHERE[0],
    ),
  );
  expect(
    fixtureEntries('spells-520/binding-preview.json').find(
      (entry) => entry.externalKey === COMMITTED_ELSEWHERE[1],
    ),
  ).toEqual(
    waveCl6Closure.find(
      (entry) => entry.externalKey === COMMITTED_ELSEWHERE[1],
    ),
  );
});
