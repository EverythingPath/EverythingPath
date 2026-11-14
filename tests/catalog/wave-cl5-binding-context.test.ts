// @vitest-environment node
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { isWaveCl5Row } from './launch-reassessment';
import { WAVE_CL5_KEYS, waveCl5Closure } from './wave-cl5-binding-context';

const BATCHES = [526, 535, 546, 529, 541] as const;

it('assembles the wave CL5 binding context for exactly the rows the inventories record as wave CL5', () => {
  expect(WAVE_CL5_KEYS).toHaveLength(40);
  // The 40 keys and the two admitted Spells their closures reach
  // (Invisibility and Summon Monster I).
  expect(waveCl5Closure).toHaveLength(42);
  expect(
    waveCl5Closure
      .map((entry) => entry.externalKey)
      .filter((key) => !WAVE_CL5_KEYS.includes(key)),
  ).toEqual(['pf1/kyo0kwhw2jhuztju', 'pf1/oylikodnyku2zewu']);
  const recorded = BATCHES.flatMap((batch) =>
    (
      JSON.parse(
        readFileSync(`scripts/catalog/legal/spells-${batch}.json`, 'utf8'),
      ) as { candidates: { externalKey: string }[] }
    ).candidates
      .filter((row) => isWaveCl5Row(row))
      .map((row) => row.externalKey),
  );
  expect(recorded).toEqual(WAVE_CL5_KEYS);
});
