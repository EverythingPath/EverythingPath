import {
  calculateFixtureSheet as calculateCharacterSheet,
  buildSheet,
  characterId,
  emptyOwnerCandidates,
  type Level,
} from './character-sheet-test-fixture';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import type { Id } from '@convex/_generated/dataModel';
import { ConvexError } from 'convex/values';
import { beforeEach, expect, test, vi } from 'vitest';
import { representativeArchetypeCatalog } from '@convex/lib/representativeArchetypeCatalog';
import { representativeClassFeatureSchedules } from '@convex/lib/representativeClassCatalog';
import type { MigrationMaintenance } from '~/components/use-initial-migration-maintenance';

import { CharacterSheetBlocks } from './character-sheet-blocks-test-fixture';
import { retiredChoiceReason } from './retired-catalog-choices';
import { catalogRuntimeCompatibility } from '~/lib/catalog/runtime-compatibility';

import type { CharacterSheetSnapshot } from './use-character-sheet';
import { characterSheetNames } from './character-sheet-api-test-fixture';
import type { FunctionReference } from 'convex/server';

// Archetypes across a class (#305): cards per class that apply to every
// level of it, what each replaces and adds, independent parts beside
// whole-feature conflicts, the exact replaced rows, and retained Grant state
// through deactivation. The Rogue schedule and its Archetypes are synthetic
// test facts shaped like the APG Scout (p. 134), not curated content.

type Call = {
  name: string;
  args: Record<string, unknown>;
  resolve: (value: unknown) => void;
  reject: (error: unknown) => void;
};
let calls: Call[] = [];
let snapshot: CharacterSheetSnapshot | null | undefined;
const maintenance = vi.fn<() => MigrationMaintenance>();

vi.mock('~/components/use-initial-migration-maintenance', () => ({
  useInitialMigrationMaintenance: () => maintenance(),
}));
const nameOf = characterSheetNames();
vi.mock('convex/react', () => ({
  useQuery: (query: FunctionReference<'query'>) => {
    const name = nameOf(query);
    return name === 'read' ? snapshot : name === 'companions' ? [] : undefined;
  },
  usePaginatedQuery: () => emptyOwnerCandidates(),
  useMutation: (mutation: FunctionReference<'mutation'>) => {
    const name = nameOf(mutation);
    return (args: Record<string, unknown>) =>
      new Promise((resolve, reject) => {
        calls.push({ name, args, resolve, reject });
      });
  },
}));
vi.mock(
  '~/components/ui/select',
  () => import('../weekly-draft-workspace/native-select-test-double'),
);

beforeEach(() => {
  calls = [];
  snapshot = undefined;
  maintenance.mockReturnValue({ kind: 'ready', readOnly: false, message: '' });
});

type CatalogEntry = CharacterSheetSnapshot['catalogEntries'][number];
type Entry = CharacterSheetSnapshot['entries'][number];
type ArchetypeKey = 'scout' | 'sniper' | 'thug';
type Replacement = {
  classLevel: number;
  catalogEntryId: string;
  scope?: 'whole' | 'part';
};
type Selection = {
  key: ArchetypeKey;
  active?: boolean;
  replaces?: Replacement[];
  notes?: string;
  choice?: string;
  /** The class the Selection is bound to. */
  classEntryId?: string;
};

const schedule = [
  { classLevel: 2, catalogEntryId: 'talent-2' },
  { classLevel: 4, catalogEntryId: 'uncanny' },
  { classLevel: 4, catalogEntryId: 'talent-4' },
  { classLevel: 8, catalogEntryId: 'improved' },
];
const features = [
  { id: 'talent-2', name: 'Rogue Talent', parentFeature: 'talent', part: '2' },
  { id: 'talent-4', name: 'Rogue Talent', parentFeature: 'talent', part: '4' },
  { id: 'uncanny', name: 'Uncanny Dodge' },
  { id: 'improved', name: 'Improved Uncanny Dodge' },
  { id: 'charge', name: 'Scout’s Charge' },
];
const archetypes: Record<
  ArchetypeKey,
  { name: string; replaces: Replacement[]; adds: Replacement[] }
> = {
  scout: {
    name: 'Scout',
    replaces: [
      { classLevel: 4, catalogEntryId: 'uncanny', scope: 'whole' },
      { classLevel: 8, catalogEntryId: 'improved', scope: 'whole' },
    ],
    adds: [{ classLevel: 4, catalogEntryId: 'charge' }],
  },
  sniper: {
    name: 'Sniper',
    replaces: [{ classLevel: 2, catalogEntryId: 'talent-2', scope: 'part' }],
    adds: [],
  },
  thug: {
    name: 'Thug',
    replaces: [{ classLevel: 4, catalogEntryId: 'talent-4', scope: 'part' }],
    adds: [],
  },
};

function catalogEntry(
  id: string,
  name: string,
  detail: unknown,
  sources: { book: string; pages?: string }[] = [],
) {
  return {
    _id: id,
    _creationTime: 7,
    scope: 'character',
    characterId,
    name,
    ruleIdentity: id,
    stacksWithItself: false,
    sources,
    modifiers: [],
    detail,
  } as unknown as CatalogEntry;
}

const rogueLevels = (count: number): Level[] =>
  Array.from({ length: count }, (_, index) => ({
    id: `level-${index + 1}`,
    hp: 8,
    classId: 'rogue',
  }));

/** A sheet with the synthetic Rogue schedule, its Archetypes and Selections. */
function buildArchetypeSheet({
  levels = rogueLevels(4),
  selections = [],
  chargeState,
  lastOperationId,
}: {
  levels?: Level[];
  selections?: Selection[];
  /** Recorded state on the Scout's added Scout's Charge Grant. */
  chargeState?: { notes: string; choice: string };
  lastOperationId?: string;
} = {}): CharacterSheetSnapshot {
  const base = buildSheet({ levels, lastOperationId });
  const catalogEntries = [
    ...base.catalogEntries.map((entry) =>
      entry._id === 'rogue' && entry.detail.kind === 'class'
        ? ({
            ...entry,
            detail: { ...entry.detail, featuresByLevel: schedule },
          } as CatalogEntry)
        : entry,
    ),
    ...features.map(({ id, name, ...parts }) =>
      catalogEntry(id, name, { kind: 'classFeature', ...parts }),
    ),
    ...Object.entries(archetypes).map(([key, archetype]) =>
      catalogEntry(
        key,
        archetype.name,
        {
          kind: 'archetype',
          classEntryIds: ['rogue'],
          replaces: archetype.replaces,
          adds: archetype.adds,
        },
        [{ book: 'Advanced Player’s Guide', pages: '134' }],
      ),
    ),
  ];
  const entries = [
    ...base.entries,
    ...selections.map(
      (selection, index) =>
        ({
          _id: `${selection.key}-row`,
          _creationTime: 60 + index,
          characterId,
          kind: 'archetype',
          active: selection.active ?? true,
          catalogEntryId: selection.key,
          ...(selection.notes ? { notes: selection.notes } : {}),
          state: {
            kind: 'archetype',
            ...(selection.replaces ? { replaces: selection.replaces } : {}),
            ...(selection.choice ? { choice: selection.choice } : {}),
            ...(selection.classEntryId
              ? { classEntryId: selection.classEntryId }
              : {}),
          },
        }) as unknown as Entry,
    ),
    ...(chargeState
      ? [
          {
            _id: 'charge-state',
            _creationTime: 70,
            characterId,
            kind: 'classFeature',
            active: true,
            catalogEntryId: 'charge',
            grantKey: { source: 'scout', classLevel: 4, entry: 'charge' },
            notes: chargeState.notes,
            state: { kind: 'classFeature', choice: chargeState.choice },
          } as unknown as Entry,
        ]
      : []),
  ];
  return calculateSheet({ base, entries, catalogEntries });
}

function calculateSheet({
  base,
  entries,
  catalogEntries,
}: {
  base: CharacterSheetSnapshot;
  entries: Entry[];
  catalogEntries: CatalogEntry[];
}): CharacterSheetSnapshot {
  const input = { entries, catalogEntries, characterKind: 'pc' as const };
  return {
    ...base,
    entries,
    catalogEntries,
    calculated: calculateCharacterSheet(input),
    permanentCalculated: calculateCharacterSheet(input, {
      permanentOnly: true,
    }),
  };
}

/** Five Fighter levels with the representative APG Archer selected. */
function buildArcherSheet(): CharacterSheetSnapshot {
  const base = buildSheet({
    levels: Array.from({ length: 5 }, (_, index) => ({
      id: `level-${index + 1}`,
      hp: 10,
      classId: 'fighter' as const,
    })),
  });
  const catalogEntries = [
    ...base.catalogEntries.map((entry) =>
      entry._id === 'fighter' && entry.detail.kind === 'class'
        ? ({
            ...entry,
            detail: {
              ...entry.detail,
              featuresByLevel: representativeClassFeatureSchedules.fighter,
            },
          } as CatalogEntry)
        : entry,
    ),
    ...representativeArchetypeCatalog.map(
      (seed) =>
        ({
          ...seed,
          _creationTime: 7,
          scope: 'character',
          characterId,
          stacksWithItself: false,
        }) as unknown as CatalogEntry,
    ),
  ];
  const archer = {
    _id: 'archer-row',
    _creationTime: 60,
    characterId,
    kind: 'archetype',
    active: true,
    catalogEntryId: 'fighter-archer',
    state: { kind: 'archetype', classEntryId: 'fighter' },
  } as unknown as Entry;
  return calculateSheet({
    base,
    entries: [...base.entries, archer],
    catalogEntries,
  });
}

function renderBlocks(
  initial: CharacterSheetSnapshot | undefined,
  blocks: ('archetypes' | 'grants' | 'levels')[] = ['archetypes'],
) {
  snapshot = initial;
  const ui = () => <CharacterSheetBlocks blocks={blocks} />;
  const view = render(ui());
  return {
    show(next: CharacterSheetSnapshot) {
      snapshot = next;
      view.rerender(ui());
    },
  };
}

const archetypesRegion = () =>
  within(screen.getByRole('region', { name: 'Archetypes' }));
const card = (name: string) => screen.getByRole('listitem', { name });
const cardBox = (name: string) =>
  screen.getByRole('checkbox', { name: `${name} for Rogue` });
const button = (name: string | RegExp) => screen.getByRole('button', { name });
const lastCall = () => {
  const call = calls.at(-1);
  if (!call) throw new Error('Expected a write');
  return call;
};

test('a class’s card applies the Archetype to all its levels with one write and leaves every Class Level’s class as it was', async () => {
  const view = renderBlocks(buildArchetypeSheet(), ['levels', 'archetypes']);
  const rogue = within(screen.getByRole('group', { name: 'Rogue' }));
  expect(rogue.getByText('Applies to all Rogue levels')).toBeVisible();
  expect(
    within(rogue.getByRole('list', { name: 'Rogue Archetypes' }))
      .getAllByRole('checkbox')
      .map((box) => box.getAttribute('aria-label')),
  ).toEqual(['Scout for Rogue', 'Sniper for Rogue', 'Thug for Rogue']);
  expect(
    within(card('Scout')).getByText('Advanced Player’s Guide p. 134'),
  ).toBeVisible();

  fireEvent.click(cardBox('Scout'));
  expect(calls.map((call) => [call.name, call.args])).toEqual([
    [
      'setArchetypeSelected',
      expect.objectContaining({
        classEntryId: 'rogue',
        catalogEntryId: 'scout',
        selected: true,
      }),
    ],
  ]);
  expect(cardBox('Scout')).toBeDisabled();
  expect(within(card('Scout')).getByText('Saving…')).toHaveAttribute(
    'role',
    'status',
  );

  view.show(
    buildArchetypeSheet({
      selections: [{ key: 'scout' }],
      lastOperationId: lastCall().args.operationId as string,
    }),
  );
  await act(async () => lastCall().resolve(null));
  expect(cardBox('Scout')).toBeChecked();
  expect(within(card('Scout')).getByText('Scout selected.')).toHaveAttribute(
    'role',
    'status',
  );
  const replaces = within(
    within(card('Scout')).getByRole('list', { name: 'Replaces' }),
  );
  expect(
    replaces.getAllByRole('listitem').map((row) => row.textContent),
  ).toEqual([
    'Level 4Uncanny DodgeWhole feature',
    'Level 8Improved Uncanny DodgeWhole featureLater level',
  ]);
  expect(
    within(card('Scout')).getByRole('list', { name: 'Adds' }),
  ).toHaveTextContent('Level 4Scout’s Charge');
  for (const level of [1, 2, 3, 4])
    expect(
      screen.getByRole('combobox', { name: `Class at level ${level}` }),
    ).toHaveTextContent('Rogue');
  expect(calls.map((call) => call.name)).toEqual(['setArchetypeSelected']);
  expect(
    screen.queryByText(/pf1\/|scout-row|talent-2/),
  ).not.toBeInTheDocument();
});

test('independent parts read as compatible; a whole-feature change warns verbatim and both Archetypes stay selected and editable', () => {
  const view = renderBlocks(
    buildArchetypeSheet({ selections: [{ key: 'sniper' }, { key: 'thug' }] }),
  );
  expect(
    within(card('Sniper')).getByText(
      'Independent part, compatible with Thug: Rogue Talent',
    ),
  ).toBeVisible();
  expect(
    screen.queryByText(/both alter the same class feature/),
  ).not.toBeInTheDocument();

  view.show(
    buildArchetypeSheet({
      selections: [
        { key: 'sniper' },
        {
          key: 'thug',
          replaces: [
            { classLevel: 4, catalogEntryId: 'talent-4', scope: 'whole' },
          ],
        },
      ],
    }),
  );
  expect(
    within(card('Sniper')).getByText(
      'Sniper and Thug both alter the same class feature. Both remain selected.',
    ),
  ).toBeVisible();
  expect(
    within(card('Sniper')).getByText(
      'Whole feature also altered by Thug: Rogue Talent',
    ),
  ).toBeVisible();
  expect(
    within(card('Thug')).getByText(
      'Whole feature also altered by Sniper: Rogue Talent',
    ),
  ).toBeVisible();
  expect(cardBox('Sniper')).toBeChecked();
  expect(cardBox('Thug')).toBeChecked();
  expect(cardBox('Thug')).toBeEnabled();
  fireEvent.click(button('Choose replaced features for Thug, Rogue'));
  expect(button('Save replaced features for Thug')).toBeEnabled();
});

test('accepting a conflict warning goes through the sheet’s warning controller and never changes the chosen parts', () => {
  renderBlocks(
    buildArchetypeSheet({
      selections: [
        { key: 'sniper' },
        {
          key: 'thug',
          replaces: [
            { classLevel: 4, catalogEntryId: 'talent-4', scope: 'whole' },
          ],
        },
      ],
    }),
  );
  fireEvent.click(
    within(card('Sniper')).getByRole('button', { name: 'Accept' }),
  );
  expect(calls.map((call) => call.name)).toEqual(['accept']);
  expect(lastCall().args).toMatchObject({
    check: 'archetypeConflict',
    subject: expect.stringContaining('sniper-row'),
  });
});

test('the replacement editor sends exact class-relative rows and their extent, keeps a refused save beside it for retry, and resets to the catalog with null', async () => {
  const view = renderBlocks(
    buildArchetypeSheet({ selections: [{ key: 'scout' }] }),
  );
  const disclosure = button('Choose replaced features for Scout, Rogue');
  expect(disclosure).toHaveAttribute('aria-expanded', 'false');
  fireEvent.click(disclosure);
  expect(disclosure).toHaveAttribute('aria-expanded', 'true');
  const row = (name: string) =>
    screen.getByRole('checkbox', { name: `Scout replaces ${name}` });
  expect(row('Uncanny Dodge, Rogue level 4')).toBeChecked();
  expect(row('Improved Uncanny Dodge, Rogue level 8')).toBeChecked();
  expect(row('Rogue Talent, Rogue level 2')).not.toBeChecked();
  expect(
    screen.queryByRole('button', { name: /Use catalog replacements/ }),
  ).not.toBeInTheDocument();

  fireEvent.click(row('Uncanny Dodge, Rogue level 4'));
  fireEvent.click(row('Rogue Talent, Rogue level 2'));
  const extent = within(
    screen.getByRole('radiogroup', {
      name: 'Extent of the Rogue Talent replacement, Rogue level 2',
    }),
  );
  expect(extent.getByRole('radio', { name: 'Independent part' })).toBeChecked();
  fireEvent.click(extent.getByRole('radio', { name: 'Whole feature' }));
  fireEvent.click(button('Save replaced features for Scout'));
  expect(lastCall()).toMatchObject({
    name: 'setArchetypePartChoices',
    args: {
      entryId: 'scout-row',
      replacementChoices: [
        { classLevel: 2, catalogEntryId: 'talent-2', scope: 'whole' },
        { classLevel: 8, catalogEntryId: 'improved', scope: 'whole' },
      ],
    },
  });
  expect(button('Saving… for Scout')).toBeDisabled();
  await act(async () =>
    lastCall().reject(new ConvexError('Character is read only')),
  );
  expect(within(card('Scout')).getByRole('alert')).toHaveTextContent(
    "Replacement choices weren't saved: Character is read only. Try again.",
  );
  expect(row('Rogue Talent, Rogue level 2')).toBeChecked();
  fireEvent.click(button('Save replaced features for Scout'));
  expect(calls.map((call) => call.name)).toEqual([
    'setArchetypePartChoices',
    'setArchetypePartChoices',
  ]);
  await act(async () => lastCall().resolve(null));

  view.show(
    buildArchetypeSheet({
      selections: [
        {
          key: 'scout',
          replaces: [
            { classLevel: 2, catalogEntryId: 'talent-2', scope: 'whole' },
          ],
        },
      ],
    }),
  );
  expect(row('Uncanny Dodge, Rogue level 4')).not.toBeChecked();
  fireEvent.click(button('Use catalog replacements for Scout'));
  expect(lastCall()).toMatchObject({
    name: 'setArchetypePartChoices',
    args: { entryId: 'scout-row', replacementChoices: null },
  });
});

test('deactivating keeps the added Grant’s choice and notes, counts the originals again, and reactivating brings back one added Grant', async () => {
  const chargeState = { notes: 'Use shortbow', choice: 'Shortbow' };
  const view = renderBlocks(
    buildArchetypeSheet({ selections: [{ key: 'scout' }], chargeState }),
    ['archetypes', 'grants'],
  );
  const replaced = within(card('Scout')).getByRole('listitem', {
    name: 'Uncanny Dodge',
  });
  expect(within(replaced).getByText('Replaced by Scout')).toBeVisible();
  expect(
    within(replaced).getByRole('button', { name: 'Keep Uncanny Dodge' }),
  ).toBeEnabled();

  fireEvent.click(button('Deactivate Scout for Rogue'));
  expect(lastCall()).toMatchObject({
    name: 'setArchetypeSelected',
    args: { catalogEntryId: 'scout', selected: false },
  });
  view.show(
    buildArchetypeSheet({
      selections: [{ key: 'scout', active: false }],
      chargeState,
    }),
  );
  await act(async () => lastCall().resolve(null));
  expect(cardBox('Scout')).not.toBeChecked();
  expect(within(card('Scout')).getByText('Not counting now')).toBeVisible();
  expect(button('Activate Scout for Rogue')).toBeEnabled();
  const classFeatures = within(
    screen.getByRole('region', { name: 'Class features' }),
  );
  const uncanny = classFeatures.getByRole('listitem', {
    name: 'Uncanny Dodge',
  });
  expect(
    within(uncanny).queryByText('Not counting now'),
  ).not.toBeInTheDocument();
  fireEvent.click(
    classFeatures.getByRole('button', { name: 'Not counting now (1)' }),
  );
  expect(
    classFeatures.getByRole('listitem', { name: 'Scout’s Charge' }),
  ).toHaveTextContent('Choice: Shortbow · Use shortbow');

  fireEvent.click(button('Activate Scout for Rogue'));
  expect(lastCall()).toMatchObject({
    name: 'setArchetypeSelected',
    args: { catalogEntryId: 'scout', selected: true },
  });
  view.show(
    buildArchetypeSheet({ selections: [{ key: 'scout' }], chargeState }),
  );
  expect(
    screen.getAllByRole('listitem', { name: 'Scout’s Charge' }),
  ).toHaveLength(1);
});

test('a refused card save stays at the card with its reason, and choosing the card again retries', async () => {
  renderBlocks(buildArchetypeSheet());
  fireEvent.click(cardBox('Sniper'));
  await act(async () =>
    lastCall().reject(new ConvexError('Character is read only')),
  );
  expect(within(card('Sniper')).getByRole('alert')).toHaveTextContent(
    "Archetype wasn't saved: Character is read only. Try again.",
  );
  expect(cardBox('Sniper')).not.toBeChecked();
  expect(within(card('Scout')).queryByRole('alert')).not.toBeInTheDocument();
  fireEvent.click(cardBox('Sniper'));
  expect(calls.map((call) => call.name)).toEqual([
    'setArchetypeSelected',
    'setArchetypeSelected',
  ]);
});

test('another player’s Archetype change is announced in the block and dismissing it writes nothing', () => {
  const view = renderBlocks(buildArchetypeSheet());
  view.show(
    buildArchetypeSheet({
      selections: [{ key: 'thug' }],
      lastOperationId: 'remote-operation',
    }),
  );
  expect(
    archetypesRegion().getByText('Archetypes or replaced features changed.'),
  ).toBeVisible();
  fireEvent.click(button('Dismiss archetypes update'));
  expect(
    screen.queryByText('Archetypes or replaced features changed.'),
  ).not.toBeInTheDocument();
  expect(calls).toEqual([]);
});

test('loading, a sheet without classes, a class without Archetypes and a Selection whose class is gone each read plainly', () => {
  const view = renderBlocks(undefined);
  expect(
    screen.getByRole('status', { name: 'Loading character sheet…' }),
  ).toBeInTheDocument();

  view.show(buildArchetypeSheet({ levels: [{ id: 'level-1', hp: null }] }));
  expect(
    archetypesRegion().getByText('Add a class to choose an Archetype.'),
  ).toBeVisible();

  view.show(
    buildArchetypeSheet({
      levels: [{ id: 'level-1', hp: 10, classId: 'fighter' }],
      selections: [{ key: 'scout' }],
    }),
  );
  expect(
    within(screen.getByRole('group', { name: 'Fighter' })).getByText(
      'No Archetypes available for this class.',
    ),
  ).toBeVisible();
  const dormant = button('Not counting now (1)');
  expect(dormant).toHaveAttribute('aria-expanded', 'false');
  fireEvent.click(dormant);
  const scout = card('Scout');
  expect(
    within(scout).getByText(
      'Scout has no applicable Class Levels in its selected class; its features do not count.',
    ),
  ).toBeVisible();
  expect(
    within(scout).getByRole('button', { name: 'Keep Scout' }),
  ).toBeEnabled();
});

test('an Archetype card is a native checkbox a keyboard reaches and toggles', () => {
  renderBlocks(buildArchetypeSheet());
  const box = cardBox('Thug');
  expect(box).toHaveProperty('type', 'checkbox');
  expect(box).not.toHaveAttribute('tabindex', '-1');
  box.focus();
  expect(box).toHaveFocus();
  fireEvent.click(box);
  expect(lastCall()).toMatchObject({
    name: 'setArchetypeSelected',
    args: { catalogEntryId: 'thug' as Id<'catalogEntry'>, selected: true },
  });
});

test('a chosen Archetype’s notes save on their own under its Selection, keep what was entered when refused, retry, and leave its replacements and class alone', async () => {
  const replaces = [
    { classLevel: 2, catalogEntryId: 'talent-2', scope: 'whole' as const },
  ];
  const view = renderBlocks(
    buildArchetypeSheet({
      selections: [
        {
          key: 'scout',
          notes: 'Hunts at night',
          choice: 'Forest',
          classEntryId: 'rogue',
          replaces,
        },
      ],
    }),
  );
  expect(
    within(card('Scout')).getByText('Choice: Forest · Hunts at night'),
  ).toBeVisible();
  const edit = button('Edit Scout for Rogue');
  fireEvent.click(edit);
  expect(edit).toHaveAttribute('aria-pressed', 'true');
  const notes = screen.getByRole('textbox', {
    name: 'Notes for Scout for Rogue',
  });
  fireEvent.change(notes, { target: { value: 'Scouts ahead' } });
  fireEvent.click(button('Save Scout for Rogue'));
  await act(async () => undefined);
  expect(calls.map((call) => call.name)).toEqual(['editSelection']);
  expect(lastCall().args).toMatchObject({
    entryId: 'scout-row',
    notes: 'Scouts ahead',
  });
  for (const field of ['choice', 'replacementChoices', 'classEntryId'])
    expect(lastCall().args).not.toHaveProperty(field);
  expect(within(card('Scout')).getByText('Saving…')).toHaveAttribute(
    'role',
    'status',
  );

  await act(async () =>
    lastCall().reject(new ConvexError('Character is read only')),
  );
  expect(within(card('Scout')).getAllByRole('alert')).toHaveLength(1);
  expect(within(card('Scout')).getByRole('alert')).toHaveTextContent(
    "Archetype wasn't saved: Character is read only. Try again.",
  );
  expect(notes).toHaveValue('Scouts ahead');
  fireEvent.click(button('Save Scout for Rogue'));
  await act(async () => undefined);
  expect(lastCall().args).toMatchObject({
    entryId: 'scout-row',
    notes: 'Scouts ahead',
  });
  await act(async () => lastCall().resolve(null));
  expect(
    screen.queryByRole('form', { name: 'Edit Scout for Rogue' }),
  ).not.toBeInTheDocument();
  expect(edit).toHaveFocus();
  expect(within(card('Scout')).getByText('Saved')).toHaveAttribute(
    'role',
    'status',
  );
  expect(
    within(card('Scout')).queryByText('Replaced features saved.'),
  ).not.toBeInTheDocument();

  view.show(
    buildArchetypeSheet({
      selections: [
        {
          key: 'scout',
          active: false,
          notes: 'Scouts ahead',
          choice: 'Forest',
          classEntryId: 'rogue',
          replaces,
        },
      ],
    }),
  );
  fireEvent.click(button('Edit Scout for Rogue'));
  fireEvent.change(
    screen.getByRole('textbox', { name: 'Choice for Scout for Rogue' }),
    { target: { value: ' ' } },
  );
  fireEvent.click(button('Save Scout for Rogue'));
  await act(async () => undefined);
  expect(lastCall()).toMatchObject({
    name: 'editSelection',
    args: { entryId: 'scout-row', choice: null },
  });
  for (const field of ['notes', 'replacementChoices', 'classEntryId'])
    expect(lastCall().args).not.toHaveProperty(field);
  expect(calls.map((call) => call.name)).toEqual([
    'editSelection',
    'editSelection',
    'editSelection',
  ]);
});

test('an Archetype bound to another class stays recorded, warns verbatim with Accept, and leaves its usual class’s card unchecked', () => {
  renderBlocks(
    buildArchetypeSheet({
      levels: [
        ...rogueLevels(2),
        { id: 'level-3', hp: 10, classId: 'fighter' },
      ],
      selections: [{ key: 'scout', classEntryId: 'fighter' }],
    }),
  );
  expect(cardBox('Scout')).not.toBeChecked();
  expect(
    within(card('Scout')).queryByRole('button', {
      name: 'Deactivate Scout for Rogue',
    }),
  ).not.toBeInTheDocument();
  const dormant = button('Not counting now (1)');
  fireEvent.click(dormant);
  const panel = document.getElementById(
    dormant.getAttribute('aria-controls') ?? '',
  );
  if (!panel) throw new Error('Expected the Not counting now group');
  const scout = within(panel).getByRole('listitem', { name: 'Scout' });
  expect(
    within(scout).getByText(
      'Scout has no applicable Class Levels in its selected class; its features do not count.',
    ),
  ).toBeVisible();
  expect(
    within(scout).getByRole('button', { name: 'Edit Scout' }),
  ).toBeVisible();
  fireEvent.click(within(scout).getByRole('button', { name: 'Accept' }));
  expect(calls.map((call) => call.name)).toEqual(['accept']);
  expect(lastCall().args).toMatchObject({ check: 'archetypeClass' });
});

// APG Archer p. 104 against CRB Table 3-9 (p. 56): each replaced Fighter row
// is listed once, at its class level.
test('the Archer replaces exactly its fifteen Fighter rows, each listed once', () => {
  renderBlocks(buildArcherSheet());
  const replaces = within(
    within(card('Archer')).getByRole('list', { name: 'Replaces' }),
  );
  expect(
    replaces.getAllByRole('listitem').map((row) => row.textContent),
  ).toEqual([
    'Level 2Bravery +1Whole feature',
    'Level 6Bravery +2Whole featureLater level',
    'Level 10Bravery +3Whole featureLater level',
    'Level 14Bravery +4Whole featureLater level',
    'Level 18Bravery +5Whole featureLater level',
    'Level 3Armor Training 1Whole feature',
    'Level 7Armor Training 2Whole featureLater level',
    'Level 11Armor Training 3Whole featureLater level',
    'Level 15Armor Training 4Whole featureLater level',
    'Level 5Weapon Training 1Independent part',
    'Level 9Weapon Training 2Independent partLater level',
    'Level 13Weapon Training 3Independent partLater level',
    'Level 17Weapon Training 4Independent partLater level',
    'Level 19Armor MasteryWhole featureLater level',
    'Level 20Weapon MasteryWhole featureLater level',
  ]);
});

// #411: a release retired the APG Archer (p. 104). A fighter without it sees
// the card greyed out with the reason; a fighter that already has it keeps
// its card choosable.
test('a retired Archetype is unavailable to a new fighter but stays choosable for its own', () => {
  const held = (sheet: CharacterSheetSnapshot): CharacterSheetSnapshot => ({
    ...sheet,
    catalogView: {
      releaseNumber: 1,
      calculationIdentity: catalogRuntimeCompatibility.calculation,
      resources: { castingTables: undefined },
      legalInputs: null,
      definitions: [],
      advisories: [],
      heldDefinitionIds: ['fighter-archer' as Id<'catalogEntry'>],
    },
  });
  const archer = buildArcherSheet();
  const withoutArcher = calculateSheet({
    base: archer,
    entries: archer.entries.filter((entry) => entry.kind !== 'archetype'),
    catalogEntries: archer.catalogEntries,
  });
  const box = () =>
    screen.getByRole('checkbox', { name: 'Archer for Fighter' });

  const view = renderBlocks(held(withoutArcher));
  expect(box()).toBeDisabled();
  expect(within(card('Archer')).getByText(retiredChoiceReason)).toHaveClass(
    'text-muted-foreground',
  );
  fireEvent.click(box());
  expect(calls).toEqual([]);

  view.show(held(archer));
  expect(box()).toBeEnabled();
  expect(box()).toBeChecked();
  expect(within(card('Archer')).queryByText(retiredChoiceReason)).toBeNull();
  fireEvent.click(box());
  expect(lastCall()).toMatchObject({
    name: 'setArchetypeSelected',
    args: { catalogEntryId: 'fighter-archer', selected: false },
  });
});
