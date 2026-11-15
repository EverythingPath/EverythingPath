// @vitest-environment node
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { isWaveCl4Row } from './launch-reassessment';
import { WAVE_CL4_KEYS, waveCl4Closure } from './wave-cl4-binding-context';

const BATCHES = [529, 531, 540, 518] as const;

it('assembles the wave CL4 binding context for exactly the rows the inventories record as wave CL4', () => {
  expect(WAVE_CL4_KEYS).toHaveLength(41);
  // The 41 keys and the five admitted Spells their closures reach
  // (Restoration, Lesser; Inflict Light Wounds, Mass; Beast Shape I-III).
  expect(waveCl4Closure).toHaveLength(46);
  expect(
    waveCl4Closure
      .map((entry) => entry.externalKey)
      .filter((key) => !WAVE_CL4_KEYS.includes(key)),
  ).toEqual([
    'pf1/774kmgcb7ygviht0',
    'pf1/dhjhfv5hzthy0fgu',
    'pf1/fxz69pwpqt9b6uss',
    'pf1/tjdfluulncmqacc3',
    'pf1/w88ddxpu89qcr5c0',
  ]);
  const recorded = BATCHES.flatMap((batch) =>
    (
      JSON.parse(
        readFileSync(`scripts/catalog/legal/spells-${batch}.json`, 'utf8'),
      ) as { candidates: { externalKey: string }[] }
    ).candidates
      .filter((row) => isWaveCl4Row(row))
      .map((row) => row.externalKey),
  );
  expect(recorded).toEqual(WAVE_CL4_KEYS);
});
