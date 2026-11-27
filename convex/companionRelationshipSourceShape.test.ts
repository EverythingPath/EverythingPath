import { validate } from 'convex-helpers/validators';
import { expect, test } from 'vitest';
import { companionRelationshipSourceValidator } from './companionRelationships';

const source = { key: 'bond', label: 'Ranger', enabled: true };
const replaced = { reason: 'replacedBy', archetypes: ['Guide'] };

// The relationship read cannot give a source that both counts and is
// replaced or otherwise not entitled (companion-entitlement-replaced).
test('an available relationship source gives no reason it does not count', () => {
  expect(
    [
      { ...source, available: true },
      { ...source, available: false },
      { ...source, available: false, notEntitled: replaced },
      {
        ...source,
        available: false,
        notEntitled: { reason: 'archetypeDoesNotApply' },
      },
      { ...source, available: true, notEntitled: replaced },
      {
        ...source,
        available: true,
        notEntitled: { reason: 'archetypeDoesNotApply' },
      },
    ].map((shape) => validate(companionRelationshipSourceValidator, shape)),
  ).toEqual([true, true, true, true, false, false]);
});
