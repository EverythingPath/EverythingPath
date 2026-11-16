import {
  calculateFixtureSheetProjections as calculateCharacterSheetProjections,
  buildSheet,
  emptyOwnerCandidates,
  findCalculatedWarning,
  isClassCatalogEntry,
  withClasses,
  type Adjustment,
  type ExtraClass,
  type Level,
} from './character-sheet-test-fixture';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { ConvexError } from 'convex/values';
import type { ComponentProps } from 'react';
import { beforeEach, expect, test, vi } from 'vitest';
import type { MigrationMaintenance } from '~/components/use-initial-migration-maintenance';
import type * as NavigationGuard from '~/components/campaign-shell/navigation-guard';
import { CharacterSheetBlocks } from './character-sheet-blocks-test-fixture';
import {
  fighterHpWarning,
  fighterVersionSheet,
  homebrewFighter,
} from './class-version-test-fixture';
import { formatModifier } from './sheet-parts';
import { retiredChoiceReason } from './retired-catalog-choices';
import { catalogRuntimeCompatibility } from '~/lib/catalog/runtime-compatibility';
import type { CharacterSheetSnapshot } from './use-character-sheet';
import { characterSheetNames } from './character-sheet-api-test-fixture';
import type { FunctionReference } from 'convex/server';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';

// Advancing and revising Class Levels (#299): every row's class, hit points,
// favored class bonus and ability increase chosen in place; Level up and
// insertion; stable rows through moves and deletions; the derived numbers
// with their breakdowns.

type Call = {
  name: string;
  args: Record<string, unknown>;
  resolve: (value: unknown) => void;
  reject: (error: unknown) => void;
};
let calls: Call[] = [];
let snapshot: CharacterSheetSnapshot | null | undefined;
let scrollIntoView = vi.fn();
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

const page = () => (
  <CharacterSheetBlocks
    blocks={[
      'scores',
      'levels',
      'favoredClasses',
      'summary',
      'defenses',
      'offense',
    ]}
  />
);
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
const classPicker = (level: number) =>
  within(row(level)).getByRole('combobox', { name: `Class at level ${level}` });
const favoredPicker = (level: number) =>
  within(row(level)).getByRole('combobox', {
    name: `Favored class bonus at level ${level}`,
  });
const abilityPicker = (level: number) =>
  within(row(level)).getByRole('combobox', {
    name: `Ability increase at level ${level}`,
  });
const hpInput = (level: number) =>
  within(row(level)).getByRole('textbox', {
    name: `Hit points gained at level ${level}`,
  });
const noteInput = (level: number) =>
  within(row(level)).getByRole('textbox', {
    name: `Alternative favored class bonus at level ${level}`,
  });
const pick = (select: HTMLElement, value: string) =>
  fireEvent.change(select, { target: { value } });
/** Opens a class picker and chooses the named card. */
function chooseClass(picker: HTMLElement, name: string) {
  fireEvent.click(picker);
  fireEvent.click(
    within(screen.getByRole('dialog')).getByRole('radio', { name }),
  );
}
/** Reduced motion and the tablet width answer the same media query here. */
const media = (matches: boolean) => ({
  matches,
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
});
const button = (name: string | RegExp) => screen.getByRole('button', { name });
function lastCall() {
  const call = calls.at(-1);
  if (!call) throw new Error('Expected a write');
  return call;
}
const operationOf = (call: Call) => String(call.args.operationId);
/** Shows the snapshot as the own write's echo, then settles the write. */
async function settle(
  view: ReturnType<typeof renderSheet>,
  next: Parameters<typeof buildSheet>[0],
  reply: unknown = null,
) {
  view.show(buildSheet({ ...next, lastOperationId: operationOf(lastCall()) }));
  await act(async () => {
    lastCall().resolve(reply);
  });
}
const noWizard = () => {
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: /roll|average|maximum|next step/i }),
  ).not.toBeInTheDocument();
};

beforeEach(() => {
  calls = [];
  maintenance.mockReturnValue({ kind: 'ready', readOnly: false, message: '' });
  snapshot = undefined;
  scrollIntoView = vi.fn();
  Element.prototype.scrollIntoView = scrollIntoView;
  window.matchMedia = vi.fn().mockReturnValue(media(false));
});

test('a class, plain hit points, an alternative favored class bonus and an ability increase are chosen in place on a row and saved as recorded, with no wizard and no HP fill', async () => {
  const view = renderSheet(
    buildSheet({ hasClasses: true, levels: [{ id: 'a', hp: null }] }),
  );
  expect(classPicker(1)).toHaveTextContent('Unspecified');
  expect(classPicker(1)).toHaveClass('ring-sky-400/80');
  expect(hpInput(1)).toHaveValue('');

  chooseClass(classPicker(1), 'Fighter');
  await waitFor(() => expect(calls).toHaveLength(1));
  expect(lastCall().name).toBe('editLevel');
  expect(lastCall().args).toMatchObject({
    entryId: 'a',
    classEntryId: 'fighter',
  });
  expect(lastCall().args).not.toHaveProperty('hpGained');
  expect(
    within(row(1)).getByRole('button', { name: 'Saving…' }),
  ).toBeDisabled();
  const fighter: Level = { id: 'a', hp: null, classId: 'fighter' };
  await settle(view, { levels: [fighter] });
  expect(within(row(1)).getByText('Choices saved.')).toBeVisible();
  expect(within(row(1)).getByText('Fighter 1')).toBeVisible();
  expect(classPicker(1)).not.toHaveClass('ring-sky-400/80');
  expect(
    within(row(1)).queryByRole('button', { name: 'Save choices' }),
  ).not.toBeInTheDocument();
  // The hit die is a hint, never a fill.
  expect(hpInput(1)).toHaveValue('');
  expect(hpInput(1)).toHaveAccessibleDescription('d10');
  expect(within(row(1)).getByText('Enter hit points gained.')).toBeVisible();

  fireEvent.change(hpInput(1), { target: { value: '9' } });
  fireEvent.click(
    within(row(1)).getByRole('button', { name: 'Save hit points' }),
  );
  await waitFor(() => expect(calls).toHaveLength(2));
  expect(lastCall().args).toEqual(
    expect.objectContaining({ entryId: 'a', hpGained: 9 }),
  );
  expect(lastCall().args).not.toHaveProperty('classEntryId');
  await settle(view, { levels: [{ ...fighter, hp: 9 }] });
  expect(within(row(1)).getByText('Hit points saved.')).toBeVisible();

  // "Other…" waits for its note; the note saves when left.
  pick(favoredPicker(1), 'alt');
  expect(calls).toHaveLength(2);
  fireEvent.change(noteInput(1), { target: { value: 'Extra rage round' } });
  fireEvent.blur(noteInput(1));
  await waitFor(() => expect(calls).toHaveLength(3));
  expect(lastCall().args).toMatchObject({
    entryId: 'a',
    favoredClassBonus: { choice: 'alt', note: 'Extra rage round' },
  });
  expect(lastCall().args).not.toHaveProperty('classEntryId');
  expect(lastCall().args).not.toHaveProperty('abilityIncrease');
  const withNote: Level = {
    ...fighter,
    hp: 9,
    favoredClassBonus: { choice: 'alt', note: 'Extra rage round' },
  };
  await settle(view, { levels: [withNote] });
  expect(noteInput(1)).toHaveValue('Extra rage round');

  pick(abilityPicker(1), 'strength');
  await waitFor(() => expect(calls).toHaveLength(4));
  expect(lastCall().args).toMatchObject({
    entryId: 'a',
    abilityIncrease: 'strength',
  });
  await settle(view, {
    levels: [{ ...withNote, abilityIncrease: 'strength' }],
  });
  expect(abilityPicker(1)).toHaveValue('strength');
  expect(
    within(screen.getByRole('region', { name: 'Ability scores' })).getByRole(
      'button',
      { name: 'Strength 11, breakdown' },
    ),
  ).toBeVisible();
  noWizard();
});

test('Level up as the chosen next class appends an empty-HP row that only this device scrolls to and focuses, honouring reduced motion; a remote append is announced without moving', async () => {
  window.matchMedia = vi.fn().mockReturnValue(media(true));
  const fighter: Level = { id: 'a', hp: 8, classId: 'fighter' };
  const view = renderSheet(buildSheet({ levels: [fighter] }));
  const nextClass = screen.getByRole('combobox', {
    name: 'Class for the next level',
  });
  expect(nextClass).toHaveTextContent('Fighter');
  expect(screen.getByText('Level 2 as')).toBeVisible();
  chooseClass(nextClass, 'Wizard');
  fireEvent.click(button('Level up'));
  await waitFor(() => expect(calls).toHaveLength(1));
  expect(lastCall().name).toBe('add');
  expect(lastCall().args).toMatchObject({ classEntryId: 'wizard' });
  expect(lastCall().args).not.toHaveProperty('hpGained');
  expect(lastCall().args).not.toHaveProperty('position');
  expect(button('Level up')).toBeDisabled();
  const wizard: Level = { id: 'b', hp: null, classId: 'wizard' };
  await settle(view, { levels: [fighter, wizard] }, 'b');
  await waitFor(() => expect(hpInput(2)).toHaveFocus());
  expect(row(2)).toHaveAttribute('id', 'sheet-level-b');
  expect(hpInput(2)).toHaveValue('');
  expect(within(row(2)).getByText('Wizard 1')).toBeVisible();
  expect(scrollIntoView).toHaveBeenCalledTimes(1);
  expect(scrollIntoView).toHaveBeenCalledWith({
    block: 'center',
    behavior: 'auto',
  });
  expect(screen.getByText('Level 3 as')).toBeVisible();
  expect(
    within(levelsRegion()).queryByText(/updated by another player/),
  ).not.toBeInTheDocument();

  classPicker(1).focus();
  view.show(
    buildSheet({
      levels: [fighter, wizard, { id: 'c', hp: 6, classId: 'rogue' }],
      lastOperationId: 'other-device',
    }),
  );
  expect(classPicker(1)).toHaveFocus();
  expect(scrollIntoView).toHaveBeenCalledTimes(1);
  expect(
    within(levelsRegion()).getByText('Class Levels updated by another player.'),
  ).toBeVisible();
  fireEvent.click(button('Dismiss Class Levels update'));
  expect(within(levelsRegion()).getAllByRole('listitem')).toHaveLength(3);
  noWizard();
});

test('insert, move and change keep each row its identity, draft and choices; deleting a middle row closes positions and leaves its linked selection unplaced; deleting the last row leaves Level 1 available', async () => {
  const a: Level = {
    id: 'a',
    hp: 10,
    classId: 'fighter',
    favoredClassBonus: { choice: 'hp' },
  };
  const b: Level = { id: 'b', hp: 6, classId: 'rogue' };
  const c: Level = { id: 'c', hp: 4, classId: 'wizard' };
  const sneakAttack: Adjustment = {
    id: 'sneak',
    name: 'Sneak attack',
    modifiers: [{ target: 'damage.melee', bonusType: 'untyped', value: 1 }],
    gainedAtClassLevel: 'b',
  };
  const adjustments = [sneakAttack];
  const view = renderSheet(buildSheet({ levels: [a, b, c], adjustments }));
  expect(screen.queryByText(/Gained at a deleted/)).not.toBeInTheDocument();

  fireEvent.click(
    within(row(2)).getByRole('button', { name: 'Insert level before level 2' }),
  );
  await waitFor(() => expect(calls).toHaveLength(1));
  expect(lastCall().name).toBe('add');
  expect(lastCall().args).toMatchObject({ position: 2 });
  expect(lastCall().args).not.toHaveProperty('classEntryId');
  const inserted: Level = { id: 'n', hp: null };
  await settle(view, { levels: [a, inserted, b, c], adjustments }, 'n');
  await waitFor(() => expect(hpInput(2)).toHaveFocus());
  expect(row(2)).toHaveAttribute('id', 'sheet-level-n');
  expect(classPicker(2)).toHaveTextContent('Unspecified');
  expect(row(3)).toHaveAttribute('id', 'sheet-level-b');
  expect(within(row(3)).getByText('Rogue 1')).toBeVisible();
  expect(favoredPicker(1)).toHaveValue('hp');

  // A draft typed into the Rogue row travels with it up the list.
  fireEvent.change(hpInput(3), { target: { value: '7' } });
  fireEvent.click(
    within(row(3)).getByRole('button', { name: 'Move level 3 up' }),
  );
  await waitFor(() => expect(calls).toHaveLength(2));
  expect(lastCall().args).toMatchObject({ entryId: 'b', position: 2 });
  await settle(view, { levels: [a, b, inserted, c], adjustments });
  expect(row(2)).toHaveAttribute('id', 'sheet-level-b');
  expect(hpInput(2)).toHaveValue('7');
  expect(classPicker(2)).toHaveTextContent('Rogue');
  expect(favoredPicker(1)).toHaveValue('hp');
  expect(row(3)).toHaveAttribute('id', 'sheet-level-n');

  chooseClass(classPicker(2), 'Cleric');
  await waitFor(() => expect(calls).toHaveLength(3));
  expect(lastCall().args).toMatchObject({
    entryId: 'b',
    classEntryId: 'cleric',
  });
  const cleric: Level = { ...b, classId: 'cleric' };
  await settle(view, { levels: [a, cleric, inserted, c], adjustments });
  expect(within(row(2)).getByText('Cleric 1')).toBeVisible();
  expect(hpInput(2)).toHaveValue('7');

  fireEvent.click(
    within(row(2)).getByRole('button', { name: 'Delete level 2' }),
  );
  fireEvent.click(
    within(
      screen.getByRole('group', { name: 'Delete Cleric (level 2)?' }),
    ).getByRole('button', { name: 'Delete level 2' }),
  );
  await waitFor(() => expect(calls).toHaveLength(4));
  expect(lastCall().name).toBe('delete');
  expect(lastCall().args).toMatchObject({ entryId: 'b' });
  await settle(view, { levels: [a, inserted, c], adjustments });
  expect(within(levelsRegion()).getAllByRole('listitem')).toHaveLength(3);
  expect(row(2)).toHaveAttribute('id', 'sheet-level-n');
  expect(row(3)).toHaveAttribute('id', 'sheet-level-c');
  const unplaced = within(levelsRegion()).getByText(
    'Gained at a deleted Class Level:',
  );
  expect(unplaced).toBeVisible();
  expect(
    within(unplaced.parentElement!).getByText('Sneak attack'),
  ).toBeVisible();
  for (const level of [1, 2, 3]) {
    expect(
      within(row(level)).queryByText('Sneak attack'),
    ).not.toBeInTheDocument();
  }
  expect(screen.getByText('Level 4 as')).toBeVisible();

  view.show(buildSheet({ levels: [c], adjustments, hasClasses: true }));
  fireEvent.click(
    within(row(1)).getByRole('button', { name: 'Delete level 1' }),
  );
  fireEvent.click(
    within(
      screen.getByRole('group', { name: 'Delete Wizard (level 1)?' }),
    ).getByRole('button', { name: 'Delete level 1' }),
  );
  await waitFor(() => expect(calls).toHaveLength(5));
  await settle(view, { levels: [], adjustments, hasClasses: true });
  expect(
    within(levelsRegion()).queryByRole('listitem'),
  ).not.toBeInTheDocument();
  expect(screen.getByText('Level 1 as')).toBeVisible();
  expect(button('Level up')).toBeEnabled();
  expect(button('Level up')).toHaveFocus();
  expect(
    screen.getByRole('combobox', { name: 'Class for the next level' }),
  ).toBeEnabled();
  expect(within(levelsRegion()).getByText('Sneak attack')).toBeVisible();
});

test("a refused choice is reported on its row with the draft kept and retried from there; another player's pristine change refreshes while the dirty choice stays, acknowledged on the row", async () => {
  const fighter: Level = { id: 'a', hp: 8, classId: 'fighter' };
  const view = renderSheet(buildSheet({ levels: [fighter] }));
  pick(abilityPicker(1), 'strength');
  await waitFor(() => expect(calls).toHaveLength(1));
  await act(async () => {
    lastCall().reject(new ConvexError('Editing is paused'));
  });
  expect(await within(row(1)).findByRole('alert')).toHaveTextContent(
    "Changes weren't saved: Editing is paused. Your edits are kept. Save to try again.",
  );
  expect(abilityPicker(1)).toHaveValue('strength');
  expect(within(row(1)).getByText('Fighter 1')).toBeVisible();
  expect(snapshot?.entries.find((entry) => entry._id === 'a')).toMatchObject({
    state: { classEntryId: 'fighter', hpGained: 8 },
  });
  expect(
    within(row(1)).queryByText(
      'This level is outside the ability-increase milestones.',
    ),
  ).not.toBeInTheDocument();

  fireEvent.click(within(row(1)).getByRole('button', { name: 'Save choices' }));
  await waitFor(() => expect(calls).toHaveLength(2));
  expect(lastCall().args).toMatchObject({
    entryId: 'a',
    abilityIncrease: 'strength',
  });
  await settle(view, { levels: [{ ...fighter, abilityIncrease: 'strength' }] });
  expect(within(row(1)).getByText('Choices saved.')).toBeVisible();
  expect(within(row(1)).queryByRole('alert')).not.toBeInTheDocument();
  expect(
    within(row(1)).queryByRole('button', { name: 'Save choices' }),
  ).not.toBeInTheDocument();

  pick(favoredPicker(1), 'alt');
  expect(calls).toHaveLength(2);
  view.show(
    buildSheet({
      levels: [{ ...fighter, classId: 'rogue', abilityIncrease: 'strength' }],
      lastOperationId: 'other-player',
    }),
  );
  expect(classPicker(1)).toHaveTextContent('Rogue');
  expect(within(row(1)).getByText('Rogue 1')).toBeVisible();
  expect(favoredPicker(1)).toHaveValue('alt');
  expect(noteInput(1)).toBeVisible();
  const notice = within(row(1)).getByText(
    'Updated by another player. Your edits are kept.',
  );
  expect(notice).toBeVisible();
  fireEvent.click(button('Dismiss level 1 choices update'));
  expect(notice).not.toBeInTheDocument();
  expect(favoredPicker(1)).toHaveValue('alt');
});

test('a favored class is chosen for the Character; missing favored and milestone choices are marked inline, departures save with Accept, an acceptance survives an unrelated HP edit, and moving onto a milestone removes the warning', async () => {
  const fighter = (id: string, hp: number): Level => ({
    id,
    hp,
    classId: 'fighter',
    favoredClassBonus: id === 'a' ? null : { choice: 'hp' },
  });
  const levels = [
    fighter('a', 10),
    fighter('b', 6),
    fighter('c', 6),
    fighter('d', 6),
  ];
  const view = renderSheet(buildSheet({ levels }));
  expect(
    within(row(1)).queryByText('Choose a favored class bonus.'),
  ).not.toBeInTheDocument();
  const favoredFighter = screen.getByRole('checkbox', {
    name: 'Fighter favored',
  });
  expect(favoredFighter).not.toBeChecked();
  fireEvent.click(favoredFighter);
  await waitFor(() => expect(calls).toHaveLength(1));
  expect(lastCall().name).toBe('settings');
  expect(lastCall().args).toMatchObject({ favoredClassIds: ['fighter'] });
  await settle(view, { levels, favoredClassIds: ['fighter'] });
  expect(
    screen.getByRole('checkbox', { name: 'Fighter favored' }),
  ).toBeChecked();
  expect(screen.getByText('Favored class saved.')).toBeVisible();

  expect(within(row(1)).getByText('Choose a favored class bonus.')).toHaveClass(
    'text-sky-300',
  );
  expect(favoredPicker(1)).toHaveClass('ring-sky-400/80');
  expect(favoredPicker(2)).not.toHaveClass('ring-sky-400/80');
  expect(within(row(4)).getByText('Choose an ability increase.')).toHaveClass(
    'text-sky-300',
  );
  expect(abilityPicker(4)).toHaveClass('ring-sky-400/80');
  expect(abilityPicker(2)).not.toHaveClass('ring-sky-400/80');
  expect(abilityPicker(2)).toHaveClass('text-muted-foreground');
  expect(abilityPicker(2)).toBeEnabled();
  expect(
    screen.queryByRole('button', { name: /Accept|Reopen/ }),
  ).not.toBeInTheDocument();

  pick(abilityPicker(2), 'dexterity');
  await waitFor(() => expect(calls).toHaveLength(2));
  expect(lastCall().args).toMatchObject({
    entryId: 'b',
    abilityIncrease: 'dexterity',
  });
  const departed = levels.map((level) =>
    level.id === 'b'
      ? { ...level, abilityIncrease: 'dexterity' as const }
      : level,
  );
  await settle(view, { levels: departed, favoredClassIds: ['fighter'] });
  const message = 'This level is outside the ability-increase milestones.';
  expect(within(row(2)).getByText(message).parentElement).toHaveClass(
    'text-amber-300',
  );
  const accept = within(row(2)).getByRole('button', {
    name: 'Accept',
    description: message,
  });
  fireEvent.click(accept);
  await waitFor(() => expect(calls).toHaveLength(3));
  const warning = findCalculatedWarning(
    buildSheet({ levels: departed, favoredClassIds: ['fighter'] }),
    'abilityIncreaseMilestone',
    'b',
  );
  expect(lastCall().args).toMatchObject({
    check: 'abilityIncreaseMilestone',
    subject: 'b',
    fingerprint: warning.fingerprint,
  });
  await settle(view, {
    levels: departed,
    favoredClassIds: ['fighter'],
    accepted: [warning],
  });
  expect(within(row(2)).getByText('Accepted')).toBeVisible();

  // An unrelated HP edit on another row leaves the acceptance standing.
  view.show(
    buildSheet({
      levels: departed.map((level) =>
        level.id === 'a' ? { ...level, hp: 11 } : level,
      ),
      favoredClassIds: ['fighter'],
      accepted: [warning],
    }),
  );
  expect(within(row(2)).getByText('Accepted')).toBeVisible();

  // Moved onto level 4, the increase is due: nothing to accept any more.
  const [first, second, third, fourth] = departed;
  view.show(
    buildSheet({
      levels: [first!, third!, fourth!, second!],
      favoredClassIds: ['fighter'],
      accepted: [warning],
    }),
  );
  expect(row(4)).toHaveAttribute('id', 'sheet-level-b');
  expect(abilityPicker(4)).toHaveValue('dexterity');
  expect(within(row(4)).queryByText(message)).not.toBeInTheDocument();
  expect(screen.queryByText('Accepted')).not.toBeInTheDocument();
  expect(abilityPicker(4)).not.toHaveClass('ring-sky-400/80');
  expect(
    within(row(3)).queryByText('Choose an ability increase.'),
  ).not.toBeInTheDocument();
});

test('BAB, the saves, Initiative, CMB, AC and CMD open accessible breakdowns naming their class sources, by click, keyboard and touch at every approved width, and focus returns to the number', () => {
  const sheet = buildSheet({
    levels: [
      { id: 'a', hp: 10, classId: 'fighter' },
      { id: 'b', hp: 6, classId: 'rogue' },
    ],
  });
  renderSheet(sheet);
  const derived = sheet.calculated.derivedStatistics;
  const figures: [string, number, boolean][] = [
    ['Base attack bonus', derived.bab.total, true],
    ['Fortitude save', derived.fortitude.total, true],
    ['Reflex save', derived.reflex.total, true],
    ['Will save', derived.will.total, true],
    ['Initiative', derived.initiative.total, true],
    ['Combat Maneuver Bonus', derived.cmb.total, true],
    ['Armor Class', derived.ac.total, false],
    ['Touch AC', derived.touchAc.total, false],
    ['Flat-footed AC', derived.flatFootedAc.total, false],
    ['Combat Maneuver Defense', derived.cmd.total, false],
    ['Flat-footed CMD', derived.flatFootedCmd.total, false],
  ];
  expect(derived.bab.total).toBe(1);
  expect(derived.fortitude.total).toBe(2);
  expect(derived.reflex.total).toBe(2);
  const triggers = figures.map(([title, total, isSigned]) =>
    button(`${title} ${isSigned ? formatModifier(total) : total}, breakdown`),
  );
  for (const trigger of triggers)
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

  for (const widthPx of [390, 1180, 1440]) {
    Object.defineProperty(window, 'innerWidth', {
      value: widthPx,
      configurable: true,
    });
    const fortitude = button('Fortitude save +2, breakdown');
    fireEvent.pointerEnter(fortitude, { pointerType: 'touch' });
    expect(
      screen.queryByRole('group', { name: 'Fortitude save breakdown' }),
    ).not.toBeInTheDocument();
    fireEvent.click(fortitude);
    const panel = screen.getByRole('group', {
      name: 'Fortitude save breakdown',
    });
    expect(panel).toBeVisible();
    expect(within(panel).getByText('Fighter 1')).toBeVisible();
    expect(within(panel).getByText('Constitution')).toBeVisible();
    expect(panel).not.toHaveTextContent(/builtin|entryId|revision/);
    fireEvent.keyDown(panel, { key: 'Escape' });
    expect(
      screen.queryByRole('group', { name: 'Fortitude save breakdown' }),
    ).not.toBeInTheDocument();
    expect(fortitude).toHaveFocus();
  }

  fireEvent.click(button('Base attack bonus +1, breakdown'));
  const bab = screen.getByRole('group', {
    name: 'Base attack bonus breakdown',
  });
  expect(within(bab).getByText('Fighter 1')).toBeVisible();
  fireEvent.click(within(bab).getByRole('button', { name: 'Close breakdown' }));
  expect(button('Base attack bonus +1, breakdown')).toHaveFocus();
  fireEvent.click(button('Combat Maneuver Defense 11, breakdown'));
  expect(
    screen.getByRole('group', { name: 'Combat Maneuver Defense breakdown' }),
  ).toBeVisible();
});

test('maintenance disables every Class Level choice, insertion, warning action and the favored classes; the block states the reason once and each disabled action is described by it; nothing is written', () => {
  const message = 'Editing is paused for maintenance.';
  maintenance.mockReturnValue({ kind: 'maintenance', readOnly: true, message });
  // Four hit points at a d10 class's first level: a rules warning in the row.
  renderSheet(buildSheet({ levels: [{ id: 'a', hp: 4, classId: 'fighter' }] }));
  const firstLevelRule =
    "A PC's first Class Level normally gains 10 hit points.";
  const accept = within(row(1)).getByRole('button', { name: 'Accept' });
  for (const control of [
    classPicker(1),
    favoredPicker(1),
    abilityPicker(1),
    hpInput(1),
    within(row(1)).getByRole('button', { name: 'Insert level before level 1' }),
    screen.getByRole('combobox', { name: 'Class for the next level' }),
    button('Level up'),
    accept,
    screen.getByRole('checkbox', { name: 'Fighter favored' }),
  ]) {
    expect(control).toBeDisabled();
  }
  expect(within(levelsRegion()).getAllByText(message)).toHaveLength(1);
  expect(within(row(1)).queryByText(message)).not.toBeInTheDocument();
  expect(
    within(row(1)).getByRole('button', { name: 'Save hit points' }),
  ).toHaveAccessibleDescription(message);
  expect(accept).toHaveAccessibleDescription(`${firstLevelRule} ${message}`);
  expect(button('Level up')).toHaveAccessibleDescription(message);
  fireEvent.click(classPicker(1));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  fireEvent.click(accept);
  fireEvent.click(screen.getByRole('checkbox', { name: 'Fighter favored' }));
  expect(calls).toEqual([]);
});

test('"Other…" with an empty or blank note is refused at the note field with the draft kept, from Enter, from leaving the field and from Save choices; a note then saves', async () => {
  const fighter: Level = { id: 'a', hp: 10, classId: 'fighter' };
  const view = renderSheet(buildSheet({ levels: [fighter] }));
  const error = 'Describe the alternative favored class bonus';
  pick(favoredPicker(1), 'alt');
  expect(calls).toEqual([]);
  fireEvent.keyDown(noteInput(1), { key: 'Enter' });
  expect(await within(row(1)).findByText(error)).toHaveAttribute(
    'role',
    'alert',
  );
  expect(noteInput(1)).toHaveAttribute('aria-invalid', 'true');
  expect(noteInput(1)).toHaveAccessibleDescription(error);
  expect(favoredPicker(1)).toHaveValue('alt');
  expect(calls).toEqual([]);

  fireEvent.change(noteInput(1), { target: { value: '   ' } });
  fireEvent.blur(noteInput(1));
  fireEvent.click(within(row(1)).getByRole('button', { name: 'Save choices' }));
  expect(await within(row(1)).findByText(error)).toBeVisible();
  expect(noteInput(1)).toHaveValue('   ');
  expect(calls).toEqual([]);

  fireEvent.change(noteInput(1), { target: { value: 'Extra rage round' } });
  fireEvent.blur(noteInput(1));
  await waitFor(() => expect(calls).toHaveLength(1));
  expect(lastCall().args).toMatchObject({
    entryId: 'a',
    favoredClassBonus: { choice: 'alt', note: 'Extra rage round' },
  });
  const withNote: Level = {
    ...fighter,
    favoredClassBonus: { choice: 'alt', note: 'Extra rage round' },
  };
  await settle(view, { levels: [withNote] });
  expect(within(row(1)).queryByText(error)).not.toBeInTheDocument();
  expect(noteInput(1)).not.toHaveAttribute('aria-invalid', 'true');
  expect(within(row(1)).getByText('Choices saved.')).toBeVisible();
});

/** The fixture's Rogue as a prestige class, with the sheet recalculated. */
function withPrestigeRogue(input: CharacterSheetSnapshot) {
  const catalogEntries = input.catalogEntries.map((entry) =>
    entry._id === 'rogue' && isClassCatalogEntry(entry)
      ? {
          ...entry,
          detail: { ...entry.detail, classKind: 'prestige' as const },
        }
      : entry,
  );
  const calculated = calculateCharacterSheetProjections({
    characterKind: 'pc',
    entries: input.entries,
    catalogEntries,
  });
  return {
    ...input,
    catalogEntries,
    calculated: calculated.current,
    permanentCalculated: calculated.permanent,
  };
}

test('hit points above the hit die and a first PC level below it warn at the HP field with Accept; too many favored classes and a prestige favored class warn under the favored classes; a level of a deleted class reads Unspecified with its missing-class marker', async () => {
  const levels: Level[] = [
    { id: 'a', hp: 4, classId: 'fighter' },
    { id: 'b', hp: 12, classId: 'fighter' },
    { id: 'c', hp: 6, classId: 'deleted-class' },
  ];
  const input = withPrestigeRogue(
    buildSheet({ levels, favoredClassIds: ['fighter', 'rogue'] }),
  );
  renderSheet(input);
  const firstLevelRule =
    "A PC's first Class Level normally gains 10 hit points.";
  const aboveMaximum = 'Hit points gained exceed the d10 maximum.';
  expect(within(row(1)).getByText(firstLevelRule).parentElement).toHaveClass(
    'text-amber-300',
  );
  expect(
    within(row(1)).getByRole('button', {
      name: 'Accept',
      description: firstLevelRule,
    }),
  ).toBeEnabled();
  expect(within(row(2)).getByText(aboveMaximum).parentElement).toHaveClass(
    'text-amber-300',
  );
  expect(within(row(2)).queryByText(firstLevelRule)).not.toBeInTheDocument();
  expect(within(row(3)).queryByText(aboveMaximum)).not.toBeInTheDocument();

  const character = within(screen.getByRole('region', { name: 'Character' }));
  for (const rule of [
    'Choose up to 1 favored class.',
    'Rogue cannot normally be a favored class.',
  ]) {
    expect(character.getByText(rule).parentElement).toHaveClass(
      'text-amber-300',
    );
    expect(
      character.getByRole('button', { name: 'Accept', description: rule }),
    ).toBeEnabled();
  }
  expect(within(levelsRegion()).queryByText(/favored class\./)).toBeNull();

  expect(classPicker(3)).toHaveTextContent('Unspecified');
  expect(within(row(3)).getByText('Choose a class.')).toHaveClass(
    'text-sky-300',
  );
  expect(classPicker(3)).toHaveClass('ring-sky-400/80');
  expect(hpInput(3)).not.toHaveAccessibleDescription();
  fireEvent.click(
    within(row(3)).getByRole('button', { name: 'Delete level 3' }),
  );
  const question = screen.getByRole('group', {
    name: 'Delete Unspecified (level 3)?',
  });
  fireEvent.click(
    within(question).getByRole('button', { name: 'Keep level 3' }),
  );

  fireEvent.click(
    within(row(2)).getByRole('button', {
      name: 'Accept',
      description: aboveMaximum,
    }),
  );
  await waitFor(() => expect(calls).toHaveLength(1));
  expect(lastCall().name).toBe('accept');
  expect(lastCall().args).toMatchObject({
    check: 'hpGainedAboveMaximum',
    subject: 'b',
    fingerprint: findCalculatedWarning(input, 'hpGainedAboveMaximum', 'b')
      .fingerprint,
  });
});

test.each(['deleted', 'legacy'])(
  'a %s class definition remains Unspecified while another choice saves without replacing its reference',
  async (kind) => {
    let input = buildSheet({
      levels: [
        {
          id: 'a',
          hp: 8,
          classId: kind === 'deleted' ? 'deleted-class' : 'fighter',
        },
      ],
    });
    if (kind === 'legacy') {
      const catalogEntries = input.catalogEntries.map((entry) =>
        entry._id === 'fighter' && isClassCatalogEntry(entry)
          ? { ...entry, detail: { kind: 'class' as const } }
          : entry,
      );
      const calculated = calculateCharacterSheetProjections({
        characterKind: 'pc',
        entries: input.entries,
        catalogEntries,
      });
      input = {
        ...input,
        catalogEntries,
        calculated: calculated.current,
        permanentCalculated: calculated.permanent,
      };
    }
    renderSheet(input);
    expect(classPicker(1)).toHaveTextContent('Unspecified');
    expect(within(row(1)).getByText('Choose a class.')).toBeVisible();
    pick(abilityPicker(1), 'strength');
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(lastCall().args).toMatchObject({
      entryId: 'a',
      abilityIncrease: 'strength',
    });
    expect(lastCall().args).not.toHaveProperty('classEntryId');
    expect(snapshot?.entries.find((entry) => entry._id === 'a')).toMatchObject({
      state: { classEntryId: kind === 'deleted' ? 'deleted-class' : 'fighter' },
    });
  },
);

test('racial Hit Dice count toward Hit Dice but not Level, ability increases accept the character-level reading, and missing racial hit points leave HP not complete', () => {
  const levels: Level[] = ['a', 'b', 'c'].map((id) => ({
    id,
    hp: 6,
    classId: 'fighter',
  }));
  renderSheet(buildSheet({ race: { key: 'human', hitDice: 1 }, levels }));
  const summaryValue = (label: string) =>
    screen.getByText(label, { selector: 'dt' }).nextElementSibling;
  expect(summaryValue('Level')).toHaveTextContent('3');
  expect(summaryValue('Hit Dice')).toHaveTextContent('4');

  expect(
    within(row(3)).queryByText('Choose an ability increase.'),
  ).not.toBeInTheDocument();
  expect(abilityPicker(3)).not.toHaveClass('ring-sky-400/80');
  expect(
    within(row(2)).queryByText('Choose an ability increase.'),
  ).not.toBeInTheDocument();

  const hp = screen.getByRole('button', { name: 'HP not complete, breakdown' });
  fireEvent.click(hp);
  expect(
    within(screen.getByRole('group', { name: 'HP breakdown' })).getByText(
      'Not complete: racial Hit Dice have no hit points yet.',
    ),
  ).toBeVisible();
});

test('a Prestige Class shows its entry prerequisites now and at its first level apart, each accepted alone, and its later levels show none', () => {
  const input = withPrestigeRogue(
    buildSheet({
      levels: [
        { id: 'a', hp: 8, classId: 'rogue' },
        { id: 'b', hp: 8, classId: 'rogue' },
      ],
    }),
  );
  const catalogEntries = input.catalogEntries.map((entry) =>
    entry._id === 'rogue'
      ? { ...entry, prerequisites: [{ ability: 'strength' as const, min: 13 }] }
      : entry,
  );
  const calculated = calculateCharacterSheetProjections({
    characterKind: 'pc',
    entries: input.entries,
    catalogEntries,
  });
  renderSheet({
    ...input,
    catalogEntries,
    calculated: calculated.current,
    permanentCalculated: calculated.permanent,
  });
  const first = within(row(1));
  const now = within(first.getByRole('group', { name: 'Prerequisites now' }));
  const atLevel = within(
    first.getByRole('group', { name: 'Prerequisites at recorded level 1' }),
  );
  expect(now.getByText('Prerequisites not met')).toBeVisible();
  expect(
    now.getByRole('list', { name: 'Prerequisites now' }),
  ).toHaveTextContent('Strength 13 not met');
  expect(atLevel.getByText('Prerequisites not met')).toBeVisible();
  const accept = now.getByRole('button', { name: /^Accept / });
  fireEvent.click(accept);
  expect(calls.at(-1)).toMatchObject({
    name: 'accept',
    args: { check: 'prerequisites.current' },
  });
  expect(atLevel.getByRole('button', { name: /^Accept / })).toBeEnabled();
  expect(
    within(row(2)).queryByRole('group', { name: /^Prerequisites/ }),
  ).toBeNull();
  expect(
    screen.queryByRole('button', { name: /(earlier|later) at level/ }),
  ).toBeNull();
});

// Prestige Classes in the class picker (#406): entry requirements checked
// before the class's own first-level benefits, previewed at an edited
// level, never invented while a clause is unresolved, and never blocking.

const duelist: ExtraClass = {
  id: 'duelist',
  name: 'Duelist',
  classKind: 'prestige',
  prerequisites: [{ bab: 2 }],
};
const initiate: ExtraClass = {
  id: 'initiate',
  name: 'Initiate',
  classKind: 'prestige',
  prerequisites: [{ bab: 1 }],
};
const dialog = () => within(screen.getByRole('dialog'));
const card = (name: string) => dialog().getByRole('radio', { name });
function openRequirements(name: string) {
  fireEvent.click(
    dialog().getByRole('button', { name: `Entry requirements for ${name}` }),
  );
}

test('Prestige cards show entry met or not met before their first-level benefits; an unmet one is still chosen and added with only its class and empty hit points', async () => {
  const fighter: Level = { id: 'a', hp: 10, classId: 'fighter' };
  const view = renderSheet(
    withClasses(buildSheet({ levels: [fighter] }), [duelist, initiate]),
  );
  const nextClass = screen.getByRole('combobox', {
    name: 'Class for the next level',
  });
  fireEvent.click(nextClass);
  expect(card('Fighter')).toBeChecked();
  expect(card('Fighter')).not.toHaveAccessibleDescription(/Prestige/);
  // Fighter 1 has BAB +1: Duelist's +2 would only come from its own level.
  expect(card('Duelist')).toHaveAccessibleDescription(
    'd10 Prestige Class Entry requirements not met',
  );
  expect(card('Initiate')).toHaveAccessibleDescription(
    'd10 Prestige Class Entry requirements met',
  );
  openRequirements('Duelist');
  expect(
    dialog().getByRole('button', { name: 'Entry requirements for Duelist' }),
  ).toHaveAttribute('aria-expanded', 'true');
  expect(
    dialog().getByRole('list', { name: 'Prerequisites at recorded level 2' }),
  ).toHaveTextContent('BAB +2 not met');
  expect(
    dialog().queryByRole('group', { name: 'Prerequisites now' }),
  ).not.toBeInTheDocument();

  fireEvent.click(card('Duelist'));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(nextClass).toHaveTextContent('Duelist');
  expect(within(levelsRegion()).getAllByRole('listitem')).toHaveLength(1);
  expect(calls).toEqual([]);

  fireEvent.click(button('Level up'));
  await waitFor(() => expect(calls).toHaveLength(1));
  expect(lastCall().name).toBe('add');
  expect(lastCall().args).toMatchObject({ classEntryId: 'duelist' });
  expect(lastCall().args).not.toHaveProperty('hpGained');
  view.show(
    withClasses(
      buildSheet({
        levels: [fighter, { id: 'b', hp: null, classId: 'fighter' }],
        lastOperationId: operationOf(lastCall()),
      }),
      [duelist, initiate],
      { b: 'duelist' },
    ),
  );
  await act(async () => {
    lastCall().resolve('b');
  });
  expect(classPicker(2)).toHaveTextContent('Duelist');
  expect(hpInput(2)).toHaveValue('');
});

test('choosing a class for an earlier level previews entry at that level, without the later levels; once saved, its first level shows prerequisites now and at that level apart', async () => {
  const levels: Level[] = [
    { id: 'a', hp: 10, classId: 'fighter' },
    { id: 'b', hp: 10, classId: 'fighter' },
  ];
  const view = renderSheet(withClasses(buildSheet({ levels }), [duelist]));
  fireEvent.click(
    screen.getByRole('combobox', { name: 'Class for the next level' }),
  );
  expect(card('Duelist')).toHaveAccessibleDescription(
    /Entry requirements met$/,
  );
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });

  fireEvent.click(classPicker(1));
  expect(card('Duelist')).toHaveAccessibleDescription(
    /Entry requirements not met$/,
  );
  openRequirements('Duelist');
  expect(
    dialog().getByRole('list', { name: 'Prerequisites at recorded level 1' }),
  ).toHaveTextContent('BAB +2 not met');
  // A hypothetical edit claims nothing about the current build.
  expect(
    dialog().queryByRole('group', { name: 'Prerequisites now' }),
  ).not.toBeInTheDocument();
  fireEvent.click(card('Duelist'));
  await waitFor(() => expect(calls).toHaveLength(1));
  expect(lastCall().args).toMatchObject({
    entryId: 'a',
    classEntryId: 'duelist',
  });
  view.show(
    withClasses(
      buildSheet({ levels, lastOperationId: operationOf(lastCall()) }),
      [duelist],
      { a: 'duelist' },
    ),
  );
  await act(async () => {
    lastCall().resolve(null);
  });
  const first = within(row(1));
  expect(
    within(first.getByRole('group', { name: 'Prerequisites now' })).getByText(
      'Prerequisites met',
    ),
  ).toBeVisible();
  expect(
    within(
      first.getByRole('group', { name: 'Prerequisites at recorded level 1' }),
    ).getByText('Prerequisites not met'),
  ).toBeVisible();
  expect(
    within(row(2)).queryByRole('group', { name: /^Prerequisites/ }),
  ).not.toBeInTheDocument();
  expect(hpInput(1)).toHaveValue('10');

  fireEvent.click(
    screen.getByRole('combobox', { name: 'Class for the next level' }),
  );
  openRequirements('Duelist');
  expect(
    within(
      dialog().getByRole('group', { name: 'Prerequisites now' }),
    ).getByText('Prerequisites met'),
  ).toBeVisible();
  expect(
    dialog().getByRole('group', { name: 'Prerequisites at recorded level 1' }),
  ).toBeVisible();
});

test('an unresolved Perform (dance) requirement keeps its wording and its checked clauses with no met or failed status, even with generic Perform ranks', () => {
  const shadowdancer: ExtraClass = {
    id: 'shadowdancer',
    name: 'Shadowdancer',
    classKind: 'prestige',
    prerequisiteText: 'Perform (dance) 5 ranks; base attack bonus +1.',
    prerequisites: [{ skillRanks: 'skill.prf.dance', min: 5 }, { bab: 1 }],
  };
  renderSheet(
    withClasses(
      buildSheet({
        levels: [
          {
            id: 'a',
            hp: 10,
            classId: 'fighter',
            skillRanks: { 'skill.prf': 5 },
          },
        ],
      }),
      [shadowdancer],
    ),
  );
  fireEvent.click(
    screen.getByRole('combobox', { name: 'Class for the next level' }),
  );
  expect(card('Shadowdancer')).toHaveAccessibleDescription(
    'd10 Prestige Class',
  );
  openRequirements('Shadowdancer');
  expect(
    dialog().getByText(
      'Prerequisites: Perform (dance) 5 ranks; base attack bonus +1.',
    ),
  ).toBeVisible();
  const checked = dialog().getByRole('list', {
    name: 'Prerequisites at recorded level 2',
  });
  expect(checked).toHaveTextContent('BAB +1 met');
  expect(checked).not.toHaveTextContent(/Perform/);
  expect(
    dialog().queryByText(/^(Prerequisites|Entry requirements) (met|not met)$/),
  ).not.toBeInTheDocument();
});

test('loading and an unavailable sheet show no class message; an empty catalog offers Unspecified with "No classes available." in a bottom sheet on the phone', () => {
  snapshot = undefined;
  const view = render(page());
  expect(screen.queryByText('No classes available.')).not.toBeInTheDocument();
  snapshot = null;
  view.rerender(page());
  expect(screen.queryByText('No classes available.')).not.toBeInTheDocument();
  view.unmount();

  renderSheet(buildSheet({ levels: [], hasClasses: false }));
  fireEvent.click(
    screen.getByRole('combobox', { name: 'Class for the next level' }),
  );
  expect(screen.getByRole('dialog')).toHaveAttribute('data-side', 'bottom');
  expect(dialog().getByText('No classes available.')).toBeVisible();
  expect(card('Unspecified')).toBeChecked();
  expect(card('Unspecified')).toHaveFocus();
});

test('the class cards are one keyboard stop: arrows, Home and End move between them without choosing, a card chooses on activation, and focus returns to the field in the tablet side panel', async () => {
  window.matchMedia = vi.fn().mockReturnValue(media(true));
  renderSheet(
    withClasses(
      buildSheet({ levels: [{ id: 'a', hp: 10, classId: 'fighter' }] }),
      [duelist],
    ),
  );
  fireEvent.click(classPicker(1));
  expect(screen.getByRole('dialog')).toHaveAttribute('data-side', 'right');
  const group = dialog().getByRole('radiogroup', { name: 'Class at level 1' });
  const radios = within(group).getAllByRole('radio');
  expect(card('Fighter')).toHaveFocus();
  expect(radios.filter((radio) => radio.tabIndex === 0)).toEqual([
    card('Fighter'),
  ]);
  fireEvent.keyDown(card('Fighter'), { key: 'ArrowRight' });
  expect(radios[2]).toHaveFocus();
  fireEvent.keyDown(radios[2]!, { key: 'Home' });
  expect(card('Unspecified')).toHaveFocus();
  fireEvent.keyDown(card('Unspecified'), { key: 'ArrowUp' });
  expect(card('Duelist')).toHaveFocus();
  fireEvent.keyDown(card('Duelist'), { key: 'End' });
  expect(card('Duelist')).toHaveFocus();
  expect(card('Fighter')).toBeChecked();
  expect(calls).toEqual([]);
  // A native button: Enter and Space activate it as a tap does.
  expect(card('Duelist').tagName).toBe('BUTTON');
  fireEvent.click(card('Duelist'));
  await waitFor(() => expect(calls).toHaveLength(1));
  expect(lastCall().args).toMatchObject({
    entryId: 'a',
    classEntryId: 'duelist',
  });
  await waitFor(() => expect(classPicker(1)).toHaveFocus());
});

// A saved class version switch (#583) is reported once under the Class
// Levels heading, with what it changed, until dismissed or superseded.

const switchedBlocks = () => (
  <CharacterSheetBlocks blocks={['levels', 'grants']} />
);
const reopeningLevels: Level[] = [
  { id: 'a', hp: 10, classId: 'fighter' },
  { id: 'b', hp: 13, classId: 'fighter' },
];
/** Switches every Fighter level to the homebrew copy from this device. */
async function switchToHomebrew() {
  const before = { levels: reopeningLevels, copies: [homebrewFighter] };
  const accepted = [fighterHpWarning(before)];
  snapshot = fighterVersionSheet({ ...before, accepted });
  const view = render(switchedBlocks());
  fireEvent.click(
    within(row(1)).getByRole('button', { name: /^Rules used: / }),
  );
  const chooser = within(screen.getByRole('dialog'));
  fireEvent.click(
    chooser.getByRole('radio', { name: 'Fighter (this Character)' }),
  );
  fireEvent.click(
    chooser.getByRole('button', { name: 'Switch all Fighter levels' }),
  );
  await waitFor(() => expect(calls).toHaveLength(1));
  expect(within(levelsRegion()).queryByText(/now uses/)).toBeNull();
  const after = (lastOperationId: string) =>
    fighterVersionSheet({
      ...before,
      classOf: { a: 'fighter-homebrew', b: 'fighter-homebrew' },
      accepted,
      lastOperationId,
    });
  snapshot = after(operationOf(lastCall()));
  view.rerender(switchedBlocks());
  await act(async () => {
    lastCall().resolve(null);
  });
  return {
    showLater(lastOperationId: string) {
      snapshot = after(lastOperationId);
      view.rerender(switchedBlocks());
    },
  };
}
function switchNotice() {
  const headlines = within(levelsRegion()).getAllByText(
    'Fighter now uses Fighter (this Character).',
  );
  expect(headlines).toHaveLength(1);
  const notice = headlines[0]?.closest('[role="status"]');
  if (!(notice instanceof HTMLElement)) throw new Error('Expected a notice');
  return notice;
}

test('a saved version switch is reported once under the heading, leading to the entry that stopped counting and to the warning to accept again, until Dismiss', async () => {
  await switchToHomebrew();
  const notice = switchNotice();
  expect(
    notice.compareDocumentPosition(row(1)) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
  for (const level of [1, 2])
    expect(within(row(level)).queryByText(/now uses/)).toBeNull();
  expect(within(row(1)).getByText('Class version saved.')).toBeVisible();
  expect(within(notice).getByText('BAB +2 → +1')).toBeVisible();
  expect(within(notice).getByText('Stops counting')).toBeVisible();
  expect(within(notice).queryByText(/keep their hit points/)).toBeNull();

  const features = screen.getByRole('region', { name: 'Class features' });
  const dormantGroup = within(features).getByRole('button', {
    name: 'Not counting now (1)',
  });
  expect(dormantGroup).toHaveAttribute('aria-expanded', 'false');
  fireEvent.click(within(notice).getByRole('button', { name: 'Bravery +1' }));
  expect(dormantGroup).toHaveAttribute('aria-expanded', 'true');
  await waitFor(() =>
    expect(
      within(features).getByRole('switch', { name: 'Bravery +1: on' }),
    ).toHaveFocus(),
  );

  expect(
    within(notice).getByText(/: will need accepting again$/),
  ).toBeVisible();
  fireEvent.click(
    within(notice).getByRole('button', {
      name: 'Hit points gained exceed the d12 maximum',
    }),
  );
  await waitFor(() =>
    expect(
      within(row(2)).getByRole('button', { name: 'Accept' }),
    ).toHaveFocus(),
  );

  fireEvent.click(
    within(notice).getByRole('button', {
      name: 'Dismiss class version result',
    }),
  );
  expect(within(levelsRegion()).queryByText(/now uses/)).toBeNull();
  expect(calls).toHaveLength(1);
});

test('the switch result gives way to a later change from anyone', async () => {
  const view = await switchToHomebrew();
  expect(switchNotice()).toBeVisible();
  view.showLater('other-player');
  expect(within(levelsRegion()).queryByText(/now uses/)).toBeNull();
  expect(calls).toHaveLength(1);
});

// #411: a release retired the CRB fighter and rogue (pp. 55, 66). A fighter
// keeps adding fighter levels; the rogue card shows the reason and can't be
// chosen.
test('the class picker marks a retired class unavailable unless the Character already has it', () => {
  const sheet = buildSheet({
    levels: [{ id: 'a', hp: 10, classId: 'fighter' }],
  });
  renderSheet({
    ...sheet,
    catalogView: {
      releaseNumber: 1,
      calculationIdentity: catalogRuntimeCompatibility.calculation,
      resources: { castingTables: undefined },
      legalInputs: null,
      definitions: [],
      advisories: [],
      heldDefinitionIds: ['fighter', 'rogue'] as Id<'catalogEntry'>[],
    },
  });
  fireEvent.click(
    screen.getByRole('combobox', { name: 'Class for the next level' }),
  );
  expect(card('Fighter')).toBeEnabled();
  expect(card('Fighter')).not.toHaveAccessibleDescription(
    new RegExp(retiredChoiceReason),
  );
  expect(card('Rogue')).toBeDisabled();
  expect(card('Rogue')).toHaveAccessibleDescription(
    expect.stringContaining(retiredChoiceReason),
  );
  expect(card('Wizard')).toBeEnabled();
});
