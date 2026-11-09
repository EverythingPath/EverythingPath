import {
  calculateFixtureSheet as calculateCharacterSheet,
  buildSheet,
} from './character-sheet-test-fixture';
import { expect, test } from 'vitest';

import {
  buildCharacterSheetRacesView,
  buildRaceStatisticsView,
} from './character-sheet-races-view-model';
import type { CharacterSheetSnapshot } from './use-character-sheet';

function fixture() {
  const snapshot = buildSheet({
    hasClasses: true,
    levels: [{ id: 'race-row', hp: null }],
    adjustments: [
      { id: 'heritage-row', name: 'Heritage', modifiers: [] },
      { id: 'standard-row', name: 'Standard', modifiers: [] },
    ],
  });
  const [base, original, copy, alternate, override, heritage, standard] =
    snapshot.catalogEntries;
  const raceRow = snapshot.entries.find((entry) => entry.kind === 'classLevel');
  const heritageRow = snapshot.entries.find((entry) => entry.kind === 'manual');
  if (
    !base ||
    !original ||
    !copy ||
    !alternate ||
    !override ||
    !heritage ||
    !standard ||
    !raceRow ||
    !heritageRow
  )
    throw new Error('Missing fixture');
  const catalogEntries: CharacterSheetSnapshot['catalogEntries'] = [
    base,
    {
      ...original,
      name: 'Elf',
      ruleIdentity: 'elf',
      detail: { kind: 'race', racialTraits: [standard._id] },
    },
    {
      ...copy,
      name: 'Elf copy',
      ruleIdentity: 'elf',
      detail: { kind: 'race', racialTraits: [] },
    },
    {
      ...alternate,
      name: 'Subrace ability',
      detail: {
        kind: 'racialTrait',
        raceEntryIds: [original._id],
        replaces: [],
        subrace: 'Illustrative subrace',
      },
    },
    {
      ...override,
      name: 'Subrace vision',
      detail: {
        kind: 'racialTrait',
        raceEntryIds: [original._id],
        replaces: [],
        subrace: 'Illustrative subrace',
      },
    },
    {
      ...standard,
      name: 'Elf standard',
      detail: {
        kind: 'racialTrait',
        raceEntryIds: [original._id],
        replaces: [],
      },
    },
    {
      ...heritage,
      name: 'Heritage',
      countsAsRaces: { oneOf: ['human', 'orc'] },
      detail: { kind: 'feat' },
    },
  ];
  const entries: CharacterSheetSnapshot['entries'] = [
    ...snapshot.entries.filter((entry) => entry.kind === 'base'),
    {
      ...raceRow,
      kind: 'race',
      catalogEntryId: copy._id,
      state: { kind: 'race' },
    },
    {
      ...heritageRow,
      kind: 'feat',
      catalogEntryId: heritage._id,
      state: { kind: 'feat', choice: 'human' },
    },
  ];
  return {
    ...snapshot,
    entries,
    catalogEntries,
    calculated: calculateCharacterSheet({
      entries,
      catalogEntries,
      characterKind: 'pc',
    }),
    ids: {
      alternate: alternate._id,
      override: override._id,
      heritage: heritage._id,
      copy: copy._id,
      standard: standard._id,
    },
  };
}

test('a selected zero-HD race still exposes editable progression and distinct level, actual HD and feat budget facts', () => {
  const snapshot = fixture();
  expect(buildRaceStatisticsView(snapshot)).toMatchObject({
    racialHitDice: 0,
    progression: null,
    racialHpGained: null,
    characterLevel: 0,
    actualHitDice: 0,
    featBudget: 0,
    creatureTypeOptions: expect.arrayContaining([
      { value: 'dragon', label: 'Dragon' },
      { value: 'monstrousHumanoid', label: 'Monstrous Humanoid' },
    ]),
  });
  expect(buildRaceStatisticsView(snapshot)?.creatureTypeOptions).toHaveLength(
    13,
  );
});

test('a Catalog Copy offers the original race’s independent subrace options without marking unselected options dormant', () => {
  const snapshot = fixture();
  const view = buildCharacterSheetRacesView(snapshot);
  expect(view.selectedRaceId).toBe(snapshot.ids.copy);
  expect(view.traitOptions).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        catalogEntryId: snapshot.ids.alternate,
        subrace: 'Illustrative subrace',
        applicable: true,
        selected: false,
        dormant: false,
      }),
      expect.objectContaining({
        catalogEntryId: snapshot.ids.override,
        subrace: 'Illustrative subrace',
        applicable: true,
        selected: false,
        dormant: false,
      }),
    ]),
  );
});

test('race equivalence choices on a feat are available through its Selection target', () => {
  const snapshot = fixture();
  const view = buildCharacterSheetRacesView(snapshot);
  expect(view.choiceRows).toContainEqual(
    expect.objectContaining({
      rowId: 'heritage-row',
      name: 'Heritage',
      target: { entryId: 'heritage-row' },
      counting: true,
      abilityScoreChoice: false,
      raceChoices: ['human', 'orc'],
      choice: 'human',
    }),
  );
});

test.each([true, false])(
  'statistics copies stay out of the race picker while selected or retained (%s)',
  (isSelected) => {
    const snapshot = fixture();
    const original = snapshot.catalogEntries.find(
      (entry) =>
        entry.detail.kind === 'race' && entry._id !== snapshot.ids.copy,
    );
    if (!original) throw new Error('Missing original race');
    snapshot.catalogEntries = snapshot.catalogEntries.map((entry) =>
      entry._id === snapshot.ids.copy
        ? { ...entry, racialStatisticsCopy: true }
        : entry,
    );
    snapshot.entries = snapshot.entries.map((entry) =>
      entry.kind === 'race'
        ? {
            ...entry,
            catalogEntryId: isSelected ? snapshot.ids.copy : original._id,
            ...(isSelected ? { catalogOverride: true } : {}),
          }
        : entry,
    );
    const view = buildCharacterSheetRacesView(snapshot);
    expect(view.raceOptions.map((option) => option.catalogEntryId)).toEqual([
      original._id,
    ]);
    expect(view.selectedRaceId).toBe(original._id);
  },
);

test('a detached race remains selectable after its racial statistics are edited', () => {
  const snapshot = fixture();
  const original = snapshot.catalogEntries.find(
    (entry) => entry.detail.kind === 'race' && entry._id !== snapshot.ids.copy,
  );
  if (!original) throw new Error('Missing original race');
  snapshot.catalogEntries = snapshot.catalogEntries.map((entry) =>
    entry._id === snapshot.ids.copy
      ? { ...entry, copiedFrom: original._id }
      : entry,
  );
  snapshot.entries = snapshot.entries.map((entry) =>
    entry.kind === 'race' ? { ...entry, catalogOverride: true } : entry,
  );
  const view = buildCharacterSheetRacesView(snapshot);
  expect(view.raceOptions).toContainEqual(
    expect.objectContaining({ catalogEntryId: snapshot.ids.copy }),
  );
  expect(view.selectedRaceId).toBe(snapshot.ids.copy);
});

test('the alternate picker excludes all known standards even when a Catalog Copy changes its standard list', () => {
  const snapshot = fixture();
  const view = buildCharacterSheetRacesView(snapshot);
  expect(
    view.traitOptions.some(
      (option) => option.catalogEntryId === snapshot.ids.standard,
    ),
  ).toBe(false);
});

test('a racial Grant exposes separate current prerequisite warnings without inventing a recorded level', () => {
  const snapshot = fixture();
  const catalogEntries = snapshot.catalogEntries.map((definition) =>
    definition._id === snapshot.ids.standard
      ? {
          ...definition,
          prerequisites: [{ ability: 'strength' as const, min: 13 }],
        }
      : definition,
  );
  const entries = snapshot.entries.map((entry) =>
    entry.kind === 'race'
      ? {
          ...entry,
          catalogEntryId: catalogEntries.find(
            (definition) => definition.name === 'Elf',
          )!._id,
        }
      : entry,
  );
  const calculated = calculateCharacterSheet({
    entries,
    catalogEntries,
    characterKind: 'pc',
  });
  const view = buildCharacterSheetRacesView({
    ...snapshot,
    entries,
    catalogEntries,
    calculated,
  });
  const row = view.rows.find((row) => row.name === 'Elf standard')!;
  expect(row.selection).toMatchObject({
    currentStatus: 'unmet',
    recordedStatus: null,
    recordedLevelLabel: null,
    recordedChecks: [],
    recordedWarnings: [],
    canMoveEarlier: false,
    canMoveLater: false,
  });
  expect(row.selection?.currentWarnings).toHaveLength(1);
});
