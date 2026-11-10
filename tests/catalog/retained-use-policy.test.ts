import { expect, it } from 'vitest';
import { assessRetainedUse } from '../../src/lib/catalog/retained-use-policy';

const existingUse = {
  characterId: 'existing-character',
  definition: {
    name: 'Edited copy',
    choices: ['saved choice'],
    description: 'Last usable definition',
  },
  requiredNotices: ['MISSING-NOTICE'],
};

it('keeps the last usable definition and player edits for an existing held use', () => {
  const result = assessRetainedUse({
    status: 'held',
    kind: 'existing-use',
    existingUse,
    targetCharacterId: 'existing-character',
  });
  expect(result).toEqual({
    kind: 'retained',
    definition: existingUse.definition,
    requiredNotices: ['MISSING-NOTICE'],
  });
  if (result.kind === 'retained')
    expect(result.definition).toBe(existingUse.definition);
});

it.each(['held', 'withdrawn'] as const)(
  'blocks new uses and held revisions while %s',
  (status) => {
    for (const kind of ['selection', 'copy', 'grant', 'revision'] as const) {
      expect(
        assessRetainedUse({
          status,
          kind,
        }).kind,
      ).toBe('blocked');
    }
  },
);

it.each([
  ['existing-character', true, true],
  ['existing-character', false, false],
  ['another-character', true, false],
] as const)(
  'permits departure preservation for %s only when necessary (%s)',
  (targetCharacterId, necessaryForDeparture, allowed) => {
    const result = assessRetainedUse({
      status: 'held',
      kind: 'departure-preservation',
      existingUse,
      targetCharacterId,
      necessaryForDeparture,
    });
    expect(result.kind).toBe(allowed ? 'retained' : 'blocked');
    if (result.kind === 'retained') {
      expect(result.definition).toBe(existingUse.definition);
      expect(result.requiredNotices).toEqual(['MISSING-NOTICE']);
    }
  },
);

it('refuses preservation without an existing use or for another character', () => {
  expect(
    assessRetainedUse({
      status: 'withdrawn',
      kind: 'departure-preservation',
      existingUse: null,
      targetCharacterId: 'new-character',
      necessaryForDeparture: true,
    }).kind,
  ).toBe('blocked');
  expect(
    assessRetainedUse({
      status: 'held',
      kind: 'existing-use',
      existingUse,
      targetCharacterId: 'another-character',
    }).kind,
  ).toBe('blocked');
});
