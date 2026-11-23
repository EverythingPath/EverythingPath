// @vitest-environment node
import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import { WAVE_CL1_KEYS, waveCl1Closure } from './wave-cl1-binding-context';

/** JSON with every object's keys sorted, so key order in a fixture cannot move the hash. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object')
    return `{${Object.keys(value)
      .sort()
      .map(
        (key) =>
          `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`,
      )
      .join(',')}}`;
  return JSON.stringify(value);
}

it('assembles exactly the reviewed wave CL1 binding context from committed previews', () => {
  expect(WAVE_CL1_KEYS).toHaveLength(60);
  expect(waveCl1Closure).toHaveLength(63);
  // The reviewed snapshot ({ roots, closure }, fix round 1 of #527/#542),
  // hashed as canonical JSON before it was replaced by these references.
  expect(
    createHash('sha256')
      .update(canonical({ roots: WAVE_CL1_KEYS, closure: waveCl1Closure }))
      .digest('hex'),
  ).toBe('500469a066bcd9b94b85932a6e798a994d5ab6edc1e13e64f1b78048e3ccf49a');
});
