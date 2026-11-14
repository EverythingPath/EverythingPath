import type { RawRoll } from './weekly-draft-facts';

export type RollSpec = Readonly<{ count: number; sides: number }>;
export type NormalizedRoll = RollSpec &
  (
    | {
        status: 'missing' | 'incomplete';
        diceTotal: null;
        naturalValue: null;
        rangeWarning: null;
      }
    | {
        status: 'complete';
        diceTotal: number;
        naturalValue: number | null;
        rangeWarning: 'total' | null;
      }
  );

export function normalizeRawRoll(
  raw: RawRoll | null | undefined,
  expected: RollSpec,
): NormalizedRoll {
  if (!raw)
    return {
      ...expected,
      status: 'missing',
      diceTotal: null,
      naturalValue: null,
      rangeWarning: null,
    };
  if (raw.sides !== expected.sides || raw.diceCount !== expected.count)
    return {
      ...expected,
      status: 'incomplete',
      diceTotal: null,
      naturalValue: null,
      rangeWarning: null,
    };
  const { diceTotal } = raw;
  return {
    ...expected,
    status: 'complete',
    diceTotal,
    naturalValue: expected.count === 1 ? diceTotal : null,
    rangeWarning:
      diceTotal < expected.count || diceTotal > expected.count * expected.sides
        ? 'total'
        : null,
  };
}
