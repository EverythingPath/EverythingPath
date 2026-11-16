import {
  calculateFixtureSheet as calculateCharacterSheet,
  buildSheet,
} from './character-sheet-test-fixture';
import type { Id } from '@convex/_generated/dataModel';
import { expect, test } from 'vitest';
import type { CharacterSheetInput } from '~/lib/character-sheet';
import type { ResolvedSheetEntry } from '~/lib/character-sheet-grants';
import { buildCharacterSheetGrantsView } from './character-sheet-grants-view-model';
import { buildCharacterSheetView } from './character-sheet-view-model';

const catalogs: CharacterSheetInput['catalogEntries'] = [
  {
    _id: 'armor',
    name: 'Armor Training 1',
    ruleIdentity: 'armor',
    modifiers: [],
  },
  {
    _id: 'master',
    name: 'Weapon Master',
    ruleIdentity: 'master',
    modifiers: [],
  },
];

function feature(recorded: boolean) {
  return {
    entry: {
      _id: 'armor-grant',
      kind: 'classFeature',
      active: true,
      catalogEntryId: 'armor',
      state: { kind: 'classFeature', choice: 'heavy armor' },
      grantKey: { source: 'fighter', classLevel: 3, entry: 'armor' },
      notes: 'A table choice',
    },
    origin: 'grant',
    recorded,
    dormant: true,
    counting: false,
    ...(recorded ? { storedEntryId: 'stored-armor' } : {}),
    reason: { kind: 'replaced', byEntryIds: ['weapon-master'] },
  } satisfies ResolvedSheetEntry;
}
const master: ResolvedSheetEntry = {
  entry: {
    _id: 'weapon-master',
    kind: 'archetype',
    active: true,
    catalogEntryId: 'master',
    state: { kind: 'archetype' },
  },
  origin: 'selection',
  recorded: true,
  storedEntryId: 'weapon-master',
  dormant: false,
  counting: true,
};

test.each([true, false])(
  'replaced Grants nest under their replacer with or without recorded state (%s)',
  (recorded) => {
    const sections = buildCharacterSheetGrantsView({
      entries: [feature(recorded), master],
      catalogEntries: catalogs,
    });
    expect(sections).toHaveLength(1);
    expect(sections[0]?.title).toBe('Archetypes');
    expect(sections[0]?.rows[0]?.replaced[0]).toMatchObject({
      rowId: 'armor-grant',
      name: 'Armor Training 1',
      status: 'dormant',
      reason: 'Replaced by Weapon Master',
      choice: 'heavy armor',
      notes: 'A table choice',
      canKeep: true,
      canDiscard: recorded,
      target: {
        grantKey: { source: 'fighter', classLevel: 3, entry: 'armor' },
      },
    });
  },
);

test('only recorded lost entries go in their section’s Not counting now group', () => {
  const recorded = {
    ...feature(true),
    reason: { kind: 'sourceMissing' as const },
  };
  const unrecorded = {
    ...feature(false),
    entry: { ...feature(false).entry, _id: 'unrecorded' },
    reason: { kind: 'sourceMissing' as const },
  };
  const off = {
    ...feature(true),
    entry: { ...feature(true).entry, _id: 'off', active: false },
    dormant: false,
    counting: false,
    reason: undefined,
  };
  const [section] = buildCharacterSheetGrantsView({
    entries: [recorded, unrecorded, off],
    catalogEntries: catalogs,
  });
  expect(section?.dormantLabel).toBe('Not counting now (1)');
  expect(section?.dormantRows.map((row) => row.rowId)).toEqual(['armor-grant']);
  expect(
    section?.rows.map((row) => [row.rowId, row.status, row.canKeep]),
  ).toEqual([['off', 'off', false]]);
});

test('a kept entry stays visible once and keeps its off control independent of Keep', () => {
  const kept = {
    ...feature(true),
    entry: { ...feature(true).entry, kept: true as const },
    counting: true,
  };
  const [section] = buildCharacterSheetGrantsView({
    entries: [master, kept],
    catalogEntries: catalogs,
  });
  expect(section?.rows[0]?.replaced[0]).toMatchObject({
    kept: true,
    status: 'kept',
    counting: true,
  });
  const off = {
    ...kept,
    entry: { ...kept.entry, active: false },
    counting: false,
  };
  expect(
    buildCharacterSheetGrantsView({
      entries: [master, off],
      catalogEntries: catalogs,
    })[0]?.rows[0]?.replaced[0],
  ).toMatchObject({ kept: true, status: 'off', counting: false });
});

test('dormant Selections from existing effect sections keep state without duplicating current entries', () => {
  const lost: ResolvedSheetEntry = {
    entry: {
      _id: 'item',
      kind: 'item',
      active: true,
      catalogEntryId: 'armor',
      state: { kind: 'item' },
      selectionSource: {
        kind: 'slot',
        grantedBy: { kind: 'entry', entryId: 'missing-slot' },
      },
    },
    origin: 'selection',
    recorded: true,
    storedEntryId: 'item',
    dormant: true,
    counting: false,
    reason: { kind: 'sourceMissing' },
  };
  if (lost.entry.kind !== 'item') throw new Error('Missing item');
  const [section] = buildCharacterSheetGrantsView({
    entries: [lost],
    catalogEntries: catalogs,
  });
  expect(section).toMatchObject({
    title: 'Items',
    rows: [],
    dormantLabel: 'Not counting now (1)',
  });
  expect(section?.dormantRows[0]?.target).toEqual({ entryId: 'item' });
  expect(
    buildCharacterSheetGrantsView({
      entries: [{ ...lost, dormant: false, counting: true }],
      catalogEntries: catalogs,
    }),
  ).toEqual([]);
  expect(
    buildCharacterSheetGrantsView({
      entries: [
        { ...lost, entry: { ...lost.entry, kept: true }, counting: true },
      ],
      catalogEntries: catalogs,
    })[0]?.rows[0],
  ).toMatchObject({ status: 'kept', canKeep: true, canDiscard: true });
});

test('derived Grants in existing effect kinds have their own controls even without stored state', () => {
  const manual: ResolvedSheetEntry = {
    entry: {
      _id: 'manual-grant',
      kind: 'manual',
      active: true,
      catalogEntryId: 'armor',
      state: { kind: 'manual' },
      grantKey: { source: 'fighter', entry: 'armor' },
    },
    origin: 'grant',
    recorded: false,
    dormant: false,
    counting: true,
  };
  expect(
    buildCharacterSheetGrantsView({
      entries: [manual],
      catalogEntries: catalogs,
    })[0]?.rows[0],
  ).toMatchObject({
    name: 'Armor Training 1',
    origin: 'grant',
    status: 'counting',
    recorded: false,
    canEditChoice: true,
  });
  const condition: ResolvedSheetEntry = {
    ...manual,
    entry: {
      ...manual.entry,
      catalogEntryId: 'armor',
      kind: 'condition',
      state: { kind: 'condition' },
    },
  };
  expect(
    buildCharacterSheetGrantsView({
      entries: [condition],
      catalogEntries: catalogs,
    })[0]?.rows[0],
  ).toMatchObject({ canEditChoice: false, notes: '' });
});

test('nested Grants name their Grant or Selection parent without repeating the parent’s class level', () => {
  const parent = {
    ...feature(true),
    dormant: false,
    counting: true,
    reason: undefined,
  };
  const nested = (source: string, rowId: string) => ({
    ...feature(false),
    entry: {
      ...feature(false).entry,
      _id: rowId,
      grantKey: { source, classLevel: 3, entry: 'child' },
    },
    dormant: false,
    counting: true,
    reason: undefined,
  });
  const rows = buildCharacterSheetGrantsView({
    entries: [
      parent,
      master,
      nested(parent.entry._id, 'grant-child'),
      nested(master.entry._id, 'selection-child'),
    ],
    catalogEntries: [
      ...catalogs,
      {
        _id: 'fighter',
        name: 'Fighter',
        ruleIdentity: 'fighter',
        modifiers: [],
      },
    ],
  }).flatMap((section) => section.rows);
  expect(rows.find((row) => row.rowId === 'armor-grant')?.sourceLabel).toBe(
    'Fighter 3',
  );
  expect(rows.find((row) => row.rowId === 'grant-child')?.sourceLabel).toBe(
    'Armor Training 1',
  );
  expect(rows.find((row) => row.rowId === 'selection-child')?.sourceLabel).toBe(
    'Weapon Master',
  );
});

test('the shipped sheet view lists a dormant selection once and keeps ordinary off adjustments in their section', () => {
  const snapshot = buildSheet({
    adjustments: [
      { id: 'lost', name: 'Dormant Selection', modifiers: [] },
      { id: 'off', name: 'Off adjustment', modifiers: [], active: false },
    ],
  });
  const entries = snapshot.entries.map((entry) =>
    entry._id === 'lost'
      ? {
          ...entry,
          selectionSource: {
            kind: 'slot' as const,
            grantedBy: {
              kind: 'entry' as const,
              entryId: 'missing' as Id<'characterSheetEntry'>,
            },
          },
        }
      : entry,
  );
  const calculated = calculateCharacterSheet({
    entries,
    catalogEntries: snapshot.catalogEntries,
    characterKind: snapshot.character.kind,
  });
  const view = buildCharacterSheetView({ ...snapshot, entries, calculated });
  expect(view.adjustments.map((row) => row.name)).toEqual(['Off adjustment']);
  expect(view.grants[0]?.dormantRows.map((row) => row.name)).toEqual([
    'Dormant Selection',
  ]);
});

test('current general selections keep their broken Class Level links and names without becoming Grants or dormant', () => {
  const snapshot = buildSheet({
    adjustments: [
      {
        id: 'feat',
        name: 'General feat',
        modifiers: [],
        gainedAtClassLevel: 'deleted-level',
      },
      {
        id: 'trait',
        name: 'Chosen trait',
        modifiers: [],
        gainedAtClassLevel: 'deleted-level',
      },
      {
        id: 'feature',
        name: 'Chosen feature',
        modifiers: [],
        gainedAtClassLevel: 'deleted-level',
      },
      {
        id: 'linked',
        name: 'Linked feat',
        modifiers: [],
        gainedAtClassLevel: 'level-1',
      },
      {
        id: 'grant',
        name: 'Lost Grant',
        modifiers: [],
        gainedAtClassLevel: 'deleted-level',
      },
    ],
  });
  const entries = snapshot.entries.map((entry) => {
    if (entry.kind !== 'manual') return entry;
    if (entry._id === 'trait')
      return {
        ...entry,
        kind: 'trait' as const,
        state: { kind: 'trait' as const },
      };
    if (entry._id === 'feature')
      return {
        ...entry,
        kind: 'classFeature' as const,
        state: { kind: 'classFeature' as const },
      };
    if (entry._id === 'grant')
      return { ...entry, grantKey: { source: 'lost', entry: 'lost-grant' } };
    return {
      ...entry,
      kind: 'feat' as const,
      state: { kind: 'feat' as const, slot: 'general' as const },
    };
  });
  const catalogEntries = snapshot.catalogEntries.map((entry) => {
    if (entry._id === 'trait-catalog')
      return { ...entry, detail: { kind: 'trait' as const } };
    if (entry._id === 'feature-catalog')
      return { ...entry, detail: { kind: 'classFeature' as const } };
    if (entry._id === 'feat-catalog' || entry._id === 'linked-catalog')
      return { ...entry, detail: { kind: 'feat' as const } };
    return entry;
  });
  const calculated = calculateCharacterSheet({
    entries,
    catalogEntries,
    characterKind: snapshot.character.kind,
  });
  const view = buildCharacterSheetView({
    ...snapshot,
    entries,
    catalogEntries,
    calculated,
  });
  expect(
    view.unplacedSelections.map((entry) => [
      entry._id,
      entry.name,
      'gainedAtClassLevel' in entry ? entry.gainedAtClassLevel : null,
    ]),
  ).toEqual([
    ['feat', 'General feat', 'deleted-level'],
    ['trait', 'Chosen trait', 'deleted-level'],
    ['feature', 'Chosen feature', 'deleted-level'],
  ]);
  expect(
    view.grants
      .flatMap((section) => section.rows)
      .filter((row) => row.unplaced)
      .map((row) => row.name),
  ).toEqual(['Chosen feature', 'General feat', 'Chosen trait']);
  expect(
    view.grants
      .flatMap((section) => section.rows)
      .find((row) => row.name === 'Linked feat'),
  ).toMatchObject({ gainedAtClassLevel: 'level-1', unplaced: false });
});

// #411: a retired target's new Grant keeps recorded state but cannot be kept.
test('a retired Grant the Character never had stays in Not counting now without Keep', () => {
  const retired: ResolvedSheetEntry = {
    ...feature(true),
    entry: { ...feature(true).entry, kept: true },
    reason: { kind: 'retired' },
  };
  const [section] = buildCharacterSheetGrantsView({
    entries: [retired],
    catalogEntries: catalogs,
  });
  expect(section?.rows).toEqual([]);
  expect(section?.dormantRows[0]).toMatchObject({
    rowId: 'armor-grant',
    status: 'dormant',
    kept: false,
    canKeep: false,
    canDiscard: true,
    notes: 'A table choice',
    reason:
      'Retired from the catalog before this Character had it, so it cannot be kept.',
  });
});
