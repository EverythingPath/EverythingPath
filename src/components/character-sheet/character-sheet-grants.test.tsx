import {
  calculateFixtureSheet as calculateCharacterSheet,
  buildSheet,
  characterId,
  emptyOwnerCandidates,
} from './character-sheet-test-fixture';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import type { ComponentProps } from 'react';
import type { Id } from '@convex/_generated/dataModel';
import type * as NavigationGuard from '~/components/campaign-shell/navigation-guard';
import { beforeEach, expect, test, vi } from 'vitest';
import type { MigrationMaintenance } from '~/components/use-initial-migration-maintenance';

import { CharacterSheetGrants } from './character-sheet-grants';
import type {
  GrantEntryView,
  GrantSectionView,
} from './character-sheet-grants-view-model';
import { CharacterSheetPage } from './character-sheet-page';

import type { SaveStatus } from './save-status';
import type {
  CharacterSheetSnapshot,
  SheetWarningView,
  useCharacterSheet,
} from './use-character-sheet';
import { characterSheetNames } from './character-sheet-api-test-fixture';
import type { FunctionReference } from 'convex/server';

// Grants and dormant entries (#301): granted features listed with their
// sources, replaced entries muted beneath their replacer, lost state kept
// under "Not counting now", and Keep, Unkeep, Edit and Discard per row.

type Controller = ReturnType<typeof useCharacterSheet>;
type Actions = Controller['grants'];
type Write = {
  name: 'setKept' | 'discard' | 'edit';
  args: unknown[];
  resolve: (outcome: boolean) => void;
};
type Call = { name: string; args: Record<string, unknown> };

let writes: Write[] = [];
let statuses: Record<string, SaveStatus> = {};
let hasRemoteChange = false;
let calls: Call[] = [];
let snapshot: CharacterSheetSnapshot | null | undefined;
const dismissRemoteChange = vi.fn();
const maintenance = vi.fn<() => MigrationMaintenance>();
const warningController: Controller['warnings'] = {
  accept: vi.fn(() => Promise.resolve()),
  reopen: vi.fn(() => Promise.resolve()),
  statusFor: () => ({ kind: 'idle' }),
  hasRemoteChange: false,
  dismissRemoteChange: vi.fn(),
};

vi.mock(
  './use-character-move',
  () => import('./use-character-move-test-double'),
);
vi.mock('~/components/use-initial-migration-maintenance', () => ({
  useInitialMigrationMaintenance: () => maintenance(),
}));
const nameOf = characterSheetNames();
vi.mock('convex/react', () => ({
  useQuery: (query: FunctionReference<'query'>) => {
    const name = nameOf(query);
    return name === 'read'
      ? snapshot
      : ['companions', 'catalogList', 'catalogAdvisories'].includes(name)
        ? []
        : undefined;
  },
  usePaginatedQuery: () => emptyOwnerCandidates(),
  useMutation: (mutation: FunctionReference<'mutation'>) => {
    const name = nameOf(mutation);
    return (args: Record<string, unknown>) =>
      new Promise(() => {
        calls.push({ name, args });
      });
  },
}));
vi.mock(
  '~/components/campaign-shell/navigation-guard',
  async (importOriginal) => {
    const actual = await importOriginal<typeof NavigationGuard>();
    return {
      ...actual,
      GuardedLink: ({
        href,
        children,
        ...props
      }: ComponentProps<'a'> & { href: string }) => (
        <a href={href} {...props}>
          {children}
        </a>
      ),
    };
  },
);
vi.mock(
  '~/components/ui/select',
  () => import('../weekly-draft-workspace/native-select-test-double'),
);

beforeEach(() => {
  writes = [];
  statuses = {};
  hasRemoteChange = false;
  calls = [];
  snapshot = undefined;
  vi.clearAllMocks();
  maintenance.mockReturnValue({ kind: 'ready', readOnly: false, message: '' });
});

const record =
  (name: Write['name']) =>
  (...args: unknown[]) =>
    new Promise<boolean>((resolve) => {
      writes.push({ name, args, resolve });
    });
function buildActions(): Actions {
  return {
    getCatalogDetachTarget: () => undefined,
    statusFor: (rowId) => statuses[rowId] ?? { kind: 'idle' },
    hasRemoteChange,
    dismissRemoteChange,
    setKept: record('setKept'),
    discard: record('discard'),
    edit: record('edit'),
  };
}

function row(
  overrides: Partial<GrantEntryView> & Pick<GrantEntryView, 'rowId' | 'name'>,
): GrantEntryView {
  return {
    target: {
      grantKey: { source: 'fighter', classLevel: 3, entry: overrides.rowId },
    },
    kind: 'classFeature',
    origin: 'grant',
    recorded: false,
    active: true,
    kept: false,
    dormant: false,
    counting: true,
    gainedAtClassLevel: null,
    unplaced: false,
    status: 'counting',
    choice: null,
    notes: '',
    sourceLabel: 'Fighter 3',
    reason: null,
    canKeep: false,
    canDiscard: false,
    canEditChoice: true,
    replaced: [],
    ...overrides,
  };
}
const dormant = {
  dormant: true,
  counting: false,
  status: 'dormant' as const,
  canKeep: true,
};
const armor = row({
  rowId: 'armor',
  name: 'Armor Training 1',
  ...dormant,
  reason: 'Replaced by Weapon Master',
});
const recordedArmor = row({
  ...armor,
  recorded: true,
  canDiscard: true,
  choice: 'heavy armor',
  notes: 'A table choice',
});
const master = row({
  rowId: 'master',
  name: 'Weapon Master',
  kind: 'archetype',
  origin: 'selection',
  recorded: true,
  target: { entryId: 'master' },
  sourceLabel: null,
  replaced: [armor],
});
const powerAttack = row({
  rowId: 'power-attack',
  name: 'Power Attack',
  kind: 'feat',
  origin: 'selection',
  recorded: true,
  target: { entryId: 'power-attack' },
  sourceLabel: null,
});
const dodge = row({
  rowId: 'dodge',
  name: 'Dodge',
  kind: 'feat',
  origin: 'selection',
  recorded: true,
  target: { entryId: 'dodge' },
  sourceLabel: null,
  ...dormant,
  canDiscard: true,
  reason: 'Its source is no longer active.',
});
// #411: Keen Senses, retired from the CRB elf (p. 22). A Character that
// already had it keeps an ordinary counting row; one that gained it later
// sees it under Not counting now with the reason and Discard alone.
const retiredReason =
  'Retired from the catalog before this Character had it, so it cannot be kept.';
const keenSenses = row({
  rowId: 'keen-senses',
  name: 'Keen Senses',
  kind: 'racialTrait',
  target: { grantKey: { source: 'elf', entry: 'elf-keen-senses' } },
  recorded: true,
  sourceLabel: 'Elf',
  notes: 'Spotted the ambush',
});
const retiredKeenSenses = row({
  ...keenSenses,
  ...dormant,
  canKeep: false,
  canDiscard: true,
  reason: retiredReason,
});
function section(
  kind: GrantSectionView['kind'],
  title: string,
  rows: GrantEntryView[],
  dormantRows: GrantEntryView[] = [],
): GrantSectionView {
  return {
    kind,
    title,
    rows,
    dormantRows,
    dormantLabel: `Not counting now (${dormantRows.length})`,
  };
}
const archetypes = (replacer: GrantEntryView) => [
  section('archetype', 'Archetypes', [replacer]),
];
const feats = (rows: GrantEntryView[], lost: GrantEntryView[] = []) => [
  section('feat', 'Feats', rows, lost),
];
const racialTraits = (rows: GrantEntryView[], lost: GrantEntryView[] = []) => [
  section('racialTrait', 'Racial traits', rows, lost),
];

function renderGrants(
  initial: GrantSectionView[],
  initialWarnings: SheetWarningView[] = [],
  withSheetHeading = false,
) {
  let sections = initial;
  let warnings = initialWarnings;
  const grants = () => (
    <CharacterSheetGrants
      sections={sections}
      actions={buildActions()}
      warnings={warnings}
      warningController={warningController}
    />
  );
  const ui = () =>
    withSheetHeading ? (
      <main>
        <h1>Character sheet</h1>
        {grants()}
      </main>
    ) : (
      grants()
    );
  const view = render(ui());
  return {
    rerender(next = sections, nextWarnings = warnings) {
      sections = next;
      warnings = nextWarnings;
      view.rerender(ui());
    },
  };
}
const item = (name: string) => screen.getByRole('listitem', { name });
const button = (name: string | RegExp) => screen.getByRole('button', { name });
const toggle = (name: string) => screen.getByRole('switch', { name });
const field = (name: string) => screen.getByRole('textbox', { name });
const group = () => button(/^Not counting now \(\d+\)$/);
function lastWrite() {
  const write = writes.at(-1);
  if (!write) throw new Error('Expected a write');
  return write;
}
async function settle(outcome: boolean) {
  await act(async () => {
    lastWrite().resolve(outcome);
  });
}

test('a replaced Grant without state sits muted beneath its replacer with Keep, which sends that row and true and never removes anything', async () => {
  const view = renderGrants(archetypes(master));
  const replaced = within(item('Weapon Master')).getByRole('listitem', {
    name: 'Armor Training 1',
  });
  expect(within(replaced).getByText('Replaced by Weapon Master')).toBeVisible();
  expect(within(replaced).getByText('Not counting now')).toBeVisible();
  expect(within(replaced).getByText('Fighter 3')).toBeVisible();
  expect(
    screen.queryByRole('button', { name: /Remove|Delete|Discard/ }),
  ).not.toBeInTheDocument();
  expect(toggle('Weapon Master: on')).toBeChecked();

  fireEvent.click(button('Keep Armor Training 1'));
  expect(writes.map((write) => write.name)).toEqual(['setKept']);
  expect(lastWrite().args).toEqual([armor, true]);
  await settle(true);
  statuses.armor = { kind: 'saved' };
  view.rerender();
  expect(
    within(item('Armor Training 1')).getByRole('status'),
  ).toHaveTextContent('Saved');
});

test('a replaced Grant with saved choice and notes shows them, Keep then Unkeep leaves them, and Edit saves state through the hook alone', async () => {
  const view = renderGrants(
    archetypes({ ...master, replaced: [recordedArmor] }),
  );
  const replaced = () => item('Armor Training 1');
  expect(
    within(replaced()).getByText('Choice: heavy armor · A table choice'),
  ).toBeVisible();

  fireEvent.click(button('Keep Armor Training 1'));
  expect(lastWrite().args).toEqual([recordedArmor, true]);
  await settle(true);
  const kept = {
    ...recordedArmor,
    kept: true,
    counting: true,
    status: 'kept' as const,
  };
  view.rerender(archetypes({ ...master, replaced: [kept] }));
  expect(within(replaced()).getByText('Kept')).toBeVisible();
  expect(
    within(replaced()).getByText('Choice: heavy armor · A table choice'),
  ).toBeVisible();
  fireEvent.click(button('Unkeep Armor Training 1'));
  expect(lastWrite().args).toEqual([kept, false]);
  await settle(true);

  fireEvent.click(button('Edit Armor Training 1'));
  const editor = screen.getByRole('form', { name: 'Edit Armor Training 1' });
  expect(field('Choice for Armor Training 1')).toHaveValue('heavy armor');
  expect(field('Notes for Armor Training 1')).toHaveValue('A table choice');
  fireEvent.change(field('Choice for Armor Training 1'), {
    target: { value: 'light armor' },
  });
  fireEvent.click(within(editor).getByRole('button', { name: /^Save/ }));
  await waitFor(() => expect(writes).toHaveLength(3));
  expect(lastWrite()).toMatchObject({
    name: 'edit',
    args: [kept, { choice: 'light armor' }],
  });
  expect(lastWrite().args[1]).not.toHaveProperty('notes');
  expect(editor).toBeVisible();
  await settle(true);
  expect(
    screen.queryByRole('form', { name: 'Edit Armor Training 1' }),
  ).not.toBeInTheDocument();
  expect(button('Edit Armor Training 1')).toHaveFocus();
  expect(writes.map((write) => write.name)).toEqual([
    'setKept',
    'setKept',
    'edit',
  ]);
});

test('Not counting now starts collapsed and opens to its retained row with Keep and Discard; a row switched off stays in the main list', async () => {
  const view = renderGrants(feats([powerAttack], [dodge]));
  expect(group()).toHaveTextContent('Not counting now (1)');
  expect(group()).toHaveAttribute('aria-expanded', 'false');
  expect(screen.queryByRole('listitem', { name: 'Dodge' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Keep Dodge' })).toBeNull();

  fireEvent.click(group());
  expect(group()).toHaveAttribute('aria-expanded', 'true');
  const panel = document.getElementById(group().getAttribute('aria-controls')!);
  expect(panel).not.toBeNull();
  expect(within(panel!).getByRole('listitem', { name: 'Dodge' })).toBeVisible();
  expect(button('Keep Dodge')).toBeEnabled();
  expect(button('Discard Dodge')).toBeEnabled();
  expect(
    within(panel!).getByText('Its source is no longer active.'),
  ).toBeVisible();

  fireEvent.click(toggle('Power Attack: on'));
  expect(lastWrite()).toMatchObject({
    name: 'edit',
    args: [powerAttack, { active: false }],
  });
  await settle(true);
  const off = { ...powerAttack, active: false, status: 'off' as const };
  view.rerender(feats([off], [dodge]));
  expect(toggle('Power Attack: off')).not.toBeChecked();
  expect(within(item('Power Attack')).getByText('Off')).toBeVisible();
  expect(
    within(panel!).queryByRole('listitem', { name: 'Power Attack' }),
  ).toBeNull();
  expect(group()).toHaveTextContent('Not counting now (1)');
});

test('Kept and Off coexist: Unkeep leaves the row off and the switch leaves it kept', () => {
  const keptOff = row({
    ...dodge,
    kept: true,
    active: false,
    status: 'off',
  });
  renderGrants(feats([keptOff]));
  const chips = within(item('Dodge'));
  expect(chips.getByText('Kept')).toBeVisible();
  expect(chips.getByText('Off')).toBeVisible();
  fireEvent.click(button('Unkeep Dodge'));
  expect(lastWrite()).toMatchObject({
    name: 'setKept',
    args: [keptOff, false],
  });
  expect(toggle('Dodge: off')).not.toBeChecked();
  fireEvent.click(toggle('Dodge: off'));
  expect(lastWrite()).toMatchObject({
    name: 'edit',
    args: [keptOff, { active: true }],
  });
  expect(writes.map((write) => write.name)).toEqual(['setKept', 'edit']);
});

test('Discard asks first and writes only on confirmation; a failed discard keeps the question with the error, and the derived default line can remain afterwards', async () => {
  const view = renderGrants(feats([], [dodge]));
  fireEvent.click(group());
  fireEvent.click(button('Discard Dodge'));
  const question = screen.getByRole('group', {
    name: "Discard Dodge's saved state?",
  });
  expect(question).toHaveAccessibleDescription(
    'Its choices and notes will be lost.',
  );
  expect(writes).toEqual([]);

  button('Discard saved state Dodge').focus();
  fireEvent.click(button('Discard saved state Dodge'));
  expect(lastWrite()).toMatchObject({ name: 'discard', args: [dodge] });
  statuses.dodge = {
    kind: 'error',
    message: "Dodge wasn't saved. Try again.",
  };
  view.rerender();
  await settle(false);
  expect(question).toBeVisible();
  expect(button('Cancel Dodge')).toHaveFocus();
  expect(screen.getByRole('alert')).toHaveTextContent(
    "Dodge wasn't saved. Try again.",
  );

  fireEvent.click(button('Discard saved state Dodge'));
  statuses.dodge = { kind: 'saved' };
  view.rerender();
  await settle(true);
  expect(
    screen.queryByRole('group', { name: "Discard Dodge's saved state?" }),
  ).not.toBeInTheDocument();
  const defaultLine = row({ ...armor, recorded: false, canDiscard: false });
  view.rerender(archetypes({ ...master, replaced: [defaultLine] }));
  expect(item('Armor Training 1')).toBeVisible();
  expect(button('Keep Armor Training 1')).toBeEnabled();
  expect(
    screen.queryByRole('button', { name: 'Discard Armor Training 1' }),
  ).toBeNull();
});

test('Cancel closes the discard question and returns focus to Discard', () => {
  renderGrants(feats([dodge]));
  fireEvent.click(button('Discard Dodge'));
  fireEvent.click(button('Cancel Dodge'));
  expect(
    screen.queryByRole('group', { name: "Discard Dodge's saved state?" }),
  ).not.toBeInTheDocument();
  expect(button('Discard Dodge')).toHaveFocus();
  expect(writes).toEqual([]);
});

test('a local Discard waits for the row to disappear before focusing its successor; remote removal leaves focus alone', async () => {
  const other = row({ ...dodge, rowId: 'other', name: 'Mobility' });
  const view = renderGrants(feats([], [dodge, other]));
  fireEvent.click(group());
  fireEvent.click(button('Discard Dodge'));
  const confirm = button('Discard saved state Dodge');
  confirm.focus();
  fireEvent.click(confirm);
  await settle(true);
  expect(button('Discard Dodge')).toHaveFocus();
  view.rerender(feats([], [other]));
  expect(toggle('Mobility: on')).toHaveFocus();
  view.rerender(feats([powerAttack], [other]));
  button('Edit Power Attack').focus();
  view.rerender(feats([powerAttack]));
  expect(button('Edit Power Attack')).toHaveFocus();
});

test.each(['section', 'panel'])(
  'Discard returns to a surviving sheet heading when the final row removes its %s',
  async (removed) => {
    const otherSections = removed === 'section' ? archetypes(master) : [];
    const view = renderGrants(
      [...otherSections, ...feats([], [dodge])],
      [],
      true,
    );
    fireEvent.click(group());
    fireEvent.click(button('Discard Dodge'));
    button('Discard saved state Dodge').focus();
    fireEvent.click(button('Discard saved state Dodge'));
    view.rerender(otherSections);
    await settle(true);
    expect(screen.queryByRole('heading', { name: 'Feats' })).toBeNull();
    expect(
      screen.getByRole('heading', { name: 'Character sheet' }),
    ).toHaveFocus();
  },
);

test('Discard focuses its section heading when no following row remains there', async () => {
  const view = renderGrants(feats([powerAttack], [dodge]));
  fireEvent.click(group());
  fireEvent.click(button('Discard Dodge'));
  button('Discard saved state Dodge').focus();
  fireEvent.click(button('Discard saved state Dodge'));
  await settle(true);
  view.rerender(feats([powerAttack]));
  expect(screen.getByRole('heading', { name: 'Feats' })).toHaveFocus();
});

test('Discard keeps focus on the derived default row when its saved state disappears', async () => {
  const view = renderGrants(
    archetypes({ ...master, replaced: [recordedArmor] }),
  );
  fireEvent.click(button('Discard Armor Training 1'));
  button('Discard saved state Armor Training 1').focus();
  fireEvent.click(button('Discard saved state Armor Training 1'));
  await settle(true);
  view.rerender(archetypes(master));
  expect(item('Armor Training 1')).toBeVisible();
  expect(toggle('Armor Training 1: on')).toHaveFocus();
});

test('Saving disables only its own row, Saved and the error read beside it, and retry works', () => {
  const view = renderGrants(feats([dodge, powerAttack]));
  statuses.dodge = { kind: 'saving' };
  view.rerender();
  expect(toggle('Dodge: on')).toBeDisabled();
  expect(button('Keep Dodge')).toBeDisabled();
  expect(within(item('Dodge')).getByRole('status')).toHaveTextContent(
    'Saving…',
  );
  expect(toggle('Power Attack: on')).toBeEnabled();

  statuses.dodge = { kind: 'saved' };
  view.rerender();
  expect(within(item('Dodge')).getByRole('status')).toHaveTextContent('Saved');
  expect(button('Keep Dodge')).toBeEnabled();

  statuses.dodge = {
    kind: 'error',
    message: 'Dodge may not have been saved. Check it before trying again.',
  };
  view.rerender();
  expect(within(item('Dodge')).getByRole('alert')).toHaveTextContent(
    'Dodge may not have been saved. Check it before trying again.',
  );
  fireEvent.click(button('Keep Dodge'));
  expect(lastWrite()).toMatchObject({ name: 'setKept', args: [dodge, true] });
});

test('maintenance disables writes with one reason per section but leaves the dormant group expandable', () => {
  const message = 'Editing is paused for maintenance.';
  maintenance.mockReturnValue({ kind: 'maintenance', readOnly: true, message });
  renderGrants([...feats([powerAttack], [dodge]), ...archetypes(master)]);
  expect(toggle('Power Attack: on')).toBeDisabled();
  expect(button('Keep Armor Training 1')).toBeDisabled();
  expect(screen.getAllByText(message)).toHaveLength(2);
  expect(group()).toBeEnabled();
  fireEvent.click(group());
  expect(group()).toHaveAttribute('aria-expanded', 'true');
  expect(item('Dodge')).toBeVisible();
  expect(button('Keep Dodge')).toBeDisabled();
  expect(button('Discard Dodge')).toBeEnabled();
  fireEvent.click(button('Discard Dodge'));
  expect(button('Discard saved state Dodge')).toBeDisabled();
  expect(screen.getAllByText(message)).toHaveLength(2);
});

test('another player’s change is announced without opening the group or losing a draft, and Dismiss clears it', () => {
  const view = renderGrants(feats([powerAttack], [dodge]));
  fireEvent.click(button('Edit Power Attack'));
  fireEvent.change(field('Notes for Power Attack'), {
    target: { value: 'Use with the greatsword' },
  });
  hasRemoteChange = true;
  view.rerender();
  expect(screen.getByText('Entries updated by another player.')).toBeVisible();
  expect(group()).toHaveAttribute('aria-expanded', 'false');
  expect(field('Notes for Power Attack')).toHaveValue(
    'Use with the greatsword',
  );
  fireEvent.click(button('Dismiss entries update'));
  expect(dismissRemoteChange).toHaveBeenCalledTimes(1);
  hasRemoteChange = false;
  view.rerender();
  expect(
    screen.queryByText('Entries updated by another player.'),
  ).not.toBeInTheDocument();
  expect(field('Notes for Power Attack')).toHaveValue(
    'Use with the greatsword',
  );
});

test('a kept entry’s advisory warning sits beside it with Accept and Reopen; no sections means no panel', () => {
  const kept = row({ ...dodge, kept: true, counting: true, status: 'kept' });
  const warning: SheetWarningView = {
    kind: 'rules',
    check: 'keptDormant',
    target: { kind: 'entry', entryId: kept.rowId },
    subject: kept.rowId,
    fingerprint: 'dodge',
    message: 'Dodge: kept, although its source is unavailable.',
    accepted: false,
  };
  const view = renderGrants(feats([kept]), [warning]);
  const inRow = within(item('Dodge'));
  expect(
    inRow.getByText('Dodge: kept, although its source is unavailable.'),
  ).toBeVisible();
  fireEvent.click(inRow.getByRole('button', { name: 'Accept' }));
  expect(warningController.accept).toHaveBeenCalledWith(warning);

  view.rerender(feats([kept]), [{ ...warning, accepted: true }]);
  expect(inRow.getByText('Accepted')).toBeVisible();
  fireEvent.click(inRow.getByRole('button', { name: 'Reopen' }));
  expect(warningController.reopen).toHaveBeenCalledWith({
    ...warning,
    accepted: true,
  });

  view.rerender([]);
  expect(screen.queryAllByRole('region')).toHaveLength(0);
});

test('a retired Grant the Character never had sits under Not counting now with its reason and Discard but no Keep; one it already had is an ordinary counting row', async () => {
  const view = renderGrants(racialTraits([], [retiredKeenSenses]));
  expect(group()).toHaveTextContent('Not counting now (1)');
  fireEvent.click(group());
  const lost = item('Keen Senses');
  expect(within(lost).getByText('Not counting now')).toBeVisible();
  expect(within(lost).getByText(retiredReason)).toHaveClass(
    'text-muted-foreground',
  );
  expect(within(lost).getByText('Elf')).toBeVisible();
  expect(within(lost).getByText('Spotted the ambush')).toBeVisible();
  expect(screen.queryByRole('button', { name: /^(Keep|Unkeep) / })).toBeNull();
  expect(button('Discard Keen Senses')).toBeEnabled();
  fireEvent.click(button('Discard Keen Senses'));
  fireEvent.click(button('Discard saved state Keen Senses'));
  expect(lastWrite()).toMatchObject({
    name: 'discard',
    args: [retiredKeenSenses],
  });
  await settle(true);

  view.rerender(racialTraits([keenSenses]));
  const retained = item('Keen Senses');
  expect(toggle('Keen Senses: on')).toBeChecked();
  expect(within(retained).getByText('Elf')).toBeVisible();
  expect(within(retained).getByText('Spotted the ambush')).toBeVisible();
  expect(within(retained).queryByText(retiredReason)).toBeNull();
  expect(within(retained).queryByText(/Not counting now|Kept/)).toBeNull();
  expect(
    screen.queryByRole('button', { name: /^Not counting now/ }),
  ).toBeNull();
  expect(screen.queryByRole('button', { name: /Keep|Discard/ })).toBeNull();
  expect(button('Edit Keen Senses')).toBeEnabled();
});

test('an item editor offers Notes and on/off but no Choice and saves without a choice value', async () => {
  const belt = row({
    rowId: 'belt',
    name: 'Belt of giant strength',
    kind: 'item',
    origin: 'selection',
    recorded: true,
    target: { entryId: 'belt' },
    sourceLabel: null,
    canEditChoice: false,
    ...dormant,
    canDiscard: true,
    reason: 'Its source is no longer active.',
  });
  renderGrants([section('item', 'Items', [], [belt])]);
  fireEvent.click(group());
  expect(toggle('Belt of giant strength: on')).toBeChecked();
  fireEvent.click(button('Edit Belt of giant strength'));
  expect(
    screen.queryByRole('textbox', {
      name: 'Choice for Belt of giant strength',
    }),
  ).toBeNull();
  const notes = field('Notes for Belt of giant strength');
  expect(notes).toHaveFocus();
  fireEvent.change(notes, { target: { value: 'Worn under armor' } });
  fireEvent.click(button(/^Save/));
  await waitFor(() => expect(writes).toHaveLength(1));
  expect(lastWrite().args).toEqual([belt, { notes: 'Worn under armor' }]);
  await settle(true);
  expect(button('Edit Belt of giant strength')).toHaveFocus();
});

// --- The sheet page, with the panel wired to the live read ---------------

type CatalogEntry = CharacterSheetSnapshot['catalogEntries'][number];
const armorTraining = {
  _id: 'armor-training',
  _creationTime: 4,
  scope: 'character',
  characterId,
  name: 'Armor Training 1',
  ruleIdentity: 'feature/armor-training',
  stacksWithItself: false,
  detail: { kind: 'classFeature' },
  sources: [],
  modifiers: [{ target: 'ac.other', bonusType: 'untyped', value: 1 }],
} as unknown as CatalogEntry;

/** The fixture sheet with Fighter 1 granting Armor Training 1, recalculated. */
function withGrants(
  base: CharacterSheetSnapshot,
  patch: (
    entries: CharacterSheetSnapshot['entries'],
  ) => CharacterSheetSnapshot['entries'],
): CharacterSheetSnapshot {
  const catalogEntries = [
    ...base.catalogEntries.map((entry) =>
      entry._id === 'fighter' && entry.detail.kind === 'class'
        ? ({
            ...entry,
            detail: {
              ...entry.detail,
              featuresByLevel: [
                { classLevel: 1, catalogEntryId: 'armor-training' },
              ],
            },
          } as CatalogEntry)
        : entry,
    ),
    armorTraining,
  ];
  const entries = patch(base.entries);
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
function renderPage() {
  render(
    <CharacterSheetPage
      organizationId="org"
      characterId={characterId}
      back={{ href: '/campaigns/campaign-1/characters', label: 'Characters' }}
      campaignName="Ironfang"
    />,
  );
}
const region = (name: string) => screen.getByRole('region', { name });

test('the sheet lists an automatic class feature once with its source and a dormant item once under Not counting now, out of the old panel', () => {
  snapshot = withGrants(
    buildSheet({
      levels: [{ id: 'level-1', hp: 10, classId: 'fighter' }],
      sheetEntries: [
        {
          id: 'belt',
          name: 'Belt of giant strength',
          detail: { kind: 'item', consumable: false },
          modifiers: [
            { target: 'ability.str', bonusType: 'enhancement', value: 4 },
          ],
        },
      ],
    }),
    (entries) =>
      entries.map((entry) =>
        entry.kind === 'item' && entry._id === 'belt'
          ? {
              ...entry,
              selectionSource: {
                kind: 'slot' as const,
                grantedBy: {
                  kind: 'entry' as const,
                  entryId: 'gone' as Id<'characterSheetEntry'>,
                },
              },
            }
          : entry,
      ),
  );
  renderPage();
  const features = region('Class features');
  expect(
    screen.getAllByRole('listitem', { name: 'Armor Training 1' }),
  ).toHaveLength(1);
  expect(within(features).getByText('Fighter 1')).toBeVisible();
  expect(
    within(region('Sheet entries')).getByText('No entries.'),
  ).toBeVisible();
  const items = region('Items');
  fireEvent.click(
    within(items).getByRole('button', { name: 'Not counting now (1)' }),
  );
  expect(
    screen.getAllByRole('listitem', { name: 'Belt of giant strength' }),
  ).toHaveLength(1);
  expect(within(items).getByText('Not counting now')).toBeVisible();

  fireEvent.click(toggle('Armor Training 1: on'));
  expect(calls.map((call) => call.name)).toEqual(['editGrantState']);
  expect(calls[0]?.args).toMatchObject({
    grantKey: {
      source: 'fighter',
      classLevel: 1,
      entry: 'feature/armor-training',
    },
    state: { active: false },
  });
  fireEvent.click(button('Keep Belt of giant strength'));
  expect(calls.at(-1)).toMatchObject({
    name: 'setDormantEntryKept',
    args: { target: { entryId: 'belt' }, kept: true },
  });
});

test('a feat whose Class Level was deleted keeps counting with Not tied to a level and is named by the levels; an unavailable sheet shows no panel', () => {
  const base = buildSheet({
    adjustments: [
      {
        id: 'feat',
        name: 'General feat',
        modifiers: [],
        gainedAtClassLevel: 'deleted-level',
      },
    ],
  });
  const entries = base.entries.map((entry) =>
    entry.kind === 'manual' && entry._id === 'feat'
      ? {
          ...entry,
          kind: 'feat' as const,
          state: { kind: 'feat' as const, slot: 'general' as const },
        }
      : entry,
  );
  const catalogEntries = base.catalogEntries.map((entry) =>
    entry._id === 'feat-catalog'
      ? ({ ...entry, detail: { kind: 'feat' } } as CatalogEntry)
      : entry,
  );
  snapshot = {
    ...base,
    entries,
    catalogEntries,
    calculated: calculateCharacterSheet({
      entries,
      catalogEntries,
      characterKind: 'pc',
    }),
  };
  renderPage();
  // Feats & traits owns the feat rows the Grants block used to list.
  const inFeats = within(region('Feats & traits'));
  expect(inFeats.getByRole('listitem', { name: 'General feat' })).toBeVisible();
  expect(inFeats.getByText('Not tied to a level')).toBeVisible();
  expect(
    inFeats.queryByRole('button', { name: /Not counting now/ }),
  ).toBeNull();
  expect(toggle('General feat: on')).toBeChecked();
  expect(
    within(region('Class Levels')).getByText('General feat'),
  ).toBeVisible();

  snapshot = null;
  renderPage();
  expect(
    screen.getByText("This character's sheet is not available here yet."),
  ).toBeVisible();
  expect(
    screen.getAllByRole('region', { name: 'Feats & traits' }),
  ).toHaveLength(1);
});
