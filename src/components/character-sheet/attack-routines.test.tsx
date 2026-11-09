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
  emptyOwnerCandidates,
  findCalculatedWarning,
  monkClassCatalog,
  representativeEquipment,
  representativeWeapon,
  type AttackRoutineFixture,
} from './character-sheet-test-fixture';
import type { CharacterSheetSnapshot } from './use-character-sheet';
import { characterSheetNames } from './character-sheet-api-test-fixture';
import type { FunctionReference } from 'convex/server';

// The Attacks block (#314): adding weapons and routines, routine cards with
// their warnings and repair, and removal with Undo of the same routine.

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

beforeEach(() => {
  calls = [];
  maintenance.mockReturnValue({ kind: 'ready', readOnly: false, message: '' });
});

const sword = representativeWeapon('longsword', 'sword');
const strike = { id: 'strike', name: 'Sword strike', weaponEntryId: 'sword' };
const sheet = (input: Parameters<typeof buildSheet>[0] = {}) =>
  buildSheet({
    levels: [{ id: 'level-1', hp: 10, classId: 'fighter' }],
    classProficiencies: {
      fighter: [{ category: 'simple' }, { category: 'martial' }],
    },
    ...input,
  });

const page = () => <CharacterSheetBlocks blocks={['equipment', 'attacks']} />;
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
const attacksBlock = () => screen.getByRole('region', { name: 'Attacks' });
const card = (name: string) =>
  within(attacksBlock()).getByRole('listitem', { name });
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

test('a catalog weapon card adds Gear with its default routine, and another routine reuses that Gear', async () => {
  const view = renderSheet(sheet({ catalogOnly: [sword] }));
  expect(attacksBlock()).toHaveTextContent(
    'Choose an attack to create a routine.',
  );
  expect(
    within(attacksBlock()).getByRole('button', { name: 'Add attack routine' }),
  ).toBeEnabled();

  const addWeapon = within(attacksBlock()).getByRole('button', {
    name: 'Add weapon',
  });
  fireEvent.click(addWeapon);
  expect(addWeapon).toHaveAttribute('aria-expanded', 'true');
  const catalog = within(attacksBlock()).getByRole('region', {
    name: 'Add weapon',
  });
  fireEvent.click(within(catalog).getByRole('button', { name: 'Longsword' }));
  expect(lastCall()).toMatchObject({
    name: 'selectEntry',
    args: { catalogEntryId: 'sword-catalog' },
  });
  expect(within(catalog).getByRole('status')).toHaveTextContent(
    'Adding Longsword…',
  );
  await settle(() => lastCall().resolve('sword'));
  view.show(
    sheet({
      sheetEntries: [sword],
      attackRoutines: [{ ...strike, name: 'Longsword' }],
    }),
  );
  expect(
    within(attacksBlock()).getAllByRole('button', { name: /^Edit / }),
  ).toHaveLength(1);
  expect(card('Longsword')).toHaveTextContent('Longsword · One hand · Melee');

  fireEvent.click(
    within(attacksBlock()).getByRole('button', { name: 'Add attack routine' }),
  );
  fireEvent.click(
    within(
      within(attacksBlock()).getByRole('region', {
        name: 'Add attack routine',
      }),
    ).getByRole('button', { name: 'Longsword' }),
  );
  expect(lastCall()).toMatchObject({
    name: 'createAttackRoutine',
    args: { weaponEntryId: 'sword' },
  });
  expect(calls.filter((call) => call.name === 'selectEntry')).toHaveLength(1);
  await settle(() => lastCall().resolve('second'));
  expect(screen.queryByRole('dialog')).toBeNull();
  view.show(
    sheet({
      sheetEntries: [sword],
      attackRoutines: [
        { ...strike, name: 'Longsword' },
        { ...strike, id: 'second', name: 'Longsword' },
      ],
    }),
  );
  const dialog = screen.getByRole('dialog', { name: 'Attack routine' });
  expect(
    within(dialog).getByRole('textbox', { name: 'Routine name' }),
  ).toHaveValue('Longsword');
  fireEvent.click(within(dialog).getByRole('button', { name: 'Done' }));
  await waitFor(() =>
    expect(
      within(attacksBlock()).getByRole('button', {
        name: 'Add attack routine',
      }),
    ).toHaveFocus(),
  );
});

test('Gear offers the same weapon cards', () => {
  renderSheet(sheet({ catalogOnly: [sword] }));
  const equipment = screen.getByRole('region', { name: 'Equipment' });
  fireEvent.click(
    within(equipment).getByRole('button', { name: 'Add weapon' }),
  );
  fireEvent.click(
    within(
      within(equipment).getByRole('region', { name: 'Add weapon' }),
    ).getByRole('button', { name: 'Longsword' }),
  );
  expect(lastCall()).toMatchObject({
    name: 'selectEntry',
    args: { catalogEntryId: 'sword-catalog' },
  });
});

test('a switched-off weapon keeps its named card, warning and repair; a new weapon brings its natural hands', async () => {
  renderSheet(
    sheet({
      sheetEntries: [
        { ...sword, active: false },
        representativeWeapon('greatsword', 'greatsword'),
      ],
      attackRoutines: [strike],
    }),
  );
  const routine = card('Sword strike');
  expect(routine).toHaveTextContent(
    "Sword strike's weapon is switched off. Switch it on in Gear or choose another weapon to use this routine.",
  );
  expect(within(routine).getByRole('button', { name: 'Accept' })).toBeVisible();
  expect(within(routine).queryByRole('list', { name: 'Single attack' })).toBe(
    null,
  );
  fireEvent.click(
    within(routine).getByRole('button', {
      name: 'Choose a weapon for Sword strike',
    }),
  );
  const dialog = screen.getByRole('dialog', { name: 'Attack routine' });
  const weapons = within(dialog).getByRole('radiogroup', {
    name: 'Main weapon',
  });
  expect(
    within(weapons).getByRole('radio', { name: 'Longsword, switched off' }),
  ).toBeChecked();
  await settle(() =>
    fireEvent.click(within(weapons).getByRole('radio', { name: 'Greatsword' })),
  );
  expect(lastCall()).toMatchObject({
    name: 'editAttackRoutine',
    args: {
      entryId: 'strike',

      weaponEntryId: 'greatsword',
      hands: 'two',
      mode: 'melee',
    },
  });
});

test('a routine whose weapon left Gear keeps its card, and duplicate Gear names are numbered', () => {
  renderSheet(
    sheet({
      sheetEntries: [sword, representativeWeapon('longsword', 'sword-2')],
      attackRoutines: [
        { ...strike, weaponEntryId: 'sword-2' },
        { id: 'lost', name: 'Lost blade', weaponEntryId: 'gone' },
      ],
    }),
  );
  expect(card('Sword strike')).toHaveTextContent(
    'Longsword 2 · One hand · Melee',
  );
  const lost = card('Lost blade');
  expect(lost).toHaveTextContent("Lost blade's weapon is no longer in Gear.");
  fireEvent.click(
    within(lost).getByRole('button', { name: 'Edit Lost blade' }),
  );
  const dialog = screen.getByRole('dialog', { name: 'Attack routine' });
  expect(dialog).toHaveTextContent(
    "Lost blade's weapon is no longer in Gear. Choose another weapon to use this routine.",
  );
  expect(
    within(dialog).queryByText(
      'Its weapon is no longer in Gear. Choose another weapon.',
    ),
  ).toBeNull();
  const weapons = within(dialog).getByRole('radiogroup', {
    name: 'Main weapon',
  });
  expect(
    within(weapons)
      .getAllByRole('radio')
      .map((radio) => (radio as HTMLInputElement).checked),
  ).toEqual([false, false, false]);
  expect(
    within(weapons).getByRole('radio', { name: 'Longsword 1' }),
  ).toBeVisible();
  expect(
    within(weapons).getByRole('radio', { name: 'Longsword 2' }),
  ).toBeVisible();
});

test('removal waits for its acknowledgement, and Undo restores the same routine and stays retryable', async () => {
  const view = renderSheet(
    sheet({ sheetEntries: [sword], attackRoutines: [strike] }),
  );
  fireEvent.click(
    within(card('Sword strike')).getByRole('button', {
      name: 'Remove Sword strike',
    }),
  );
  expect(lastCall()).toMatchObject({
    name: 'deleteAttackRoutine',
    args: { entryId: 'strike' },
  });
  expect(card('Sword strike')).toBeVisible();
  await settle(() => lastCall().resolve(1));
  expect(
    within(attacksBlock()).queryByRole('listitem', { name: 'Sword strike' }),
  ).toBeNull();
  expect(screen.getByRole('heading', { name: 'Attacks' })).toHaveFocus();
  expect(
    within(attacksBlock()).getByText('Removed “Sword strike”.'),
  ).toHaveAttribute('role', 'status');

  const undo = within(attacksBlock()).getByRole('button', { name: 'Undo' });
  fireEvent.click(undo);
  expect(lastCall()).toMatchObject({
    name: 'restoreAttackRoutine',
    args: { entryId: 'strike' },
  });
  await settle(() =>
    lastCall().reject(new ConvexError('Character is read only')),
  );
  expect(within(attacksBlock()).getByRole('alert')).toHaveTextContent(
    'Character is read only',
  );
  expect(undo).toBeEnabled();
  fireEvent.click(undo);
  await settle(() => lastCall().resolve(2));
  expect(within(attacksBlock()).queryByRole('button', { name: 'Undo' })).toBe(
    null,
  );
  expect(attacksBlock()).toHaveTextContent('Restored “Sword strike”.');
  view.show(
    sheet({
      sheetEntries: [sword],
      attackRoutines: [{ ...strike, revision: 2 }],
    }),
  );
  expect(card('Sword strike')).toBeVisible();
  fireEvent.click(
    within(attacksBlock()).getByRole('button', { name: 'Dismiss' }),
  );
  expect(attacksBlock()).not.toHaveTextContent('Restored “Sword strike”.');
});

test('a refused removal keeps the card with its error and offers no Undo', async () => {
  renderSheet(sheet({ sheetEntries: [sword], attackRoutines: [strike] }));
  fireEvent.click(
    within(card('Sword strike')).getByRole('button', {
      name: 'Remove Sword strike',
    }),
  );
  await settle(() =>
    lastCall().reject(new ConvexError('Character is read only')),
  );
  expect(within(card('Sword strike')).getByRole('alert')).toHaveTextContent(
    'Character is read only',
  );
  expect(within(attacksBlock()).queryByRole('button', { name: 'Undo' })).toBe(
    null,
  );
});

test('Remove routine in the editor closes it once saved and returns focus to Attacks', async () => {
  renderSheet(sheet({ sheetEntries: [sword], attackRoutines: [strike] }));
  fireEvent.click(
    within(card('Sword strike')).getByRole('button', {
      name: 'Edit Sword strike',
    }),
  );
  const dialog = screen.getByRole('dialog', { name: 'Attack routine' });
  fireEvent.click(
    within(dialog).getByRole('button', { name: 'Remove routine' }),
  );
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  await settle(() => lastCall().resolve(1));
  expect(screen.queryByRole('dialog')).toBeNull();
  await waitFor(() =>
    expect(screen.getByRole('heading', { name: 'Attacks' })).toHaveFocus(),
  );
  expect(attacksBlock()).toHaveTextContent('Removed “Sword strike”.');
});

test('another player’s change is announced in Attacks until dismissed', () => {
  const view = renderSheet(
    sheet({ sheetEntries: [sword], attackRoutines: [strike] }),
  );
  view.show(
    sheet({
      sheetEntries: [sword],
      attackRoutines: [{ ...strike, name: 'Remote strike', revision: 1 }],
      lastOperationId: 'other-player',
    }),
  );
  expect(card('Remote strike')).toBeVisible();
  expect(attacksBlock()).toHaveTextContent('Changed by another player.');
  fireEvent.click(
    within(attacksBlock()).getByRole('button', {
      name: 'Dismiss attack routines update',
    }),
  );
  expect(attacksBlock()).not.toHaveTextContent('Changed by another player.');
});

test('maintenance disables writes with its reason while breakdowns stay usable', () => {
  maintenance.mockReturnValue({
    kind: 'maintenance',
    readOnly: true,
    message: 'Editing is paused for maintenance.',
  });
  renderSheet(
    sheet({
      sheetEntries: [sword],
      catalogOnly: [representativeWeapon('dagger', 'dagger')],
      attackRoutines: [strike],
    }),
  );
  const remove = within(card('Sword strike')).getByRole('button', {
    name: 'Remove Sword strike',
  });
  expect(remove).toBeDisabled();
  expect(remove).toHaveAccessibleDescription(
    'Editing is paused for maintenance.',
  );
  fireEvent.click(
    within(attacksBlock()).getByRole('button', { name: 'Add weapon' }),
  );
  expect(
    within(
      within(attacksBlock()).getByRole('region', { name: 'Add weapon' }),
    ).getByRole('button', { name: 'Dagger' }),
  ).toBeDisabled();
  const attack = within(card('Sword strike')).getByRole('button', {
    name: /^Sword strike single attack: attack /,
  });
  fireEvent.click(attack);
  expect(attack).toHaveAttribute('aria-expanded', 'true');
});

const dagger = representativeWeapon('dagger', 'dagger');
const hammer = representativeWeapon('gnome-hooked-hammer', 'hammer');
const damages = (list: HTMLElement) =>
  within(list)
    .getAllByRole('button', { name: /: damage / })
    .map((button) => button.getAttribute('aria-label'));

test('two weapons and a double weapon’s ends attack in order with their own damage and critical; the single attack stays one-handed', () => {
  renderSheet(
    sheet({
      sheetEntries: [sword, dagger, hammer],
      attackRoutines: [
        {
          ...strike,
          offHand: { kind: 'weapon', weaponEntryId: 'dagger', mode: 'melee' },
        },
        {
          id: 'whirl',
          name: 'Hammer whirl',
          weaponEntryId: 'hammer',
          hands: 'two',
          offHand: { kind: 'otherEnd', mode: 'melee' },
        },
      ],
    }),
  );
  const swords = card('Sword strike');
  expect(swords).toHaveTextContent(
    'Longsword · One hand · Melee · Off hand: Dagger',
  );
  const single = within(swords).getByRole('list', { name: 'Single attack' });
  expect(within(single).getAllByRole('listitem')).toHaveLength(1);
  expect(within(single).queryByText('Off hand')).toBe(null);
  expect(
    damages(within(swords).getByRole('list', { name: 'Full attack' })),
  ).toEqual([
    expect.stringMatching(
      /^Sword strike full attack 1 of 2, main hand: damage 1d8/,
    ),
    expect.stringMatching(
      /^Sword strike full attack 2 of 2, off hand: damage 1d4/,
    ),
  ]);

  const whirl = card('Hammer whirl');
  expect(whirl).toHaveTextContent('Off hand: Other end');
  const full = within(whirl).getByRole('list', { name: 'Full attack' });
  expect(damages(full)).toEqual([
    expect.stringMatching(
      /^Hammer whirl full attack 1 of 2, main hand: damage 1d8/,
    ),
    expect.stringMatching(
      /^Hammer whirl full attack 2 of 2, off hand, other end: damage 1d6/,
    ),
  ]);
  expect(within(full).getByText('Other end')).toBeVisible();
  expect(
    within(full)
      .getAllByRole('button', { name: /: critical multiplier / })
      .map((button) => button.textContent),
  ).toEqual(['×3', '×4']);
  expect(
    damages(within(whirl).getByRole('list', { name: 'Single attack' })),
  ).toEqual([expect.stringMatching(/^Hammer whirl single attack: damage 1d8/)]);
});

test('an off hand’s accepted warning stays its own, apart from the same check on a main weapon', () => {
  const input = {
    sheetEntries: [sword, { ...dagger, active: false }],
    attackRoutines: [
      {
        ...strike,
        offHand: {
          kind: 'weapon' as const,
          weaponEntryId: 'dagger',
          mode: 'melee' as const,
        },
      },
      { id: 'stab', name: 'Dagger stab', weaponEntryId: 'dagger' },
    ],
  };
  const unaccepted = sheet(input);
  renderSheet(
    sheet({
      ...input,
      accepted: [
        findCalculatedWarning(unaccepted, 'inactiveAttackWeapon', 'strike:off'),
      ],
    }),
  );
  const swords = card('Sword strike');
  expect(swords).toHaveTextContent(/Off hand: .*switched off/);
  expect(within(swords).getByText('Accepted')).toBeVisible();
  expect(within(swords).getByRole('button', { name: 'Reopen' })).toBeVisible();
  const stab = card('Dagger stab');
  expect(within(stab).queryByText('Accepted')).toBe(null);
  expect(within(stab).getByRole('button', { name: 'Accept' })).toBeVisible();
});

// Ranged routines (#322): Add ammunition from the catalog, and a card that
// states its ammunition, range and free hand.

test('Add ammunition adds arrows under Gear without a routine, and a bow card states its ammunition, range and free hand', async () => {
  const bow = representativeWeapon('longbow', 'bow');
  const arrows = representativeWeapon('arrows', 'arrows');
  const shot = {
    id: 'shot',
    name: 'Bow shot',
    weaponEntryId: 'bow',
    hands: 'two' as const,
    mode: 'ranged' as const,
  };
  const view = renderSheet(
    sheet({ sheetEntries: [bow], attackRoutines: [shot] }),
  );
  const addAmmunition = within(attacksBlock()).getByRole('button', {
    name: 'Add ammunition',
  });
  expect(addAmmunition).toBeDisabled();
  expect(card('Bow shot')).toHaveTextContent('Longbow · Two hands · Ranged');

  view.show(
    sheet({
      sheetEntries: [bow],
      catalogOnly: [arrows],
      attackRoutines: [shot],
    }),
  );
  expect(addAmmunition).toBeEnabled();
  fireEvent.click(addAmmunition);
  expect(addAmmunition).toHaveAttribute('aria-expanded', 'true');
  const catalog = within(attacksBlock()).getByRole('region', {
    name: 'Add ammunition',
  });
  fireEvent.click(within(catalog).getByRole('button', { name: 'Arrows' }));
  expect(lastCall()).toMatchObject({
    name: 'selectEntry',
    args: { catalogEntryId: 'arrows-catalog' },
  });
  expect(within(catalog).getByRole('status')).toHaveTextContent(
    'Adding Arrows…',
  );
  await settle(() => lastCall().resolve('arrows'));
  expect(calls.map((call) => call.name)).toEqual(['selectEntry']);

  view.show(
    sheet({
      sheetEntries: [bow, arrows],
      attackRoutines: [
        {
          ...shot,
          ammunitionEntryId: 'arrows',
          rangeIncrements: 2,
        },
      ],
    }),
  );
  expect(within(catalog).getByRole('status')).toHaveTextContent(
    'Arrows added under Gear.',
  );
  expect(
    within(attacksBlock()).getAllByRole('button', { name: /^Edit / }),
  ).toHaveLength(1);
  expect(card('Bow shot')).toHaveTextContent(
    'Longbow · Two hands · Ranged · Arrows · 2 range increments',
  );
});

test('a sheet without Gear creates an unarmed routine from the built-in strike, with no Gear to select or edit', async () => {
  const view = renderSheet(sheet());
  const add = within(attacksBlock()).getByRole('button', {
    name: 'Add attack routine',
  });
  expect(add).toBeEnabled();
  fireEvent.click(add);
  const picker = within(attacksBlock()).getByRole('region', {
    name: 'Add attack routine',
  });
  await settle(() =>
    fireEvent.click(
      within(picker).getByRole('button', { name: 'Unarmed strike' }),
    ),
  );
  expect(lastCall()).toMatchObject({
    name: 'createAttackRoutine',
    args: { weaponEntryId: 'unarmed' },
  });
  expect(calls.some((call) => call.name === 'selectEntry')).toBe(false);
  await settle(() => lastCall().resolve('fist'));
  view.show(
    sheet({
      attackRoutines: [
        { id: 'fist', name: 'Unarmed strike', weaponEntryId: 'unarmed' },
      ],
    }),
  );
  const dialog = screen.getByRole('dialog', { name: 'Attack routine' });
  expect(
    within(
      within(dialog).getByRole('radiogroup', { name: 'Main weapon' }),
    ).getByRole('radio', { name: 'Unarmed strike' }),
  ).toBeChecked();
  expect(
    within(dialog).queryByRole('region', { name: 'Weapon details' }),
  ).toBeNull();
  expect(
    within(dialog).queryByRole('textbox', { name: 'Enhancement' }),
  ).toBeNull();
  fireEvent.click(within(dialog).getByRole('button', { name: 'Done' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect(card('Unarmed strike')).toHaveTextContent(
    'Unarmed strike · One hand · Melee',
  );
  expect(
    within(card('Unarmed strike')).getAllByText('Nonlethal').length,
  ).toBeGreaterThan(0);
});

const naturalForm = () =>
  within(attacksBlock()).getByRole('region', { name: 'Add natural attack' });

const submitNatural = () =>
  act(async () => {
    fireEvent.click(
      within(naturalForm()).getByRole('button', { name: 'Add natural attack' }),
    );
  });

test('Add natural attack prefills a type, blocks malformed damage, saves the player’s own definition and keeps it through a failed save', async () => {
  renderSheet(sheet());
  const toggle = within(attacksBlock()).getByRole('button', {
    name: 'Add natural attack',
  });
  fireEvent.click(toggle);
  expect(toggle).toHaveAttribute('aria-expanded', 'true');
  const form = naturalForm();
  const types = within(form).getByRole('radiogroup', {
    name: 'Natural attack type',
  });
  expect(within(types).getByRole('radio', { name: 'Bite' })).toBeChecked();
  expect(within(types).getAllByRole('radio')).toHaveLength(12);
  fireEvent.click(within(types).getByRole('radio', { name: 'Tail slap' }));
  const name = within(form).getByLabelText('Attack name');
  const damage = within(form).getByLabelText('Medium damage');
  expect(name).toHaveValue('Tail slap');
  expect(damage).toHaveValue('1d6');
  expect(damage).toHaveAccessibleDescription('Damage changes with size.');
  expect(within(form).getByRole('radio', { name: 'Secondary' })).toBeChecked();

  fireEvent.change(damage, { target: { value: '' } });
  await submitNatural();
  expect(within(form).getByRole('alert')).toHaveTextContent(
    'Damage dice is required',
  );
  fireEvent.change(damage, { target: { value: 'd6' } });
  await submitNatural();
  expect(within(form).getByRole('alert')).toHaveTextContent(
    'Enter damage such as 1d6 or 1',
  );
  expect(damage).toHaveAccessibleDescription(
    'Damage changes with size. Enter damage such as 1d6 or 1',
  );
  expect(calls).toHaveLength(0);

  fireEvent.change(damage, { target: { value: '1' } });
  fireEvent.change(name, { target: { value: 'Lashing tail' } });
  fireEvent.click(within(form).getByRole('radio', { name: 'Primary' }));
  await submitNatural();
  await waitFor(() => expect(calls).toHaveLength(1));
  expect(lastCall()).toMatchObject({
    name: 'createSheetEntry',
    args: {
      name: 'Lashing tail',
      detail: {
        kind: 'item',
        weapon: {
          dice: '1',
          naturalAttack: { type: 'tailSlap', role: 'primary' },
        },
      },
    },
  });
  await settle(() =>
    lastCall().reject(new ConvexError('Character is read only')),
  );
  await waitFor(() =>
    expect(within(naturalForm()).getByRole('alert')).toHaveTextContent(
      "Changes weren't saved",
    ),
  );
  expect(name).toHaveValue('Lashing tail');
  expect(damage).toHaveValue('1');

  await submitNatural();
  await waitFor(() => expect(calls).toHaveLength(2));
  expect(lastCall().args).toMatchObject({ name: 'Lashing tail' });
  await settle(() => lastCall().resolve('tail'));
  await waitFor(() =>
    expect(
      within(attacksBlock()).queryByRole('region', {
        name: 'Add natural attack',
      }),
    ).toBeNull(),
  );
  expect(toggle).toHaveFocus();
});

test('maintenance keeps the natural attack form readable with its submit disabled and explained', () => {
  maintenance.mockReturnValue({
    kind: 'maintenance',
    readOnly: true,
    message: 'Editing is paused for maintenance.',
  });
  renderSheet(sheet());
  fireEvent.click(
    within(attacksBlock()).getByRole('button', { name: 'Add natural attack' }),
  );
  const submit = within(naturalForm()).getByRole('button', {
    name: 'Add natural attack',
  });
  expect(submit).toBeDisabled();
  expect(submit).toHaveAccessibleDescription(
    'Editing is paused for maintenance.',
  );
  expect(within(naturalForm()).getByLabelText('Attack name')).toBeDisabled();
  expect(
    within(naturalForm()).getByRole('radio', { name: 'Claw' }),
  ).toBeDisabled();
});

// Routine Options on the card (#407): switched-on options as chips beside
// the name, the resolver's option notes under the rate notes, and the
// Two-Weapon Rend after the full attack.

test('switched-on options are chips beside the routine name, primary when in effect and flagged when not, with the option notes and advisory on the card', () => {
  renderSheet(
    sheet({
      sheetEntries: [sword, representativeWeapon('longbow', 'bow')],
      feats: [
        { id: 'power', key: 'power-attack' },
        { id: 'many', key: 'manyshot', active: false },
      ],
      attackRoutines: [
        { ...strike, options: ['power-catalog'] },
        {
          id: 'shot',
          name: 'Bow shot',
          weaponEntryId: 'bow',
          hands: 'two',
          mode: 'ranged',
          options: ['power-catalog', 'many-catalog'],
        },
      ],
    }),
  );
  const swords = card('Sword strike');
  const chips = within(swords).getByRole('list', { name: 'Routine Options' });
  expect(
    within(chips)
      .getAllByRole('listitem')
      .map((chip) => chip.textContent),
  ).toEqual(['Power Attack']);
  expect(within(chips).queryByRole('button')).toBeNull();
  expect(
    within(swords).queryByRole('list', { name: 'Sword strike options' }),
  ).toBeNull();

  const shot = card('Bow shot');
  expect(
    within(within(shot).getByRole('list', { name: 'Routine Options' }))
      .getAllByRole('listitem')
      .map((chip) => chip.textContent),
  ).toEqual(['Power Attack, no effect', 'Manyshot, no effect']);
  expect(
    within(shot).getByRole('list', { name: 'Bow shot options' }),
  ).toHaveTextContent(/Power Attack/);
  const advisory = within(shot).getByText(
    'Manyshot is switched on in Bow shot, but the feat is switched off. It has no effect until the feat is switched on.',
  );
  expect(advisory).toBeVisible();
  expect(within(shot).getByRole('button', { name: 'Accept' })).toBeVisible();
});

test('Two-Weapon Rend reads once after the full attack with its own breakdown and note, never under the single attack', () => {
  renderSheet(
    sheet({
      sheetEntries: [sword, dagger],
      feats: [{ id: 'rend', key: 'two-weapon-rend' }],
      attackRoutines: [
        {
          ...strike,
          offHand: { kind: 'weapon', weaponEntryId: 'dagger', mode: 'melee' },
        },
      ],
    }),
  );
  const swords = card('Sword strike');
  const rend = within(swords).getByRole('button', {
    name: 'Sword strike Two-Weapon Rend: damage 1d10, breakdown',
  });
  const full = within(swords).getByRole('list', { name: 'Full attack' });
  const single = within(swords).getByRole('list', { name: 'Single attack' });
  expect(within(full).queryByText('Two-Weapon Rend')).toBeNull();
  expect(within(single).queryByText('Two-Weapon Rend')).toBeNull();
  expect(
    full.compareDocumentPosition(rend) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
  expect(swords).toHaveTextContent(
    /Two-Weapon Rend\s*Once per round, when both hands hit\.\s*1d10/,
  );
  expect(
    within(swords).queryByRole('button', { name: /Two-Weapon Rend: attack/ }),
  ).toBeNull();
  rend.focus();
  fireEvent.click(rend);
  expect(rend).toHaveAttribute('aria-expanded', 'true');
  expect(
    screen.getByRole('group', {
      name: 'Sword strike Two-Weapon Rend: damage breakdown',
    }),
  ).toHaveTextContent('Two-Weapon Rend');
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(rend).toHaveAttribute('aria-expanded', 'false');
  expect(rend).toHaveFocus();
});

// Flurry of blows on the card (#414): the NPC Codex Cruel Devotee (monk 5,
// Str 16) attacks once at +6 and flurries at +6/+6 from a flurry base attack
// bonus of +5 (CRB p. 57; FAQ naz). Natural attacks stay out of the flurry
// (#237 A5), only unarmed strikes and monk weapons flurry, and armor loses
// it; each keeps its attacks recorded with an advisory.

const claw = representativeWeapon('natural-claw', 'claw');
// CRB pp. 151–152: the seeded chain shirt, light armor.
const chainShirt = representativeEquipment('chain-shirt', 'shirt');
const fists: AttackRoutineFixture = {
  id: 'fists',
  name: 'Fists',
  weaponEntryId: 'unarmed',
  options: ['monk-flurry'],
};
const cruelDevotee = (input: Parameters<typeof buildSheet>[0] = {}) =>
  buildSheet({
    scores: { ...defaultAbilityScores, strength: 16 },
    levels: Array.from({ length: 5 }, (_, index) => ({
      id: `monk-${index + 1}`,
      hp: 8,
      classId: 'monk',
    })),
    hasRaces: true,
    extraCatalog: monkClassCatalog(),
    ...input,
  });
const attacks = (list: HTMLElement) =>
  within(list)
    .getAllByRole('button', { name: /: attack / })
    .map((button) => button.getAttribute('aria-label'));

test('a flurry heads the full attack with its line and base attack bonus, tags its extra attack, and leaves the single attack ordinary', () => {
  renderSheet(cruelDevotee({ attackRoutines: [fists] }));
  const routine = card('Fists');
  expect(
    within(routine).getByRole('list', { name: 'Routine Options' }),
  ).toHaveTextContent('Flurry of Blows');
  const single = within(routine).getByRole('list', { name: 'Single attack' });
  expect(attacks(single)).toEqual([
    'Fists single attack: attack +6, breakdown',
  ]);
  expect(single).not.toHaveTextContent('Flurry of Blows');
  const full = within(routine).getByRole('list', {
    name: 'Full attack · Flurry of Blows',
  });
  expect(attacks(full)).toEqual([
    'Fists full attack 1 of 2: attack +6, breakdown',
    'Fists full attack 2 of 2: attack +6, breakdown',
  ]);
  const lines = within(full).getAllByRole('listitem');
  expect(lines[0]).not.toHaveTextContent('extra attack');
  expect(lines[1]).toHaveTextContent('extra attack from Flurry of Blows');
  expect(routine).toHaveTextContent(
    /Full attack · Flurry of Blows\s*Flurry of Blows\s*Core\s*−2 on every attack\s*BAB\s*\+5/,
  );
  expect(
    within(routine).getByRole('list', { name: 'Fists options' }),
  ).toHaveTextContent(
    'Flurry of Blows: base attack bonus +5 with monk level 5, 1 extra attack, −2 on every attack.',
  );
  expect(within(routine).queryByRole('button', { name: 'Accept' })).toBeNull();

  const bab = within(routine).getByRole('button', {
    name: 'Fists Flurry of Blows: base attack bonus +5, breakdown',
  });
  fireEvent.click(bab);
  expect(bab).toHaveAttribute('aria-expanded', 'true');
  const breakdown = screen.getByRole('group', {
    name: 'Fists Flurry of Blows: base attack bonus breakdown',
  });
  expect(breakdown).toHaveTextContent('Flurry of Blows: monk level 5');
  // A paragraph can't hold the breakdown's list.
  expect(breakdown.closest('p')).toBeNull();
});

test('a flurry keeps its natural attacks, a non-monk weapon and armor recorded, each with its advisory and Accept on the card', async () => {
  renderSheet(
    cruelDevotee({
      sheetEntries: [claw, chainShirt, sword],
      attackRoutines: [
        { ...fists, naturalAttackEntryIds: ['claw'] },
        { ...strike, options: ['monk-flurry'] },
      ],
    }),
  );
  const routine = card('Fists');
  expect(routine).toHaveTextContent('Natural: Claw');
  const full = within(routine).getByRole('list', {
    name: 'Full attack · Flurry of Blows',
  });
  expect(within(full).getAllByRole('listitem')).toHaveLength(2);
  expect(full).not.toHaveTextContent('Claw');
  const natural = within(routine).getByRole('button', {
    name: 'Accept',
    description:
      "Natural attacks can't be part of a flurry of blows. Fists keeps them recorded but leaves them out of its flurry.",
  });
  expect(
    within(routine).getByRole('button', {
      name: 'Accept',
      description:
        'A monk loses flurry of blows while wearing armor or using a shield (Chain shirt). Fists keeps its flurry attacks.',
    }),
  ).toBeVisible();
  const swords = card('Sword strike');
  expect(
    within(swords).getByRole('button', {
      name: 'Accept',
      description:
        "Longsword isn't a monk weapon. A flurry of blows uses only unarmed strikes and monk weapons; Sword strike keeps its flurry attacks.",
    }),
  ).toBeVisible();
  expect(
    within(swords).getByRole('list', { name: 'Full attack · Flurry of Blows' }),
  ).toBeVisible();

  await settle(() => fireEvent.click(natural));
  expect(lastCall()).toMatchObject({
    name: 'accept',
    args: { check: 'flurryNaturalAttacks', subject: 'fists:flurry' },
  });
});

// CRB p. 57; #237 A5: a natural main weapon can't make the flurry's
// attacks, so the switched-on flurry has no effect, says why, and keeps
// its natural-attacks advisory with Accept.
test('a natural main weapon leaves the flurry without effect, with its natural-attacks advisory on the card', async () => {
  renderSheet(
    cruelDevotee({
      sheetEntries: [claw],
      attackRoutines: [
        { ...fists, name: 'Claws', id: 'claws', weaponEntryId: 'claw' },
      ],
    }),
  );
  const routine = card('Claws');
  expect(
    within(routine).queryByRole('list', {
      name: 'Full attack · Flurry of Blows',
    }),
  ).toBeNull();
  expect(
    within(routine).getByRole('list', { name: 'Claws options' }),
  ).toHaveTextContent(
    "Flurry of Blows can't use a natural attack. It has no effect in this routine.",
  );
  const accept = within(routine).getByRole('button', {
    name: 'Accept',
    description:
      "Natural attacks can't be part of a flurry of blows. Claws keeps them recorded but leaves them out of its flurry.",
  });
  await settle(() => fireEvent.click(accept));
  expect(lastCall()).toMatchObject({
    name: 'accept',
    args: { check: 'flurryNaturalAttacks', subject: 'claws:flurry' },
  });
});
