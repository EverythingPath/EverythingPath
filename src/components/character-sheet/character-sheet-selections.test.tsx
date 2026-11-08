import { magicalLineage } from '../../../e2e/fixtures/magical-lineage';
import {
  calculateFixtureSheet as calculateCharacterSheet,
  buildSheet,
  characterId,
  emptyOwnerCandidates,
  findCalculatedWarning,
  type Accepted,
  type Level,
} from './character-sheet-test-fixture';
import type { Id } from '@convex/_generated/dataModel';
import { representativeArchetypeCatalog } from '@convex/lib/representativeArchetypeCatalog';
import { representativeSelectionCatalog } from '@convex/lib/representativeSelectionCatalog';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { ConvexError } from 'convex/values';
import { beforeEach, expect, test, vi } from 'vitest';
import type { MigrationMaintenance } from '~/components/use-initial-migration-maintenance';
import {
  createCatalogSheetEntryState,
  type SelectableCatalogSheetEntryKind,
} from '~/lib/character-sheet-entries';
import { CharacterSheetBlocks } from './character-sheet-blocks-test-fixture';
import { catalogRuntimeCompatibility } from '~/lib/catalog/runtime-compatibility';

import type { CharacterSheetSnapshot } from './use-character-sheet';
import { characterSheetNames } from './character-sheet-api-test-fixture';
import type { FunctionReference } from 'convex/server';

// Feats & traits (#313): slots with their counts, the picker's advisory
// prerequisite preview, saved rows with current and recorded-level checks,
// alignment and deity, and Grants and dormant entries kept with their own
// controls. The real controller runs against recorded mutations.

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
  maintenance.mockReturnValue({ kind: 'ready', readOnly: false, message: '' });
});

type CatalogEntry = CharacterSheetSnapshot['catalogEntries'][number];
type Entry = CharacterSheetSnapshot['entries'][number];
type Selection = {
  id: string;
  key: string;
  slot?: [string, number];
  level?: string;
  order?: number;
  choice?: string;
  notes?: string;
  active?: boolean;
  kept?: boolean;
  /** A bonus slot's source Class Level. */
  bonusFrom?: string;
};

const selectionCatalog = [
  ...representativeSelectionCatalog,
  magicalLineage,
].map(
  (entry) =>
    ({
      ...entry,
      _id: entry.ruleIdentity,
      _creationTime: 7,
      scope: 'character',
      characterId,
    }) as CatalogEntry,
);
const bonusFeatId = (classLevel: number) => `fighter-bonus-feat-${classLevel}`;
const fighterBonusFeats = (classLevels: number[]) =>
  classLevels.map((classLevel) => {
    const seed = representativeArchetypeCatalog.find(
      (entry) => entry._id === bonusFeatId(classLevel),
    );
    if (!seed) throw new Error(`No Fighter Bonus Feat at level ${classLevel}`);
    return {
      ...seed,
      _creationTime: 7,
      scope: 'character',
      characterId,
    } as CatalogEntry;
  });
const faithful = {
  ...selectionCatalog[0]!,
  _id: 'faithful-strike',
  name: 'Faithful Strike',
  ruleIdentity: 'faithful-strike',
  prerequisites: [{ alignment: ['LG'] }],
  prerequisiteText: 'Lawful good.',
} as CatalogEntry;

function selectionEntry(selection: Selection): Entry {
  const catalog =
    selectionCatalog.find((entry) => entry._id === selection.key) ?? faithful;
  const source = selection.bonusFrom
    ? {
        kind: 'slot' as const,
        grantedBy: { kind: 'entry' as const, entryId: selection.bonusFrom },
        slotIndex: 0,
      }
    : undefined;
  const kind = catalog.detail.kind as 'feat' | 'trait';
  return {
    _id: selection.id as Id<'characterSheetEntry'>,
    _creationTime: 60,
    characterId,
    kind,
    active: selection.active ?? true,
    catalogEntryId: catalog._id,
    ...(selection.slot
      ? {
          selectionSlot: {
            id: selection.slot[0],
            position: selection.slot[1],
          },
        }
      : {}),
    ...(source ? { selectionSource: source } : {}),
    ...(selection.level ? { gainedAtClassLevel: selection.level } : {}),
    ...(selection.order !== undefined ? { choiceOrder: selection.order } : {}),
    ...(selection.notes !== undefined ? { notes: selection.notes } : {}),
    ...(selection.kept ? { kept: true } : {}),
    state:
      kind === 'feat'
        ? {
            kind: 'feat',
            choice: selection.choice ?? null,
            slot: source
              ? { grantedBy: source.grantedBy, slotIndex: 0 }
              : 'general',
          }
        : { kind: 'trait', choice: selection.choice ?? null },
  } as Entry;
}

function selectionSheet({
  levels = [{ id: 'level-1', hp: 10, classId: 'fighter' }],
  selections = [],
  bonusSlot,
  grantedFeat = false,
  bonusFeatLevels = [],
  alignment,
  deity,
  accepted = [],
  lastOperationId = 'seed',
  id = characterId,
}: {
  levels?: Level[];
  selections?: Selection[];
  bonusSlot?: { ignoresPrerequisites?: boolean };
  grantedFeat?: boolean;
  /** Fighter levels whose Fighter Bonus Feat opens a slot of its own. */
  bonusFeatLevels?: number[];
  alignment?: string;
  deity?: string;
  accepted?: Accepted[];
  lastOperationId?: string;
  id?: Id<'character'>;
} = {}): CharacterSheetSnapshot {
  const sheet = buildSheet({ levels, hasClasses: true, lastOperationId });
  const featuresByLevel = [
    ...(grantedFeat ? [{ classLevel: 1, catalogEntryId: 'skill-focus' }] : []),
    ...bonusFeatLevels.map((classLevel) => ({
      classLevel,
      catalogEntryId: bonusFeatId(classLevel),
    })),
  ];
  const catalogEntries = [
    ...sheet.catalogEntries.map((entry) =>
      entry._id === 'fighter'
        ? ({
            ...entry,
            ...(bonusSlot
              ? {
                  grantsSlots: [
                    {
                      kind: 'feat',
                      count: 1,
                      featTypes: ['combat'],
                      ...bonusSlot,
                    },
                  ],
                }
              : {}),
            ...(featuresByLevel.length > 0
              ? { detail: { ...entry.detail, featuresByLevel } }
              : {}),
          } as CatalogEntry)
        : entry,
    ),
    ...fighterBonusFeats(bonusFeatLevels),
    ...selectionCatalog,
    ...bonusFeatLevels.map((classLevel) => ({
      ...sheet.baseScoresEntry,
      _id: `fighter-bonus-feat-${classLevel}` as Id<'catalogEntry'>,
      name: 'Fighter Bonus Feat',
      ruleIdentity: `fighter-bonus-feat-${classLevel}`,
      modifiers: [],
      detail: { kind: 'classFeature' as const },
      grantsSlots: [{ kind: 'feat' as const, count: 1, featTypes: ['combat'] }],
    })),
    faithful,
  ];
  const entries = [
    ...sheet.entries.map((entry) =>
      entry.kind === 'base'
        ? ({
            ...entry,
            state: {
              ...entry.state,
              ...(alignment ? { alignment } : {}),
              ...(deity ? { deity } : {}),
            },
          } as Entry)
        : entry,
    ),
    ...selections.map(selectionEntry),
  ];
  const input = { entries, catalogEntries, characterKind: 'pc' as const };
  const calculated = calculateCharacterSheet(input);
  return {
    ...sheet,
    character: { ...sheet.character, _id: id },
    entries,
    catalogEntries,
    calculated,
    permanentCalculated: calculateCharacterSheet(input, {
      permanentOnly: true,
    }),
    acceptedWarnings: accepted.map((warning, index) => ({
      _id: `accepted-${index}` as Id<'acceptedWarning'>,
      _creationTime: 10 + index,
      characterId: id,
      acceptedBy: 'other-player',
      acceptedAt: 10 + index,
      ...warning,
    })),
  };
}

function renderSelections(initial: CharacterSheetSnapshot) {
  snapshot = initial;
  const view = render(<CharacterSheetBlocks blocks={['selections']} />);
  return {
    rerender(next: CharacterSheetSnapshot, scopeCharacterId = characterId) {
      snapshot = next;
      view.rerender(
        <CharacterSheetBlocks
          blocks={['selections']}
          scopeCharacterId={scopeCharacterId}
        />,
      );
    },
  };
}

const slot = (name: string) => within(screen.getByRole('group', { name }));
const row = (name: string) => within(screen.getByRole('listitem', { name }));
const picker = (name: RegExp) => within(screen.getByRole('group', { name }));
function lastCall(name: string) {
  const call = calls.filter((candidate) => candidate.name === name).at(-1);
  if (!call) throw new Error(`Expected a ${name} call`);
  return call;
}
async function submit(button: HTMLElement) {
  fireEvent.click(button);
  await act(async () => undefined);
}
async function settle(call: Call, value: unknown = null) {
  await act(async () => {
    call.resolve(value);
  });
}

/** The innermost element holding both, such as one line of a row. */
function commonAncestor(first: Element, second: Element) {
  let node: Element | null = first;
  while (node && !node.contains(second)) node = node.parentElement;
  if (!node) throw new Error('Expected a shared ancestor');
  return node;
}
function isBefore(first: Element, second: Element) {
  return Boolean(
    first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING,
  );
}
/** Catalog prose the calculation never reads, set on the snapshot alone. */
function withCatalogText(
  sheet: CharacterSheetSnapshot,
  catalogEntryId: string,
  text: { description?: string },
): CharacterSheetSnapshot {
  return {
    ...sheet,
    catalogEntries: sheet.catalogEntries.map((entry) =>
      entry._id === catalogEntryId ? { ...entry, ...text } : entry,
    ),
  };
}

const powerAttack: Selection = {
  id: 'power-attack-entry',
  key: 'power-attack',
  slot: ['feat:general', 0],
  level: 'level-1',
  order: 0,
};

test('the first Hit Die opens one general feat, the class its bonus feat, and Additional Traits two more traits beside Traits and the Drawback', () => {
  renderSelections(
    selectionSheet({
      bonusSlot: {},
      selections: [
        {
          id: 'additional',
          key: 'additional-traits',
          slot: ['feat:general', 0],
          level: 'level-1',
          order: 0,
        },
      ],
    }),
  );
  const block = within(screen.getByRole('region', { name: 'Feats & traits' }));
  expect(block.getByText('1/2 feats · 0/4 traits')).toBeVisible();
  expect(slot('General feats').getByText('1/1')).toBeVisible();
  expect(
    slot('General feats').getByRole('listitem', { name: 'Additional Traits' }),
  ).toBeVisible();
  const bonus = slot('Fighter feats');
  expect(bonus.getByText('0/1')).toBeVisible();
  expect(bonus.getByText('1 open')).toHaveClass('text-sky-300');
  expect(bonus.getByText('Usually combat feats')).toBeVisible();
  expect(bonus.getByText('1 fighter feat remains to select.')).toHaveClass(
    'text-sky-300',
  );
  expect(bonus.getByRole('button', { name: 'Add a feat' }).className).toContain(
    'ring-sky-400',
  );
  expect(slot('Traits').getByText('0/2')).toBeVisible();
  expect(slot('Additional Traits').getByText('0/2')).toBeVisible();
  expect(slot('Drawback').getByText('0/1')).toBeVisible();
  for (const [group, name] of [
    ['Traits', 'Add a trait'],
    ['Additional Traits', 'Add a trait'],
    ['Drawback', 'Add a drawback'],
  ] as const) {
    expect(slot(group).getByRole('button', { name }).className).not.toContain(
      'ring-sky-400',
    );
    expect(slot(group).queryByText(/remain to select/)).toBeNull();
  }
  expect(screen.queryByText('Not tied to a level')).toBeNull();
});

test('budget copy is singular for one open choice, and Fighter bonus feats from different levels have labels of their own', () => {
  renderSelections(
    selectionSheet({
      levels: [
        { id: 'level-1', hp: 10, classId: 'fighter' },
        { id: 'level-2', hp: 10, classId: 'fighter' },
      ],
      bonusFeatLevels: [1, 2],
    }),
  );
  expect(
    slot('General feats').getByText('1 general feat remains to select.'),
  ).toHaveClass('text-sky-300');
  for (const level of [1, 2]) {
    const bonus = slot(`Bonus Feat (level ${level})`);
    expect(bonus.getByText('0/1')).toBeVisible();
    expect(
      bonus.getByText(`1 bonus feat (level ${level}) remains to select.`),
    ).toBeVisible();
  }
});

test('the picker shows unmet supported prerequisites, still adds the feat, and returns focus to Add', async () => {
  renderSelections(selectionSheet());
  const add = slot('General feats').getByRole('button', { name: 'Add a feat' });
  fireEvent.click(add);
  const choose = picker(/Choose a feat/);
  expect(choose.getByRole('searchbox', { name: 'Search feats' })).toHaveFocus();
  fireEvent.click(choose.getByRole('button', { name: 'Power Attack' }));
  const staged = within(
    choose.getByRole('group', { name: 'General feats selection' }),
  );
  expect(staged.getByText('Prerequisites not met')).toBeVisible();
  const now = within(staged.getByRole('list', { name: 'Prerequisites now' }));
  expect(now.getByText(/Strength 13/)).toHaveTextContent('not met');
  expect(now.getByText(/BAB \+1/)).toHaveTextContent('met');
  expect(
    staged.getByText('Prerequisites: Str 13, base attack bonus +1.'),
  ).toBeVisible();
  fireEvent.change(choose.getByRole('combobox', { name: 'Level gained' }), {
    target: { value: 'level-1' },
  });
  expect(
    staged.getByRole('list', { name: 'Prerequisites at recorded level 1' }),
  ).toBeVisible();
  expect(
    staged.getByRole('group', { name: 'Prerequisites at recorded level 1' }),
  ).not.toContainElement(
    staged.getByRole('list', { name: 'Prerequisites now' }),
  );
  expect(staged.queryByRole('button', { name: /^Accept/ })).toBeNull();
  await submit(choose.getByRole('button', { name: 'Add Power Attack' }));
  expect(lastCall('fillSelectionSlot').args).toMatchObject({
    slotId: 'feat:general',
    position: 0,
    catalogEntryId: 'power-attack',
    choice: null,
    gainedAtClassLevel: 'level-1',
  });
  await settle(lastCall('fillSelectionSlot'), 'power-attack-entry');
  expect(screen.queryByRole('group', { name: /Choose a feat/ })).toBeNull();
  expect(add).toHaveFocus();
});

test('a trait with only unmodeled prose stays readable without a failed or unchecked status', async () => {
  renderSelections(selectionSheet());
  fireEvent.click(slot('Traits').getByRole('button', { name: 'Add a trait' }));
  const choose = picker(/Choose a trait/);
  fireEvent.click(
    choose.getByRole('button', { name: 'Prepared campaign trait' }),
  );
  const staged = within(
    choose.getByRole('group', { name: 'Traits selection' }),
  );
  expect(
    staged.getByText('Prerequisites: Campaign-specific background agreement.'),
  ).toBeVisible();
  expect(staged.queryByText(/Prerequisites (not )?met/)).toBeNull();
  expect(staged.queryByText(/not checked/i)).toBeNull();
  expect(staged.queryByRole('list')).toBeNull();
  await submit(
    choose.getByRole('button', { name: 'Add Prepared campaign trait' }),
  );
  expect(lastCall('fillSelectionSlot').args).not.toHaveProperty(
    'gainedAtClassLevel',
  );
});

class TestPointerEvent extends MouseEvent {
  pointerId: number;
  pointerType: string;
  isPrimary: boolean;
  constructor(type: string, init: PointerEventInit = {}) {
    super(type, init);
    this.pointerId = init.pointerId ?? 1;
    this.pointerType = init.pointerType ?? 'mouse';
    this.isPrimary = init.isPrimary ?? true;
  }
}

test('a card dropped outside the selection area returns with feedback, one dropped inside is staged, and a card the slot cannot take is refused', async () => {
  vi.stubGlobal('PointerEvent', TestPointerEvent);
  const view = renderSelections(selectionSheet());
  fireEvent.click(
    slot('General feats').getByRole('button', { name: 'Add a feat' }),
  );
  const choose = picker(/Choose a feat/);
  const area = choose.getByRole('group', { name: 'General feats selection' });
  vi.spyOn(area, 'getBoundingClientRect').mockReturnValue(
    new DOMRect(100, 100, 120, 80),
  );
  const card = choose.getByRole('button', { name: 'Cleave' });
  fireEvent.pointerDown(card, { button: 0, clientX: 20, clientY: 20 });
  fireEvent.pointerMove(card, { clientX: 40, clientY: 45 });
  fireEvent.pointerUp(card, { clientX: 40, clientY: 45 });
  expect(choose.getByText(/Your selection is unchanged/)).toBeVisible();
  expect(card).toHaveAttribute('aria-pressed', 'false');
  fireEvent.pointerDown(card, { button: 0, clientX: 20, clientY: 20 });
  fireEvent.pointerMove(card, { clientX: 150, clientY: 130 });
  expect(area).toHaveAttribute('data-drop-active', 'true');
  fireEvent.pointerUp(card, { clientX: 150, clientY: 130 });
  expect(card).toHaveAttribute('aria-pressed', 'true');
  expect(within(area).getByText('Cleave')).toBeVisible();

  // Another player's change turns the staged card into a trait: it cannot
  // fill a feat slot, so Add explains and changes nothing.
  const next = selectionSheet();
  view.rerender({
    ...next,
    catalogEntries: next.catalogEntries.map((entry) =>
      entry._id === 'cleave'
        ? ({ ...entry, detail: { kind: 'trait' } } as CatalogEntry)
        : entry,
    ),
  });
  expect(
    within(area).getByText(
      "Cleave is a trait, so it can't fill this feat slot. Nothing changed.",
    ),
  ).toBeVisible();
  await submit(choose.getByRole('button', { name: 'Add Cleave' }));
  expect(calls.filter((call) => call.name === 'fillSelectionSlot')).toEqual([]);
  vi.unstubAllGlobals();
});

test('an ordinary trait in the Drawback slot is allowed and its advisory can be accepted', async () => {
  const view = renderSelections(selectionSheet());
  fireEvent.click(
    slot('Drawback').getByRole('button', { name: 'Add a drawback' }),
  );
  const choose = picker(/Choose a drawback/);
  fireEvent.click(choose.getByRole('button', { name: 'Reactionary' }));
  await submit(choose.getByRole('button', { name: 'Add Reactionary' }));
  expect(lastCall('fillSelectionSlot').args).toMatchObject({
    slotId: 'trait:drawback',
    position: 0,
    catalogEntryId: 'reactionary',
  });
  await settle(lastCall('fillSelectionSlot'));
  view.rerender(
    selectionSheet({
      selections: [
        {
          id: 'reactionary-entry',
          key: 'reactionary',
          slot: ['trait:drawback', 0],
        },
      ],
    }),
  );
  const saved = row('Reactionary');
  const message = 'This slot normally holds a drawback.';
  expect(saved.getByText(message)).toBeVisible();
  fireEvent.click(saved.getByRole('button', { name: `Accept ${message}` }));
  expect(lastCall('accept').args).toMatchObject({
    check: 'traitSlotType',
    subject: 'reactionary-entry',
  });
});

test('a saved feat keeps its name, Level gained and Remove on the first line, with its description below and its order, Edit and Replace after', () => {
  const description = 'Trade melee accuracy for bonus damage.';
  renderSelections(
    withCatalogText(
      selectionSheet({ selections: [powerAttack] }),
      'power-attack',
      {
        description,
      },
    ),
  );
  const saved = row('Power Attack');
  const name = saved.getByRole('heading', { name: 'Power Attack' });
  const remove = saved.getByRole('button', { name: 'Remove Power Attack' });
  const firstLine = commonAncestor(name, remove);
  expect(firstLine).toContainElement(
    saved.getByRole('combobox', { name: 'Level gained' }),
  );
  const below = [
    saved.getByText(description),
    saved.getByText('Prerequisites: Str 13, base attack bonus +1.'),
    saved.getByText('Order 1 of 1'),
    saved.getByRole('button', { name: 'Edit Power Attack' }),
    saved.getByRole('button', { name: 'Replace Power Attack' }),
  ];
  for (const element of below) {
    expect(firstLine).not.toContainElement(element);
    expect(isBefore(firstLine, element)).toBe(true);
  }
  expect(isBefore(below[0]!, below[3]!)).toBe(true);
});

test('drawback guidance reads under its own label, never as a prerequisite, in the picker and on the saved row', () => {
  const guidance =
    'Record the chosen drawback and its narrative consequences in notes.';
  function expectOwnLabel(text: HTMLElement) {
    const paragraph = text.closest('p');
    if (!paragraph) throw new Error('Expected the guidance paragraph');
    expect(within(paragraph).getByText('Guidance')).toBeVisible();
    expect(paragraph).not.toHaveTextContent(/Prerequisites/);
  }
  const view = renderSelections(selectionSheet());
  fireEvent.click(
    slot('Drawback').getByRole('button', { name: 'Add a drawback' }),
  );
  const choose = picker(/Choose a drawback/);
  fireEvent.click(choose.getByRole('button', { name: 'Prepared drawback' }));
  const staged = within(
    choose.getByRole('group', { name: 'Drawback selection' }),
  );
  expectOwnLabel(staged.getByText(guidance));
  expect(staged.queryByText(/^Prerequisites:/)).toBeNull();
  fireEvent.click(choose.getByRole('button', { name: 'Close picker' }));

  view.rerender(
    selectionSheet({
      selections: [
        {
          id: 'drawback-entry',
          key: 'prepared-drawback',
          slot: ['trait:drawback', 0],
        },
      ],
    }),
  );
  const saved = row('Prepared drawback');
  expectOwnLabel(saved.getByText(guidance));
  expect(saved.queryByText(/^Prerequisites:/)).toBeNull();
  expect(saved.queryByRole('combobox', { name: 'Level gained' })).toBeNull();
  const firstLine = commonAncestor(
    saved.getByRole('heading', { name: 'Prepared drawback' }),
    saved.getByRole('button', { name: 'Remove Prepared drawback' }),
  );
  expect(firstLine).not.toContainElement(saved.getByText(guidance));
});

test('current and recorded-level warnings are separate and each Accept or Reopen changes only its own warning', async () => {
  const sheet = selectionSheet({ selections: [powerAttack] });
  const view = renderSelections(sheet);
  const saved = row('Power Attack');
  expect(saved.getAllByText('Prerequisites not met')).toHaveLength(2);
  const current = 'Power Attack: Strength 13 not met now.';
  const recorded = 'Power Attack: Strength 13 not met at level 1 as recorded.';
  expect(saved.getByText(current)).toBeVisible();
  const atLevel = within(
    saved.getByRole('group', { name: 'Prerequisites at recorded level 1' }),
  );
  expect(atLevel.getByText(recorded)).toBeVisible();
  expect(atLevel.queryByText(current)).toBeNull();
  expect(screen.queryByText(/ineligible/i)).toBeNull();

  fireEvent.click(atLevel.getByRole('button', { name: `Accept ${recorded}` }));
  const accept = lastCall('accept');
  expect(accept.args).toMatchObject({
    check: 'prerequisites.recordedLevel',
  });
  expect(
    saved.getByRole('button', { name: `Accept ${current}` }),
  ).toBeEnabled();
  await settle(accept);
  view.rerender(
    selectionSheet({
      selections: [powerAttack],
      accepted: [findCalculatedWarning(sheet, 'prerequisites.recordedLevel')],
    }),
  );
  expect(atLevel.getByText('Accepted')).toBeVisible();
  expect(
    saved.getByRole('button', { name: `Accept ${current}` }),
  ).toBeVisible();
  fireEvent.click(atLevel.getByRole('button', { name: `Reopen ${recorded}` }));
  expect(lastCall('reopen').args).toMatchObject({
    check: 'prerequisites.recordedLevel',
  });
});

test('a saved feat edits its choice without an order field, and undoing its level keeps only the current check', async () => {
  const view = renderSelections(selectionSheet({ selections: [powerAttack] }));
  const saved = row('Power Attack');
  expect(saved.getByText('Order 1 of 1')).toBeVisible();
  fireEvent.click(saved.getByRole('button', { name: 'Edit Power Attack' }));
  const editor = within(
    screen.getByRole('form', { name: 'Edit Power Attack' }),
  );
  expect(editor.queryByRole('textbox', { name: /order/i })).toBeNull();
  fireEvent.change(editor.getByRole('textbox', { name: /Choice for/ }), {
    target: { value: ' Longsword ' },
  });
  fireEvent.click(editor.getByRole('button', { name: 'Save Power Attack' }));
  await act(async () => undefined);
  expect(lastCall('editSelection').args).toMatchObject({
    entryId: 'power-attack-entry',
    choice: 'Longsword',
  });
  expect(lastCall('editSelection').args).not.toHaveProperty('notes');
  expect(lastCall('editSelection').args).not.toHaveProperty('choiceOrder');
  await settle(lastCall('editSelection'));
  expect(screen.queryByRole('form', { name: 'Edit Power Attack' })).toBeNull();
  expect(
    saved.getByRole('button', { name: 'Edit Power Attack' }),
  ).toHaveFocus();

  fireEvent.change(saved.getByRole('combobox', { name: 'Level gained' }), {
    target: { value: '' },
  });
  expect(lastCall('editSelection').args).toMatchObject({
    entryId: 'power-attack-entry',
    gainedAtClassLevel: null,
  });
  await settle(lastCall('editSelection'));
  view.rerender(
    selectionSheet({ selections: [{ ...powerAttack, level: undefined }] }),
  );
  expect(
    saved.queryByRole('group', { name: /Prerequisites at recorded level/ }),
  ).toBeNull();
  expect(
    within(saved.getByRole('group', { name: 'Prerequisites now' })).getByText(
      'Power Attack: Strength 13 not met now.',
    ),
  ).toBeVisible();
  expect(saved.queryByText(/^Order \d+ of/)).toBeNull();
  expect(
    saved.queryByRole('button', { name: /^Move Power Attack/ }),
  ).toBeNull();
});

test('Remove clears one slot and keeps the other rows, Replace refills a trait in place, and a Grant offers no ordinary removal', async () => {
  const selections: Selection[] = [
    powerAttack,
    { id: 'reactionary-entry', key: 'reactionary', slot: ['trait:general', 0] },
  ];
  const view = renderSelections(
    selectionSheet({ selections, grantedFeat: true }),
  );
  fireEvent.click(
    row('Power Attack').getByRole('button', { name: 'Remove Power Attack' }),
  );
  expect(lastCall('clearSelectionSlot').args).toMatchObject({
    entryId: 'power-attack-entry',
  });
  await settle(lastCall('clearSelectionSlot'));
  view.rerender(
    selectionSheet({ selections: selections.slice(1), grantedFeat: true }),
  );
  expect(screen.queryByRole('listitem', { name: 'Power Attack' })).toBeNull();
  expect(
    row('Reactionary').getByRole('heading', { name: 'Reactionary' }),
  ).toBeVisible();
  expect(
    slot('General feats').getByRole('button', { name: 'Add a feat' }),
  ).toHaveFocus();

  fireEvent.click(
    row('Reactionary').getByRole('button', { name: 'Replace Reactionary' }),
  );
  const choose = picker(/Replace Reactionary/);
  fireEvent.click(choose.getByRole('button', { name: 'Indomitable Faith' }));
  await submit(
    choose.getByRole('button', { name: 'Replace with Indomitable Faith' }),
  );
  expect(lastCall('fillSelectionSlot').args).toMatchObject({
    slotId: 'trait:general',
    position: 0,
    catalogEntryId: 'indomitable-faith',
  });

  const granted = row('Skill Focus');
  expect(granted.getByText('Prerequisites waived')).toBeVisible();
  expect(granted.queryByRole('button', { name: /Remove|Discard/ })).toBeNull();
  expect(
    granted.getByRole('button', { name: 'Edit Skill Focus' }),
  ).toBeVisible();
});

test('alignment and deity save through the sheet settings and refresh the prerequisite they meet', async () => {
  const selections: Selection[] = [
    { id: 'faithful-entry', key: 'faithful-strike', slot: ['feat:general', 0] },
  ];
  const view = renderSelections(
    selectionSheet({ selections, alignment: 'CE' }),
  );
  expect(
    row('Faithful Strike').getByText('Prerequisites not met'),
  ).toBeVisible();
  fireEvent.change(screen.getByRole('combobox', { name: 'Alignment' }), {
    target: { value: 'LG' },
  });
  expect(lastCall('settings').args).toMatchObject({
    settings: {},
    alignment: 'LG',
  });
  expect(screen.getByText('Saving…')).toBeVisible();
  await settle(lastCall('settings'));
  expect(screen.getByText('Alignment and deity saved.')).toBeVisible();
  view.rerender(selectionSheet({ selections, alignment: 'LG' }));
  expect(row('Faithful Strike').getByText('Prerequisites met')).toBeVisible();
  expect(
    screen.getByRole<HTMLSelectElement>('combobox', { name: 'Alignment' })
      .value,
  ).toBe('LG');

  const deity = screen.getByRole('textbox', { name: 'Deity' });
  fireEvent.change(deity, { target: { value: '  Iomedae ' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save deity' }));
  await act(async () => undefined);
  expect(lastCall('settings').args).toMatchObject({ deity: 'Iomedae' });
  await settle(lastCall('settings'));
  view.rerender(
    selectionSheet({ selections, alignment: 'LG', deity: 'Iomedae' }),
  );
  fireEvent.change(deity, { target: { value: '' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save deity' }));
  await act(async () => undefined);
  expect(lastCall('settings').args).toMatchObject({ deity: null });
  fireEvent.change(screen.getByRole('combobox', { name: 'Alignment' }), {
    target: { value: 'none' },
  });
});

test('a failed fill keeps the picker and its input for a retry, another player’s change is acknowledged, and another Character starts clean', async () => {
  const view = renderSelections(selectionSheet());
  fireEvent.click(
    slot('General feats').getByRole('button', { name: 'Add a feat' }),
  );
  const choose = picker(/Choose a feat/);
  fireEvent.change(choose.getByRole('searchbox', { name: 'Search feats' }), {
    target: { value: 'Skill Focus' },
  });
  fireEvent.click(choose.getByRole('button', { name: 'Skill Focus' }));
  fireEvent.change(choose.getByRole('textbox', { name: 'Choice' }), {
    target: { value: 'Perception' },
  });
  fireEvent.click(choose.getByRole('button', { name: 'Add Skill Focus' }));
  await act(async () => undefined);
  expect(choose.getByRole('button', { name: 'Saving…' })).toBeDisabled();
  expect(
    slot('Traits').getByRole('button', { name: 'Add a trait' }),
  ).toBeEnabled();
  await act(async () => {
    lastCall('fillSelectionSlot').reject(
      new ConvexError('Character is read only'),
    );
  });
  expect(choose.getByRole('alert')).toHaveTextContent(
    "Selection wasn't saved: Character is read only. Try again.",
  );
  expect(choose.getByRole('textbox', { name: 'Choice' })).toHaveValue(
    'Perception',
  );
  fireEvent.click(choose.getByRole('button', { name: 'Add Skill Focus' }));
  await act(async () => undefined);
  expect(
    calls.filter((call) => call.name === 'fillSelectionSlot'),
  ).toHaveLength(2);
  expect(lastCall('fillSelectionSlot').args).toMatchObject({
    choice: 'Perception',
  });

  view.rerender(
    selectionSheet({
      selections: [
        { id: 'dodge-entry', key: 'cleave', slot: ['feat:general', 1] },
      ],
      lastOperationId: 'another-player',
    }),
  );
  const notice = screen.getByText('Feats and traits changed.');
  expect(notice).toBeVisible();
  fireEvent.click(
    screen.getByRole('button', { name: 'Dismiss feats and traits update' }),
  );
  expect(screen.queryByText('Feats and traits changed.')).toBeNull();

  const other = 'character-2' as Id<'character'>;
  view.rerender(selectionSheet({ id: other }), other);
  expect(screen.queryByRole('group', { name: /Choose a feat/ })).toBeNull();
  expect(screen.queryByRole('alert')).toBeNull();
  expect(screen.queryByText('Saving…')).toBeNull();
});

test('off, dormant, kept and restored feats keep their state, and an exempt slot raises no prerequisite failure', async () => {
  const bonus: Selection = {
    id: 'bonus-entry',
    key: 'power-attack',
    slot: ['feat:level-1:0', 0],
    bonusFrom: 'level-1',
  };
  const view = renderSelections(
    selectionSheet({
      bonusSlot: { ignoresPrerequisites: true },
      selections: [{ ...powerAttack, key: 'cleave', active: false }, bonus],
    }),
  );
  const off = row('Cleave');
  expect(off.getByText('Off')).toBeVisible();
  fireEvent.click(off.getByRole('switch', { name: 'Cleave: off' }));
  expect(lastCall('editSelection').args).toMatchObject({
    entryId: 'power-attack-entry',
    active: true,
  });
  const exempt = within(
    slot('Fighter feats').getByRole('listitem', { name: 'Power Attack' }),
  );
  expect(exempt.getByText('Prerequisites waived')).toBeVisible();
  expect(exempt.queryByText(/not met/)).toBeNull();
  expect(exempt.queryByRole('button', { name: /^Accept/ })).toBeNull();

  // The fighter level goes: the bonus feat waits under Not counting now.
  const levels = [{ id: 'level-2', hp: 10, classId: 'wizard' as const }];
  view.rerender(
    selectionSheet({
      levels,
      bonusSlot: { ignoresPrerequisites: true },
      selections: [bonus],
    }),
  );
  expect(screen.queryByRole('group', { name: 'Fighter feats' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Not counting now (1)' }));
  const dormant = row('Power Attack');
  expect(dormant.getByText('Not counting now')).toBeVisible();
  expect(dormant.queryByText(/Prerequisites (not )?met/)).toBeNull();
  fireEvent.click(dormant.getByRole('button', { name: 'Keep Power Attack' }));
  expect(lastCall('setDormantEntryKept').args).toMatchObject({
    target: { entryId: 'bonus-entry' },
    kept: true,
  });
  await settle(lastCall('setDormantEntryKept'));
  view.rerender(
    selectionSheet({
      levels,
      bonusSlot: { ignoresPrerequisites: true },
      selections: [{ ...bonus, kept: true }],
    }),
  );
  expect(row('Power Attack').getByText('Kept')).toBeVisible();
  expect(
    row('Power Attack').getByRole('button', { name: 'Unkeep Power Attack' }),
  ).toBeVisible();

  view.rerender(
    selectionSheet({
      bonusSlot: { ignoresPrerequisites: true },
      selections: [bonus],
    }),
  );
  expect(
    slot('Fighter feats').getByRole('listitem', { name: 'Power Attack' }),
  ).toBeVisible();
  expect(screen.queryByRole('button', { name: /Not counting now/ })).toBeNull();
});

test('dense rows wrap long names and prose, keep touch-sized controls on the phone, and the picker opens and closes from the keyboard', () => {
  const long = 'Exceptionally Long Feat Name '.repeat(6).trim();
  const sheet = selectionSheet({ selections: [powerAttack] });
  renderSelections({
    ...sheet,
    catalogEntries: sheet.catalogEntries.map((entry) =>
      entry._id === 'power-attack' ? { ...entry, name: long } : entry,
    ),
    calculated: calculateCharacterSheet({
      entries: sheet.entries,
      catalogEntries: sheet.catalogEntries.map((entry) =>
        entry._id === 'power-attack' ? { ...entry, name: long } : entry,
      ),
      characterKind: 'pc',
    }),
  });
  const saved = row(long);
  expect(saved.getByRole('heading', { name: long }).className).toContain(
    '[overflow-wrap:anywhere]',
  );
  expect(saved.getByRole('switch').className).toContain('size-11');
  expect(
    saved.getByRole('button', { name: `Remove ${long}` }).className,
  ).toContain('size-11');
  const add = slot('Traits').getByRole('button', { name: 'Add a trait' });
  expect(add.className).toContain('min-h-11');

  add.focus();
  fireEvent.click(add, { detail: 0 });
  expect(add).toHaveAttribute('aria-expanded', 'true');
  const choose = picker(/Choose a trait/);
  const card = choose.getByRole('button', { name: 'Reactionary' });
  expect(card.className).toContain('min-h-11');
  card.focus();
  fireEvent.click(card, { detail: 0 });
  expect(card).toHaveAttribute('aria-pressed', 'true');
  fireEvent.keyDown(card, { key: 'Escape' });
  expect(screen.queryByRole('group', { name: /Choose a trait/ })).toBeNull();
  expect(add).toHaveFocus();
  expect(add).toHaveAttribute('aria-expanded', 'false');
});

// Within-level order and the separate prerequisite groups on every
// Selection row (#320): feats here, the other kinds in their own blocks.

type DatedKind = SelectableCatalogSheetEntryKind;
type DatedSelection = {
  id: string;
  kind: DatedKind;
  name: string;
  level?: string;
  order?: number;
  active?: boolean;
  prerequisites?: CatalogEntry['prerequisites'];
  /** Definitions this one grants, by catalog ID. */
  grants?: string[];
};

const raceCatalogId = 'sky-folk-catalog' as Id<'catalogEntry'>;
function datedDefinition(selection: DatedSelection): CatalogEntry {
  const details: Record<DatedKind, CatalogEntry['detail']> = {
    race: { kind: 'race', racialTraits: [] },
    racialTrait: {
      kind: 'racialTrait',
      raceEntryIds: [raceCatalogId],
      replaces: [],
    },
    archetype: { kind: 'archetype', classEntryIds: [], replaces: [], adds: [] },
    classFeature: { kind: 'classFeature' },
    feat: { kind: 'feat' },
    trait: { kind: 'trait' },
    manual: { kind: 'manual' },
    item: { kind: 'item', consumable: false },
    spell: { kind: 'spell' },
    spellEffect: {
      kind: 'spellEffect',
      lastsOverOneDay: false,
      defaultCasterLevel: 1,
    },
    condition: { kind: 'condition' },
  };
  return {
    ...selectionCatalog[0]!,
    _id: (selection.kind === 'race'
      ? raceCatalogId
      : `${selection.id}-catalog`) as Id<'catalogEntry'>,
    name: selection.name,
    ruleIdentity: `${selection.id}-rule`,
    modifiers: [],
    detail: details[selection.kind],
    prerequisites: selection.prerequisites ?? [],
    prerequisiteText: undefined,
    ...(selection.grants
      ? {
          grants: selection.grants.map((catalogEntryId) => ({
            catalogEntryId,
          })),
        }
      : {}),
  } as CatalogEntry;
}

function datedEntry(selection: DatedSelection): Entry {
  return {
    _id: selection.id as Id<'characterSheetEntry'>,
    _creationTime: 80,
    characterId,
    ...createCatalogSheetEntryState({ kind: selection.kind }),
    active: selection.active ?? true,
    catalogEntryId: datedDefinition(selection)._id,
    ...(selection.level ? { gainedAtClassLevel: selection.level } : {}),
    ...(selection.order !== undefined ? { choiceOrder: selection.order } : {}),
  } as Entry;
}

/** Feats and traits from `selectionSheet`, with other dated Selections. */
function mixedSheet({
  dated,
  definitions = [],
  ...options
}: Parameters<typeof selectionSheet>[0] & {
  dated: DatedSelection[];
  /** Definitions without an entry of their own, such as granted ones. */
  definitions?: CatalogEntry[];
}): CharacterSheetSnapshot {
  const sheet = selectionSheet(options);
  const entries = [...sheet.entries, ...dated.map(datedEntry)];
  const catalogEntries = [
    ...sheet.catalogEntries,
    ...dated.map(datedDefinition),
    ...definitions,
  ];
  const input = { entries, catalogEntries, characterKind: 'pc' as const };
  return {
    ...sheet,
    entries,
    catalogEntries,
    calculated: calculateCharacterSheet(input),
    permanentCalculated: calculateCharacterSheet(input, {
      permanentOnly: true,
    }),
  };
}

function renderBlocks(
  initial: CharacterSheetSnapshot,
  blocks: Parameters<typeof CharacterSheetBlocks>[0]['blocks'],
) {
  snapshot = initial;
  const view = render(<CharacterSheetBlocks blocks={blocks} />);
  return (next: CharacterSheetSnapshot) => {
    snapshot = next;
    view.rerender(<CharacterSheetBlocks blocks={blocks} />);
  };
}

const region = (name: string) => within(screen.getByRole('region', { name }));
const moveButton = (name: string, direction: 'earlier' | 'later') =>
  screen.getByRole('button', {
    name: `Move ${name} ${direction} at level 1`,
  });

const strength13 = [{ ability: 'strength' as const, min: 13 }];
const skyFolk: DatedSelection = {
  id: 'race-entry',
  kind: 'race',
  name: 'Sky folk',
};
const talent: DatedSelection = {
  id: 'talent-entry',
  kind: 'classFeature',
  name: 'Combat talent',
  level: 'level-1',
  order: 1,
  prerequisites: strength13,
};
const senses: DatedSelection = {
  id: 'senses-entry',
  kind: 'racialTrait',
  name: 'Keen senses',
  level: 'level-1',
  order: 2,
};

test('feat, class feature and racial trait rows at one level move earlier or later among each other, by button or Alt+Arrow, and keep focus', async () => {
  const sheet = (orders: [number, number, number]) =>
    mixedSheet({
      selections: [{ ...powerAttack, order: orders[0] }],
      dated: [
        skyFolk,
        { ...talent, order: orders[1] },
        { ...senses, order: orders[2] },
      ],
    });
  const rerender = renderBlocks(sheet([0, 1, 2]), [
    'races',
    'selections',
    'grants',
  ]);
  expect(moveButton('Power Attack', 'earlier')).toBeDisabled();
  expect(moveButton('Power Attack', 'later')).toBeEnabled();
  expect(row('Power Attack').getByText('Order 1 of 3')).toBeVisible();
  const talentRow = within(
    region('Class features').getByRole('listitem', { name: 'Combat talent' }),
  );
  expect(talentRow.getByText('Order 2 of 3')).toBeVisible();
  expect(moveButton('Combat talent', 'earlier')).toBeEnabled();
  expect(moveButton('Combat talent', 'later')).toBeEnabled();
  expect(
    region('Race').getByRole('button', {
      name: 'Move Keen senses earlier at level 1',
    }),
  ).toBeEnabled();
  expect(moveButton('Keen senses', 'later')).toBeDisabled();

  // Native buttons: touch, Enter and Space all activate them.
  const later = moveButton('Combat talent', 'later');
  expect(later.tagName).toBe('BUTTON');
  expect(later).toHaveAttribute('type', 'button');
  expect(later).toHaveAttribute('aria-keyshortcuts', 'Alt+ArrowDown');
  expect(later.className).toContain('size-11');
  expect(later.parentElement?.className).toContain('flex-wrap');
  later.focus();
  fireEvent.click(later);
  await act(async () => undefined);
  expect(calls.filter((call) => call.name === 'moveSelection')).toHaveLength(1);
  expect(lastCall('moveSelection').args).toMatchObject({
    entryId: 'talent-entry',
    direction: 'later',
  });
  await settle(lastCall('moveSelection'));
  rerender(sheet([0, 2, 1]));
  expect(talentRow.getByText('Order 3 of 3')).toBeVisible();
  expect(moveButton('Combat talent', 'later')).toBeDisabled();
  // The direction used is spent, so focus stays on the row's other button.
  expect(moveButton('Combat talent', 'earlier')).toHaveFocus();
  expect(region('Race').getByText('Order 2 of 3')).toBeVisible();

  const earlier = moveButton('Combat talent', 'earlier');
  fireEvent.keyDown(earlier, { key: 'ArrowUp' });
  fireEvent.keyDown(earlier, { key: 'ArrowDown', altKey: true });
  expect(calls.filter((call) => call.name === 'moveSelection')).toHaveLength(1);
  fireEvent.keyDown(earlier, { key: 'ArrowUp', altKey: true });
  await act(async () => undefined);
  expect(lastCall('moveSelection').args).toMatchObject({
    entryId: 'talent-entry',
    direction: 'earlier',
  });
  await settle(lastCall('moveSelection'));
  rerender(sheet([0, 1, 2]));
  expect(talentRow.getByText('Order 2 of 3')).toBeVisible();
  expect(moveButton('Combat talent', 'earlier')).toHaveFocus();
});

test('dated prerequisite inputs have order controls in their block while current undated facts and Grants have none', () => {
  const kinds = (
    [
      { ...skyFolk, level: 'level-1', order: 1 },
      { ...senses, order: 2 },
      { id: 'archetype-entry', kind: 'archetype', name: 'Sky warden' },
      talent,
      { id: 'manual-entry', kind: 'manual', name: 'Blessing' },
      { id: 'item-entry', kind: 'item', name: 'Lantern' },
      { id: 'spell-entry', kind: 'spell', name: 'Light' },
      { id: 'effect-entry', kind: 'spellEffect', name: 'Bless effect' },
      { id: 'condition-entry', kind: 'condition', name: 'Inspired' },
    ] satisfies DatedSelection[]
  ).map((selection, index) => ({
    level: 'level-1',
    order: index + 3,
    ...selection,
  }));
  const granted = {
    ...datedDefinition({
      id: 'granted',
      kind: 'classFeature',
      name: 'Granted training',
      prerequisites: strength13,
    }),
  };
  renderBlocks(
    mixedSheet({
      grantedFeat: true,
      selections: [
        { ...powerAttack, key: 'cleave', order: 0 },
        {
          id: 'reactionary-entry',
          key: 'reactionary',
          slot: ['trait:general', 0],
          level: 'level-1',
          order: 12,
        },
      ],
      dated: [
        ...kinds,
        {
          id: 'source-entry',
          kind: 'feat',
          name: 'Training source',
          level: 'level-1',
          order: 13,
          grants: [granted._id],
        },
      ],
      definitions: [granted],
    }),
    ['races', 'archetypes', 'selections', 'adjustments', 'entries', 'grants'],
  );
  for (const toggle of screen.queryAllByRole('button', {
    name: /^Not counting now/,
    expanded: false,
  }))
    fireEvent.click(toggle);
  const blocks: Record<string, string[]> = {
    Race: ['Keen senses'],
    Archetypes: ['Sky warden'],
    'Class features': ['Combat talent'],
    'Feats & traits': ['Cleave', 'Reactionary', 'Training source'],
    'Sheet entries': ['Light'],
  };
  for (const [block, names] of Object.entries(blocks)) {
    for (const name of names)
      expect(
        region(block).getByRole('button', {
          name: `Move ${name} later at level 1`,
        }),
      ).toBeInTheDocument();
  }
  const feats = region('Feats & traits');
  expect(
    feats.getAllByRole('button', { name: /^Move .* earlier at level 1$/ }),
  ).toHaveLength(3);
  expect(
    screen.getAllByRole('button', { name: /^Move .* later/ }),
  ).toHaveLength(7);

  for (const name of [
    'Sky folk',
    'Blessing',
    'Lantern',
    'Bless effect',
    'Inspired',
  ])
    expect(
      screen.queryByRole('button', { name: `Move ${name} later at level 1` }),
    ).toBeNull();

  // Granted rows take their source's place; they never move on their own.
  expect(feats.queryByRole('button', { name: /^Move Skill Focus/ })).toBeNull();
  const grantedRow = within(
    region('Class features').getByRole('listitem', {
      name: 'Granted training',
    }),
  );
  expect(
    grantedRow.getByRole('group', {
      name: 'Prerequisites at recorded level 1',
    }),
  ).toBeVisible();
  expect(
    grantedRow.getByRole('group', { name: 'Prerequisites now' }),
  ).toBeVisible();
  expect(grantedRow.queryByRole('button', { name: /^Move / })).toBeNull();
});

test('a level that is gone keeps only the current check without order controls, and relinking through Level gained restores the recorded group and place', async () => {
  const unplaced = { ...powerAttack, level: 'deleted-level' };
  const rerender = renderBlocks(
    mixedSheet({ selections: [unplaced], dated: [{ ...talent, order: 0 }] }),
    ['selections'],
  );
  const saved = row('Power Attack');
  expect(saved.getByText('Not tied to a level')).toBeVisible();
  expect(saved.getByRole('group', { name: 'Prerequisites now' })).toBeVisible();
  expect(
    saved.queryByRole('group', { name: /Prerequisites at recorded level/ }),
  ).toBeNull();
  expect(saved.queryByRole('button', { name: /^Move / })).toBeNull();
  expect(saved.queryByText(/^Order \d+ of/)).toBeNull();

  fireEvent.change(saved.getByRole('combobox', { name: 'Level gained' }), {
    target: { value: 'level-1' },
  });
  expect(lastCall('editSelection').args).toMatchObject({
    entryId: 'power-attack-entry',
    gainedAtClassLevel: 'level-1',
  });
  await settle(lastCall('editSelection'));
  rerender(
    mixedSheet({
      selections: [{ ...powerAttack, order: 1 }],
      dated: [{ ...talent, order: 0 }],
    }),
  );
  expect(
    saved.getByRole('group', { name: 'Prerequisites at recorded level 1' }),
  ).toBeVisible();
  expect(saved.getByText('Order 2 of 2')).toBeVisible();
  expect(moveButton('Power Attack', 'earlier')).toBeEnabled();
  expect(moveButton('Power Attack', 'later')).toBeDisabled();
});

test('class feature, racial trait and generic entry rows keep current and recorded groups apart, list each warning once, and accept each group alone', async () => {
  const feature = { ...talent, order: 0 };
  const lantern: DatedSelection = {
    id: 'item-entry',
    kind: 'item',
    name: 'Lantern',
    level: 'level-1',
    order: 1,
    prerequisites: strength13,
  };
  const keen = { ...senses, prerequisites: strength13 };
  const sheet = mixedSheet({ dated: [skyFolk, feature, lantern, keen] });
  const rerender = renderBlocks(sheet, ['races', 'grants', 'entries']);
  const racial = within(
    region('Race').getByRole('listitem', { name: 'Keen senses' }),
  );
  expect(
    within(racial.getByRole('group', { name: 'Prerequisites now' })).getByText(
      'Keen senses: Strength 13 not met now.',
    ),
  ).toBeVisible();
  expect(
    racial.getByRole('group', { name: 'Prerequisites at recorded level 1' }),
  ).toBeVisible();
  expect(
    racial.getAllByText('Keen senses: Strength 13 not met now.'),
  ).toHaveLength(1);
  const featureRow = within(
    region('Class features').getByRole('listitem', { name: 'Combat talent' }),
  );
  const current = 'Combat talent: Strength 13 not met now.';
  const recorded = 'Combat talent: Strength 13 not met at level 1 as recorded.';
  const now = within(
    featureRow.getByRole('group', { name: 'Prerequisites now' }),
  );
  const atLevel = within(
    featureRow.getByRole('group', {
      name: 'Prerequisites at recorded level 1',
    }),
  );
  expect(now.getByText(current)).toBeVisible();
  expect(
    now.getByRole('list', { name: 'Prerequisites now' }),
  ).toHaveTextContent('Strength 13 not met');
  expect(atLevel.getByText(recorded)).toBeVisible();
  expect(featureRow.getAllByText(current)).toHaveLength(1);
  expect(featureRow.getAllByText(recorded)).toHaveLength(1);
  const entry = region('Sheet entries');
  expect(entry.getByRole('group', { name: 'Prerequisites now' })).toBeVisible();
  expect(
    entry.getByRole('group', { name: 'Prerequisites at recorded level 1' }),
  ).toBeVisible();
  expect(entry.getAllByText('Lantern: Strength 13 not met now.')).toHaveLength(
    1,
  );

  fireEvent.click(atLevel.getByRole('button', { name: `Accept ${recorded}` }));
  expect(lastCall('accept').args).toMatchObject({
    check: 'prerequisites.recordedLevel',
  });
  expect(now.getByRole('button', { name: `Accept ${current}` })).toBeEnabled();
  expect(moveButton('Combat talent', 'later')).toBeEnabled();
  await settle(lastCall('accept'));
  const accepted = sheet.calculated.warnings.find(
    (warning) =>
      warning.check === 'prerequisites.recordedLevel' &&
      warning.target.kind === 'entry' &&
      warning.target.entryId === 'talent-entry',
  )!;
  rerender(
    mixedSheet({
      dated: [skyFolk, feature, lantern, keen],
      accepted: [
        {
          check: accepted.check,
          subject: accepted.subject,
          fingerprint: accepted.fingerprint,
        },
      ],
    }),
  );
  expect(atLevel.getByText('Accepted')).toBeVisible();
  expect(now.getByRole('button', { name: `Accept ${current}` })).toBeVisible();
  fireEvent.click(atLevel.getByRole('button', { name: `Reopen ${recorded}` }));
  expect(lastCall('reopen').args).toMatchObject({
    check: 'prerequisites.recordedLevel',
  });
  expect(screen.queryByText(/eligible/i)).toBeNull();
});

test('entry rules remain visible beside prerequisite groups while a dated feature can still move', async () => {
  const sheet = mixedSheet({
    selections: [{ ...powerAttack, order: 1 }],
    dated: [
      { ...talent, order: 0 },
      {
        id: 'item-entry',
        kind: 'item',
        name: 'Lantern',
        prerequisites: strength13,
      },
      {
        id: 'manual-entry',
        kind: 'manual',
        name: 'Blessing',
        prerequisites: strength13,
      },
    ],
  });
  const notes = new Map([
    ['talent-entry-catalog', 'Reroll a failed confirmation check.'],
    ['item-entry-catalog', 'Reveals invisible writing.'],
    ['manual-entry-catalog', 'Can always take 10 on this check.'],
    ['power-attack', 'Trade attack bonus for damage.'],
  ]);
  const catalogEntries = sheet.catalogEntries.map((entry) => {
    const text = notes.get(entry._id);
    return text ? { ...entry, situationalNotes: [{ text }] } : entry;
  });
  const input = {
    entries: sheet.entries,
    catalogEntries,
    characterKind: sheet.character.kind,
  };
  renderBlocks(
    {
      ...sheet,
      catalogEntries,
      calculated: calculateCharacterSheet(input),
      permanentCalculated: calculateCharacterSheet(input, {
        permanentOnly: true,
      }),
    },
    ['selections', 'grants', 'entries', 'adjustments'],
  );
  const powerAttackNote = 'Trade attack bonus for damage.';
  expect(screen.getAllByText(powerAttackNote)).toHaveLength(1);
  expect(
    within(screen.getByRole('listitem', { name: 'Power Attack' })).getByText(
      powerAttackNote,
    ),
  ).toBeVisible();
  const expectedNotes: [string, string][] = [
    ['Combat talent', 'Reroll a failed confirmation check.'],
    ['Lantern', 'Reveals invisible writing.'],
    ['Blessing', 'Can always take 10 on this check.'],
  ];
  for (const [name, text] of expectedNotes) {
    const saved = within(screen.getByRole('listitem', { name }));
    expect(saved.getByText(text)).toBeVisible();
    expect(
      saved.getByRole('group', { name: 'Prerequisites now' }),
    ).toBeVisible();
  }
  const feature = within(
    screen.getByRole('listitem', { name: 'Combat talent' }),
  );
  expect(
    feature.getByRole('group', { name: 'Prerequisites at recorded level 1' }),
  ).toBeVisible();
  fireEvent.click(moveButton('Combat talent', 'later'));
  await act(async () => undefined);
  expect(lastCall('moveSelection').args).toMatchObject({
    entryId: 'talent-entry',
    direction: 'later',
  });
  await settle(lastCall('moveSelection'));
});

test('a move waits only on its own row, reports a failure for a retry, and another player’s reorder refreshes the places with a dismissable notice', async () => {
  const sheet = (orders: [number, number], lastOperationId = 'seed') =>
    mixedSheet({
      lastOperationId,
      selections: [{ ...powerAttack, order: orders[0] }],
      dated: [{ ...talent, order: orders[1] }],
    });
  const rerender = renderBlocks(sheet([0, 1]), ['selections', 'grants']);
  const later = moveButton('Power Attack', 'later');
  fireEvent.click(later);
  await act(async () => undefined);
  expect(later).toBeDisabled();
  expect(row('Power Attack').getByText('Saving…')).toBeVisible();
  expect(moveButton('Combat talent', 'earlier')).toBeEnabled();
  fireEvent.click(later);
  expect(calls.filter((call) => call.name === 'moveSelection')).toHaveLength(1);
  await act(async () => {
    lastCall('moveSelection').reject(new ConvexError('Character is read only'));
  });
  expect(row('Power Attack').getByRole('alert')).toHaveTextContent(
    /Character is read only/,
  );
  expect(moveButton('Power Attack', 'later')).toBeEnabled();
  fireEvent.click(moveButton('Power Attack', 'later'));
  await act(async () => undefined);
  expect(calls.filter((call) => call.name === 'moveSelection')).toHaveLength(2);
  await settle(lastCall('moveSelection'));
  expect(row('Power Attack').getByText('Saved')).toBeVisible();

  const talentRow = within(
    region('Class features').getByRole('listitem', { name: 'Combat talent' }),
  );
  expect(talentRow.queryByText('Saved')).toBeNull();
  fireEvent.click(
    row('Power Attack').getByRole('button', { name: 'Edit Power Attack' }),
  );
  const choice = screen.getByRole('textbox', { name: /Choice for/ });
  fireEvent.change(choice, { target: { value: 'Draft' } });
  rerender(sheet([1, 0], 'another-player'));
  expect(screen.getByText('Feats and traits changed.')).toBeVisible();
  expect(row('Power Attack').getByText('Order 2 of 2')).toBeVisible();
  expect(talentRow.getByText('Order 1 of 2')).toBeVisible();
  expect(choice).toHaveValue('Draft');
  expect(choice).toHaveFocus();
  fireEvent.click(
    screen.getByRole('button', { name: 'Dismiss feats and traits update' }),
  );
  expect(screen.queryByText('Feats and traits changed.')).toBeNull();
});

test('maintenance disables every move with its reason while a rule mismatch leaves moves and Accept usable', () => {
  const sheet = mixedSheet({
    selections: [powerAttack],
    dated: [talent],
  });
  const rerender = renderBlocks(sheet, ['selections', 'grants']);
  expect(moveButton('Combat talent', 'earlier')).toBeEnabled();
  expect(
    screen.getAllByRole('button', { name: /^Accept Combat talent/ })[0],
  ).toBeEnabled();
  const message = 'Editing is paused for maintenance.';
  maintenance.mockReturnValue({ kind: 'maintenance', readOnly: true, message });
  rerender(sheet);
  for (const button of screen.getAllByRole('button', { name: /^Move / })) {
    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleDescription(message);
  }
  fireEvent.keyDown(moveButton('Combat talent', 'earlier'), {
    key: 'ArrowUp',
    altKey: true,
  });
  expect(calls.filter((call) => call.name === 'moveSelection')).toEqual([]);
});

test('a dormant racial trait keeps its Keep control and no prerequisite groups, and moving it neither keeps nor activates it', async () => {
  const dormant: DatedSelection = {
    ...senses,
    order: 1,
    prerequisites: strength13,
  };
  renderBlocks(mixedSheet({ selections: [powerAttack], dated: [dormant] }), [
    'races',
  ]);
  fireEvent.click(screen.getByRole('button', { name: 'Not counting now (1)' }));
  const trait = within(screen.getByRole('listitem', { name: 'Keen senses' }));
  expect(trait.getByText('Not counting now')).toBeVisible();
  expect(trait.getByRole('button', { name: 'Keep Keen senses' })).toBeVisible();
  expect(trait.queryByRole('group', { name: /^Prerequisites/ })).toBeNull();
  fireEvent.click(moveButton('Keen senses', 'earlier'));
  await act(async () => undefined);
  expect(calls.map((call) => call.name)).toEqual(['moveSelection']);
  expect(lastCall('moveSelection').args).toMatchObject({
    entryId: 'senses-entry',
    direction: 'earlier',
  });
});

test('an off Selection has no order controls and does not count among active neighbours', () => {
  renderBlocks(
    mixedSheet({
      selections: [
        powerAttack,
        {
          id: 'off-entry',
          key: 'reactionary',
          level: 'level-1',
          order: 1,
          active: false,
        },
      ],
      dated: [{ ...talent, order: 2 }],
    }),
    ['selections', 'grants'],
  );
  expect(row('Power Attack').getByText('Order 1 of 2')).toBeVisible();
  expect(region('Class features').getByText('Order 2 of 2')).toBeVisible();
  expect(
    screen.queryByRole('button', { name: /^Move Reactionary/ }),
  ).toBeNull();
});

// #753: an active Catalog Release's admitted feat lives on a global
// definition the Character's sheet doesn't hold. The read lists it among its
// catalog choices, projected through the release, and the general slot's
// picker offers it beside the representative feats and saves its global ID.
test('a release feat from the read’s catalog choices is offered in the general slot and saved by its global ID', async () => {
  const sheet = selectionSheet();
  const releaseFeat: CatalogEntry = {
    ...sheet.baseScoresEntry,
    _id: 'release-skill-focus' as Id<'catalogEntry'>,
    scope: 'global',
    characterId: undefined,
    name: 'Skill Focus (Acrobatics)',
    ruleIdentity: 'pf1-content/xgRstzkd1nDznrjH',
    description: 'You are particularly adept at your chosen skill.',
    modifiers: [
      {
        target: 'skill.acr',
        bonusType: 'untyped',
        value: { formula: '3 + 3 * min(1, floor(@skillRanks.acr / 10))' },
      },
    ],
    detail: { kind: 'feat', featTypes: ['General'], repeatable: 'unreviewed' },
  };
  renderSelections({
    ...sheet,
    catalogView: {
      releaseNumber: 1,
      calculationIdentity: catalogRuntimeCompatibility.calculation,
      resources: { castingTables: undefined },
      legalInputs: null,
      // The read lists the Character's own definitions too.
      definitions: [
        ...sheet.catalogEntries.filter((entry) => entry.scope === 'character'),
        releaseFeat,
      ],
      advisories: [],
    },
  });
  fireEvent.click(
    slot('General feats').getByRole('button', { name: 'Add a feat' }),
  );
  const choose = picker(/Choose a feat/);
  // The representative feats stay offered beside it.
  expect(choose.getByRole('button', { name: 'Power Attack' })).toBeVisible();
  fireEvent.change(choose.getByRole('searchbox', { name: 'Search feats' }), {
    target: { value: 'Skill Focus (Acrobatics)' },
  });
  fireEvent.click(
    within(choose.getByRole('list', { name: 'Feats' })).getByRole('button', {
      name: 'Skill Focus (Acrobatics)',
    }),
  );
  expect(
    choose.getByRole('group', { name: 'General feats selection' }),
  ).toBeVisible();
  await submit(
    choose.getByRole('button', { name: 'Add Skill Focus (Acrobatics)' }),
  );
  expect(lastCall('fillSelectionSlot').args).toMatchObject({
    slotId: 'feat:general',
    position: 0,
    catalogEntryId: 'release-skill-focus',
  });
});

test('Magical Lineage labels one spell, displays its benefit and permits an incomplete choice', async () => {
  const lineage: Selection = {
    id: 'lineage-entry',
    key: magicalLineage.ruleIdentity,
    slot: ['trait:general', 0],
  };
  const view = renderSelections(selectionSheet({ selections: [lineage] }));
  const saved = row('Magical Lineage');
  expect(saved.getByText('Incomplete: choose a spell.')).toBeVisible();
  expect(saved.getByText(magicalLineage.description)).toBeVisible();
  expect(
    saved.getByText('Apply the metamagic adjustment manually.'),
  ).toBeVisible();
  fireEvent.click(saved.getByRole('button', { name: 'Edit Magical Lineage' }));
  const editor = within(
    screen.getByRole('form', { name: 'Edit Magical Lineage' }),
  );
  const spell = editor.getByRole('textbox', {
    name: 'Chosen spell for Magical Lineage',
  });
  expect(editor.queryByRole('textbox', { name: /Spell ID/i })).toBeNull();
  fireEvent.change(spell, { target: { value: ' Fireball ' } });
  fireEvent.click(editor.getByRole('button', { name: 'Save Magical Lineage' }));
  await act(async () => undefined);
  expect(lastCall('editSelection').args).toMatchObject({
    entryId: 'lineage-entry',
    choice: 'Fireball',
  });
  await settle(lastCall('editSelection'));
  view.rerender(
    selectionSheet({ selections: [{ ...lineage, choice: 'Fireball' }] }),
  );
  expect(saved.getByText('Chosen spell: Fireball')).toBeVisible();
  expect(saved.queryByText('Incomplete: choose a spell.')).toBeNull();
  fireEvent.click(saved.getByRole('button', { name: 'Edit Magical Lineage' }));
  fireEvent.change(
    screen.getByRole('textbox', { name: 'Chosen spell for Magical Lineage' }),
    { target: { value: '  ' } },
  );
  fireEvent.click(screen.getByRole('button', { name: 'Save Magical Lineage' }));
  await act(async () => undefined);
  expect(lastCall('editSelection').args).toMatchObject({ choice: null });
  await settle(lastCall('editSelection'));
  view.rerender(selectionSheet({ selections: [lineage] }));
  expect(saved.getByText('Incomplete: choose a spell.')).toBeVisible();
});

test('a failed chosen-spell save keeps the draft, while clean remote edits and clearing remain visible', async () => {
  const lineage: Selection = {
    id: 'lineage-entry',
    key: magicalLineage.ruleIdentity,
    slot: ['trait:general', 0],
    choice: 'Magic Missile',
  };
  const view = renderSelections(selectionSheet({ selections: [lineage] }));
  fireEvent.click(
    row('Magical Lineage').getByRole('button', {
      name: 'Edit Magical Lineage',
    }),
  );
  const spell = () =>
    screen.getByRole('textbox', { name: 'Chosen spell for Magical Lineage' });
  view.rerender(
    selectionSheet({
      selections: [{ ...lineage, choice: 'Fireball' }],
      lastOperationId: 'another-player',
    }),
  );
  expect(spell()).toHaveValue('Fireball');
  expect(screen.getByText('Feats and traits changed.')).toBeVisible();
  fireEvent.change(spell(), { target: { value: 'Burning Hands' } });
  view.rerender(
    selectionSheet({
      selections: [{ ...lineage, choice: 'Light' }],
      lastOperationId: 'another-player-2',
    }),
  );
  expect(spell()).toHaveValue('Burning Hands');
  expect(row('Magical Lineage').getByText('Chosen spell: Light')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Save Magical Lineage' }));
  await act(async () => undefined);
  expect(
    screen.getByRole('button', { name: 'Saving… Magical Lineage' }),
  ).toBeDisabled();
  await act(async () => {
    lastCall('editSelection').reject(new ConvexError('Character is read only'));
  });
  expect(row('Magical Lineage').getByRole('alert')).toHaveTextContent(
    "Selection wasn't saved: Character is read only. Try again.",
  );
  expect(spell()).toHaveValue('Burning Hands');
  fireEvent.click(screen.getByRole('button', { name: 'Save Magical Lineage' }));
  await act(async () => undefined);
  expect(lastCall('editSelection').args).toMatchObject({
    choice: 'Burning Hands',
  });
  await settle(lastCall('editSelection'));
  view.rerender(
    selectionSheet({
      selections: [{ ...lineage, choice: undefined }],
      lastOperationId: 'remote-clear',
    }),
  );
  expect(
    row('Magical Lineage').getByText('Incomplete: choose a spell.'),
  ).toBeVisible();
});

test('a dormant Magical Lineage keeps chosen-spell wording, benefit and incomplete advisory until restored', () => {
  const source: Selection = {
    id: 'additional-entry',
    key: 'additional-traits',
    slot: ['feat:general', 0],
  };
  const slot = selectionSheet({
    selections: [source],
  }).calculated.selectionRules.slots.find(
    (slot) =>
      slot.kind === 'trait' &&
      slot.grantedBy?.kind === 'entry' &&
      slot.grantedBy.entryId === source.id,
  )!;
  const lineage: Selection = {
    id: 'lineage-entry',
    key: magicalLineage.ruleIdentity,
    slot: [slot.id, 0],
    bonusFrom: source.id,
  };
  const view = renderSelections(
    selectionSheet({ selections: [{ ...source, active: false }, lineage] }),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Not counting now (1)' }));
  const saved = row('Magical Lineage');
  expect(saved.getByText('Incomplete: choose a spell.')).toBeVisible();
  expect(saved.getByText(magicalLineage.description)).toBeVisible();
  expect(
    saved.getByText('Apply the metamagic adjustment manually.'),
  ).toBeVisible();
  fireEvent.click(saved.getByRole('button', { name: 'Edit Magical Lineage' }));
  expect(
    screen.getByRole('textbox', { name: 'Chosen spell for Magical Lineage' }),
  ).toHaveValue('');
  view.rerender(
    selectionSheet({
      selections: [source, { ...lineage, choice: 'Magic Missile' }],
    }),
  );
  expect(
    row('Magical Lineage').getByText('Chosen spell: Magic Missile'),
  ).toBeVisible();
});

function lineageEditorSheet(
  path: 'normal' | 'dormant' | 'kept',
  state: { choice?: string; notes?: string },
  lastOperationId = 'seed',
) {
  const source: Selection = {
    id: 'additional-entry',
    key: 'additional-traits',
    slot: ['feat:general', 0],
  };
  const extraSlot = selectionSheet({
    selections: [source],
  }).calculated.selectionRules.slots.find(
    (slot) =>
      slot.kind === 'trait' &&
      slot.grantedBy?.kind === 'entry' &&
      slot.grantedBy.entryId === source.id,
  )!;
  return selectionSheet({
    lastOperationId,
    selections: [
      ...(path === 'normal' ? [] : [{ ...source, active: false }]),
      {
        id: 'lineage-entry',
        key: magicalLineage.ruleIdentity,
        slot: path === 'normal' ? ['trait:general', 0] : [extraSlot.id, 0],
        ...(path === 'normal' ? {} : { bonusFrom: source.id }),
        kept: path === 'kept',
        ...state,
      },
    ],
  });
}

test.each(['normal', 'dormant', 'kept'] as const)(
  '%s Magical Lineage follows remote spell changes and clears without resubmitting choice on notes-only saves',
  async (path) => {
    const view = renderSelections(
      lineageEditorSheet(path, { choice: 'Magic Missile' }),
    );
    if (path === 'dormant') {
      fireEvent.click(
        screen.getByRole('button', { name: 'Not counting now (1)' }),
      );
    }
    for (const [index, choice] of ['Fireball', undefined].entries()) {
      fireEvent.click(
        row('Magical Lineage').getByRole('button', {
          name: 'Edit Magical Lineage',
        }),
      );
      const note = `Spell notes ${index}`;
      fireEvent.change(
        screen.getByRole('textbox', { name: 'Notes for Magical Lineage' }),
        {
          target: { value: note },
        },
      );
      view.rerender(lineageEditorSheet(path, { choice }, `remote-${index}`));
      expect(
        screen.getByRole('textbox', {
          name: 'Chosen spell for Magical Lineage',
        }),
      ).toHaveValue(choice ?? '');
      expect(
        screen.getByRole('textbox', { name: 'Notes for Magical Lineage' }),
      ).toHaveValue(note);
      await submit(
        screen.getByRole('button', { name: 'Save Magical Lineage' }),
      );
      const call = lastCall('editSelection');
      expect(call.args).toMatchObject({
        entryId: 'lineage-entry',
        notes: note,
      });
      expect(call.args).not.toHaveProperty('choice');
      await settle(call);
      view.rerender(
        lineageEditorSheet(path, { choice, notes: note }, `saved-${index}`),
      );
      expect(
        screen.getByRole('listitem', { name: 'Magical Lineage' }),
      ).toHaveTextContent(
        choice ? `Chosen spell: ${choice}` : 'Incomplete: choose a spell.',
      );
    }
  },
);

test.each(['normal', 'dormant', 'kept'] as const)(
  '%s Magical Lineage retains a deliberate spell draft and clear through remote notes, save failure and retry',
  async (path) => {
    const view = renderSelections(
      lineageEditorSheet(path, { choice: 'Magic Missile' }),
    );
    if (path === 'dormant') {
      fireEvent.click(
        screen.getByRole('button', { name: 'Not counting now (1)' }),
      );
    }
    for (const [index, draft] of ['Burning Hands', '  '].entries()) {
      fireEvent.click(
        row('Magical Lineage').getByRole('button', {
          name: 'Edit Magical Lineage',
        }),
      );
      const spell = () =>
        screen.getByRole('textbox', {
          name: 'Chosen spell for Magical Lineage',
        });
      fireEvent.change(spell(), { target: { value: draft } });
      const remote = {
        choice: index === 0 ? 'Fireball' : 'Light',
        notes: `Other member's notes ${index}`,
      };
      view.rerender(lineageEditorSheet(path, remote, `remote-${index}`));
      expect(spell()).toHaveValue(draft);
      expect(
        screen.getByRole('textbox', { name: 'Notes for Magical Lineage' }),
      ).toHaveValue(remote.notes);
      await submit(
        screen.getByRole('button', { name: 'Save Magical Lineage' }),
      );
      const failed = lastCall('editSelection');
      expect(failed.args).toMatchObject({
        entryId: 'lineage-entry',
        choice: draft.trim() || null,
      });
      expect(failed.args).not.toHaveProperty('notes');
      await act(async () => {
        failed.reject(new ConvexError('Character is read only'));
      });
      expect(row('Magical Lineage').getByRole('alert')).toHaveTextContent(
        "wasn't saved",
      );
      const later = { ...remote, choice: 'Haste', notes: 'Later notes' };
      view.rerender(lineageEditorSheet(path, later, `later-${index}`));
      expect(spell()).toHaveValue(draft);
      expect(
        screen.getByRole('textbox', { name: 'Notes for Magical Lineage' }),
      ).toHaveValue(later.notes);
      await submit(
        screen.getByRole('button', { name: 'Save Magical Lineage' }),
      );
      const retry = lastCall('editSelection');
      expect(retry.args).toMatchObject({
        entryId: 'lineage-entry',
        choice: draft.trim() || null,
      });
      expect(retry.args).not.toHaveProperty('notes');
      await settle(retry);
      view.rerender(
        lineageEditorSheet(
          path,
          { choice: draft.trim() || undefined, notes: later.notes },
          `saved-${index}`,
        ),
      );
    }
  },
);

test.each(['normal', 'dormant', 'kept'] as const)(
  '%s Magical Lineage retries only the notes draft after a failed save and a remote spell clear',
  async (path) => {
    const view = renderSelections(
      lineageEditorSheet(path, { choice: 'Magic Missile' }),
    );
    if (path === 'dormant') {
      fireEvent.click(
        screen.getByRole('button', { name: 'Not counting now (1)' }),
      );
    }
    fireEvent.click(
      row('Magical Lineage').getByRole('button', {
        name: 'Edit Magical Lineage',
      }),
    );
    fireEvent.change(
      screen.getByRole('textbox', { name: 'Notes for Magical Lineage' }),
      {
        target: { value: 'Keep this note' },
      },
    );
    await submit(screen.getByRole('button', { name: 'Save Magical Lineage' }));
    const failed = lastCall('editSelection');
    expect(failed.args).toMatchObject({ notes: 'Keep this note' });
    expect(failed.args).not.toHaveProperty('choice');
    await act(async () => {
      failed.reject(new ConvexError('Character is read only'));
    });
    view.rerender(lineageEditorSheet(path, {}, 'remote-clear'));
    expect(
      screen.getByRole('textbox', { name: 'Chosen spell for Magical Lineage' }),
    ).toHaveValue('');
    expect(
      screen.getByRole('textbox', { name: 'Notes for Magical Lineage' }),
    ).toHaveValue('Keep this note');
    await submit(screen.getByRole('button', { name: 'Save Magical Lineage' }));
    const retry = lastCall('editSelection');
    expect(retry.args).toMatchObject({ notes: 'Keep this note' });
    expect(retry.args).not.toHaveProperty('choice');
    await settle(retry);
    expect(
      screen.queryByRole('form', { name: 'Edit Magical Lineage' }),
    ).toBeNull();
  },
);
