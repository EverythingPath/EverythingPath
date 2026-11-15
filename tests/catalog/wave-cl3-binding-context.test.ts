// @vitest-environment node
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { isWaveCl3Row } from './launch-reassessment';
import { WAVE_CL3_KEYS, waveCl3Closure } from './wave-cl3-binding-context';

const BATCHES = [543, 523, 527, 529, 528] as const;

it('assembles the wave CL3 binding context for exactly the rows the inventories record as wave CL3', () => {
  expect(WAVE_CL3_KEYS).toHaveLength(42);
  // The 42 keys and the two admitted Spells their closures reach (Disguise
  // Self and Cacophonous Call).
  expect(waveCl3Closure).toHaveLength(44);
  expect(
    waveCl3Closure
      .map((entry) => entry.externalKey)
      .filter((key) => !WAVE_CL3_KEYS.includes(key)),
  ).toEqual(['pf1/oj36nfak6jc2s5ky', 'pf1/p222zrbf0ynwblzd']);
  const recorded = BATCHES.flatMap((batch) =>
    (
      JSON.parse(
        readFileSync(`scripts/catalog/legal/spells-${batch}.json`, 'utf8'),
      ) as { candidates: { externalKey: string }[] }
    ).candidates
      .filter((row) => isWaveCl3Row(row))
      .map((row) => row.externalKey),
  );
  expect(recorded).toEqual(WAVE_CL3_KEYS);
});
