import { expect, test } from 'vitest';
import type { ResolvedStatistic, SourcedModifier } from '~/lib/character-sheet';
import {
  diffSituation,
  listSituationGroups,
  hasSituationalContributions,
  describeContributionScope,
} from './stat-breakdown-groups';

const modifier = (
  condition?: SourcedModifier['condition'],
): SourcedModifier => ({
  target: 'save.will',
  bonusType: 'morale',
  value: 2,
  sheetEntryId: 'rage',
  entryName: 'Rage',
  source: 'rage',
  builtIn: false,
  condition,
});
const statistic = (
  applied: SourcedModifier[],
  conditional: SourcedModifier[] = [],
): ResolvedStatistic => ({
  total: 2,
  applied,
  suppressed: [],
  conditional,
});

test('a newly applied Situation line is retained when its number matches an ordinary line from the same entry', () => {
  const ordinary = statistic(
    [modifier()],
    [modifier({ situation: 'fear', whileActive: 'rage' })],
  );
  const group = listSituationGroups(ordinary)[0];
  if (!group) throw new Error('Missing fear Situation');
  const result = diffSituation({
    group,
    ordinary,
    inSituation: statistic([
      modifier({ situation: 'fear', whileActive: 'rage' }),
    ]),
  });
  expect(result.applied).toHaveLength(1);
  expect(result.total).toBe(2);
});

test('notes-only Situations are discoverable and built-in Combat conditions do not flag a number', () => {
  const notesOnly: ResolvedStatistic = {
    ...statistic([]),
    notes: [
      {
        sheetEntryId: 'feat',
        entryName: 'Fearless',
        source: 'fearless',
        builtIn: false,
        situation: 'fear',
        text: 'Reroll a failed save.',
      },
    ],
  };
  expect(
    listSituationGroups(notesOnly).map((group) => group.selection),
  ).toEqual(['fear']);
  expect(hasSituationalContributions(notesOnly)).toBe(true);
  const combat = statistic([], [modifier({ situation: 'charging' })]);
  expect(hasSituationalContributions(combat)).toBe(false);
  expect(listSituationGroups(combat).map((group) => group.selection)).toEqual([
    'charging',
  ]);
  expect(
    hasSituationalContributions(
      statistic([], [{ ...modifier({ situation: 'fear' }), builtIn: true }]),
    ),
  ).toBe(true);
});

test('scope explanations describe chosen weapons and name routine entries without exposing references', () => {
  expect(
    describeContributionScope(
      {
        ...modifier({
          weapon: '$choice',
          weaponSelection: 'private-weapon-id',
        }),
        entryName: 'Weapon Focus',
      },
      () => null,
    ),
  ).toBe('only with the chosen weapon');
  expect(
    describeContributionScope(
      { ...modifier({ option: true }), entryName: 'Power Attack' },
      () => null,
    ),
  ).toBe('only in routines using Power Attack');
});

test('a Situation explains a changed suppressor even when the suppression reason stays the same', () => {
  const ordinary = {
    ...statistic([], [modifier({ situation: 'fear' })]),
    suppressed: [
      {
        ...modifier(),
        reason: 'A higher bonus of this type applies.',
        suppressedBy: 'old-winner',
      },
    ],
  };
  const group = listSituationGroups(ordinary)[0];
  if (!group) throw new Error('Missing fear Situation');
  const change = diffSituation({
    group,
    ordinary,
    inSituation: {
      ...ordinary,
      conditional: [],
      suppressed: [
        {
          ...modifier(),
          reason: 'A higher bonus of this type applies.',
          suppressedBy: 'new-winner',
        },
      ],
    },
  });
  expect(change.suppressed.map((item) => item.suppressedBy)).toEqual([
    'new-winner',
  ]);
});
