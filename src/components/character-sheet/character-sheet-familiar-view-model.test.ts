import { expect, test } from 'vitest';
import { resolveFamiliar } from '~/lib/character-sheet-familiar';
import type {
  CompanionLinkedInput,
  CompanionLinkedInputResolution,
} from '~/lib/character-sheet-linked-inputs';
import { buildCharacterSheetFamiliarView } from './character-sheet-familiar-view-model';

function linked(
  input: CompanionLinkedInput,
  value: number,
): CompanionLinkedInputResolution {
  return {
    input,
    value,
    status: 'available',
    resolution: 'calculated',
    candidates: [],
    contributions: [],
    fallback: null,
    interpretation: null,
    fallbackState: 'none',
    prerequisiteStatus: 'resolved',
  };
}

test('familiar summary distinguishes actual HD, effective HD and current versus permanent maximum HP', () => {
  const common = [
    linked({ kind: 'characterLevel' }, 7),
    linked({ kind: 'familiarProgressionLevels' }, 5),
  ];
  const view = buildCharacterSheetFamiliarView({
    baseCreatureKey: 'cat',
    current: resolveFamiliar({
      baseCreatureKey: 'cat',
      linkedInputs: [...common, linked({ kind: 'maximumHp' }, 49)],
    }),
    permanent: resolveFamiliar({
      baseCreatureKey: 'cat',
      linkedInputs: [...common, linked({ kind: 'maximumHp' }, 41)],
    }),
  });
  expect(view.baseCreatureLabel).toBe('Cat');
  expect(view.statistics).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        key: 'actualHitDice',
        label: 'Actual Hit Dice',
        valueLabel: '1',
      }),
      expect.objectContaining({
        key: 'effectiveHitDice',
        label: 'Effective Hit Dice',
        valueLabel: '7',
      }),
      expect.objectContaining({
        key: 'progressionLevel',
        label: 'Familiar progression level',
        valueLabel: '5',
      }),
      expect.objectContaining({
        key: 'maximumHp',
        valueLabel: '24',
        permanentValueLabel: '20',
        hasTemporaryChange: true,
      }),
    ]),
  );
  expect(view.specialAbilities).toContain('Speak with master');
  expect(view.choices.map((choice) => choice.label)).toEqual([
    'Cat',
    'Raven',
    'Toad',
  ]);
});

test('missing master inputs remain visibly unresolved while valid zero and the familiar’s independent creature choice survive', () => {
  const facts = resolveFamiliar({
    baseCreatureKey: 'toad',
    linkedInputs: [linked({ kind: 'baseAttackBonus' }, 0)],
  });
  const view = buildCharacterSheetFamiliarView({
    baseCreatureKey: 'toad',
    current: facts,
    permanent: facts,
  });
  expect(view.baseCreatureLabel).toBe('Toad');
  expect(view.statistics).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ key: 'actualHitDice', valueLabel: '1' }),
      expect.objectContaining({ key: 'baseAttackBonus', valueLabel: '0' }),
      expect.objectContaining({
        key: 'maximumHp',
        valueLabel: 'Unresolved',
        permanentValueLabel: 'Unresolved',
        hasTemporaryChange: false,
      }),
      expect.objectContaining({
        key: 'effectiveHitDice',
        valueLabel: 'Unresolved',
      }),
    ]),
  );
  expect(view.unresolvedMessage).toBe(
    'Some familiar statistics need values from the associated Character.',
  );
  expect(view.specialAbilities).toEqual([]);
});

test('unavailable creature state is explicit independently of its display label', () => {
  const view = buildCharacterSheetFamiliarView({
    baseCreatureKey: 'owl',
    current: null,
    permanent: null,
  });
  expect(view.isBaseCreatureUnavailable).toBe(true);
  expect(
    buildCharacterSheetFamiliarView({
      baseCreatureKey: null,
      current: null,
      permanent: null,
    }).isBaseCreatureUnavailable,
  ).toBe(false);
});
