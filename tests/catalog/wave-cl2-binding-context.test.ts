// @vitest-environment node
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { isWaveCl2Row } from './launch-reassessment';
import { WAVE_CL2_KEYS, waveCl2Closure } from './wave-cl2-binding-context';

const BATCHES = [525, 537, 518, 519, 534, 529, 541, 523] as const;

it('assembles the wave CL2 binding context for exactly the rows the inventories record as wave CL2', () => {
  expect(WAVE_CL2_KEYS).toHaveLength(48);
  // The 48 keys and the two admitted Spells their closures reach (Summon
  // Monster I and Interposing Hand).
  expect(waveCl2Closure).toHaveLength(50);
  expect(
    waveCl2Closure
      .map((entry) => entry.externalKey)
      .filter((key) => !WAVE_CL2_KEYS.includes(key)),
  ).toEqual(['pf1/kyo0kwhw2jhuztju', 'pf1/wu4y1ilg6iq28cr6']);
  const recorded = BATCHES.flatMap((batch) =>
    (
      JSON.parse(
        readFileSync(`scripts/catalog/legal/spells-${batch}.json`, 'utf8'),
      ) as { candidates: { externalKey: string }[] }
    ).candidates
      .filter((row) => isWaveCl2Row(row))
      .map((row) => row.externalKey),
  );
  expect(recorded).toEqual(WAVE_CL2_KEYS);
});
