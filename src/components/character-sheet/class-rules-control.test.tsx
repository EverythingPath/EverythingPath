import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { ConvexError } from 'convex/values';
import { beforeEach, expect, test, vi } from 'vitest';
import type { MigrationMaintenance } from '~/components/use-initial-migration-maintenance';
import { CharacterSheetBlocks } from './character-sheet-blocks-test-fixture';
import {
  buildSheet,
  emptyOwnerCandidates,
  monkClassCatalog,
  withClasses,
  type Accepted,
  type ClassKey,
  type ExtraClass,
  type Level,
} from './character-sheet-test-fixture';
import {
  campaignFighter,
  campaignRogue,
  campaignUnchainedRogue,
  fighterSheetWithAcceptedHp as withAcceptedHp,
  fighterVersionSheet as fighterSheet,
  homebrewFighter,
  rogueVersionSheet as rogueSheet,
} from './class-version-test-fixture';
import type { CharacterSheetSnapshot } from './use-character-sheet';
import { characterSheetNames } from './character-sheet-api-test-fixture';
import type { FunctionReference } from 'convex/server';
import { api } from '@convex/_generated/api';
import { representativeArchetypeCatalog } from '@convex/lib/representativeArchetypeCatalog';
import {
  incrementEntries,
  reviewedSchedule,
  scheduleRows,
} from '../../../scripts/catalog/pcgen/schedules';
import type { CharacterSheetCatalogEntry } from '~/lib/character-sheet';
import {
  acrobatCatalog,
  foundryRogue,
  foundryUnchainedRogue,
} from './acrobat-test-fixture';

// The rules every level of a class follows (#583, #406): one "Rules used"
// control on the class's first level, its chooser listing every version
// and every Catalog Copy with the preview of what is kept and recalculated,
// one write for all the levels, and the feedback beside the control.

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
const nameOf = characterSheetNames({
  editLevel: api.characterSheet.editClassLevel,
});
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

const mixedMessage =
  'Original and Unchained versions of the same class are both present.';

const page = () => <CharacterSheetBlocks blocks={['levels']} />;
function renderSheet(initial: CharacterSheetSnapshot) {
  snapshot = initial;
  const view = render(page());
  return {
    show(next: CharacterSheetSnapshot) {
      snapshot = next;
      view.rerender(page());
    },
  };
}
const row = (level: number) =>
  screen.getByRole('listitem', { name: `Level ${level}` });
const levelsRegion = () => screen.getByRole('region', { name: 'Class Levels' });
const rulesButton = (level: number) =>
  within(row(level)).getByRole('button', { name: /^Rules used: / });
const rulesButtons = () =>
  within(levelsRegion()).queryAllByRole('button', { name: /^Rules used: / });
const classPicker = (level: number) =>
  within(row(level)).getByRole('combobox', { name: `Class at level ${level}` });
const chooser = () => within(screen.getByRole('dialog'));
const option = (name: string) => chooser().getByRole('radio', { name });
const optionLabels = () =>
  chooser()
    .getAllByRole('radio')
    .map((radio) => radio.getAttribute('aria-label'));
const switchAll = (className: string) =>
  chooser().getByRole('button', { name: `Switch all ${className} levels` });
const hpInput = (level: number) =>
  within(row(level)).getByRole('textbox', {
    name: `Hit points gained at level ${level}`,
  });
function lastCall() {
  const call = calls.at(-1);
  if (!call) throw new Error('Expected a write');
  return call;
}
const operationOf = (call: Call) => String(call.args.operationId);

beforeEach(() => {
  calls = [];
  snapshot = undefined;
  maintenance.mockReturnValue({ kind: 'ready', readOnly: false, message: '' });
  window.matchMedia = vi.fn().mockReturnValue({
    matches: true,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  });
});

test('the control sits once on the first level of its class, hidden for a class with one choice, and lists both versions and every copy in order with the one in use checked', () => {
  const levels: Level[] = [
    { id: 'a', hp: 8, classId: 'rogue' },
    { id: 'b', hp: 10, classId: 'fighter' },
    { id: 'c', hp: null },
    { id: 'd', hp: 7, classId: 'rogue' },
  ];
  renderSheet(
    rogueSheet({ levels, copies: [campaignRogue, campaignUnchainedRogue] }),
  );
  expect(rulesButtons()).toHaveLength(1);
  expect(rulesButton(1)).toHaveTextContent('Rules used: Rogue');
  expect(rulesButton(1)).toHaveAccessibleDescription('Change all Rogue levels');
  for (const level of [2, 3, 4])
    expect(
      within(row(level)).queryByRole('button', { name: /^Rules used: / }),
    ).not.toBeInTheDocument();
  expect(within(levelsRegion()).getAllByText(/^Change all/)).toHaveLength(1);

  fireEvent.click(rulesButton(1));
  expect(
    chooser().getByRole('radiogroup', { name: 'Rules of Rogue' }),
  ).toBeVisible();
  expect(
    chooser().getByText(
      'Every Rogue level follows the same version and the same copy of it. Nothing changes until you switch.',
    ),
  ).toBeVisible();
  expect(optionLabels()).toEqual([
    'Rogue',
    'Rogue (campaign)',
    'Rogue (Unchained)',
    'Rogue (Unchained) (campaign)',
  ]);
  expect(option('Rogue')).toBeChecked();
  expect(option('Rogue')).toHaveAccessibleDescription('global catalog In use');
  expect(option('Rogue (campaign)')).toHaveAccessibleDescription(
    'campaign version',
  );
  expect(option('Rogue (Unchained)')).toHaveAccessibleDescription(
    'global catalog',
  );
  expect(option('Rogue (Unchained) (campaign)')).toHaveAccessibleDescription(
    'campaign',
  );
  expect(
    chooser().queryByRole('button', { name: /^Switch all/ }),
  ).not.toBeInTheDocument();
  expect(calls).toEqual([]);
});

test('a version card previews the switch; Switch all writes once for every Rogue level, closes the chooser, keeps focus on the trigger and reports saved there', async () => {
  const view = renderSheet(rogueSheet());
  const trigger = rulesButton(1);
  fireEvent.click(trigger);
  fireEvent.click(option('Rogue (Unchained)'));
  expect(option('Rogue (Unchained)')).toBeChecked();
  expect(
    chooser().getByText(
      'All 2 Rogue levels keep their hit points, skill ranks, favored class bonuses, ability increases and choices.',
    ),
  ).toBeVisible();
  expect(chooser().getByText('Changes')).toBeVisible();
  expect(calls).toEqual([]);

  fireEvent.click(switchAll('Rogue'));
  await waitFor(() => expect(calls).toHaveLength(1));
  expect(lastCall()).toMatchObject({
    name: 'switchClassVersion',
    args: { entryId: 'a', classEntryId: 'unchained-rogue' },
  });
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  await waitFor(() => expect(trigger).toHaveFocus());
  expect(within(row(1)).getByText('Saving…')).toBeVisible();
  expect(trigger).toHaveAttribute('aria-disabled', 'true');
  expect(trigger).toHaveTextContent('Rules used: Rogue');
  fireEvent.click(trigger);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

  view.show(
    rogueSheet({
      classOf: { a: 'unchained-rogue', b: 'unchained-rogue' },
      lastOperationId: operationOf(lastCall()),
    }),
  );
  await act(async () => {
    lastCall().resolve(null);
  });
  expect(within(row(1)).getByText('Class version saved.')).toBeVisible();
  expect(trigger).toHaveFocus();
  expect(rulesButtons()).toHaveLength(1);
  expect(rulesButton(1)).toHaveTextContent('Rules used: Rogue (Unchained)');
  for (const [level, id, hp] of [
    [1, 'a', '8'],
    [2, 'b', '7'],
  ] as const) {
    expect(row(level)).toHaveAttribute('id', `sheet-level-${id}`);
    expect(classPicker(level)).toHaveTextContent('Rogue (Unchained)');
    expect(hpInput(level)).toHaveValue(hp);
  }
  expect(calls).toHaveLength(1);
  expect(
    within(levelsRegion()).queryByText(/^Class (Levels|versions) updated/),
  ).not.toBeInTheDocument();
});

test('a copy card previews what is kept; from the campaign copy, choosing the global Fighter asks for exactly that one, not the campaign preference', async () => {
  const view = renderSheet(withAcceptedHp());
  fireEvent.click(rulesButton(1));
  expect(optionLabels()).toEqual(['Fighter', 'Fighter (campaign)']);
  fireEvent.click(option('Fighter (campaign)'));
  expect(
    chooser().getByText(
      'All 2 Fighter levels keep their hit points, skill ranks, favored class bonuses, ability increases and choices.',
    ),
  ).toBeVisible();
  expect(chooser().queryByText(/Spells and casting/)).not.toBeInTheDocument();
  expect(chooser().getByText('Totals stay the same.')).toBeVisible();
  expect(
    chooser().getByText('1 accepted warning stays accepted'),
  ).toBeVisible();
  expect(chooser().queryByText('Stops counting')).not.toBeInTheDocument();
  fireEvent.click(switchAll('Fighter'));
  await waitFor(() => expect(calls).toHaveLength(1));
  expect(lastCall()).toMatchObject({
    name: 'switchClassVersion',
    args: { entryId: 'a', classEntryId: 'fighter-campaign' },
  });
  view.show(
    withAcceptedHp({
      classOf: { a: 'fighter-campaign', b: 'fighter-campaign' },
      lastOperationId: operationOf(lastCall()),
    }),
  );
  await act(async () => {
    lastCall().resolve(null);
  });
  expect(rulesButton(1)).toHaveTextContent('Rules used: Fighter (campaign)');

  fireEvent.click(rulesButton(1));
  expect(option('Fighter (campaign)')).toBeChecked();
  expect(option('Fighter (campaign)')).toHaveAccessibleDescription(
    'campaign version In use',
  );
  fireEvent.click(option('Fighter'));
  expect(switchAll('Fighter')).toBeVisible();
  fireEvent.click(switchAll('Fighter'));
  await waitFor(() => expect(calls).toHaveLength(2));
  expect(lastCall().args).toMatchObject({
    entryId: 'a',
    classEntryId: 'fighter',
  });
});

test('a refused switch keeps the saved rules shown with its reason and Retry, which asks for the same definition again from the same control', async () => {
  const view = renderSheet(fighterSheet());
  const trigger = rulesButton(1);
  fireEvent.click(trigger);
  fireEvent.click(option('Fighter (campaign)'));
  fireEvent.click(switchAll('Fighter'));
  await waitFor(() => expect(calls).toHaveLength(1));
  await act(async () => {
    lastCall().reject(new ConvexError('Editing is paused'));
  });
  expect(within(row(1)).getByRole('alert')).toHaveTextContent(
    "Class version wasn't saved: Editing is paused. Try again.",
  );
  expect(trigger).toHaveTextContent('Rules used: Fighter');
  expect(trigger).not.toHaveAttribute('aria-disabled');
  expect(within(row(2)).queryByRole('alert')).not.toBeInTheDocument();

  fireEvent.click(
    within(row(1)).getByRole('button', { name: 'Retry rules of Fighter' }),
  );
  await waitFor(() => expect(calls).toHaveLength(2));
  expect(lastCall().args).toMatchObject({
    entryId: 'a',
    classEntryId: 'fighter-campaign',
  });
  view.show(
    fighterSheet({
      classOf: { a: 'fighter-campaign', b: 'fighter-campaign' },
      lastOperationId: operationOf(lastCall()),
    }),
  );
  await act(async () => {
    lastCall().resolve(null);
  });
  expect(within(row(1)).getByText('Class version saved.')).toBeVisible();
  expect(within(row(1)).queryByRole('alert')).not.toBeInTheDocument();
  expect(
    within(row(1)).queryByRole('button', { name: /Retry/ }),
  ).not.toBeInTheDocument();
});

test('the preview names the totals that change, the entry that stops counting and the accepted warning that reopens or clears; from the homebrew, the entry counts again; Cancel writes nothing', () => {
  const copies = [campaignFighter, homebrewFighter];
  const reopening: Level[] = [
    { id: 'a', hp: 10, classId: 'fighter' },
    { id: 'b', hp: 13, classId: 'fighter' },
  ];
  const view = renderSheet(withAcceptedHp({ levels: reopening, copies }));
  fireEvent.click(rulesButton(1));
  expect(optionLabels()).toEqual([
    'Fighter',
    'Fighter (campaign)',
    'Fighter (this Character)',
  ]);
  expect(option('Fighter (this Character)')).toHaveAccessibleDescription(
    'this Character',
  );
  fireEvent.click(option('Fighter (this Character)'));
  expect(chooser().getByText('BAB +2 → +1')).toBeVisible();
  expect(chooser().queryByText('Totals stay the same.')).toBeNull();
  expect(chooser().getByText('Stops counting')).toBeVisible();
  expect(chooser().getByText('Bravery +1')).toBeVisible();
  expect(
    chooser().getByText(
      'Kept with its choices and notes; it counts again if you switch back.',
    ),
  ).toBeVisible();
  expect(
    chooser().getByText(
      (_, element) =>
        element?.tagName === 'LI' &&
        element.textContent ===
          'Hit points gained exceed the d10 maximum: will need accepting again',
    ),
  ).toBeVisible();
  expect(chooser().queryByText(/stays? accepted/)).toBeNull();
  expect(chooser().queryByText('Counts again')).toBeNull();
  fireEvent.click(chooser().getByRole('button', { name: 'Cancel' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(calls).toEqual([]);

  // 11 HP no longer exceeds a d12, so the acceptance no longer applies.
  const clearing: Level[] = [
    { id: 'a', hp: 10, classId: 'fighter' },
    { id: 'b', hp: 11, classId: 'fighter' },
  ];
  view.show(withAcceptedHp({ levels: clearing, copies }));
  fireEvent.click(rulesButton(1));
  fireEvent.click(option('Fighter (this Character)'));
  expect(
    chooser().getByText(
      (_, element) =>
        element?.tagName === 'LI' &&
        element.textContent ===
          'Hit points gained exceed the d10 maximum: no longer applies',
    ),
  ).toBeVisible();
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });

  // From the homebrew, the seeded Fighter brings Bravery back.
  view.show(
    fighterSheet({
      copies,
      classOf: { a: 'fighter-homebrew', b: 'fighter-homebrew' },
    }),
  );
  expect(rulesButton(1)).toHaveTextContent(
    'Rules used: Fighter (this Character)',
  );
  fireEvent.click(rulesButton(1));
  expect(option('Fighter (this Character)')).toBeChecked();
  fireEvent.click(option('Fighter'));
  expect(chooser().getByText('BAB +1 → +2')).toBeVisible();
  expect(chooser().getByText('Counts again')).toBeVisible();
  expect(chooser().getByText('Bravery +1')).toBeVisible();
  expect(chooser().queryByText('Stops counting')).toBeNull();
  expect(calls).toEqual([]);
});

test('maintenance disables the control, described by the one reason beside Level up; the phone opens the chooser as a bottom sheet with a 44px trigger and 44px cards', () => {
  const message = 'Editing is paused for maintenance.';
  maintenance.mockReturnValue({ kind: 'maintenance', readOnly: true, message });
  const view = renderSheet(fighterSheet());
  expect(rulesButton(1)).toBeDisabled();
  expect(rulesButton(1)).toHaveAccessibleDescription(
    `Change all Fighter levels ${message}`,
  );
  expect(within(levelsRegion()).getAllByText(message)).toHaveLength(1);
  fireEvent.click(rulesButton(1));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(calls).toEqual([]);

  maintenance.mockReturnValue({ kind: 'ready', readOnly: false, message: '' });
  window.matchMedia = vi.fn().mockReturnValue({
    matches: false,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  });
  view.show(fighterSheet());
  expect(rulesButton(1)).toHaveClass('min-h-11');
  fireEvent.click(rulesButton(1));
  expect(screen.getByRole('dialog')).toHaveAttribute('data-side', 'bottom');
  for (const radio of chooser().getAllByRole('radio'))
    expect(radio).toHaveClass('min-h-11');
  expect(calls).toEqual([]);
});

test('another player’s switch is announced once for the section and shows in the control; an ordinary changed row choice retains its own notice', () => {
  const first: Level = {
    id: 'a',
    hp: 8,
    classId: 'rogue',
    abilityIncrease: null,
  };
  const second: Level = {
    id: 'b',
    hp: 7,
    classId: 'rogue',
    abilityIncrease: null,
  };
  const view = renderSheet(rogueSheet({ levels: [first, second] }));
  expect(rulesButton(1)).toHaveTextContent('Rules used: Rogue');
  view.show(
    rogueSheet({
      levels: [{ ...first, abilityIncrease: 'dexterity' }, second],
      classOf: { a: 'unchained-rogue', b: 'unchained-rogue' },
      lastOperationId: 'other-player',
    }),
  );
  expect(classPicker(1)).toHaveTextContent('Rogue (Unchained)');
  expect(rulesButton(1)).toHaveTextContent('Rules used: Rogue (Unchained)');
  expect(
    within(levelsRegion()).getAllByText(/^Class (Levels|versions) updated/),
  ).toHaveLength(1);
  expect(
    screen.getAllByText('Updated by another player.', { exact: true }),
  ).toHaveLength(1);
  expect(
    within(row(1)).getByText('Updated by another player.', { exact: true }),
  ).toBeVisible();
  fireEvent.click(
    within(levelsRegion()).getByRole('button', {
      name: 'Dismiss Class Levels update',
    }),
  );
  expect(
    within(levelsRegion()).queryByText(/^Class (Levels|versions) updated/),
  ).not.toBeInTheDocument();
  expect(calls).toEqual([]);
});

test('mixed versions warn beside the Class Levels with Accept and Reopen; the warning never disables the rules switch or a class choice', async () => {
  const view = renderSheet(rogueSheet({ classOf: { b: 'unchained-rogue' } }));
  expect(within(levelsRegion()).getByText(mixedMessage)).toBeVisible();
  expect(rulesButtons()).toHaveLength(1);
  expect(rulesButton(1)).toHaveTextContent('Rules used: Rogue');
  expect(rulesButton(1)).toBeEnabled();
  for (const level of [1, 2]) expect(classPicker(level)).toBeEnabled();
  fireEvent.click(
    within(levelsRegion()).getByRole('button', { name: 'Accept' }),
  );
  await waitFor(() => expect(calls).toHaveLength(1));
  const accept = lastCall();
  expect(accept).toMatchObject({
    name: 'accept',
    args: { check: 'classVersions' },
  });
  view.show(
    rogueSheet({
      classOf: { b: 'unchained-rogue' },
      lastOperationId: operationOf(accept),
      accepted: [
        {
          check: 'classVersions',
          subject: String(accept.args.subject),
          fingerprint: String(accept.args.fingerprint),
        },
      ],
    }),
  );
  await act(async () => {
    accept.resolve(null);
  });
  expect(within(levelsRegion()).getByText('Accepted')).toBeVisible();
  expect(
    within(levelsRegion()).getByRole('button', { name: 'Reopen' }),
  ).toBeEnabled();
  expect(rulesButton(1)).toBeEnabled();
});

type Entry = CharacterSheetSnapshot['entries'][number];

/**
 * An Unchained Monk level with the seeded Zen Archer (APG p. 115), an
 * original Monk Archetype ("with the exception of the monk", Pathfinder
 * Unchained p. 8). Seeded classes and Archetype only.
 */
function zenArcherSheet(accepted: Accepted[] = []) {
  const zenArcher = representativeArchetypeCatalog.find(
    (seed) => seed.ruleIdentity === 'monk-zen-archer',
  );
  if (!zenArcher) throw new Error('Missing Zen Archer');
  const base = buildSheet({
    levels: [{ id: 'a', hp: 10, classId: 'monk' }],
    hasRaces: true,
    extraCatalog: [...monkClassCatalog(), zenArcher],
    accepted,
  });
  const selection = {
    _id: 'zen-archer-row',
    _creationTime: 60,
    characterId: base.character._id,
    kind: 'archetype',
    active: true,
    catalogEntryId: 'monk-zen-archer',
    state: { kind: 'archetype' },
  } as unknown as Entry;
  return withClasses({ ...base, entries: [...base.entries, selection] }, [], {
    a: 'unchained-monk',
  });
}

test('an original Monk Archetype on the Unchained Monk warns verbatim at its Archetype, is accepted alone, and disables nothing', async () => {
  snapshot = zenArcherSheet();
  const view = render(
    <CharacterSheetBlocks blocks={['levels', 'archetypes']} />,
  );
  const archetypes = within(screen.getByRole('region', { name: 'Archetypes' }));
  const monk = archetypes.getByText(
    "Zen Archer was written for the original class and cannot automatically replace this class's features.",
  );
  expect(monk).toBeVisible();
  expect(
    within(levelsRegion()).queryByText(mixedMessage),
  ).not.toBeInTheDocument();

  fireEvent.click(
    archetypes.getByRole('button', {
      name: 'Accept',
      description: /Zen Archer was written/,
    }),
  );
  await waitFor(() => expect(calls).toHaveLength(1));
  const accept = lastCall();
  expect(accept).toMatchObject({
    name: 'accept',
    args: { check: 'archetypeUnchainedMonk' },
  });
  snapshot = zenArcherSheet([
    {
      check: 'archetypeUnchainedMonk',
      subject: String(accept.args.subject),
      fingerprint: String(accept.args.fingerprint),
    },
  ]);
  view.rerender(<CharacterSheetBlocks blocks={['levels', 'archetypes']} />);
  await act(async () => {
    accept.resolve(null);
  });
  expect(
    archetypes.getByRole('button', {
      name: 'Reopen',
      description: /Zen Archer was written/,
    }),
  ).toBeEnabled();
  expect(classPicker(1)).toBeEnabled();
  expect(rulesButton(1)).toHaveTextContent('Rules used: Monk (Unchained)');
  expect(rulesButton(1)).toBeEnabled();
});

/** A reviewed schedule's rows and their increment entries. */
function readReviewedRows(className: string) {
  const schedule = reviewedSchedule(className);
  if (!schedule) throw new Error(`No reviewed ${className} schedule`);
  return {
    features: scheduleRows(schedule).map(({ classLevel, externalKey }) => ({
      classLevel,
      catalogEntryId: externalKey,
    })),
    increments: incrementEntries(schedule).map(
      ({ externalKey, name, detail }) =>
        ({
          _id: externalKey,
          ruleIdentity: externalKey,
          name,
          modifiers: [],
          detail,
        }) as CharacterSheetCatalogEntry,
    ),
  };
}
/** The CRB Rogue's rows (P5's reviewed schedule). */
const rogue = readReviewedRows('Rogue');
/** The Unchained Rogue's rows (P7b's reviewed schedule). */
const unchainedRogue = readReviewedRows('Rogue (Unchained)');
/** The campaign's copy of Foundry's Rogue (Unchained), not its preference. */
const campaignFoundryUnchainedRogue: ExtraClass = {
  id: 'foundry-unchained-rogue-campaign',
  name: 'Rogue (Unchained)',
  like: foundryUnchainedRogue as ClassKey,
  copy: { scope: 'campaign' },
};

/**
 * #583, restored by #716: APG Acrobat on Foundry's Rogue (Unchained) at the
 * first level, beside the seeded Zen Archer on the Unchained Monk at the
 * second, each on its reviewed schedule (P5's Rogue, P7b's Rogue (Unchained)).
 * Acrobat replaces trapfinding, which both rogues have at 1st level, and trap
 * sense, which the Unchained rogue doesn't have (its 3rd-level row is danger
 * sense), so the compatible counterpart leaves that replacement unmatched.
 * `rogueClass` is the first level's class.
 */
function acrobatSheet({
  accepted = [],
  rogueClass = foundryUnchainedRogue,
}: {
  accepted?: Accepted[];
  rogueClass?: string;
} = {}) {
  const zenArcher = representativeArchetypeCatalog.find(
    (seed) => seed.ruleIdentity === 'monk-zen-archer',
  );
  if (!zenArcher) throw new Error('Missing Zen Archer');
  const base = buildSheet({
    levels: [
      { id: 'a', hp: 8, classId: 'rogue' },
      { id: 'b', hp: 10, classId: 'monk' },
    ],
    hasRaces: true,
    extraCatalog: [
      ...monkClassCatalog(),
      zenArcher,
      ...acrobatCatalog,
      ...rogue.increments,
      ...unchainedRogue.increments,
    ],
    accepted,
  });
  const selection = (id: string, catalogEntryId: string) =>
    ({
      _id: id,
      _creationTime: 60,
      characterId: base.character._id,
      kind: 'archetype',
      active: true,
      catalogEntryId,
      state: { kind: 'archetype' },
    }) as unknown as Entry;
  const foundry = withClasses(
    {
      ...base,
      entries: [
        ...base.entries,
        selection('acrobat-row', 'everythingpath/rogue-acrobat'),
        selection('zen-archer-row', 'monk-zen-archer'),
      ],
    },
    [
      {
        id: foundryRogue,
        name: 'Rogue',
        like: 'rogue',
        detail: { featuresByLevel: rogue.features },
      },
      {
        id: foundryUnchainedRogue,
        name: 'Rogue (Unchained)',
        like: 'rogue',
        counterpartOf: foundryRogue,
        detail: { featuresByLevel: unchainedRogue.features },
      },
    ],
  );
  return withClasses(foundry, [campaignFoundryUnchainedRogue], {
    a: rogueClass,
    b: 'unchained-monk',
  });
}

const acrobatMessage =
  'Acrobat: the replaced feature has no matching row in Rogue (Unchained).';
const zenArcherMessage =
  "Zen Archer was written for the original class and cannot automatically replace this class's features.";

test('Acrobat’s unmatched replacement on the Unchained Rogue warns verbatim at its Archetype, is accepted alone beside the Monk warning, survives a copy switch, clears on the original Rogue, and disables nothing', async () => {
  snapshot = acrobatSheet();
  const blocks = () => (
    <CharacterSheetBlocks blocks={['levels', 'archetypes']} />
  );
  const view = render(blocks());
  const archetypes = () =>
    within(screen.getByRole('region', { name: 'Archetypes' }));
  for (const message of [acrobatMessage, zenArcherMessage])
    expect(archetypes().getByText(message)).toBeVisible();

  fireEvent.click(
    archetypes().getByRole('button', {
      name: 'Accept',
      description: /Acrobat: the replaced feature/,
    }),
  );
  await waitFor(() => expect(calls).toHaveLength(1));
  const accept = lastCall();
  expect(accept).toMatchObject({
    name: 'accept',
    args: { check: 'archetypeReplacementUnmatched' },
  });
  const accepted: Accepted[] = [
    {
      check: 'archetypeReplacementUnmatched',
      subject: String(accept.args.subject),
      fingerprint: String(accept.args.fingerprint),
    },
  ];
  snapshot = acrobatSheet({ accepted });
  view.rerender(blocks());
  await act(async () => {
    accept.resolve(null);
  });
  expect(
    archetypes().getByRole('button', {
      name: 'Reopen',
      description: /Acrobat: the replaced feature/,
    }),
  ).toBeEnabled();
  // The Monk warning stays its own, still open.
  expect(
    archetypes().getByRole('button', {
      name: 'Accept',
      description: /Zen Archer was written/,
    }),
  ).toBeEnabled();
  expect(classPicker(1)).toBeEnabled();
  expect(rulesButton(1)).toBeEnabled();

  // A Catalog Copy of the same class keeps the facts, so the acceptance holds.
  snapshot = acrobatSheet({
    accepted,
    rogueClass: campaignFoundryUnchainedRogue.id,
  });
  view.rerender(blocks());
  expect(
    archetypes().getByRole('button', {
      name: 'Reopen',
      description: /Acrobat: the replaced feature/,
    }),
  ).toBeEnabled();

  // On the original Rogue both replacements match, so the warning clears.
  snapshot = acrobatSheet({ accepted, rogueClass: foundryRogue });
  view.rerender(blocks());
  expect(archetypes().queryByText(acrobatMessage)).not.toBeInTheDocument();
  expect(archetypes().getByText(zenArcherMessage)).toBeVisible();
});
