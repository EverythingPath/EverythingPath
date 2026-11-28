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
import { defaultAbilityScores } from '~/lib/character-sheet';
import { CharacterSheetBlocks } from './character-sheet-blocks-test-fixture';
import {
  buildSheet,
  characterId,
  emptyOwnerCandidates,
  monkClassCatalog,
  representativeEquipment,
  representativeWeapon,
  type AttackRoutineFixture,
  type CatalogSheetEntry,
} from './character-sheet-test-fixture';
import type { CharacterSheetSnapshot } from './use-character-sheet';
import { representativeSelectionCatalog } from '@convex/lib/representativeSelectionCatalog';
import { characterSheetNames } from './character-sheet-api-test-fixture';
import type { FunctionReference } from 'convex/server';

// The Attack Routine editor (#314): a panel whose every field saves at once,
// keeps refused and newer drafts, and returns focus where it came from.

type Call = {
  name: string;
  args: Record<string, unknown>;
  resolve: (value: unknown) => void;
  reject: (error: unknown) => void;
};
let calls: Call[] = [];
let snapshot: CharacterSheetSnapshot | undefined;
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

const strike: AttackRoutineFixture = {
  id: 'strike',
  name: 'Sword strike',
  weaponEntryId: 'sword',
};
const sheet = (
  routine: Partial<AttackRoutineFixture> = {},
  input: Parameters<typeof buildSheet>[0] = {},
) =>
  buildSheet({
    levels: [{ id: 'level-1', hp: 10, classId: 'fighter' }],
    sheetEntries: [
      representativeWeapon('longsword', 'sword'),
      representativeWeapon('dagger', 'dagger'),
    ],
    attackRoutines: [{ ...strike, ...routine }],
    ...input,
  });

const offHandGroup = 'Off-hand weapon';
const offHandMode = 'Off-hand attack mode';
const hammer = representativeWeapon('gnome-hooked-hammer', 'hammer');

const page = () => <CharacterSheetBlocks blocks={['attacks']} />;
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
const editButton = (name = 'Sword strike') =>
  screen.getByRole('button', { name: `Edit ${name}` });
function openEditor(name?: string) {
  fireEvent.click(editButton(name));
  return screen.getByRole('dialog', { name: 'Attack routine' });
}
const nameField = (dialog: HTMLElement) =>
  within(dialog).getByRole('textbox', { name: 'Routine name' });
const choice = (dialog: HTMLElement, group: string, name: string) =>
  within(within(dialog).getByRole('radiogroup', { name: group })).getByRole(
    'radio',
    { name },
  );
const lastCall = () => {
  const call = calls.at(-1);
  if (!call) throw new Error('Expected a write');
  return call;
};
const settle = (action: () => void) =>
  act(async () => {
    action();
    await Promise.resolve();
  });
const type = (dialog: HTMLElement, value: string) =>
  settle(() => fireEvent.change(nameField(dialog), { target: { value } }));

test('each field saves as it changes, with no Save step, and an empty name stays local while hands still save', async () => {
  renderSheet(sheet());
  const dialog = openEditor();
  expect(within(dialog).queryByRole('button', { name: /^Save/ })).toBeNull();

  await type(dialog, 'Cleave');
  expect(lastCall()).toMatchObject({
    name: 'editAttackRoutine',
    args: { entryId: 'strike', name: 'Cleave' },
  });
  expect(lastCall().args).not.toHaveProperty('hands');
  await settle(() => lastCall().resolve(1));
  expect(within(dialog).getByText('Saved')).toBeVisible();

  await settle(() => fireEvent.click(choice(dialog, 'Held in', 'Two hands')));
  expect(lastCall().args).toMatchObject({ hands: 'two' });
  await settle(() => lastCall().resolve(2));
  await settle(() => fireEvent.click(choice(dialog, 'Attack mode', 'Thrown')));
  expect(lastCall().args).toMatchObject({
    mode: 'thrown',
  });
  await settle(() => lastCall().resolve(3));

  const written = calls.length;
  await type(dialog, '   ');
  expect(calls).toHaveLength(written);
  expect(within(dialog).getByRole('alert')).toHaveTextContent(
    'Routine name is required',
  );
  expect(nameField(dialog)).toHaveAttribute('aria-invalid', 'true');
  await settle(() => fireEvent.click(choice(dialog, 'Held in', 'One hand')));
  expect(lastCall().args).toMatchObject({ hands: 'one' });
  expect(nameField(dialog)).toHaveValue('   ');
});

test('a light weapon in two hands explains its Strength, and the preview shows the saved attacks', () => {
  renderSheet(sheet({ weaponEntryId: 'dagger', hands: 'two' }));
  const dialog = openEditor();
  expect(dialog).toHaveTextContent(
    'A light weapon in two hands still adds Strength once.',
  );
  const preview = within(dialog).getByRole('region', {
    name: 'As it attacks now',
  });
  expect(preview).toHaveTextContent(
    /Single attack\s*[+−]\d+ \(1d4\/19–20\/×2\)/,
  );
  expect(preview).toHaveTextContent(/Full attack\s*[+−]\d+ \(1d4\/19–20\/×2\)/);
});

test('a refused save keeps the draft with a local Try again, and another player’s change refreshes only untouched fields', async () => {
  const view = renderSheet(sheet());
  const dialog = openEditor();
  await type(dialog, 'Cleave');
  await settle(() =>
    lastCall().reject(new ConvexError('Character is read only')),
  );
  expect(within(dialog).getByRole('alert')).toHaveTextContent(
    "Changes weren't saved",
  );
  expect(nameField(dialog)).toHaveValue('Cleave');

  view.show(
    sheet(
      { name: 'Remote strike', mode: 'ranged', revision: 3 },
      { lastOperationId: 'other-player' },
    ),
  );
  expect(nameField(dialog)).toHaveValue('Cleave');
  expect(choice(dialog, 'Attack mode', 'Ranged')).toBeChecked();
  expect(dialog).toHaveTextContent(
    'Changed by another player. Your edits are kept.',
  );

  const written = calls.length;
  await settle(() =>
    fireEvent.click(
      within(dialog).getByRole('button', {
        name: 'Try again saving routine name',
      }),
    ),
  );
  expect(calls).toHaveLength(written + 1);
  expect(lastCall().args).toMatchObject({
    entryId: 'strike',

    name: 'Cleave',
  });
  expect(lastCall().args).not.toHaveProperty('mode');
  fireEvent.click(
    within(dialog).getByRole('button', {
      name: 'Dismiss Remote strike update',
    }),
  );
  expect(dialog).not.toHaveTextContent('Changed by another player.');
});

test('acknowledgements and their echoes never overwrite newer typing', async () => {
  const view = renderSheet(sheet());
  const dialog = openEditor();
  await type(dialog, 'Sword');
  const first = lastCall();
  await type(dialog, 'Sword sweep');
  expect(calls).toHaveLength(1);
  await settle(() => first.resolve(1));
  await act(async () => {
    await Promise.resolve();
  });
  expect(lastCall().args).toMatchObject({
    name: 'Sword sweep',
  });
  view.show(
    sheet(
      { name: 'Sword', revision: 1 },
      { lastOperationId: first.args.operationId as string },
    ),
  );
  expect(nameField(dialog)).toHaveValue('Sword sweep');
  const second = lastCall();
  await settle(() => second.resolve(2));
  view.show(
    sheet(
      { name: 'Sword sweep', revision: 2 },
      { lastOperationId: second.args.operationId as string },
    ),
  );
  expect(nameField(dialog)).toHaveValue('Sword sweep');
  expect(dialog).not.toHaveTextContent('Changed by another player.');
});

test('keyboard and touch: native radios, Escape and Done return focus to Edit, and breakdowns pin and close by key', async () => {
  renderSheet(sheet());
  const edit = editButton();
  edit.focus();
  let dialog = openEditor();
  await waitFor(() =>
    expect(dialog).toContainElement(document.activeElement as HTMLElement),
  );
  expect(within(dialog).getByRole('form')).toHaveAttribute('novalidate');
  expect(dialog.querySelector('[required]')).toBeNull();
  const hands = choice(dialog, 'Held in', 'One hand');
  expect(hands.tagName).toBe('INPUT');
  expect(hands).toHaveAttribute('name', 'hands');
  expect(hands).toBeChecked();

  // A tap on the card itself selects it, like a click on the native radio.
  await settle(() => fireEvent.click(within(dialog).getByText('Thrown')));
  expect(lastCall().args).toMatchObject({ mode: 'thrown' });
  expect(choice(dialog, 'Attack mode', 'Thrown')).toBeChecked();

  fireEvent.keyDown(document.activeElement ?? dialog, { key: 'Escape' });
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  await waitFor(() => expect(edit).toHaveFocus());

  dialog = openEditor();
  fireEvent.click(within(dialog).getByRole('button', { name: 'Done' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  await waitFor(() => expect(edit).toHaveFocus());

  const attack = screen.getByRole('button', {
    name: /^Sword strike single attack: attack /,
  });
  attack.focus();
  fireEvent.click(attack);
  expect(attack).toHaveAttribute('aria-expanded', 'true');
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(attack).toHaveAttribute('aria-expanded', 'false');
  expect(attack).toHaveFocus();
});

test('below 768px the editor is a bottom sheet that scrolls within 85% of the viewport', () => {
  const original = window.matchMedia;
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  })) as unknown as typeof window.matchMedia;
  try {
    renderSheet(sheet());
    const dialog = openEditor();
    expect(dialog).toHaveClass('bottom-0', 'max-h-[85vh]');
    expect(within(dialog).getByRole('form')).toHaveClass(
      'min-h-0',
      'overflow-y-auto',
    );
    // Off-hand cards and weapon details scroll with the rest of the routine.
    const form = within(dialog).getByRole('form');
    expect(
      within(form).getByRole('radiogroup', { name: offHandGroup }),
    ).toBeVisible();
    expect(
      within(form).getByRole('group', { name: 'Longsword' }),
    ).toBeVisible();
    // Natural attack cards and the limb count scroll with them too.
    expect(
      within(form).getByRole('group', { name: 'Natural attacks' }),
    ).toBeVisible();
    expect(within(form).getByLabelText('Available limbs')).toBeVisible();
  } finally {
    window.matchMedia = original;
  }
});

test('maintenance leaves the editor readable with its reason and every write disabled', () => {
  maintenance.mockReturnValue({
    kind: 'maintenance',
    readOnly: true,
    message: 'Editing is paused for maintenance.',
  });
  renderSheet(
    sheet({
      offHand: { kind: 'weapon', weaponEntryId: 'dagger', mode: 'melee' },
    }),
  );
  const dialog = openEditor();
  expect(dialog).toHaveTextContent('Editing is paused for maintenance.');
  expect(nameField(dialog)).toBeDisabled();
  expect(choice(dialog, offHandGroup, 'None')).toBeDisabled();
  expect(choice(dialog, offHandGroup, 'Dagger')).toHaveAccessibleDescription(
    /Editing is paused for maintenance\./,
  );
  expect(choice(dialog, offHandMode, 'Thrown')).toBeDisabled();
  for (const weapon of ['Longsword', 'Dagger']) {
    const details = within(dialog).getByRole('group', { name: weapon });
    expect(
      within(details).getByRole('textbox', { name: 'Enhancement' }),
    ).toBeDisabled();
    expect(
      within(details).getByRole('checkbox', { name: 'Masterwork' }),
    ).toBeDisabled();
    expect(
      within(details).getByRole('textbox', { name: 'Material' }),
    ).toBeDisabled();
    for (const control of within(details).getAllByRole('textbox'))
      expect(control).toHaveAccessibleDescription(
        'Editing is paused for maintenance.',
      );
    expect(
      within(details).getByRole('checkbox', { name: 'Masterwork' }),
    ).toHaveAccessibleDescription('Editing is paused for maintenance.');
  }
  expect(choice(dialog, 'Held in', 'Two hands')).toBeDisabled();
  expect(choice(dialog, 'Main weapon', 'Dagger')).toBeDisabled();
  const remove = within(dialog).getByRole('button', { name: 'Remove routine' });
  expect(remove).toBeDisabled();
  expect(remove).toHaveAccessibleDescription(
    'Editing is paused for maintenance.',
  );
  expect(within(dialog).getByRole('button', { name: 'Done' })).toBeEnabled();
});

test('weapon details retain both their field error and the maintenance explanation', async () => {
  const initial = sheet();
  const view = renderSheet(initial);
  const dialog = openEditor();
  const details = within(dialog).getByRole('group', { name: 'Longsword' });
  const enhancement = within(details).getByRole('textbox', {
    name: 'Enhancement',
  });
  await settle(() => fireEvent.change(enhancement, { target: { value: '' } }));
  expect(enhancement).toHaveAccessibleDescription('Enhancement is required');
  maintenance.mockReturnValue({
    kind: 'maintenance',
    readOnly: true,
    message: 'Editing is paused for maintenance.',
  });
  view.show(initial);
  expect(enhancement).toBeDisabled();
  expect(enhancement).toHaveAccessibleDescription(
    'Editing is paused for maintenance. Enhancement is required',
  );
  expect(calls).toHaveLength(0);
});

test('the editor displays routine advisories alongside calculated attack lines', () => {
  const snapshot = sheet();
  const routine = snapshot.calculated.attackRoutines[0];
  if (!routine) throw new Error('Missing routine');
  routine.warnings.push({
    kind: 'rules',
    check: 'unsuitableAttackHands',
    target: { kind: 'entry', entryId: routine.entryId },
    subject: routine.entryId,
    fingerprint: 'advisory-hands',
    message: 'This weapon normally needs two hands.',
  });
  renderSheet(snapshot);
  const preview = within(openEditor()).getByRole('region', {
    name: 'As it attacks now',
  });
  expect(preview).toHaveTextContent('Single attack');
  expect(preview).toHaveTextContent('This weapon normally needs two hands.');
});

test('an off-hand card saves its weapon and mode together, None clears it, and a new main weapon keeps it', async () => {
  renderSheet(sheet());
  const dialog = openEditor();
  expect(choice(dialog, offHandGroup, 'None')).toBeChecked();
  expect(within(dialog).queryByRole('radiogroup', { name: offHandMode })).toBe(
    null,
  );

  await settle(() => fireEvent.click(choice(dialog, offHandGroup, 'Dagger')));
  expect(lastCall()).toMatchObject({
    name: 'editAttackRoutine',
    args: {
      entryId: 'strike',
      offHand: { kind: 'weapon', weaponEntryId: 'dagger', mode: 'melee' },
    },
  });
  await settle(() => lastCall().resolve(1));
  expect(choice(dialog, offHandMode, 'Melee')).toBeChecked();
  // The separate off-hand weapon brings its own details.
  expect(within(dialog).getByRole('group', { name: 'Dagger' })).toBeVisible();

  await settle(() => fireEvent.click(choice(dialog, offHandMode, 'Thrown')));
  expect(lastCall().args).toMatchObject({
    offHand: { kind: 'weapon', weaponEntryId: 'dagger', mode: 'thrown' },
  });
  await settle(() => lastCall().resolve(2));

  await settle(() => fireEvent.click(choice(dialog, 'Main weapon', 'Dagger')));
  expect(lastCall().args).toMatchObject({ weaponEntryId: 'dagger' });
  expect(lastCall().args).not.toHaveProperty('offHand');
  await settle(() => lastCall().resolve(3));
  expect(choice(dialog, offHandGroup, 'Dagger')).toBeChecked();
  expect(choice(dialog, offHandMode, 'Thrown')).toBeChecked();

  await settle(() => fireEvent.click(choice(dialog, offHandGroup, 'None')));
  expect(lastCall().args).toMatchObject({ offHand: null });
  expect(within(dialog).queryByRole('radiogroup', { name: offHandMode })).toBe(
    null,
  );
});

test('a double weapon offers its other end, and unusual or switched-off off hands stay chosen with their warnings', async () => {
  const whirl = (offHand: string) =>
    sheet(
      {
        weaponEntryId: 'hammer',
        hands: 'two',
        offHand: { kind: 'weapon', weaponEntryId: offHand, mode: 'melee' },
      },
      {
        sheetEntries: [
          representativeWeapon('longsword', 'sword'),
          representativeWeapon('dagger', 'dagger', { active: false }),
          hammer,
        ],
      },
    );
  const view = renderSheet(whirl('sword'));
  const dialog = openEditor();
  const cards = () =>
    within(dialog).getByRole('radiogroup', { name: offHandGroup })
      .parentElement;
  expect(choice(dialog, offHandGroup, 'Longsword')).toBeChecked();
  expect(choice(dialog, 'Held in', 'Two hands')).toBeEnabled();
  expect(cards()).toHaveTextContent(
    'Off hand: The main weapon is held in two hands while an off-hand weapon is selected. This routine keeps both weapons.',
  );

  const switchedOff = choice(dialog, offHandGroup, 'Dagger, switched off');
  expect(switchedOff).toBeEnabled();
  await settle(() => fireEvent.click(switchedOff));
  expect(lastCall().args).toMatchObject({
    offHand: { kind: 'weapon', weaponEntryId: 'dagger', mode: 'melee' },
  });
  await settle(() => lastCall().resolve(1));
  view.show(whirl('dagger'));
  expect(switchedOff).toBeChecked();
  expect(cards()).toHaveTextContent(/Off hand: .*switched off/);

  await settle(() =>
    fireEvent.click(
      choice(dialog, offHandGroup, 'Other end of Gnome hooked hammer'),
    ),
  );
  expect(lastCall().args).toMatchObject({
    entryId: 'strike',
    offHand: { kind: 'otherEnd', mode: 'melee' },
  });
});

test('the preview shows the resolver two-weapon penalty summary for the selected off hand', () => {
  renderSheet(
    sheet({
      offHand: { kind: 'weapon', weaponEntryId: 'dagger', mode: 'melee' },
    }),
  );
  const preview = within(openEditor()).getByRole('region', {
    name: 'As it attacks now',
  });
  expect(preview).toHaveTextContent(
    'Two-weapon fighting, light off hand: −4 primary, −8 off hand',
  );
});

test('an other end the main weapon lacks stays recorded with its warning', () => {
  renderSheet(sheet({ offHand: { kind: 'otherEnd', mode: 'melee' } }));
  const dialog = openEditor();
  const cards = within(dialog).getByRole('radiogroup', { name: offHandGroup });
  expect(choice(dialog, offHandGroup, 'None')).not.toBeChecked();
  expect(choice(dialog, offHandGroup, 'Other end unavailable')).toBeChecked();
  expect(choice(dialog, offHandGroup, 'Other end unavailable')).toBeDisabled();
  expect(cards.parentElement).toHaveTextContent(
    'Off hand: Longsword has no recorded second end.',
  );
  expect(choice(dialog, offHandMode, 'Melee')).toBeChecked();
});

test('each end of a double weapon saves its own details, with separate acknowledgements, errors and Try again', async () => {
  const view = renderSheet(
    sheet(
      {
        weaponEntryId: 'hammer',
        hands: 'two',
        offHand: { kind: 'otherEnd', mode: 'melee' },
      },
      { sheetEntries: [hammer] },
    ),
  );
  const dialog = openEditor();
  const primary = within(dialog).getByRole('group', {
    name: 'Gnome hooked hammer, primary end',
  });
  const other = within(dialog).getByRole('group', {
    name: 'Gnome hooked hammer, other end',
  });
  // The other end in the off hand is the same weapon's: no second editor.
  expect(
    within(dialog).getAllByRole('group', { name: /^Gnome hooked hammer/ }),
  ).toHaveLength(2);
  const preview = within(dialog).getByRole('region', {
    name: 'As it attacks now',
  });
  expect(preview).toHaveTextContent(
    /Full attack\s*Main hand: Gnome hooked hammer [+−]\d+ \(1d8[^)]*×3\)\s*Off hand, other end: Gnome hooked hammer [+−]\d+ \(1d6[^)]*×4\)/,
  );
  expect(preview).toHaveTextContent(
    /Single attack\s*[+−]\d+ \(1d8[^)]*×3\)Full/,
  );

  await settle(() =>
    fireEvent.change(
      within(other).getByRole('textbox', { name: 'Enhancement' }),
      {
        target: { value: '2' },
      },
    ),
  );
  expect(lastCall()).toMatchObject({
    name: 'editEquipment',
    args: { entryId: 'hammer', end: 'otherEnd', enhancement: 2 },
  });
  expect(lastCall().args).not.toHaveProperty('masterwork');
  expect(lastCall().args).not.toHaveProperty('material');
  const otherSave = lastCall();

  await settle(() =>
    fireEvent.click(
      within(primary).getByRole('checkbox', { name: 'Masterwork' }),
    ),
  );
  expect(lastCall().args).toMatchObject({
    entryId: 'hammer',
    end: 'primary',
    masterwork: true,
  });
  expect(lastCall().args).not.toHaveProperty('enhancement');
  await settle(() => otherSave.resolve(null));
  await settle(() =>
    lastCall().reject(new ConvexError('Character is read only')),
  );
  expect(within(other).getByText('Saved')).toBeVisible();
  expect(within(other).queryByRole('alert')).toBe(null);
  expect(within(primary).getByRole('alert')).toHaveTextContent(
    "Changes weren't saved",
  );

  const enhancement = within(primary).getByRole('textbox', {
    name: 'Enhancement',
  });
  const written = calls.length;
  await settle(() => fireEvent.change(enhancement, { target: { value: '' } }));
  expect(within(primary).getByText('Enhancement is required')).toBeVisible();
  await settle(() =>
    fireEvent.change(enhancement, { target: { value: 'keen' } }),
  );
  expect(
    within(primary).getByText(
      'Enhancement must be a whole number of 0 or more',
    ),
  ).toBeVisible();
  expect(calls).toHaveLength(written);

  // Another player's change refreshes untouched fields and keeps refused drafts.
  view.show(
    sheet(
      {
        weaponEntryId: 'hammer',
        hands: 'two',
        offHand: { kind: 'otherEnd', mode: 'melee' },
      },
      {
        sheetEntries: [
          representativeWeapon('gnome-hooked-hammer', 'hammer', {
            itemState: { material: 'silver' },
          }),
        ],
        lastOperationId: 'other-player',
      },
    ),
  );
  expect(
    within(primary).getByRole('textbox', { name: 'Material' }),
  ).toHaveValue('silver');
  expect(enhancement).toHaveValue('keen');
  expect(
    within(primary).getByRole('checkbox', { name: 'Masterwork' }),
  ).toBeChecked();
  expect(primary).toHaveTextContent(
    'Changed by another player. Your edits are kept.',
  );

  await settle(() =>
    fireEvent.click(
      within(primary).getByRole('button', {
        name: 'Try again saving masterwork for Gnome hooked hammer, primary end',
      }),
    ),
  );
  expect(lastCall()).toMatchObject({
    name: 'editEquipment',
    args: { entryId: 'hammer', end: 'primary', masterwork: true },
  });
});

// Ranged and thrown routines (#322): ammunition and launcher, range
// increments, and the resolver's reload and throw-rate notes.

const bow = representativeWeapon('longbow', 'bow');
const arrows = representativeWeapon('arrows', 'arrows');
const crossbow = representativeWeapon('light-crossbow', 'crossbow');
const shot: AttackRoutineFixture = {
  id: 'shot',
  name: 'Bow shot',
  weaponEntryId: 'bow',
  hands: 'two',
  mode: 'ranged',
};
const archer = (
  routine: Partial<AttackRoutineFixture> = {},
  input: Parameters<typeof buildSheet>[0] = {},
) =>
  buildSheet({
    levels: [{ id: 'level-1', hp: 10, classId: 'fighter' }],
    classProficiencies: {
      fighter: [{ category: 'simple' }, { category: 'martial' }],
    },
    sheetEntries: [bow, arrows, representativeWeapon('dagger', 'dagger')],
    attackRoutines: [{ ...shot, ...routine }],
    ...input,
  });
const ammunitionGroup = 'Ammunition';
const rangeField = (dialog: HTMLElement) =>
  within(dialog).getByRole('textbox', { name: 'Range increments' });
const rateNotes = (dialog: HTMLElement) =>
  within(dialog).getByRole('list', { name: 'Attack rate' });

test('a bow routine chooses its ammunition for the launcher and saves it at once, None clears it, and a melee routine has no ranged fields', async () => {
  renderSheet(
    archer(
      {},
      { attackRoutines: [shot, { ...strike, weaponEntryId: 'dagger' }] },
    ),
  );
  const dialog = openEditor('Bow shot');
  expect(dialog).toHaveTextContent('Fired from Longbow');
  expect(choice(dialog, ammunitionGroup, 'None')).toBeChecked();
  expect(rangeField(dialog)).toHaveValue('1');
  expect(
    within(dialog).queryByRole('checkbox', { name: /free hand/i }),
  ).toBeNull();

  await settle(() =>
    fireEvent.click(choice(dialog, ammunitionGroup, 'Arrows')),
  );
  expect(lastCall()).toMatchObject({
    name: 'editAttackRoutine',
    args: { entryId: 'shot', ammunitionEntryId: 'arrows' },
  });
  expect(lastCall().args).not.toHaveProperty('rangeIncrements');
  await settle(() => lastCall().resolve(1));
  expect(within(dialog).getByText('Saved')).toBeVisible();
  expect(choice(dialog, ammunitionGroup, 'Arrows')).toBeChecked();

  await settle(() => fireEvent.click(choice(dialog, ammunitionGroup, 'None')));
  expect(lastCall().args).toMatchObject({ ammunitionEntryId: null });

  fireEvent.click(within(dialog).getByRole('button', { name: 'Done' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  const melee = openEditor();
  expect(
    within(melee).queryByRole('radiogroup', { name: ammunitionGroup }),
  ).toBeNull();
  expect(
    within(melee).queryByRole('textbox', { name: 'Range increments' }),
  ).toBeNull();
});

test('an off-hand launcher beside a melee weapon offers range and ammunition for its own shots', async () => {
  renderSheet(
    archer(
      {
        weaponEntryId: 'dagger',
        hands: 'one',
        mode: 'melee',
        offHand: { kind: 'weapon', weaponEntryId: 'hand', mode: 'ranged' },
      },
      {
        sheetEntries: [
          representativeWeapon('dagger', 'dagger'),
          representativeWeapon('hand-crossbow', 'hand'),
          arrows,
        ],
      },
    ),
  );
  const dialog = openEditor('Bow shot');
  expect(dialog).toHaveTextContent('Fired from Hand crossbow');
  expect(rangeField(dialog)).toHaveValue('1');
  await settle(() =>
    fireEvent.click(choice(dialog, ammunitionGroup, 'Arrows')),
  );
  expect(lastCall()).toMatchObject({
    name: 'editAttackRoutine',
    args: { entryId: 'shot', ammunitionEntryId: 'arrows' },
  });
});

test('ammunition that is gone stays chosen with its warning, and Add ammunition adds arrows from the catalog without a routine', async () => {
  renderSheet(
    archer(
      { ammunitionEntryId: 'gone' },
      { sheetEntries: [bow], catalogOnly: [arrows] },
    ),
  );
  const dialog = openEditor('Bow shot');
  const unavailable = choice(dialog, ammunitionGroup, 'Ammunition unavailable');
  expect(unavailable).toBeChecked();
  expect(unavailable).toBeDisabled();
  expect(choice(dialog, ammunitionGroup, 'None')).not.toBeChecked();
  expect(dialog).toHaveTextContent(
    'The selected ammunition is no longer in Gear. Choose ammunition for this routine.',
  );

  const add = within(dialog).getByRole('button', { name: 'Add ammunition' });
  fireEvent.click(add);
  expect(add).toHaveAttribute('aria-expanded', 'true');
  const catalog = within(dialog).getByRole('region', {
    name: 'Add ammunition',
  });
  const card = within(catalog).getByRole('button', { name: 'Arrows' });
  expect(card).toHaveAccessibleDescription('Ammunition');
  fireEvent.click(card);
  expect(lastCall()).toMatchObject({
    name: 'selectEntry',
    args: { catalogEntryId: 'arrows-catalog' },
  });
  expect(within(catalog).getByRole('status')).toHaveTextContent(
    'Adding Arrows…',
  );
  await settle(() => lastCall().resolve('arrows'));
  expect(within(catalog).getByRole('status')).toHaveTextContent(
    'Arrows added under Gear.',
  );
  expect(calls.map((call) => call.name)).toEqual(['selectEntry']);
});

test('range increments save whole numbers, keep malformed drafts local with their own error, and read the saved range with its penalty', async () => {
  const view = renderSheet(archer({ rangeIncrements: 2 }));
  const dialog = openEditor('Bow shot');
  const range = rangeField(dialog);
  expect(range).toHaveValue('2');
  expect(range).toHaveAccessibleDescription('Up to 200 ft.: −2 to attack.');

  await settle(() => fireEvent.change(range, { target: { value: '3' } }));
  expect(lastCall()).toMatchObject({
    name: 'editAttackRoutine',
    args: { entryId: 'shot', rangeIncrements: 3 },
  });
  await settle(() => lastCall().resolve(1));

  const written = calls.length;
  await settle(() => fireEvent.change(range, { target: { value: '' } }));
  expect(within(dialog).getByRole('alert')).toHaveTextContent(
    'Range increments are required',
  );
  await settle(() => fireEvent.change(range, { target: { value: '2.5' } }));
  expect(within(dialog).getByRole('alert')).toHaveTextContent(
    'Enter a whole number of range increments',
  );
  await settle(() => fireEvent.change(range, { target: { value: '0' } }));
  expect(within(dialog).getByRole('alert')).toHaveTextContent(
    'Enter at least 1 range increment',
  );
  await settle(() => fireEvent.change(range, { target: { value: '11' } }));
  expect(within(dialog).getByRole('alert')).toHaveTextContent(
    'Ranged attacks reach at most 10 range increments',
  );
  expect(range).toHaveAttribute('aria-invalid', 'true');
  expect(calls).toHaveLength(written);

  view.show(archer({ rangeIncrements: 11, revision: 2 }));
  expect(dialog).toHaveTextContent(
    'Bow shot is beyond its 10-increment maximum range. This routine keeps the range penalty.',
  );
  expect(dialog).toHaveTextContent('Up to 1100 ft.: −20 to attack.');
});

test('the preview lists reload notes for a crossbow, with and without Rapid Reload and a free hand, and throw-rate notes for a thrown off hand', async () => {
  const bolt = (
    routine: Partial<AttackRoutineFixture> = {},
    input: Parameters<typeof buildSheet>[0] = {},
  ) =>
    archer(
      { weaponEntryId: 'crossbow', ...routine },
      {
        sheetEntries: [crossbow, representativeWeapon('dagger', 'dagger')],
        ...input,
      },
    );
  const view = renderSheet(bolt());
  const dialog = openEditor('Bow shot');
  expect(rateNotes(dialog)).toHaveTextContent(
    'Reload: move action. One attack per full attack.',
  );

  view.show(
    bolt(
      { revision: 2 },
      {
        feats: [
          { id: 'reload', key: 'rapid-reload', choice: 'light crossbow' },
        ],
      },
    ),
  );
  expect(rateNotes(dialog)).toHaveTextContent(
    'Reload: free action (Rapid Reload).',
  );
  expect(rateNotes(dialog)).not.toHaveTextContent('One attack per full attack');

  view.show(
    bolt(
      {
        revision: 3,
        offHand: { kind: 'weapon', weaponEntryId: 'dagger', mode: 'thrown' },
      },
      {
        feats: [
          { id: 'reload', key: 'rapid-reload', choice: 'light crossbow' },
        ],
      },
    ),
  );
  expect(rateNotes(dialog)).toHaveTextContent(
    'Reload: free action (Rapid Reload), but no free hand to reload. One attack per full attack.',
  );
  expect(rateNotes(dialog)).toHaveTextContent(
    'Off hand: One held thrown weapon per hand. Quick Draw permits additional throws.',
  );
  view.show(
    bolt(
      {
        revision: 4,
        offHand: { kind: 'weapon', weaponEntryId: 'dagger', mode: 'thrown' },
      },
      {
        feats: [
          { id: 'reload', key: 'rapid-reload', choice: 'light crossbow' },
          { id: 'draw', key: 'quick-draw' },
        ],
      },
    ),
  );
  expect(rateNotes(dialog)).toHaveTextContent(
    'Off hand: Quick Draw: draw thrown weapons as a free action.',
  );
});

// Natural and unarmed attacks (#323).
const claw = representativeWeapon('natural-claw', 'claw');

const bite = representativeWeapon('natural-bite', 'bite');

const naturalSheet = (
  routine: Partial<AttackRoutineFixture> = {},
  input: Parameters<typeof buildSheet>[0] = {},
) =>
  sheet(routine, {
    sheetEntries: [
      representativeWeapon('longsword', 'sword'),
      representativeWeapon('dagger', 'dagger'),
      claw,
      bite,
    ],
    ...input,
  });

const naturalGroup = (dialog: HTMLElement) =>
  within(dialog).getByRole('group', { name: 'Natural attacks' });

const natural = (dialog: HTMLElement, name: string) =>
  within(naturalGroup(dialog)).getByRole('checkbox', { name });

const limbsField = (dialog: HTMLElement) =>
  within(dialog).getByLabelText('Available limbs');

test('natural attack cards save the whole chosen list at once, keep each other, and survive a new main attack', async () => {
  renderSheet(naturalSheet());
  const dialog = openEditor();
  const clawCard = natural(dialog, 'Claw');
  expect(clawCard).toHaveAttribute('type', 'checkbox');
  expect(clawCard).toHaveAccessibleDescription(
    /1d4 · ×2 · Primary natural attack/,
  );
  await settle(() => fireEvent.click(clawCard));
  expect(lastCall()).toMatchObject({
    name: 'editAttackRoutine',
    args: { entryId: 'strike', naturalAttackEntryIds: ['claw'] },
  });
  await settle(() => lastCall().resolve(1));
  await settle(() => fireEvent.click(natural(dialog, 'Bite')));
  expect(lastCall().args).toMatchObject({
    naturalAttackEntryIds: ['claw', 'bite'],
  });
  await settle(() => lastCall().resolve(2));
  await settle(() => fireEvent.click(clawCard));
  expect(lastCall().args).toMatchObject({ naturalAttackEntryIds: ['bite'] });
  await settle(() => lastCall().resolve(3));
  expect(clawCard).not.toBeChecked();
  expect(natural(dialog, 'Bite')).toBeChecked();

  await settle(() =>
    fireEvent.click(choice(dialog, 'Main weapon', 'Unarmed strike')),
  );
  expect(lastCall().args).toMatchObject({
    weaponEntryId: 'unarmed',
    hands: 'one',
    mode: 'melee',
  });
  expect(lastCall().args).not.toHaveProperty('naturalAttackEntryIds');
  await settle(() => lastCall().resolve(4));
  expect(natural(dialog, 'Bite')).toBeChecked();
});

test('Available limbs defaults to 2, saves 0 as a number, and keeps empty or malformed counts local with their own errors', async () => {
  renderSheet(naturalSheet());
  const dialog = openEditor();
  const limbs = limbsField(dialog);
  expect(limbs).toHaveValue('2');
  expect(limbs).toHaveAccessibleDescription('Limbs before holding weapons.');
  await settle(() => fireEvent.change(limbs, { target: { value: '0' } }));
  expect(lastCall()).toMatchObject({
    name: 'editAttackRoutine',
    args: { entryId: 'strike', availableLimbs: 0 },
  });
  await settle(() => lastCall().resolve(1));

  const written = calls.length;
  await settle(() => fireEvent.change(limbs, { target: { value: '' } }));
  expect(within(dialog).getByRole('alert')).toHaveTextContent(
    'Available limbs is required',
  );
  await settle(() => fireEvent.change(limbs, { target: { value: '1.5' } }));
  expect(within(dialog).getByRole('alert')).toHaveTextContent(
    'Available limbs must be a whole number of 0 or more',
  );
  expect(limbs).toHaveAttribute('aria-invalid', 'true');
  expect(limbs).toHaveAccessibleDescription(
    'Limbs before holding weapons. Available limbs must be a whole number of 0 or more',
  );
  await settle(() => fireEvent.change(limbs, { target: { value: 'two' } }));
  expect(calls).toHaveLength(written);
});

test('a limb advisory stays beside the natural attacks with Accept while the cards and count stay editable', async () => {
  renderSheet(
    naturalSheet({ naturalAttackEntryIds: ['claw'], availableLimbs: 1 }),
  );
  const advisory =
    '1 claw, slam or tentacle attacks need free limbs, but only 0 are available after holding weapons. The attacks remain in this routine.';
  const dialog = openEditor();
  expect(natural(dialog, 'Claw')).toBeChecked();
  expect(natural(dialog, 'Claw')).toBeEnabled();
  expect(natural(dialog, 'Bite')).toBeEnabled();
  expect(limbsField(dialog)).toBeEnabled();
  expect(limbsField(dialog)).toHaveAccessibleDescription(
    `Limbs before holding weapons. ${advisory}`,
  );
  const accept = within(dialog).getByRole('button', { name: 'Accept' });
  expect(accept).toHaveAccessibleDescription(advisory);
  await settle(() => fireEvent.click(accept));
  expect(lastCall()).toMatchObject({
    name: 'accept',
    args: { check: 'attackLimbs' },
  });
});

test('a chosen natural attack that left the sheet stays with its warning and Remove, and switched-off attacks stay selectable', async () => {
  renderSheet(
    naturalSheet(
      { naturalAttackEntryIds: ['gone', 'claw'] },
      {
        sheetEntries: [
          representativeWeapon('longsword', 'sword'),
          representativeWeapon('dagger', 'dagger'),
          { ...claw, active: false },
          bite,
        ],
      },
    ),
  );
  const routine = screen.getByRole('listitem', { name: 'Sword strike' });
  expect(routine).toHaveTextContent(
    'Natural: Unavailable natural attack, Claw',
  );
  expect(
    within(routine).getByRole('list', { name: 'Single attack' }),
  ).toBeVisible();
  const dialog = openEditor();
  const group = naturalGroup(dialog);
  expect(group).toHaveTextContent('Unavailable natural attack');
  expect(group).not.toHaveTextContent('gone');
  const remove = within(group).getByRole('button', {
    name: 'Remove unavailable natural attack',
  });
  expect(remove).toHaveAccessibleDescription(/^Natural attack: /);
  const switchedOff = natural(dialog, 'Claw, switched off');
  expect(switchedOff).toBeChecked();
  expect(switchedOff).toBeEnabled();
  await settle(() => fireEvent.click(remove));
  expect(lastCall()).toMatchObject({
    name: 'editAttackRoutine',
    args: { naturalAttackEntryIds: ['claw'] },
  });
});

test('another player’s natural choices refresh untouched cards while a local limb draft and its focus stay', async () => {
  const view = renderSheet(naturalSheet());
  const dialog = openEditor();
  const limbs = limbsField(dialog);
  limbs.focus();
  await settle(() => fireEvent.change(limbs, { target: { value: 'x' } }));
  view.show(
    naturalSheet(
      { naturalAttackEntryIds: ['bite'], availableLimbs: 4, revision: 3 },
      { lastOperationId: 'other-player' },
    ),
  );
  expect(natural(dialog, 'Bite')).toBeChecked();
  expect(natural(dialog, 'Claw')).not.toBeChecked();
  expect(limbs).toHaveValue('x');
  expect(limbs).toHaveFocus();
  expect(dialog).toHaveTextContent(
    'Changed by another player. Your edits are kept.',
  );
});

test('maintenance disables natural choices, the count and the natural attack form, and unarmed has no weapon details', () => {
  maintenance.mockReturnValue({
    kind: 'maintenance',
    readOnly: true,
    message: 'Editing is paused for maintenance.',
  });
  renderSheet(naturalSheet({ weaponEntryId: 'unarmed' }));
  const dialog = openEditor();
  expect(natural(dialog, 'Claw')).toBeDisabled();
  expect(natural(dialog, 'Claw')).toHaveAccessibleDescription(
    /Editing is paused for maintenance\./,
  );
  expect(limbsField(dialog)).toBeDisabled();
  expect(limbsField(dialog)).toHaveAccessibleDescription(
    /Editing is paused for maintenance\./,
  );
  expect(
    within(dialog).queryByRole('textbox', { name: 'Enhancement' }),
  ).toBeNull();
  fireEvent.click(
    within(dialog).getByRole('button', { name: 'Add natural attack' }),
  );
  const form = within(dialog).getByRole('region', {
    name: 'Add natural attack',
  });
  const submit = within(form).getByRole('button', {
    name: 'Add natural attack',
  });
  expect(submit).toBeDisabled();
  expect(submit).toHaveAccessibleDescription(
    'Editing is paused for maintenance.',
  );
});

test('with no natural attacks the field explains how to add one, and the form opens beside it', () => {
  renderSheet(sheet());
  const dialog = openEditor();
  expect(naturalGroup(dialog)).toHaveTextContent(
    'Add a natural attack to include it in this routine.',
  );
  const add = within(dialog).getByRole('button', {
    name: 'Add natural attack',
  });
  fireEvent.click(add);
  expect(add).toHaveAttribute('aria-expanded', 'true');
  const form = within(dialog).getByRole('region', {
    name: 'Add natural attack',
  });
  fireEvent.click(within(form).getByRole('button', { name: 'Cancel' }));
  expect(
    within(dialog).queryByRole('region', { name: 'Add natural attack' }),
  ).toBeNull();
  expect(add).toHaveFocus();
});

test('editing a recorded natural attack preserves the complete definition', async () => {
  if (claw.detail.kind !== 'item' || !claw.detail.weapon)
    throw new Error('Expected an item with a weapon');
  const customClaw = {
    ...claw,
    name: 'Dragon claw',
    modifiers: [{ target: 'attack', bonusType: 'untyped', value: 2 }],
    detail: {
      ...claw.detail,
      kind: 'item',
      consumable: false,
      material: 'dragon bone',
      weapon: {
        ...claw.detail.weapon,
        dice: '2d6',
        groups: ['dragon', 'natural'],
        damageTypes: ['slashing'],
      },
    },
  } satisfies NonNullable<
    NonNullable<Parameters<typeof buildSheet>[0]>['sheetEntries']
  >[number];
  renderSheet(
    naturalSheet(
      {},
      {
        sheetEntries: [representativeWeapon('longsword', 'sword'), customClaw],
      },
    ),
  );
  const dialog = openEditor();
  const edit = within(naturalGroup(dialog)).getByRole('button', {
    name: 'Edit Dragon claw',
  });
  fireEvent.click(edit);
  const form = within(dialog).getByRole('region', {
    name: 'Edit natural attack',
  });
  expect(
    within(form).getByRole('textbox', { name: 'Attack name' }),
  ).toHaveValue('Dragon claw');
  fireEvent.change(within(form).getByRole('textbox', { name: 'Attack name' }), {
    target: { value: 'Dragon talon' },
  });
  await settle(() =>
    fireEvent.click(
      within(form).getByRole('button', { name: 'Save natural attack' }),
    ),
  );
  expect(lastCall()).toMatchObject({
    name: 'editSheetEntry',
    args: {
      entryId: 'claw',
      name: 'Dragon talon',
      modifiers: customClaw.modifiers,
      detail: customClaw.detail,
    },
  });
  await settle(() => lastCall().resolve(null));
  expect(
    within(dialog).queryByRole('region', { name: 'Edit natural attack' }),
  ).toBeNull();
  expect(edit).toHaveFocus();
});

test('catalog natural attacks remain selectable and explain why their shared definition cannot be edited here', () => {
  const initial = naturalSheet();
  initial.catalogEntries = initial.catalogEntries.map((entry) =>
    entry.name === 'Claw'
      ? { ...entry, scope: 'global', characterId: undefined }
      : entry,
  );
  renderSheet(initial);
  const dialog = openEditor();
  expect(natural(dialog, 'Claw')).toBeEnabled();
  expect(
    within(naturalGroup(dialog)).queryByRole('button', { name: 'Edit Claw' }),
  ).toBeNull();
  expect(naturalGroup(dialog)).toHaveTextContent(
    'Shared definitions are read-only here; customize or detach the definition to edit it',
  );
});

// #407 wiring stub: each Routine Option is a labelled switch saved at once
// as the routine's whole list; a switched-on option whose feat is switched
// off stays on with its advisory.
test('Routine Options save as one list from labelled switches and an unavailable feat keeps its advisory', async () => {
  renderSheet(
    sheet(
      { options: ['vital-catalog'] },
      {
        feats: [
          { id: 'power', key: 'power-attack' },
          { id: 'finesse', key: 'weapon-finesse' },
          { id: 'vital', key: 'vital-strike', active: false },
        ],
      },
    ),
  );
  const dialog = openEditor();
  const options = within(dialog).getByRole('group', { name: 'Options' });
  const vital = within(options).getByRole('switch', {
    name: /Vital Strike/,
  });
  expect(vital).toBeChecked();
  expect(
    within(options).queryByRole('switch', { name: /Weapon Finesse/ }),
  ).toBeNull();
  expect(options).toHaveTextContent(
    'Vital Strike is switched on in Sword strike, but the feat is switched off. It has no effect until the feat is switched on.',
  );
  await settle(() =>
    fireEvent.click(
      within(options).getByRole('switch', { name: 'Power Attack' }),
    ),
  );
  expect(lastCall()).toMatchObject({
    name: 'editAttackRoutine',
    args: { entryId: 'strike', options: ['vital-catalog', 'power-catalog'] },
  });
  await settle(() => lastCall().resolve(1));
  await settle(() => fireEvent.click(vital));
  expect(lastCall().args).toMatchObject({ options: ['power-catalog'] });
});

// Routine Options in the editor (#407): each row's hint beside its toggle,
// its advisory with Accept beneath it, the group's own save feedback with Try
// again, maintenance, and touch-sized rows in the bottom sheet.
const optionsGroup = (dialog: HTMLElement) =>
  within(dialog).getByRole('group', { name: 'Options' });
const option = (dialog: HTMLElement, name: string | RegExp) =>
  within(optionsGroup(dialog)).getByRole('switch', { name });
const powerAttackDefinition = {
  ...representativeSelectionCatalog.find(
    (entry) => entry.ruleIdentity === 'power-attack',
  )!,
  _id: 'power-catalog',
  _creationTime: 7,
  scope: 'character',
  characterId,
} as unknown as NonNullable<
  NonNullable<Parameters<typeof buildSheet>[0]>['extraCatalog']
>[number];

test('a switched-on option whose feat is missing or switched off stays on with its hint and an Accept of its own, and a gone definition says so', async () => {
  renderSheet(
    sheet(
      { options: ['vital-catalog', 'power-catalog', 'gone-catalog'] },
      {
        feats: [{ id: 'vital', key: 'vital-strike', active: false }],
        // The fixture keeps extra definitions with the race catalog.
        hasRaces: true,
        extraCatalog: [powerAttackDefinition],
      },
    ),
  );
  const dialog = openEditor();
  const vital = option(dialog, 'Vital Strike');
  expect(vital).toBeChecked();
  expect(vital).toBeEnabled();
  expect(vital).toHaveAccessibleDescription(
    'the feat is switched off Vital Strike is switched on in Sword strike, but the feat is switched off. It has no effect until the feat is switched on.',
  );
  const power = option(dialog, 'Power Attack');
  expect(power).toBeChecked();
  expect(power).toHaveAccessibleDescription(
    "the feat isn’t on the sheet Power Attack is switched on in Sword strike, but the feat isn't on the sheet. It has no effect until the feat is added.",
  );
  const gone = option(dialog, 'A switched-on option');
  expect(gone).toBeChecked();
  expect(gone).toHaveAccessibleDescription(
    'no longer available A switched-on option of Sword strike is no longer available. Switch it off in this routine.',
  );

  const accepts = within(optionsGroup(dialog)).getAllByRole('button', {
    name: 'Accept',
  });
  expect(accepts).toHaveLength(3);
  expect(accepts[0]).toHaveAccessibleDescription(
    /^Vital Strike is switched on in Sword strike, but the feat is switched off\./,
  );
  await settle(() => fireEvent.click(accepts[0]!));
  expect(lastCall()).toMatchObject({
    name: 'accept',
    args: {
      check: 'missingRoutineOption',
      subject: 'strike:option:vital-catalog',
    },
  });
});

test('the Options group saves with its own Saving, Saved and Try again, keeps a refused choice shown, and an inapplicable option says it has no effect', async () => {
  renderSheet(
    sheet(
      { weaponEntryId: 'dagger', mode: 'thrown', options: ['power-catalog'] },
      {
        feats: [
          { id: 'power', key: 'power-attack' },
          { id: 'aim', key: 'deadly-aim' },
        ],
      },
    ),
  );
  const dialog = openEditor();
  const group = optionsGroup(dialog);
  // Power Attack never touches a thrown line; the note under the list says so.
  expect(option(dialog, 'Power Attack')).toHaveAccessibleDescription(
    'no effect in this routine',
  );
  expect(
    within(group).getByRole('list', { name: 'Options' }),
  ).toHaveTextContent(/Power Attack/);
  expect(within(group).queryByRole('button', { name: 'Accept' })).toBeNull();

  const aim = option(dialog, 'Deadly Aim');
  expect(aim).not.toBeChecked();
  await settle(() => fireEvent.click(aim));
  expect(lastCall()).toMatchObject({
    name: 'editAttackRoutine',
    args: { entryId: 'strike', options: ['power-catalog', 'aim-catalog'] },
  });
  expect(within(group).getByRole('status')).toHaveTextContent('Saving…');
  await settle(() =>
    lastCall().reject(new ConvexError('Character is read only')),
  );
  expect(within(group).getByRole('alert')).toHaveTextContent(
    "Changes weren't saved",
  );
  expect(aim).toBeChecked();
  const written = calls.length;
  await settle(() =>
    fireEvent.click(
      within(group).getByRole('button', { name: 'Try again saving options' }),
    ),
  );
  expect(calls).toHaveLength(written + 1);
  expect(lastCall().args).toMatchObject({
    options: ['power-catalog', 'aim-catalog'],
  });
  await settle(() => lastCall().resolve(1));
  expect(within(group).getByRole('status')).toHaveTextContent('Saved');
});

test('options are switches in list order with 44 px rows in the bottom sheet, and maintenance disables them with its reason', () => {
  const original = window.matchMedia;
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  })) as unknown as typeof window.matchMedia;
  try {
    const input = sheet(
      {},
      {
        feats: [
          { id: 'power', key: 'power-attack' },
          { id: 'expertise', key: 'combat-expertise' },
        ],
      },
    );
    const view = renderSheet(input);
    const dialog = openEditor();
    const switches = within(optionsGroup(dialog)).getAllByRole('switch');
    expect(switches.map((toggle) => toggle.getAttribute('aria-label'))).toEqual(
      ['Power Attack', 'Combat Expertise'],
    );
    for (const toggle of switches) {
      expect(toggle).toHaveAttribute('type', 'button');
      expect(toggle).toHaveAttribute('aria-checked', 'false');
      expect(toggle.closest('label')).toHaveClass('min-h-11', 'md:min-h-9');
    }
    expect(within(dialog).getByRole('form')).toHaveClass('overflow-y-auto');

    maintenance.mockReturnValue({
      kind: 'maintenance',
      readOnly: true,
      message: 'Editing is paused for maintenance.',
    });
    view.show(input);
    const power = option(dialog, 'Power Attack');
    expect(power).toBeDisabled();
    expect(power).toHaveAccessibleDescription(
      'Editing is paused for maintenance.',
    );
    fireEvent.click(power);
    expect(calls).toHaveLength(0);
  } finally {
    window.matchMedia = original;
  }
});

// Item Abilities per end, and a shield's bash (#408).
const group = (dialog: HTMLElement, name: string) =>
  within(dialog).getByRole('group', { name });
const optionValues = (select: HTMLElement) =>
  within(select)
    .getAllByRole('option')
    .map((option) => (option as HTMLOptionElement).value);

test('each end’s Item Abilities save as that end’s whole list: Add ability appends, Remove drops, and the picker offers what the end can carry', async () => {
  renderSheet(
    sheet(
      {
        weaponEntryId: 'hammer',
        hands: 'two',
        offHand: { kind: 'otherEnd', mode: 'melee' },
      },
      {
        sheetEntries: [
          representativeWeapon('gnome-hooked-hammer', 'hammer', {
            itemState: {
              enhancement: 1,
              abilities: [{ catalogEntryId: 'flaming' }],
              otherEnd: {
                enhancement: 1,
                abilities: [{ catalogEntryId: 'keen' }],
              },
            },
          }),
        ],
        itemAbilities: ['flaming', 'keen', 'bane', 'shadow'],
      },
    ),
  );
  const dialog = openEditor();
  const primary = group(
    group(dialog, 'Gnome hooked hammer, primary end'),
    'Item Abilities, primary end',
  );
  const other = group(
    group(dialog, 'Gnome hooked hammer, other end'),
    'Item Abilities, other end',
  );
  expect(primary).toHaveTextContent('Flaming');
  expect(other).toHaveTextContent('Keen');
  const add = within(primary).getByRole('combobox', {
    name: 'Add ability, primary end',
  });
  // Shadow suits armor, not a weapon end.
  expect(optionValues(add)).toEqual(['', 'bane', 'flaming', 'keen']);

  await settle(() => fireEvent.change(add, { target: { value: 'bane' } }));
  expect(lastCall()).toMatchObject({
    name: 'editEquipment',
    args: {
      entryId: 'hammer',
      end: 'primary',
      abilities: [{ catalogEntryId: 'flaming' }, { catalogEntryId: 'bane' }],
    },
  });
  expect(lastCall().args).not.toHaveProperty('enhancement');
  expect(within(primary).getByText('Saving…')).toBeVisible();
  expect(primary).toHaveTextContent('Bane');
  // Bane needs its foe: the field is outlined, not warned about.
  expect(within(primary).getByRole('textbox', { name: 'Foe' })).toHaveClass(
    'ring-sky-400/80',
  );
  await settle(() => lastCall().resolve(null));
  expect(within(primary).getByText('Saved')).toBeVisible();

  await settle(() =>
    fireEvent.click(within(other).getByRole('button', { name: 'Remove Keen' })),
  );
  expect(lastCall().args).toMatchObject({
    entryId: 'hammer',
    end: 'otherEnd',
    abilities: [],
  });
  await settle(() => lastCall().resolve(null));
  expect(other).toHaveTextContent('None.');
});

test('a shield’s weapon details are its bash: the section says so, and its edits never write the shield’s own enhancement', async () => {
  const shield: CatalogSheetEntry = {
    id: 'shield',
    name: 'Heavy steel shield',
    modifiers: [],
    detail: {
      kind: 'item',
      consumable: false,
      armor: {
        slot: 'shield',
        category: 'heavyShield',
        bonus: 2,
        maxDex: null,
        armorCheckPenalty: 2,
        asf: 15,
      },
      weapon: {
        baseType: 'heavy shield',
        proficiency: 'martial',
        handedness: 'oneHanded',
        dice: '1d4',
        threat: 20,
        mult: 2,
      },
    },
    itemState: { enhancement: 3, bash: { enhancement: 1 } },
  };
  renderSheet(
    sheet(
      { weaponEntryId: 'shield' },
      { sheetEntries: [shield], itemAbilities: ['flaming', 'shadow'] },
    ),
  );
  const dialog = openEditor();
  const bash = group(dialog, 'Heavy steel shield, shield bash');
  expect(bash).toHaveTextContent('Shield bash');
  expect(bash).toHaveTextContent(
    "Shield bash: its own enhancement and Item Abilities, apart from the shield's AC bonus.",
  );
  const enhancement = within(bash).getByRole('textbox', {
    name: 'Enhancement',
  });
  expect(enhancement).toHaveValue('1');
  await settle(() => fireEvent.change(enhancement, { target: { value: '2' } }));
  expect(lastCall()).toMatchObject({
    name: 'editEquipment',
    args: { entryId: 'shield', end: 'bash', enhancement: 2 },
  });
  await settle(() => lastCall().resolve(null));

  const add = within(group(bash, 'Item Abilities, shield bash')).getByRole(
    'combobox',
    { name: 'Add ability, shield bash' },
  );
  expect(optionValues(add)).toEqual(['', 'flaming']);
  await settle(() => fireEvent.change(add, { target: { value: 'flaming' } }));
  expect(lastCall().args).toMatchObject({
    entryId: 'shield',
    end: 'bash',
    abilities: [{ catalogEntryId: 'flaming' }],
  });
  expect(calls.every((call) => call.args.end === 'bash')).toBe(true);
});

test('bane’s foe saves trimmed when the field loses focus and on Enter, a refused list keeps Try again, and a part’s construction warning reads under it with Accept', async () => {
  renderSheet(
    sheet(
      {},
      {
        sheetEntries: [
          representativeWeapon('longsword', 'sword', {
            itemState: { abilities: [{ catalogEntryId: 'bane' }] },
          }),
        ],
        itemAbilities: ['bane'],
      },
    ),
  );
  const dialog = openEditor();
  const details = group(dialog, 'Longsword');
  const abilities = group(details, 'Item Abilities');
  expect(details).toHaveTextContent(
    'Longsword has special abilities without a +1 enhancement bonus.',
  );
  expect(within(details).getByRole('button', { name: 'Accept' })).toBeEnabled();
  const foe = within(abilities).getByRole('textbox', { name: 'Foe' });
  expect(foe).toHaveAccessibleDescription(
    'Choose a foe; bane adds nothing until then.',
  );
  fireEvent.change(foe, { target: { value: ' undead  ' } });
  await settle(() => fireEvent.keyDown(foe, { key: 'Enter' }));
  expect(lastCall()).toMatchObject({
    name: 'editEquipment',
    args: {
      entryId: 'sword',
      end: 'primary',
      abilities: [{ catalogEntryId: 'bane', choice: 'undead' }],
    },
  });
  expect(foe).not.toHaveClass('ring-sky-400/80');
  await settle(() =>
    lastCall().reject(
      new ConvexError('Item Ability does not belong to this Character'),
    ),
  );
  expect(within(abilities).getByRole('alert')).toHaveTextContent(
    "Changes weren't saved: Item Ability does not belong to this Character. Your edits are kept. Try again.",
  );
  expect(foe).toHaveValue('undead');
  const written = calls.length;
  await settle(() =>
    fireEvent.click(
      within(abilities).getByRole('button', {
        name: 'Try again saving Item Abilities for Longsword',
      }),
    ),
  );
  expect(calls).toHaveLength(written + 1);
  expect(lastCall().args).toMatchObject({
    abilities: [{ catalogEntryId: 'bane', choice: 'undead' }],
  });
  // Leaving the field with the same foe writes nothing more.
  await settle(() => lastCall().resolve(null));
  await settle(() => fireEvent.blur(foe));
  expect(calls).toHaveLength(written + 1);
});

test('the ammunition a routine fires has its own details: enhancement, material and Item Abilities save for that ammunition', async () => {
  renderSheet(
    archer(
      { ammunitionEntryId: 'arrows' },
      {
        sheetEntries: [
          bow,
          {
            ...arrows,
            itemState: {
              enhancement: 1,
              abilities: [{ catalogEntryId: 'flaming' }],
            },
          },
        ],
        itemAbilities: ['flaming', 'keen', 'bane'],
      },
    ),
  );
  const dialog = openEditor('Bow shot');
  expect(dialog).toHaveTextContent(
    'Shared by every routine that uses the weapon or ammunition.',
  );
  const details = group(dialog, 'Arrows, ammunition');
  const enhancement = within(details).getByRole('textbox', {
    name: 'Enhancement',
  });
  expect(enhancement).toHaveValue('1');
  const abilities = group(details, 'Item Abilities, ammunition');
  expect(abilities).toHaveTextContent('Flaming');
  // Ammunition is ranged: keen suits melee weapons only.
  expect(
    optionValues(
      within(abilities).getByRole('combobox', {
        name: 'Add ability, ammunition',
      }),
    ),
  ).toEqual(['', 'bane', 'flaming']);

  await settle(() => fireEvent.change(enhancement, { target: { value: '2' } }));
  expect(lastCall()).toMatchObject({
    name: 'editEquipment',
    args: { entryId: 'arrows', end: 'primary', enhancement: 2 },
  });
  await settle(() =>
    fireEvent.change(
      within(abilities).getByRole('combobox', {
        name: 'Add ability, ammunition',
      }),
      { target: { value: 'bane' } },
    ),
  );
  expect(lastCall()).toMatchObject({
    name: 'editEquipment',
    args: {
      entryId: 'arrows',
      end: 'primary',
      abilities: [{ catalogEntryId: 'flaming' }, { catalogEntryId: 'bane' }],
    },
  });

  // A material over 64 characters stays local with its error.
  const written = calls.length;
  await settle(() =>
    fireEvent.change(
      within(details).getByRole('textbox', { name: 'Material' }),
      { target: { value: 'x'.repeat(65) } },
    ),
  );
  expect(calls).toHaveLength(written);
  expect(within(details).getByRole('alert')).toHaveTextContent(
    'Name the material in 64 characters or fewer',
  );
});

test('a melee routine has no ammunition details', () => {
  renderSheet(
    archer({}, { attackRoutines: [{ ...strike, weaponEntryId: 'dagger' }] }),
  );
  const dialog = openEditor();
  expect(within(dialog).queryByRole('group', { name: /ammunition/ })).toBe(
    null,
  );
});

test('a foe over 64 characters stays local with its error until it fits', async () => {
  renderSheet(
    sheet(
      {},
      {
        sheetEntries: [
          representativeWeapon('longsword', 'sword', {
            itemState: {
              enhancement: 1,
              abilities: [{ catalogEntryId: 'bane' }],
            },
          }),
        ],
        itemAbilities: ['bane'],
      },
    ),
  );
  const abilities = group(group(openEditor(), 'Longsword'), 'Item Abilities');
  const foe = within(abilities).getByRole('textbox', { name: 'Foe' });
  fireEvent.change(foe, { target: { value: 'x'.repeat(65) } });
  await settle(() => fireEvent.blur(foe));
  expect(calls).toHaveLength(0);
  expect(within(abilities).getByRole('alert')).toHaveTextContent(
    'Name the foe in 64 characters or fewer',
  );
  expect(foe).toHaveValue('x'.repeat(65));
  fireEvent.change(foe, { target: { value: 'dragons' } });
  await settle(() => fireEvent.keyDown(foe, { key: 'Enter' }));
  expect(lastCall().args).toMatchObject({
    abilities: [{ catalogEntryId: 'bane', choice: 'dragons' }],
  });
});

// Spell Effects on items (#416): Weapon details name the effects on each end.
test('Weapon details show a chip per active Spell Effect on the end, apart from the other end', () => {
  const magicWeapon = (
    id: string,
    onItem: { entry: string; end?: 'otherEnd' | 'bash' },
    casterLevel = 1,
  ): CatalogSheetEntry => ({
    id,
    name: 'Magic weapon',
    detail: {
      kind: 'spellEffect',
      lastsOverOneDay: false,
      defaultCasterLevel: 1,
      itemTarget: 'weapon',
    },
    modifiers: [
      {
        target: 'attack',
        bonusType: 'enhancement',
        value: 1,
        condition: { weapon: '$target' },
      },
    ],
    casterLevel,
    onItem,
  });
  renderSheet(
    sheet(
      {
        name: 'Hammer strike',
        weaponEntryId: 'hammer',
        offHand: { kind: 'otherEnd', mode: 'melee' },
      },
      {
        sheetEntries: [
          hammer,
          magicWeapon('mw-primary', { entry: 'hammer' }),
          magicWeapon('mw-other', { entry: 'hammer', end: 'otherEnd' }, 3),
          { ...magicWeapon('mw-off', { entry: 'hammer' }), active: false },
        ],
      },
    ),
  );
  const dialog = openEditor('Hammer strike');
  const primary = group(dialog, 'Gnome hooked hammer, primary end');
  const other = group(dialog, 'Gnome hooked hammer, other end');
  expect(
    within(primary).getAllByRole('button', { name: /Magic weapon · CL/ }),
  ).toHaveLength(1);
  expect(
    within(primary).getByRole('button', { name: /Magic weapon · CL 1/ }),
  ).toBeVisible();
  expect(
    within(other).getByRole('button', { name: /Magic weapon · CL 3/ }),
  ).toBeVisible();
  expect(
    within(other).queryByRole('button', { name: /Magic weapon · CL 1/ }),
  ).not.toBeInTheDocument();
});

// Flurry of blows in the editor (#414): the monk's class feature is one more
// switch, first; a flurry whose class feature no longer counts reads amber
// with its Accept; the preview heads the flurry full attack with its line;
// and the flurry's advisories sit beside the fields they are about. The
// numbers are the NPC Codex Cruel Devotee's (monk 5, Str 16: +6, flurry
// +6/+6) and an Unchained monk 5 with the same Strength (+8/+8, PU p. 14).

// CRB pp. 151–152: the seeded chain shirt, light armor.
const chainShirt = representativeEquipment('chain-shirt', 'shirt');
const fists: AttackRoutineFixture = {
  id: 'fists',
  name: 'Fists',
  weaponEntryId: 'unarmed',
};
const monk = (
  classId: 'monk' | 'unchained-monk',
  routine: Partial<AttackRoutineFixture> = {},
  input: Parameters<typeof buildSheet>[0] = {},
) =>
  buildSheet({
    scores: { ...defaultAbilityScores, strength: 16 },
    levels: Array.from({ length: 5 }, (_, index) => ({
      id: `${classId}-${index + 1}`,
      hp: 8,
      classId,
    })),
    hasRaces: true,
    extraCatalog: monkClassCatalog(),
    attackRoutines: [{ ...fists, ...routine }],
    ...input,
  });
const preview = (dialog: HTMLElement) =>
  within(dialog).getByRole('region', { name: 'As it attacks now' });
const follows = (later: HTMLElement, earlier: HTMLElement) =>
  Boolean(
    earlier.compareDocumentPosition(later) & Node.DOCUMENT_POSITION_FOLLOWING,
  );

test('an offered flurry is the first switch and saves as the routine’s whole list', async () => {
  renderSheet(
    monk('monk', {}, { feats: [{ id: 'power', key: 'power-attack' }] }),
  );
  const dialog = openEditor('Fists');
  expect(
    within(optionsGroup(dialog))
      .getAllByRole('switch')
      .map((toggle) => toggle.getAttribute('aria-label')),
  ).toEqual(['Flurry of Blows', 'Power Attack']);
  const flurry = option(dialog, 'Flurry of Blows');
  expect(flurry).not.toBeChecked();
  expect(flurry).not.toHaveAttribute('aria-describedby');
  expect(preview(dialog)).toHaveTextContent(/Full attack\s*\+6 \(/);
  await settle(() => fireEvent.click(flurry));
  expect(lastCall()).toMatchObject({
    name: 'editAttackRoutine',
    args: { entryId: 'fists', options: ['monk-flurry'] },
  });
});

test('a flurry whose class feature no longer counts stays on, amber, with its own Accept, while the sheet’s own flurry is offered', async () => {
  renderSheet(monk('unchained-monk', { options: ['monk-flurry'] }));
  const dialog = openEditor('Fists');
  const stale = option(dialog, 'Flurry of Blows');
  expect(stale).toBeChecked();
  expect(stale).toBeEnabled();
  expect(stale).toHaveAccessibleDescription(
    "the class feature doesn’t count Flurry of Blows is switched on in Fists, but the class feature doesn't count on this sheet. It has no effect until it does.",
  );
  expect(
    within(optionsGroup(dialog)).getByText('the class feature doesn’t count'),
  ).toHaveClass('text-amber-300');
  expect(option(dialog, 'Flurry of Blows (UC)')).not.toBeChecked();
  expect(preview(dialog)).toHaveTextContent(/Full attack\s*\+8 \(/);
  expect(preview(dialog)).not.toHaveTextContent('Full attack · Flurry');
  const accept = within(optionsGroup(dialog)).getByRole('button', {
    name: 'Accept',
  });
  await settle(() => fireEvent.click(accept));
  expect(lastCall()).toMatchObject({
    name: 'accept',
    args: {
      check: 'missingRoutineOption',
      subject: 'fists:option:monk-flurry',
    },
  });
});

test('the preview heads a flurry full attack with its line and base attack bonus, after the ordinary single attack', () => {
  renderSheet(monk('monk', { options: ['monk-flurry'] }));
  const dialog = openEditor('Fists');
  expect(preview(dialog)).toHaveTextContent(
    /Single attack\s*\+6 \(1d3\+3\/×2\) Nonlethal\s*Full attack · Flurry of Blows\s*Flurry of Blows\s*Core\s*−2 on every attack\s*BAB\s*\+5\s*\+6 \(1d3\+3\/×2\) Nonlethal\s*\+6 \(1d3\+3\/×2\) Nonlethal Flurry of Blows/,
  );
  const bab = within(preview(dialog)).getByRole('button', {
    name: 'Fists Flurry of Blows: base attack bonus +5, breakdown',
  });
  fireEvent.click(bab);
  expect(
    screen.getByRole('group', {
      name: 'Fists Flurry of Blows: base attack bonus breakdown',
    }),
  ).toHaveTextContent('Flurry of Blows: monk level 5');
  expect(within(dialog).queryByRole('button', { name: 'Accept' })).toBeNull();
});

// A nonproficient chain shirt also penalizes every attack, so this reads the
// advisories' places and leaves the numbers to the Cruel Devotee above.
test('the natural and armor advisories sit beside the natural attacks and the flurry switch, each with Accept', async () => {
  renderSheet(
    monk(
      'monk',
      { options: ['monk-flurry'], naturalAttackEntryIds: ['claw'] },
      { sheetEntries: [claw, chainShirt] },
    ),
  );
  const dialog = openEditor('Fists');
  expect(preview(dialog)).toHaveTextContent('Full attack · Flurry of Blows');
  const naturalAccept = within(dialog).getByRole('button', {
    name: 'Accept',
    description:
      "Natural attacks can't be part of a flurry of blows. Fists keeps them recorded but leaves them out of its flurry.",
  });
  expect(follows(naturalAccept, naturalGroup(dialog))).toBe(true);
  expect(follows(optionsGroup(dialog), naturalAccept)).toBe(true);
  const armor = within(optionsGroup(dialog)).getByRole('button', {
    name: 'Accept',
    description:
      'A monk loses flurry of blows while wearing armor or using a shield (Chain shirt). Fists keeps its flurry attacks.',
  });
  expect(follows(armor, option(dialog, 'Flurry of Blows'))).toBe(true);
  expect(option(dialog, 'Flurry of Blows')).toBeChecked();
  expect(natural(dialog, 'Claw')).toBeChecked();
  await settle(() => fireEvent.click(naturalAccept));
  expect(lastCall()).toMatchObject({
    name: 'accept',
    args: { check: 'flurryNaturalAttacks', subject: 'fists:flurry' },
  });
});

test('a non-monk weapon’s flurry advisory sits beside the main weapon with Accept', async () => {
  renderSheet(
    monk(
      'monk',
      {
        name: 'Sword strike',
        weaponEntryId: 'sword',
        options: ['monk-flurry'],
      },
      { sheetEntries: [representativeWeapon('longsword', 'sword')] },
    ),
  );
  const dialog = openEditor('Sword strike');
  const accept = within(dialog).getByRole('button', {
    name: 'Accept',
    description:
      "Longsword isn't a monk weapon. A flurry of blows uses only unarmed strikes and monk weapons; Sword strike keeps its flurry attacks.",
  });
  // Above the weapon cards, where the off-hand field keeps its advisories.
  expect(follows(accept, nameField(dialog))).toBe(true);
  expect(
    follows(
      within(dialog).getByRole('radiogroup', { name: 'Main weapon' }),
      accept,
    ),
  ).toBe(true);
  expect(preview(dialog)).toHaveTextContent('Full attack · Flurry of Blows');
  await settle(() => fireEvent.click(accept));
  expect(lastCall()).toMatchObject({
    name: 'accept',
    args: { check: 'flurryWeapon', subject: 'fists:flurry' },
  });
});

test('an Unchained flurry reads its own name with no penalty, at the highest base attack bonus', () => {
  renderSheet(monk('unchained-monk', { options: ['unchained-monk-flurry'] }));
  const dialog = openEditor('Fists');
  expect(preview(dialog)).toHaveTextContent(
    /Single attack\s*\+8 \(1d3\+3\/×2\) Nonlethal\s*Full attack · Flurry of Blows \(UC\)\s*Flurry of Blows \(UC\)\s*Unchained\s*BAB\s*\+5\s*\+8 \(1d3\+3\/×2\) Nonlethal\s*\+8 \(1d3\+3\/×2\) Nonlethal Flurry of Blows \(UC\)/,
  );
  expect(preview(dialog)).not.toHaveTextContent('on every attack');
  expect(
    within(optionsGroup(dialog)).getByRole('list', { name: 'Options' }),
  ).toHaveTextContent(
    'Flurry of Blows (UC): 1 extra attack at the highest base attack bonus.',
  );
});

// A sheet can record both flurries; only one counts. The armor advisory is
// about the routine's flurry, so it sits once, beneath the one in effect.
test('the armor advisory sits once, beneath the flurry in effect, when another version’s flurry is also recorded', () => {
  renderSheet(
    monk(
      'monk',
      { options: ['unchained-monk-flurry', 'monk-flurry'] },
      { sheetEntries: [chainShirt] },
    ),
  );
  const dialog = openEditor('Fists');
  const armor = within(optionsGroup(dialog)).getAllByRole('button', {
    name: 'Accept',
    description:
      'A monk loses flurry of blows while wearing armor or using a shield (Chain shirt). Fists keeps its flurry attacks.',
  });
  expect(armor).toHaveLength(1);
  expect(follows(armor[0]!, option(dialog, 'Flurry of Blows'))).toBe(true);
  expect(
    within(optionsGroup(dialog))
      .getAllByRole('switch')
      .map((toggle) => toggle.getAttribute('aria-label')),
  ).toEqual(['Flurry of Blows (UC)', 'Flurry of Blows']);
});
