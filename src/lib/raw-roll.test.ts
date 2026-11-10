import { expect, test } from 'vitest';
import { rawRollSchema } from './weekly-draft-facts';
import { normalizeRawRoll } from './raw-roll';

const metadata = {
  provenance: { kind: 'generated', sourceId: 'session-roll' },
  modifiers: [{ sourceId: 'custom:weather', value: -2, reason: 'Heavy rain' }],
};

test('a dice total round-trips without rewriting provenance or modifiers', () => {
  const total = { ...metadata, sides: 4, diceCount: 2, diceTotal: 6 };
  expect(rawRollSchema.parse(total)).toEqual(total);
});

test('a complete 2d4 total normalizes to its dice-only result', () => {
  expect(
    normalizeRawRoll(
      rawRollSchema.parse({
        ...metadata,
        sides: 4,
        diceCount: 2,
        diceTotal: 6,
      }),
      { count: 2, sides: 4 },
    ),
  ).toEqual({
    count: 2,
    sides: 4,
    status: 'complete',
    diceTotal: 6,
    naturalValue: null,
    rangeWarning: null,
  });
});

test.each([
  { diceTotal: 6, diceCount: 1, sides: 4 },
  { diceTotal: 6, diceCount: 2, sides: 6 },
])(
  'a recorded roll with the wrong 2d4 specification remains incomplete: %j',
  (recorded) => {
    expect(
      normalizeRawRoll(rawRollSchema.parse({ ...metadata, ...recorded }), {
        count: 2,
        sides: 4,
      }),
    ).toEqual({
      count: 2,
      sides: 4,
      status: 'incomplete',
      diceTotal: null,
      naturalValue: null,
      rangeWarning: null,
    });
  },
);

test.each([undefined, null])('an absent roll remains missing (%s)', (raw) => {
  expect(normalizeRawRoll(raw, { count: 1, sides: 20 })).toEqual({
    count: 1,
    sides: 20,
    status: 'missing',
    diceTotal: null,
    naturalValue: null,
    rangeWarning: null,
  });
});

test.each([1, 20])(
  'single-die natural %s excludes custom modifiers',
  (value) => {
    const raw = rawRollSchema.parse({
      ...metadata,
      sides: 20,
      diceTotal: value,
      diceCount: 1,
    });
    expect(normalizeRawRoll(raw, { count: 1, sides: 20 })).toMatchObject({
      status: 'complete',
      diceTotal: value,
      naturalValue: value,
      rangeWarning: null,
    });
    expect(raw.modifiers).toEqual(metadata.modifiers);
  },
);

test('a multidie total of twenty is never a natural twenty', () => {
  expect(
    normalizeRawRoll(
      rawRollSchema.parse({
        ...metadata,
        sides: 20,
        diceCount: 2,
        diceTotal: 20,
      }),
      { count: 2, sides: 20 },
    ),
  ).toMatchObject({
    status: 'complete',
    diceTotal: 20,
    naturalValue: null,
  });
});

test.each([
  { total: 0, warning: 'total' },
  { total: 1, warning: 'total' },
  { total: 9, warning: 'total' },
  { total: 2, warning: null },
  { total: 8, warning: null },
])(
  '2d4 range diagnostics remain advisory and retain the recorded total: %j',
  ({ total, warning }) => {
    expect(
      normalizeRawRoll(
        rawRollSchema.parse({
          ...metadata,
          sides: 4,
          diceTotal: total,
          diceCount: 2,
        }),
        { count: 2, sides: 4 },
      ),
    ).toMatchObject({
      status: 'complete',
      diceTotal: total,
      naturalValue: null,
      rangeWarning: warning,
    });
  },
);

test.each([
  { dice: [1] },
  { dice: [1], diceTotal: 1, diceCount: 1 },
  { diceTotal: 1 },
  { diceCount: 1 },
  { diceTotal: 1, diceCount: 1, extra: true },
])('a roll is strictly a dice total and count: %j', (fields) => {
  expect(
    rawRollSchema.safeParse({ ...metadata, sides: 20, ...fields }).success,
  ).toBe(false);
});

test.each(['diceTotal', 'diceCount'] as const)(
  '%s accepts only safe finite whole numbers with its required sign',
  (field) => {
    const total = { ...metadata, sides: 4, diceTotal: 6, diceCount: 2 };
    for (const invalid of [
      -1,
      0.5,
      Infinity,
      -Infinity,
      NaN,
      Number.MAX_SAFE_INTEGER + 1,
      '6',
      null,
    ]) {
      expect(
        rawRollSchema.safeParse({ ...total, [field]: invalid }).success,
      ).toBe(false);
    }
    expect(
      rawRollSchema.safeParse({ ...total, [field]: Number.MAX_SAFE_INTEGER })
        .success,
    ).toBe(true);
    expect(rawRollSchema.safeParse({ ...total, [field]: 0 }).success).toBe(
      field === 'diceTotal',
    );
  },
);

test.each([
  { sides: 1 },
  { sides: 4.5 },
  { provenance: { kind: 'generated' } },
  { provenance: { kind: 'table', sourceId: 'unexpected' } },
  { modifiers: [{ sourceId: 'custom', value: 1.5, reason: 'Weather' }] },
  { modifiers: [{ sourceId: 'custom', value: 1, reason: '' }] },
  {
    modifiers: [
      { sourceId: 'custom', value: 1, reason: 'Weather', extra: true },
    ],
  },
])('a roll keeps its structural constraints: %j', (invalid) => {
  expect(
    rawRollSchema.safeParse({
      ...metadata,
      sides: 4,
      diceTotal: 2,
      diceCount: 1,
      ...invalid,
    }).success,
  ).toBe(false);
});

test('normalization never rewrites provenance, modifiers or the recorded total', () => {
  const raw = rawRollSchema.parse({
    ...metadata,
    sides: 4,
    diceTotal: 6,
    diceCount: 2,
  });
  const before = structuredClone(raw);
  Object.freeze(raw.provenance);
  raw.modifiers.forEach(Object.freeze);
  Object.freeze(raw.modifiers);
  Object.freeze(raw);
  normalizeRawRoll(raw, { count: 2, sides: 4 });
  expect(raw).toEqual(before);
});
