import { expect, test } from 'vitest';
import type { Id } from '@convex/_generated/dataModel';
import {
  buildCombinedFormView,
  type CombinedFormRead,
} from './character-combined-form-view-model';

const eidolonId = 'eidolon-id' as Id<'character'>;
const sources = [
  {
    title: 'Pathfinder RPG Ultimate Magic pp. 80–81, Synthesist',
    url: 'https://legacy.aonprd.com/ultimateMagic/spellcastingClassOptions/summoner.html#synthesist-(archetype)',
  },
];
const ability = (
  name: CombinedFormRead['abilities'][number]['ability'],
  score: number | null,
  from: 'summoner' | 'eidolon',
  excluded: { label: string; value: number }[] = [],
) => ({
  ability: name,
  score,
  modifier: score === null ? null : Math.floor((score - 10) / 2),
  from,
  excluded,
});
const statistic = (total: number | null) => ({ total, contributions: [] });

const calculated: CombinedFormRead = {
  status: 'calculated',
  summonerLevel: 1,
  unresolved: [],
  advisories: [],
  size: 'medium',
  eidolon: { characterId: eidolonId, name: 'Brightwing' },
  abilities: [
    ability('strength', 16, 'eidolon'),
    ability('dexterity', 12, 'eidolon'),
    ability('constitution', 13, 'eidolon'),
    ability('intelligence', 10, 'summoner'),
    ability('wisdom', 12, 'summoner'),
    ability('charisma', 16, 'summoner', [
      { label: 'Ability Increase evolution', value: 2 },
    ]),
  ],
  baseAttackBonus: {
    total: 20,
    contributions: [
      { label: 'Fighter 19', value: 19, from: 'summoner' },
      { label: 'Eidolon BAB', value: 1, from: 'eidolon' },
    ],
    replaced: [{ label: 'Summoner 1', value: 0 }],
  },
  hitPoints: { total: 180, temporary: 11 },
  armorClass: {
    total: 14,
    touch: 11,
    flatFooted: 13,
    contributions: [
      { label: 'Eidolon natural armor', value: 2, from: 'eidolon' },
    ],
  },
  saves: {
    fortitude: statistic(12),
    reflex: statistic(7),
    will: statistic(9),
  },
  combatManeuverBonus: 23,
  combatManeuverDefense: 34,
  initiative: 1,
  skills: [
    { skill: 'skill.per', name: 'Perception', total: 10, skilled: 8 },
    { skill: 'skill.ste', name: 'Stealth', total: 1, skilled: null },
  ],
  evolutions: {
    hitDice: 1,
    characterHitDice: 20,
    maxAttacks: 3,
    attackCount: 2,
    list: [
      { key: 'claws', name: 'Claws', choice: null },
      { key: 'skilled', name: 'Skilled', choice: 'skill.per' },
    ],
  },
  inputs: [
    {
      label: 'Summoner level',
      value: 1,
      resolution: 'fallback',
      fallbackState: 'applied',
    },
  ],
  features: [],
  sources,
};

test('the Combined Form view names each fused value’s build and stays read-only', () => {
  const view = buildCombinedFormView(calculated);
  expect(view).toMatchObject({
    title: 'Combined Form',
    isCalculated: true,
    readOnlyNotice:
      'A static view of the synthesist fused with the eidolon. Viewing it does not fuse them, track combat or change either sheet.',
    eidolon: {
      name: 'Brightwing',
      href: '/characters/eidolon-id',
    },
    unresolved: [],
  });
  expect(view.abilities).toEqual([
    {
      key: 'strength',
      label: 'Strength',
      score: '16',
      modifier: '+3',
      source: 'Eidolon',
      excluded: [],
    },
    expect.objectContaining({ key: 'dexterity', source: 'Eidolon' }),
    expect.objectContaining({ key: 'constitution', source: 'Eidolon' }),
    expect.objectContaining({ key: 'intelligence', source: 'Summoner' }),
    expect.objectContaining({ key: 'wisdom', source: 'Summoner' }),
    {
      key: 'charisma',
      label: 'Charisma',
      score: '16',
      modifier: '+3',
      source: 'Summoner',
      excluded: ['Ability Increase evolution +2 (the eidolon’s, not applied)'],
    },
  ]);
  expect(view.statistics.find(({ key }) => key === 'bab')).toEqual({
    key: 'bab',
    label: 'Base attack bonus',
    value: '+20',
    contributions: [
      { label: 'Fighter 19', value: '+19', source: 'Summoner' },
      { label: 'Eidolon BAB', value: '+1', source: 'Eidolon' },
    ],
    note: 'Replaces Summoner 1 (+0).',
    isAtAGlance: true,
    messages: [],
  });
  expect(view.statistics.find(({ key }) => key === 'temporaryHp')).toEqual({
    key: 'temporaryHp',
    label: 'Temporary hit points',
    value: '11',
    contributions: [
      { label: 'Eidolon hit points', value: '11', source: 'Eidolon' },
    ],
    note: null,
    isAtAGlance: true,
    messages: [],
  });
  expect(
    view.statistics
      .filter((statistic) => statistic.isAtAGlance)
      .map(({ key }) => key),
  ).toEqual(['bab', 'ac', 'hp', 'temporaryHp']);
  expect(view.skills).toEqual([
    { key: 'skill.per', label: 'Perception', value: '+10', note: 'Skilled +8' },
    { key: 'skill.ste', label: 'Stealth', value: '+1', note: null },
  ]);
  expect(view.evolutions).toEqual({
    hitDiceNote:
      'Evolution effects use the eidolon’s 1 Hit Die, not the summoner’s 20.',
    attacks: '2 of 3',
    attacksNote: 'Attacks while fused are not calculated.',
    list: ['Claws', 'Skilled (Perception)'],
  });
  expect(view.inputs).toEqual([
    { label: 'Summoner level', value: '1', note: 'Saved fallback in use' },
  ]);
});

test('an unresolved Combined Form shows its reasons and never invents fused values', () => {
  const view = buildCombinedFormView({
    ...calculated,
    status: 'unresolved',
    eidolon: null,
    unresolved: [
      {
        reason: 'eidolonUnavailable',
        message:
          'The eidolon is unavailable, so its fused statistics cannot be calculated.',
      },
    ],
    abilities: [
      ability('strength', null, 'eidolon'),
      ability('intelligence', 10, 'summoner'),
    ],
    baseAttackBonus: { total: null, contributions: [], replaced: [] },
    hitPoints: { total: null, temporary: null },
    skills: [],
    inputs: [],
  });
  expect(view).toMatchObject({
    isCalculated: false,
    eidolon: null,
    unresolved: [
      'The eidolon is unavailable, so its fused statistics cannot be calculated.',
    ],
  });
  expect(view.abilities[0]).toMatchObject({
    score: 'Unresolved',
    modifier: null,
  });
  expect(view.statistics.find(({ key }) => key === 'bab')).toMatchObject({
    value: 'Unresolved',
    note: null,
  });
  // The whole form's reasons lead; none sits beside the temporary HP.
  expect(
    view.statistics.find(({ key }) => key === 'temporaryHp'),
  ).toMatchObject({ value: 'Unresolved', messages: [] });
});

test('unrecorded eidolon hit points are explained beside the temporary hit points alone', () => {
  const message =
    'The eidolon’s hit points are not recorded, so its temporary hit points are unresolved.';
  const view = buildCombinedFormView({
    ...calculated,
    unresolved: [{ reason: 'eidolonHitPoints', message }],
    hitPoints: { total: 180, temporary: null },
  });
  expect(view.unresolved).toEqual([]);
  expect(
    view.statistics.flatMap(({ key, messages }) =>
      messages.length ? [{ key, messages }] : [],
    ),
  ).toEqual([{ key: 'temporaryHp', messages: [message] }]);
});

test('a smaller eidolon is advised and unresolved natural attacks read Unresolved', () => {
  const advisory =
    'Fused Eidolon requires the eidolon to be at least the synthesist’s size; this eidolon is small and the synthesist medium.';
  const view = buildCombinedFormView({
    ...calculated,
    advisories: [{ kind: 'eidolonSmallerThanSynthesist', message: advisory }],
    evolutions: { ...calculated.evolutions, maxAttacks: null, attackCount: 0 },
  });
  expect(view.advisories).toEqual([advisory]);
  expect(view.evolutions).toMatchObject({
    attacks: 'Unresolved',
    attacksNote: 'Attacks while fused are not calculated.',
  });
});
