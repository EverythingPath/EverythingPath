import { expect, test } from 'vitest';
import { isBuckler } from './character-sheet-armor-categories';

// The decision takes the catalog detail's own union: it accepts every detail
// kind, and only an item's carries armor, so armor on a Feat or a Spell Effect
// does not type-check.
test('the decision accepts every detail kind and rejects armor on a non-item', () => {
  const shield = {
    slot: 'shield',
    category: 'buckler',
    armorCheckPenalty: 1,
  } as const;
  expect(
    isBuckler({
      ruleIdentity: 'one-off',
      detail: {
        kind: 'item',
        armor: { slot: 'shield', category: 'buckler', armorCheckPenalty: 1 },
      },
    }),
  ).toBe(true);
  expect(isBuckler({ ruleIdentity: 'one-off', detail: { kind: 'feat' } })).toBe(
    false,
  );
  isBuckler({
    ruleIdentity: 'one-off',
    // @ts-expect-error: a Feat carries no armor.
    detail: { kind: 'feat', armor: shield },
  });
  isBuckler({
    ruleIdentity: 'one-off',
    // @ts-expect-error: a Spell Effect carries no armor.
    detail: { kind: 'spellEffect', armor: shield },
  });
});
