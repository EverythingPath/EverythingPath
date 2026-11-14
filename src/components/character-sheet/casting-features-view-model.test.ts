import { expect, test } from 'vitest';
import { buildCastingAdvanceChoices } from './casting-advances-view-model';
import { buildCastingSheet } from './casting-features-test-fixture';
import { buildSpellcastingFeaturesView } from './spellcasting-features-view-model';
import { findCalculatedWarning } from './character-sheet-test-fixture';

const repeat = (identity: string, count: number) =>
  Array.from({ length: count }, () => identity);
const fire = {
  id: 'fire',
  catalogEntryId: 'domain-fire',
  classIdentity: 'cleric',
  feature: 'cleric-domains',
  list: 'Domains',
};
const evocation = (oppositionSchools?: string[]) => ({
  id: 'evocation',
  catalogEntryId: 'school-evocation',
  classIdentity: 'wizard',
  feature: 'wizard-arcane-school',
  list: 'Arcane schools',
  ...(oppositionSchools ? { oppositionSchools } : {}),
});

test('a pre-filled advance offers only classes taken before the Prestige Class', () => {
  const snapshot = buildCastingSheet({
    levels: [
      ...repeat('wizard', 3),
      ...repeat('cleric', 3),
      'mystic-theurge',
      'sorcerer',
    ],
  });
  expect(buildCastingAdvanceChoices(snapshot, 'mystic-theurge-1')).toEqual([
    {
      entryId: 'mystic-theurge-1',
      index: 0,
      kind: 'arcane',
      label: 'Arcane advance',
      prestigeName: 'Mystic Theurge',
      value: 'wizard',
      prefilled: true,
      missing: false,
      options: [{ classEntryId: 'wizard', name: 'Wizard', eligible: true }],
      warnings: [],
    },
    {
      entryId: 'mystic-theurge-1',
      index: 1,
      kind: 'divine',
      label: 'Divine advance',
      prestigeName: 'Mystic Theurge',
      value: 'cleric',
      prefilled: true,
      missing: false,
      options: [{ classEntryId: 'cleric', name: 'Cleric', eligible: true }],
      warnings: [],
    },
  ]);
  expect(buildCastingAdvanceChoices(snapshot, 'wizard-1')).toEqual([]);
});

test('an empty ambiguous advance is marked missing and a recorded later class stays visible with its warning', () => {
  const ambiguous = buildCastingSheet({
    levels: [
      ...repeat('wizard', 3),
      ...repeat('sorcerer', 3),
      ...repeat('cleric', 3),
      'mystic-theurge',
    ],
  });
  expect(
    buildCastingAdvanceChoices(ambiguous, 'mystic-theurge-1')[0],
  ).toMatchObject({
    value: null,
    missing: true,
    options: [
      { classEntryId: 'wizard', eligible: true },
      { classEntryId: 'sorcerer', eligible: true },
    ],
    warnings: [
      {
        kind: 'incomplete',
        check: 'castingAdvanceMissing',
        accepted: false,
      },
    ],
  });
  const levels = [
    ...repeat('wizard', 3),
    ...repeat('cleric', 3),
    'mystic-theurge',
    'sorcerer',
    ['mystic-theurge', [{ classEntryId: 'sorcerer' }]] as [
      string,
      { classEntryId: string }[],
    ],
  ];
  const later = buildCastingSheet({ levels });
  const warning = findCalculatedWarning(later, 'castingAdvanceTarget');
  const accepted = buildCastingSheet({ levels, accepted: [warning] });
  expect(
    buildCastingAdvanceChoices(accepted, 'mystic-theurge-2')[0],
  ).toMatchObject({
    value: 'sorcerer',
    prefilled: false,
    missing: false,
    options: [
      { classEntryId: 'wizard', eligible: true },
      { classEntryId: 'sorcerer', name: 'Sorcerer', eligible: false },
    ],
    warnings: [{ check: 'castingAdvanceTarget', accepted: true }],
  });
});

test('the Spells page view sums advances and lists slot-style Granted Spells by level', () => {
  const snapshot = buildCastingSheet({
    levels: [
      ...repeat('wizard', 3),
      ...repeat('cleric', 3),
      ...repeat('mystic-theurge', 2),
    ],
    selections: [fire],
  });
  const view = buildSpellcastingFeaturesView(snapshot, 'cleric');
  expect(view).toMatchObject({
    castingSum: 'Cleric 3 +2 from Mystic Theurge',
    pendingAdvances: 0,
    extraSlots: [{ kind: 'domain', label: '+1 domain' }],
    school: null,
  });
  expect(
    view?.grantedSpellsByLevel.map(({ spellLevel, spells }) => [
      spellLevel,
      spells.map((spell) => [
        spell.name,
        spell.sourceNames,
        spell.domainSlotOnly,
      ]),
    ]),
  ).toEqual([
    [1, [['Burning Hands', 'Fire Domain', true]]],
    [2, [['Produce Flame', 'Fire Domain', true]]],
    [3, [['Fireball', 'Fire Domain', true]]],
  ]);
  expect(view).not.toHaveProperty('choices');
  expect(buildSpellcastingFeaturesView(snapshot, 'fighter')).toBeNull();
});

test('a specialist school offers the other seven schools and outlines missing opposition schools', () => {
  const missing = buildSpellcastingFeaturesView(
    buildCastingSheet({ levels: ['wizard'], selections: [evocation()] }),
    'wizard',
  );
  expect(missing?.school).toMatchObject({
    entryId: 'evocation',
    target: { entryId: 'evocation' },
    name: 'Evocation',
    school: { value: 'evo', label: 'Evocation' },
    oppositionSchools: [],
    required: 2,
    missing: true,
    warnings: [
      {
        kind: 'incomplete',
        message: 'Choose two opposition schools for Evocation.',
      },
    ],
  });
  expect(missing?.school?.options.map((option) => option.value)).toEqual([
    'abj',
    'con',
    'div',
    'enc',
    'ill',
    'nec',
    'trs',
  ]);
  const chosen = buildSpellcastingFeaturesView(
    buildCastingSheet({
      levels: ['wizard'],
      selections: [evocation(['enc', 'nec'])],
    }),
    'wizard',
  );
  expect(chosen?.school).toMatchObject({
    oppositionSchools: [{ label: 'Enchantment' }, { label: 'Necromancy' }],
    missing: false,
    warnings: [],
  });
  expect(
    chosen?.school?.options
      .filter((option) => option.selected)
      .map((option) => option.value),
  ).toEqual(['enc', 'nec']);
  expect(chosen?.extraSlots).toEqual([
    { kind: 'school', label: '+1 school (evocation)' },
  ]);
});

test('bloodline Spells wait for the sorcerer level while advances raise the casting sum', () => {
  const view = buildSpellcastingFeaturesView(
    buildCastingSheet({
      levels: [
        ...repeat('sorcerer', 3),
        ...repeat('cleric', 3),
        ...repeat('mystic-theurge', 2),
      ],
      selections: [
        {
          id: 'draconic',
          catalogEntryId: 'bloodline-draconic',
          classIdentity: 'sorcerer',
          feature: 'sorcerer-bloodline',
          list: 'Bloodlines',
        },
      ],
    }),
    'sorcerer',
  );
  expect(view?.castingSum).toBe('Sorcerer 3 +2 from Mystic Theurge');
  expect(
    view?.grantedSpellsByLevel.flatMap(({ spells }) =>
      spells.map((spell) => [spell.name, spell.style]),
    ),
  ).toEqual([['Mage Armor', 'schedule']]);
});
