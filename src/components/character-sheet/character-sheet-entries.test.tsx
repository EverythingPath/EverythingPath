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
import type * as NavigationGuard from '~/components/campaign-shell/navigation-guard';
import { beforeEach, expect, test, vi } from 'vitest';
import type { MigrationMaintenance } from '~/components/use-initial-migration-maintenance';
import { CharacterSheetBlocks } from './character-sheet-blocks-test-fixture';
import {
  buildSheet,
  emptyOwnerCandidates,
  representativeWeapon,
  type CatalogSheetEntry,
} from './character-sheet-test-fixture';
import { defaultAbilityScores } from '~/lib/character-sheet';
import type { CharacterSheetSnapshot } from './use-character-sheet';
import { characterSheetNames } from './character-sheet-api-test-fixture';
import type { FunctionReference } from 'convex/server';

// Sheet entries (#298): Spell Effects, conditions, items and recorded Spells
// entered from cards with their classification, edited, switched off and
// removed on the living sheet.

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
// The tablet layout unless a test narrows to the phone.
const breakpoint = vi.hoisted(() => ({ wide: true }));
vi.mock('~/components/use-breakpoint', () => ({
  useBreakpoint: () => breakpoint.wide,
}));

const page = () => (
  <CharacterSheetBlocks blocks={['scores', 'entries', 'defenses', 'offense']} />
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
const region = () => screen.getByRole('region', { name: 'Sheet entries' });
const row = (name: string) => within(region()).getByRole('listitem', { name });
const editor = (kind: 'New' | 'Edit') =>
  within(region()).getByRole('form', { name: `${kind} entry` });
const button = (name: string | RegExp) =>
  within(region()).getByRole('button', { name });
const radio = (name: string) => within(region()).getByRole('radio', { name });
const field = (name: string) => within(region()).getByRole('textbox', { name });
const queryField = (name: string) => screen.queryByRole('textbox', { name });
const check = (name: string) =>
  within(region()).getByRole('checkbox', { name });
const picker = (name: string) =>
  within(region()).getByRole('combobox', { name });
const strength = (total: number) =>
  within(screen.getByRole('region', { name: 'Ability scores' })).getByRole(
    'button',
    { name: `Strength ${total}, breakdown` },
  );
function lastCall() {
  const call = calls.at(-1);
  if (!call) throw new Error('Expected a write');
  return call;
}
const operationOf = (call: Call) => String(call.args.operationId);

const shield: CatalogSheetEntry = {
  id: 'entry-1',
  name: 'Shield',
  detail: {
    kind: 'spellEffect',
    lastsOverOneDay: false,
    defaultCasterLevel: 6,
  },
  modifiers: [{ target: 'ac.other', bonusType: 'deflection', value: 4 }],
};
const bullStrength: CatalogSheetEntry = {
  id: 'entry-2',
  name: "Bull's strength",
  detail: {
    kind: 'spellEffect',
    lastsOverOneDay: false,
    defaultCasterLevel: 5,
  },
  modifiers: [{ target: 'ability.str', bonusType: 'enhancement', value: 4 }],
};

beforeEach(() => {
  calls = [];
  maintenance.mockReturnValue({ kind: 'ready', readOnly: false, message: '' });
  snapshot = undefined;
  breakpoint.wide = true;
});

// The Shield draft: its name and its one Modifier, typed into the open editor.
function fillShield() {
  fireEvent.change(field('Name'), { target: { value: 'Shield' } });
  fireEvent.change(picker('Modifier 1 statistic'), {
    target: { value: 'ac.other' },
  });
  fireEvent.change(picker('Modifier 1 bonus type'), {
    target: { value: 'deflection' },
  });
  fireEvent.change(field('Modifier 1 value'), { target: { value: '4' } });
}

// Shield already on the sheet with its editor open.
function openShieldEditor(entry: CatalogSheetEntry = shield) {
  const view = renderSheet(buildSheet({ sheetEntries: [entry] }));
  fireEvent.click(button('Edit Shield'));
  expect(editor('Edit')).toBeVisible();
  return view;
}

test('a new entry starts as a Condition; choosing Spell Effect from the cards shows its duration and caster levels with the default prefilled, and each caster level has its own whole-number message', async () => {
  renderSheet(buildSheet());
  expect(within(region()).getByText('No entries.')).toBeVisible();
  fireEvent.click(button('Add entry'));
  expect(editor('New')).toBeVisible();
  expect(radio('Condition')).toBeChecked();
  expect(queryField('Caster level')).not.toBeInTheDocument();
  expect(within(editor('New')).queryByRole('checkbox')).not.toBeInTheDocument();

  fireEvent.click(radio('Spell Effect'));
  expect(radio('Spell Effect')).toHaveAccessibleDescription(
    /Temporary unless it lasts more than one day/,
  );
  expect(check('Lasts more than one day')).not.toBeChecked();
  expect(field('Default caster level')).toHaveValue('1');
  expect(field('Caster level')).toHaveValue('');
  fireEvent.change(field('Default caster level'), { target: { value: '' } });
  fillShield();
  fireEvent.click(button('Save entry'));
  expect(
    await screen.findByText('Default caster level is required'),
  ).toHaveAttribute('role', 'alert');
  fireEvent.change(field('Default caster level'), { target: { value: 'six' } });
  fireEvent.change(field('Caster level'), { target: { value: '1.5' } });
  fireEvent.click(button('Save entry'));
  expect(
    await screen.findByText(
      'Default caster level must be a whole number of 0 or more',
    ),
  ).toBeVisible();
  expect(
    screen.getByText('Caster level must be a whole number of 0 or more'),
  ).toBeVisible();
  expect(calls).toEqual([]);
});

test('a blank caster level saves as the default, the editor closes after a clean save and the row reads its classification', async () => {
  const view = renderSheet(buildSheet());
  fireEvent.click(button('Add entry'));
  fireEvent.click(radio('Spell Effect'));
  fillShield();
  fireEvent.change(field('Default caster level'), { target: { value: '6' } });
  expect(field('Caster level')).toHaveAttribute('placeholder', '6');
  fireEvent.change(field('Caster level'), { target: { value: '' } });
  fireEvent.click(button('Save entry'));
  await waitFor(() => expect(calls).toHaveLength(1));
  expect(lastCall().name).toBe('createSheetEntry');
  expect(lastCall().args).toMatchObject({
    name: 'Shield',
    detail: {
      kind: 'spellEffect',
      lastsOverOneDay: false,
      defaultCasterLevel: 6,
    },
    casterLevel: 6,
    modifiers: shield.modifiers,
  });
  expect(button('Saving…')).toBeDisabled();
  await act(async () => {
    lastCall().resolve('entry-1');
  });
  view.show(
    buildSheet({
      sheetEntries: [shield],
      lastOperationId: operationOf(lastCall()),
    }),
  );
  await waitFor(() =>
    expect(screen.queryByRole('form', { name: 'New entry' })).toBeNull(),
  );
  expect(within(row('Shield')).getByText('Spell Effect · CL 6')).toBeVisible();
  expect(within(row('Shield')).getByText('Temporary')).toBeVisible();
  expect(row('Shield')).toHaveTextContent('+4 deflection to Other AC');
});

test('an existing Spell Effect keeps its kind fixed while its caster level is overridden', async () => {
  const view = openShieldEditor();
  expect(radio('Spell Effect')).toBeChecked();
  for (const kind of ['Spell Effect', 'Condition', 'Item', 'Spell'])
    expect(radio(kind)).toBeDisabled();
  expect(field('Caster level')).toHaveValue('6');
  fireEvent.change(field('Caster level'), { target: { value: '12' } });
  fireEvent.click(button('Save entry'));
  await waitFor(() => expect(calls).toHaveLength(1));
  expect(lastCall().name).toBe('editSheetEntry');
  expect(lastCall().args).toMatchObject({
    entryId: 'entry-1',
    casterLevel: 12,
    detail: shield.detail,
  });
  await act(async () => {
    lastCall().resolve(null);
  });
  view.show(
    buildSheet({
      sheetEntries: [{ ...shield, casterLevel: 12 }],
      lastOperationId: operationOf(lastCall()),
    }),
  );
  expect(within(row('Shield')).getByText('Spell Effect · CL 12')).toBeVisible();
  expect(within(editor('Edit')).getByText('Saved.')).toHaveAttribute(
    'role',
    'status',
  );
});

test('blanking an overridden caster level restores the default, and a Spell Effect lasting more than one day is no longer Temporary', async () => {
  const view = openShieldEditor({ ...shield, casterLevel: 12 });
  expect(field('Caster level')).toHaveValue('12');
  fireEvent.change(field('Caster level'), { target: { value: '' } });
  fireEvent.click(check('Lasts more than one day'));
  fireEvent.click(button('Save entry'));
  await waitFor(() => expect(calls).toHaveLength(1));
  expect(lastCall().args).toMatchObject({
    casterLevel: 6,
    detail: {
      kind: 'spellEffect',
      lastsOverOneDay: true,
      defaultCasterLevel: 6,
    },
  });
  await act(async () => {
    lastCall().resolve(null);
  });
  const lasting: CatalogSheetEntry = {
    ...shield,
    detail: {
      kind: 'spellEffect',
      lastsOverOneDay: true,
      defaultCasterLevel: 6,
    },
  };
  view.show(
    buildSheet({
      sheetEntries: [lasting],
      lastOperationId: operationOf(lastCall()),
    }),
  );
  expect(
    within(row('Shield')).queryByText('Temporary'),
  ).not.toBeInTheDocument();
  expect(field('Caster level')).toHaveValue('6');
});

/** Saves the new entry, settles its write as `entryId` and shows `next`. */
async function settleNewEntry(
  view: ReturnType<typeof renderSheet>,
  entryId: string,
  next: CatalogSheetEntry[],
) {
  await act(async () => {
    lastCall().resolve(entryId);
  });
  view.show(
    buildSheet({
      sheetEntries: next,
      lastOperationId: operationOf(lastCall()),
    }),
  );
  await waitFor(() =>
    expect(screen.queryByRole('form', { name: 'New entry' })).toBeNull(),
  );
}

test('an Item is consumable or lasting and has no caster level; every field has a name', async () => {
  const view = renderSheet(buildSheet());
  fireEvent.click(button('Add entry'));
  fireEvent.click(radio('Item'));
  expect(check('Consumable')).not.toBeChecked();
  expect(queryField('Caster level')).not.toBeInTheDocument();
  expect(queryField('Default caster level')).not.toBeInTheDocument();
  fireEvent.click(check('Consumable'));
  fireEvent.change(field('Name'), { target: { value: 'Potion of heroism' } });
  fireEvent.change(picker('Modifier 1 statistic'), {
    target: { value: 'saves' },
  });
  fireEvent.change(picker('Modifier 1 bonus type'), {
    target: { value: 'morale' },
  });
  fireEvent.change(field('Modifier 1 value'), { target: { value: '2' } });
  for (const textbox of within(editor('New')).getAllByRole('textbox'))
    expect(textbox).toHaveAccessibleName();
  fireEvent.click(button('Save entry'));
  await waitFor(() => expect(calls).toHaveLength(1));
  expect(lastCall().args).toMatchObject({
    name: 'Potion of heroism',
    detail: { kind: 'item', consumable: true },
  });
  expect(lastCall().args).not.toHaveProperty('casterLevel');
  const potion: CatalogSheetEntry = {
    id: 'entry-3',
    name: 'Potion of heroism',
    detail: { kind: 'item', consumable: true },
    modifiers: [{ target: 'saves', bonusType: 'morale', value: 2 }],
  };
  await settleNewEntry(view, 'entry-3', [potion]);
  expect(
    within(row('Potion of heroism')).getByText('Consumable item'),
  ).toBeVisible();
  expect(within(row('Potion of heroism')).getByText('Temporary')).toBeVisible();
});

test('a new entry starts as a Condition, which needs nothing more and is Temporary', async () => {
  const view = renderSheet(buildSheet());
  fireEvent.click(button('Add entry'));
  expect(radio('Condition')).toBeChecked();
  expect(within(editor('New')).queryByRole('checkbox')).not.toBeInTheDocument();
  fireEvent.change(field('Name'), { target: { value: 'Shaken' } });
  fireEvent.change(picker('Modifier 1 statistic'), {
    target: { value: 'saves' },
  });
  fireEvent.change(field('Modifier 1 value'), { target: { value: '-2' } });
  fireEvent.click(button('Save entry'));
  await waitFor(() => expect(calls).toHaveLength(1));
  expect(lastCall().args).toMatchObject({
    name: 'Shaken',
    detail: { kind: 'condition' },
  });
  const shaken: CatalogSheetEntry = {
    id: 'entry-4',
    name: 'Shaken',
    detail: { kind: 'condition' },
    modifiers: [{ target: 'saves', bonusType: 'untyped', value: -2 }],
  };
  await settleNewEntry(view, 'entry-4', [shaken]);
  expect(within(row('Shaken')).getByText('Condition')).toBeVisible();
  expect(within(row('Shaken')).getByText('Temporary')).toBeVisible();
});

test('a recorded Spell grants no Modifiers and is not Temporary', async () => {
  const view = renderSheet(buildSheet());
  fireEvent.click(button('Add entry'));
  fireEvent.click(radio('Spell'));
  expect(radio('Spell')).toHaveAccessibleDescription(/Grants no Modifiers/);
  expect(screen.queryByRole('list', { name: 'Modifiers' })).toBeNull();
  expect(
    within(editor('New')).getByText('A recorded Spell grants no Modifiers.'),
  ).toBeVisible();
  fireEvent.change(field('Name'), { target: { value: 'Magic missile' } });
  fireEvent.click(button('Save entry'));
  await waitFor(() => expect(calls).toHaveLength(1));
  expect(lastCall().args).toMatchObject({
    name: 'Magic missile',
    detail: { kind: 'spell' },
    modifiers: [],
  });
  const missile: CatalogSheetEntry = {
    id: 'entry-5',
    name: 'Magic missile',
    detail: { kind: 'spell' },
    modifiers: [],
  };
  await settleNewEntry(view, 'entry-5', [missile]);
  expect(within(row('Magic missile')).getByText('Spell')).toBeVisible();
  expect(row('Magic missile')).toHaveTextContent('Grants no Modifiers.');
  expect(
    within(row('Magic missile')).queryByText('Temporary'),
  ).not.toBeInTheDocument();
});

test('an entry switched off keeps its definition and its Modifiers stop counting; it leaves with the subscription when removed', async () => {
  const view = renderSheet(buildSheet({ sheetEntries: [bullStrength] }));
  expect(strength(14)).toBeVisible();
  fireEvent.click(button("Edit Bull's strength"));
  const toggle = screen.getByRole('switch', {
    name: "Bull's strength: active",
  });
  fireEvent.click(toggle);
  await waitFor(() => expect(calls).toHaveLength(1));
  expect(lastCall().name).toBe('editSheetEntry');
  expect(lastCall().args).toMatchObject({ entryId: 'entry-2', active: false });
  expect(lastCall().args).not.toHaveProperty('name');
  expect(toggle).toBeDisabled();
  await act(async () => {
    lastCall().resolve(null);
  });
  view.show(
    buildSheet({
      sheetEntries: [{ ...bullStrength, active: false }],
      lastOperationId: operationOf(lastCall()),
    }),
  );
  expect(
    screen.getByRole('switch', { name: "Bull's strength: inactive" }),
  ).toHaveAttribute('aria-checked', 'false');
  expect(within(row("Bull's strength")).getByText('Inactive')).toBeVisible();
  expect(strength(10)).toBeVisible();
  expect(field('Modifier 1 value')).toHaveValue('4');
  expect(field('Modifier 1 value')).toBeEnabled();
  expect(within(region()).getByText('Sheet entries saved.')).toBeVisible();

  fireEvent.click(button("Remove Bull's strength"));
  await waitFor(() => expect(calls).toHaveLength(2));
  expect(lastCall().name).toBe('removeSheetEntry');
  await act(async () => {
    lastCall().resolve(null);
  });
  expect(row("Bull's strength")).toBeVisible();
  view.show(
    buildSheet({ sheetEntries: [], lastOperationId: operationOf(lastCall()) }),
  );
  expect(within(region()).getByText('No entries.')).toBeVisible();
  expect(
    within(region()).getByText('This entry is no longer on the sheet.'),
  ).toBeVisible();
});

test("a refused save keeps the classification and Modifier drafts; another player's classification change is announced while an own echo is quiet", async () => {
  const view = renderSheet(buildSheet({ sheetEntries: [shield] }));
  fireEvent.click(button('Edit Shield'));
  fireEvent.change(field('Caster level'), { target: { value: '9' } });
  fireEvent.change(field('Modifier 1 value'), { target: { value: '5' } });
  fireEvent.click(button('Save entry'));
  await waitFor(() => expect(calls).toHaveLength(1));
  await act(async () => {
    lastCall().reject(new ConvexError('Not now'));
  });
  expect(within(editor('Edit')).getByRole('alert')).toHaveTextContent(
    "Changes weren't saved: Not now. Your edits are kept. Save to try again.",
  );
  expect(field('Caster level')).toHaveValue('9');
  expect(field('Modifier 1 value')).toHaveValue('5');
  expect(within(editor('Edit')).queryByText('Saved.')).not.toBeInTheDocument();

  view.show(
    buildSheet({
      sheetEntries: [{ ...shield, casterLevel: 7 }],
      lastOperationId: 'other-player',
    }),
  );
  expect(within(row('Shield')).getByText('Spell Effect · CL 7')).toBeVisible();
  expect(field('Caster level')).toHaveValue('9');
  expect(field('Modifier 1 value')).toHaveValue('5');
  expect(within(region()).getByText('Sheet entries changed.')).toBeVisible();
  expect(
    within(editor('Edit')).getByText(
      'This entry changed while you were editing. Your edits are kept.',
    ),
  ).toBeVisible();
  fireEvent.click(button('Dismiss entries update'));
  fireEvent.click(button('Dismiss entry update'));
  expect(
    within(region()).queryByText(/changed|another player/),
  ).not.toBeInTheDocument();

  fireEvent.click(button('Save entry'));
  await waitFor(() => expect(calls).toHaveLength(2));
  expect(lastCall().args).toMatchObject({
    entryId: 'entry-1',
    casterLevel: 9,
    modifiers: [{ target: 'ac.other', bonusType: 'deflection', value: 5 }],
  });
  await act(async () => {
    lastCall().resolve(null);
  });
  view.show(
    buildSheet({
      sheetEntries: [
        {
          ...shield,
          casterLevel: 9,
          modifiers: [
            { target: 'ac.other', bonusType: 'deflection', value: 5 },
          ],
        },
      ],
      lastOperationId: operationOf(lastCall()),
    }),
  );
  expect(
    within(region()).queryByText(/changed|another player/),
  ).not.toBeInTheDocument();
  expect(within(editor('Edit')).getByText('Saved.')).toHaveAttribute(
    'role',
    'status',
  );
});

test('maintenance disables adding, switching, removing and every editor field, with the reason beside them', () => {
  const message = 'Editing is paused for maintenance.';
  maintenance.mockReturnValue({ kind: 'maintenance', readOnly: true, message });
  renderSheet(buildSheet({ sheetEntries: [shield] }));
  expect(button('Add entry')).toBeDisabled();
  expect(screen.getByRole('switch', { name: 'Shield: active' })).toBeDisabled();
  expect(button('Remove Shield')).toBeDisabled();
  expect(within(region()).getAllByText(message).length).toBeGreaterThan(0);
  fireEvent.click(button('Edit Shield'));
  expect(field('Name')).toBeDisabled();
  expect(field('Caster level')).toBeDisabled();
  expect(check('Lasts more than one day')).toBeDisabled();
  expect(field('Modifier 1 value')).toBeDisabled();
  expect(button('Modifier 1 as formula')).toBeDisabled();
  expect(button('Save entry')).toBeDisabled();
  fireEvent.submit(editor('Edit'));
  expect(calls).toEqual([]);
});

// CRB conditions (#311): chosen by name, their rules and uncalculated
// quantities read on the row, their numbers in the current totals only.

const crbCondition = (
  id: string,
  name: string,
  conditionKey: NonNullable<
    Extract<CatalogSheetEntry['detail'], { kind: 'condition' }>['conditionKey']
  >,
  modifiers: CatalogSheetEntry['modifiers'],
): CatalogSheetEntry => ({
  id,
  name,
  detail: { kind: 'condition', conditionKey },
  modifiers,
});
const blinded = crbCondition('entry-6', 'Blinded', 'blinded', [
  { target: 'ac', bonusType: 'untyped', value: -2 },
  {
    target: 'skill.per',
    bonusType: 'untyped',
    value: -4,
    condition: { situation: 'opposed-perception' },
  },
]);
const fatigued = crbCondition('entry-7', 'Fatigued', 'fatigued', [
  { target: 'ability.str', bonusType: 'untyped', value: -2 },
  { target: 'ability.dex', bonusType: 'untyped', value: -2 },
]);
const exhausted = crbCondition('entry-8', 'Exhausted', 'exhausted', [
  { target: 'ability.str', bonusType: 'untyped', value: -6 },
  { target: 'ability.dex', bonusType: 'untyped', value: -6 },
]);
const grappled = crbCondition('entry-9', 'Grappled', 'grappled', [
  { target: 'ability.dex', bonusType: 'untyped', value: -4 },
  { target: 'attack', bonusType: 'untyped', value: -2 },
]);
const pinned = crbCondition('entry-10', 'Pinned', 'pinned', [
  { target: 'ac', bonusType: 'untyped', value: -4 },
]);
const shakenModifiers: CatalogSheetEntry['modifiers'] = [
  { target: 'attack', bonusType: 'untyped', value: -2 },
  { target: 'saves', bonusType: 'untyped', value: -2 },
  { target: 'skills', bonusType: 'untyped', value: -2 },
];
const prone = crbCondition('entry-11', 'Prone', 'prone', [
  { target: 'attack.melee', bonusType: 'untyped', value: -4 },
  {
    target: 'ac',
    bonusType: 'untyped',
    value: 4,
    condition: { situation: 'ranged-attack' },
  },
  {
    target: 'ac',
    bonusType: 'untyped',
    value: -4,
    condition: { situation: 'melee-attack' },
  },
]);
const invisible = crbCondition('entry-12', 'Invisible', 'invisible', [
  {
    target: 'attack',
    bonusType: 'untyped',
    value: 2,
    condition: { situation: 'sighted-opponent' },
  },
]);
const energyDrained = crbCondition(
  'entry-13',
  'Energy Drained',
  'energy-drained',
  [],
);
const dazed = crbCondition('entry-14', 'Dazed', 'dazed', []);

const armorClass = (total: number) =>
  within(screen.getByRole('region', { name: 'Defenses' })).getByRole('button', {
    name: `Armor Class ${total}, breakdown`,
  });
const conditionCards = () =>
  screen.getByRole('radiogroup', { name: 'CRB condition' });

test('a saved Blinded condition reads its rules on the row and denies the Dexterity bonus to AC but not to Reflex; switched off it keeps its CRB selection and the totals recover', async () => {
  const dexterous = { ...defaultAbilityScores, dexterity: 14 };
  const view = renderSheet(
    buildSheet({ scores: dexterous, sheetEntries: [blinded] }),
  );
  expect(row('Blinded')).toHaveTextContent(
    '-2 to All AC · -4 to Perception (on opposed Perception checks)',
  );
  expect(within(row('Blinded')).getByText('Rules')).toBeVisible();
  expect(row('Blinded')).toHaveTextContent(/The creature cannot see/);
  // Its structured Situational Note is the rules text, shown once.
  expect(
    within(row('Blinded')).getAllByText(/The creature cannot see/),
  ).toHaveLength(1);
  expect(row('Blinded')).not.toHaveTextContent('only when Blinded');
  expect(within(row('Blinded')).getByText('Not calculated')).toBeVisible();
  expect(row('Blinded')).toHaveTextContent(
    /Total concealment \(50% miss chance\)/,
  );
  expect(armorClass(8)).toBeVisible();
  expect(
    screen.getByRole('button', { name: 'Reflex save +2, breakdown' }),
  ).toBeVisible();
  expect(
    screen.getByRole('button', { name: 'Initiative +2, breakdown' }),
  ).toBeVisible();
  fireEvent.click(armorClass(8));
  const breakdown = screen.getByRole('group', {
    name: 'Armor Class breakdown',
  });
  expect(within(breakdown).getByText('Not applied')).toBeVisible();
  expect(breakdown).toHaveTextContent(
    /Dexterity bonus and dodge bonuses are denied by this condition\. \(Blinded\)/,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Close breakdown' }));

  fireEvent.click(screen.getByRole('switch', { name: 'Blinded: active' }));
  await waitFor(() => expect(calls).toHaveLength(1));
  expect(lastCall().args).toEqual(
    expect.objectContaining({ entryId: 'entry-6', active: false }),
  );
  expect(lastCall().args).not.toHaveProperty('detail');
  await act(async () => {
    lastCall().resolve(null);
  });
  view.show(
    buildSheet({
      scores: dexterous,
      sheetEntries: [{ ...blinded, active: false }],
      lastOperationId: operationOf(lastCall()),
    }),
  );
  expect(within(row('Blinded')).getByText('Inactive')).toBeVisible();
  expect(within(row('Blinded')).queryByText('Rules')).not.toBeInTheDocument();
  expect(armorClass(12)).toBeVisible();
  fireEvent.click(button('Edit Blinded'));
  expect(
    within(conditionCards()).getByRole('radio', { name: 'Blinded' }),
  ).toBeChecked();
  expect(editor('Edit')).toHaveTextContent(/The creature cannot see/);
});

test('current ability totals carry a condition while the permanent values exclude it; Prone and Invisible stay conditional; rules-only conditions report what is not calculated', () => {
  renderSheet(
    buildSheet({
      sheetEntries: [fatigued, prone, invisible, energyDrained, dazed],
    }),
  );
  expect(strength(8)).toBeVisible();
  const permanentRows = screen
    .getAllByText('Permanent')
    .map((label) => label.parentElement?.textContent);
  expect(permanentRows).toEqual([
    expect.stringMatching(/^Strength Permanent\s*10\s*\+0$/),
    expect.stringMatching(/^Dexterity Permanent\s*10\s*\+0$/),
  ]);
  expect(
    screen.getByText(
      'Permanent values exclude short-duration spells, conditions, consumables and ability damage.',
    ),
  ).toBeVisible();

  // Fatigued's Dexterity penalty leaves AC 9; Prone changes it only in a
  // Situation, so the ordinary total stays and the breakdown previews both.
  expect(armorClass(9)).toBeVisible();
  fireEvent.click(armorClass(9));
  const breakdown = screen.getByRole('group', {
    name: 'Armor Class breakdown',
  });
  expect(within(breakdown).getByText('Only when…')).toBeVisible();
  expect(breakdown).toHaveTextContent(/vs\. ranged attacks.*becomes.*13/);
  expect(breakdown).toHaveTextContent(/vs\. melee attacks.*becomes.*5/);
  fireEvent.click(screen.getByRole('button', { name: 'Close breakdown' }));
  expect(row('Invisible')).toHaveTextContent(
    '+2 to All attacks (vs. opponents that cannot see you)',
  );
  expect(row('Invisible')).toHaveTextContent(/Not calculated/);

  expect(row('Energy Drained')).toHaveTextContent(
    'No numeric Modifiers. Its rules say what it does.',
  );
  expect(row('Energy Drained')).toHaveTextContent(
    /Not calculated.*Negative-level count is not recorded/,
  );
  expect(row('Dazed')).toHaveTextContent(/can take no actions/);
  expect(
    within(row('Dazed')).queryByText('Not calculated'),
  ).not.toBeInTheDocument();
  expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
});

test('Exhausted replaces Fatigued and Pinned replaces Grappled without doubling penalties; switching the winner off restores the survivor, and every row stays editable', async () => {
  const view = renderSheet(
    buildSheet({ sheetEntries: [fatigued, exhausted, grappled, pinned] }),
  );
  expect(row('Fatigued')).toHaveTextContent(
    'Replaced by Exhausted. Its Modifiers do not apply.',
  );
  expect(within(row('Fatigued')).queryByText('Rules')).not.toBeInTheDocument();
  expect(row('Grappled')).toHaveTextContent(
    'Replaced by Pinned. Its Modifiers do not apply.',
  );
  expect(row('Exhausted')).toHaveTextContent(/Moves at half speed/);
  expect(strength(4)).toBeVisible();
  expect(
    screen.getByRole('button', { name: 'Dexterity 4, breakdown' }),
  ).toBeVisible();
  expect(armorClass(3)).toBeVisible();
  for (const name of ['Fatigued', 'Exhausted', 'Grappled', 'Pinned'])
    expect(button(`Edit ${name}`)).toBeEnabled();

  fireEvent.click(screen.getByRole('switch', { name: 'Exhausted: active' }));
  await waitFor(() => expect(calls).toHaveLength(1));
  await act(async () => {
    lastCall().resolve(null);
  });
  view.show(
    buildSheet({
      sheetEntries: [
        fatigued,
        { ...exhausted, active: false },
        grappled,
        pinned,
      ],
      lastOperationId: operationOf(lastCall()),
    }),
  );
  expect(row('Fatigued')).not.toHaveTextContent('Replaced by');
  expect(row('Fatigued')).toHaveTextContent(/Can neither run nor charge/);
  expect(within(row('Exhausted')).getByText('Inactive')).toBeVisible();
  expect(strength(8)).toBeVisible();
});

test('two Shaken selections count as Frightened once: the row keeps its name, reads what it counts as, and the saves take one penalty', () => {
  renderSheet(
    buildSheet({
      sheetEntries: [
        crbCondition('entry-15', 'Shaken', 'shaken', shakenModifiers),
        crbCondition('entry-16', 'Shaken', 'shaken', shakenModifiers),
      ],
    }),
  );
  const [first, second] = within(region()).getAllByRole('listitem', {
    name: 'Shaken',
  });
  expect(first).toHaveTextContent('Counts as Frightened.');
  expect(first).toHaveTextContent(/Flees from the source of its fear/);
  expect(second).toHaveTextContent(
    'Replaced by Frightened. Its Modifiers do not apply.',
  );
  expect(
    screen.getByRole('button', { name: 'Will save -2, breakdown' }),
  ).toBeVisible();
  expect(screen.queryByText('Frightened', { selector: 'h3' })).toBeNull();
});

test("customizing a saved condition keeps the draft through another player's change to the same entry, and an own save echo is quiet", async () => {
  const view = renderSheet(buildSheet({ sheetEntries: [blinded] }));
  fireEvent.click(button('Edit Blinded'));
  fireEvent.click(button('Customize condition'));
  fireEvent.change(field('Name'), { target: { value: 'Blind (adapted)' } });
  expect(field('Modifier 1 value')).toHaveValue('-2');

  const theirs: CatalogSheetEntry = {
    ...blinded,
    name: 'Blinded (house rule)',
    detail: { kind: 'condition' },
  };
  view.show(buildSheet({ sheetEntries: [theirs], lastOperationId: 'theirs' }));
  expect(within(region()).getByText('Sheet entries changed.')).toBeVisible();
  expect(
    within(editor('Edit')).getByText(
      'This entry changed while you were editing. Your edits are kept.',
    ),
  ).toBeVisible();
  expect(field('Name')).toHaveValue('Blind (adapted)');
  expect(
    within(conditionCards()).getByRole('radio', { name: 'Custom condition' }),
  ).toBeChecked();
  expect(screen.queryByText('Rules · CRB')).not.toBeInTheDocument();

  fireEvent.click(button('Save entry'));
  await waitFor(() => expect(calls).toHaveLength(1));
  expect(lastCall().name).toBe('editSheetEntry');
  expect(lastCall().args).toMatchObject({
    entryId: 'entry-6',
    name: 'Blind (adapted)',
    detail: { kind: 'condition' },
    modifiers: blinded.modifiers,
  });
  await act(async () => {
    lastCall().resolve(null);
  });
  view.show(
    buildSheet({
      sheetEntries: [{ ...theirs, name: 'Blind (adapted)' }],
      lastOperationId: operationOf(lastCall()),
    }),
  );
  fireEvent.click(button('Dismiss entries update'));
  fireEvent.click(button('Dismiss entry update'));
  expect(
    within(region()).queryByText(/changed|another player/),
  ).not.toBeInTheDocument();
  expect(within(editor('Edit')).getByText('Saved.')).toHaveAttribute(
    'role',
    'status',
  );
  expect(row('Blind (adapted)')).toHaveTextContent('-2 to All AC');
  expect(
    within(row('Blind (adapted)')).queryByText('Rules'),
  ).not.toBeInTheDocument();
});

// Spell Effects on items (#416): the caster level's default and reset, the
// Target field for magic weapon and its kin, and the duration words.

// CRB p. 307: magic weapon, cast at the lowest legal caster level, cleric 1.
const magicWeaponSpell: CatalogSheetEntry = {
  id: 'magic-weapon-spell',
  name: 'Magic Weapon',
  detail: { kind: 'spell', levels: { cleric: 1, sorcerer: 1, wizard: 1 } },
  modifiers: [],
};
const magicWeapon = (
  overrides: Partial<CatalogSheetEntry> = {},
): CatalogSheetEntry => ({
  id: 'entry-20',
  name: 'Magic weapon',
  detail: {
    kind: 'spellEffect',
    lastsOverOneDay: false,
    defaultCasterLevel: 1,
    spellKey: 'entry:magic-weapon-spell',
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
  ...overrides,
});
// CRB p. 306: magic fang enhances one natural weapon or the unarmed strike.
const magicFang: CatalogSheetEntry = {
  id: 'entry-21',
  name: 'Magic fang',
  detail: {
    kind: 'spellEffect',
    lastsOverOneDay: true,
    defaultCasterLevel: 1,
    itemTarget: 'natural',
  },
  modifiers: [
    {
      target: 'attack',
      bonusType: 'enhancement',
      value: 1,
      condition: { weapon: '$target' },
    },
  ],
};
const sword = representativeWeapon('longsword', 'sword');
const targetField = (name: string) =>
  within(row(name)).getByRole('combobox', { name: 'Target' });
const optionLabels = (select: HTMLElement) =>
  within(select)
    .getAllByRole('option')
    .map((option) => option.textContent);
const effectSheet = (
  effects: CatalogSheetEntry[],
  input: Parameters<typeof buildSheet>[0] = {},
) =>
  buildSheet({
    sheetEntries: [sword, ...effects],
    catalogOnly: [magicWeaponSpell],
    ...input,
  });

test('a Spell Effect row explains its pre-filled caster level and duration, and without a target wears the blue outline with no attack change', () => {
  renderSheet(effectSheet([magicWeapon()]));
  const effect = row('Magic weapon');
  expect(within(effect).getByText('Spell Effect · CL 1')).toBeVisible();
  expect(effect).toHaveTextContent(
    'Pre-filled 1: Cleric 1 casts 1st-level spells · Lasts one day or less',
  );
  expect(within(effect).getByText('Lasts one day or less')).toHaveAttribute(
    'title',
    'Counts in current totals only; militia facts, skill budgets and bonus spells leave it out',
  );
  expect(within(effect).getByText('Temporary')).toBeVisible();
  expect(
    within(effect).queryByRole('button', { name: /Reset to/ }),
  ).not.toBeInTheDocument();
  const target = targetField('Magic weapon');
  expect(target).toHaveValue('none');
  expect(target).toHaveClass('ring-sky-400/80');
  expect(target).toHaveAccessibleDescription(
    'Choose the weapon it enhances; until then it adds nothing.',
  );
  expect(within(effect).getByText(/Choose the weapon/)).toHaveClass(
    'text-sky-300',
  );
  // Suitable parts first, then the unarmed strike; a missing target is a
  // choice, never an amber warning.
  expect(optionLabels(target)).toEqual([
    '',
    'No target',
    'Longsword',
    'Unarmed strike',
  ]);
  expect(
    within(effect).queryByRole('button', { name: /Accept/ }),
  ).not.toBeInTheDocument();
});

test('choosing a target saves only the target; the field then names it and the outline goes', async () => {
  const view = renderSheet(effectSheet([magicWeapon()]));
  fireEvent.change(targetField('Magic weapon'), {
    target: { value: 'sword|' },
  });
  await waitFor(() => expect(calls).toHaveLength(1));
  expect(lastCall().name).toBe('editSheetEntry');
  expect(lastCall().args).toMatchObject({
    entryId: 'entry-20',
    onItem: { entry: 'sword' },
  });
  expect(lastCall().args).not.toHaveProperty('casterLevel');
  expect(lastCall().args).not.toHaveProperty('active');
  await act(async () => {
    lastCall().resolve(null);
  });
  view.show(
    effectSheet([magicWeapon({ onItem: { entry: 'sword' } })], {
      lastOperationId: operationOf(lastCall()),
    }),
  );
  const target = targetField('Magic weapon');
  expect(target).toHaveValue('sword|');
  expect(target).not.toHaveClass('ring-sky-400/80');
  expect(
    within(row('Magic weapon')).queryByText(/Choose the weapon/),
  ).not.toBeInTheDocument();
  expect(within(region()).getByText('Sheet entries saved.')).toBeVisible();

  // The unarmed strike is a target like any other; No target clears.
  fireEvent.change(target, { target: { value: 'unarmed|' } });
  await waitFor(() => expect(calls).toHaveLength(2));
  expect(lastCall().args).toMatchObject({ onItem: { entry: 'unarmed' } });
  await act(async () => {
    lastCall().resolve(null);
  });
  fireEvent.change(targetField('Magic weapon'), {
    target: { value: 'none' },
  });
  await waitFor(() => expect(calls).toHaveLength(3));
  expect(lastCall().args).toMatchObject({ onItem: null });
});

test('a recorded caster level above the default offers Reset, which restores the default server-side', async () => {
  renderSheet(effectSheet([magicWeapon({ casterLevel: 5 })]));
  const effect = row('Magic weapon');
  expect(within(effect).getByText('Spell Effect · CL 5')).toBeVisible();
  expect(effect).toHaveTextContent('Pre-filled 1: Cleric 1 casts');
  fireEvent.click(within(effect).getByRole('button', { name: /Reset to 1/ }));
  await waitFor(() => expect(calls).toHaveLength(1));
  expect(lastCall().name).toBe('editSheetEntry');
  expect(lastCall().args).toMatchObject({
    entryId: 'entry-20',
    casterLevel: null,
  });
  expect(lastCall().args).not.toHaveProperty('onItem');
  await act(async () => {
    lastCall().resolve(null);
  });
  expect(within(effect).getByText('Caster level reset.')).toHaveAttribute(
    'role',
    'status',
  );
});

test('an unlinked effect reads its defined default, a lasting one says so and is not Temporary, and a shared row keeps Edit caster level', () => {
  renderSheet(buildSheet({ sheetEntries: [shield, magicFang] }));
  expect(row('Shield')).toHaveTextContent(
    'Default CL 6 · Lasts one day or less',
  );
  expect(within(row('Shield')).getByText('Temporary')).toBeVisible();
  // Owned by the Character, the row's Edit covers the caster level.
  expect(
    within(row('Shield')).queryByRole('button', { name: /Edit caster level/ }),
  ).not.toBeInTheDocument();
  expect(row('Magic fang')).toHaveTextContent('Lasts more than one day');
  expect(
    within(row('Magic fang')).queryByText('Temporary'),
  ).not.toBeInTheDocument();
  expect(targetField('Magic fang')).toHaveAccessibleDescription(
    'Choose the natural weapon or unarmed strike it enhances; until then it adds nothing.',
  );
  expect(
    within(row('Shield')).queryByRole('combobox', { name: 'Target' }),
  ).not.toBeInTheDocument();
});

test('a target that left the sheet reads "No longer on the sheet" with an acceptable advisory, and choosing another target clears it', async () => {
  const gone = effectSheet([magicWeapon({ onItem: { entry: 'gone' } })]);
  const view = renderSheet(gone);
  const effect = row('Magic weapon');
  const target = targetField('Magic weapon');
  expect(target).toHaveValue('gone|');
  expect(
    within(target).getByRole('option', { name: 'No longer on the sheet' }),
  ).toBeDisabled();
  expect(target).not.toHaveClass('ring-sky-400/80');
  const message =
    "Magic weapon's target is no longer on the sheet. Choose another target; until then it adds nothing.";
  expect(within(effect).getByText(message)).toBeVisible();
  const accept = within(effect).getByRole('button', {
    name: 'Accept',
    description: message,
  });
  fireEvent.click(accept);
  await waitFor(() => expect(calls).toHaveLength(1));
  expect(lastCall().name).toBe('accept');
  expect(lastCall().args).toMatchObject({
    check: 'spellEffectTargetUnavailable',
    subject: 'entry-20',
  });
  await act(async () => {
    lastCall().resolve(null);
  });
  fireEvent.change(target, { target: { value: 'sword|' } });
  await waitFor(() => expect(calls).toHaveLength(2));
  expect(lastCall().args).toMatchObject({ onItem: { entry: 'sword' } });
  await act(async () => {
    lastCall().resolve(null);
  });
  view.show(
    effectSheet([magicWeapon({ onItem: { entry: 'sword' } })], {
      lastOperationId: operationOf(lastCall()),
    }),
  );
  expect(within(effect).queryByText(message)).not.toBeInTheDocument();
  expect(
    within(effect).queryByRole('button', { name: /Accept|Reopen/ }),
  ).not.toBeInTheDocument();
});

test('an unsuitable target stays chosen with its advisory and the rules-expected parts listed first; a switched-off target reads not equipped with no warning', () => {
  renderSheet(
    buildSheet({
      sheetEntries: [
        { ...sword, active: false },
        { ...magicFang, onItem: { entry: 'sword' } },
        magicWeapon({ onItem: { entry: 'sword' } }),
      ],
      catalogOnly: [magicWeaponSpell],
    }),
  );
  const fang = row('Magic fang');
  expect(
    within(fang).getByText("Magic fang normally can't target Longsword."),
  ).toHaveClass('min-w-0');
  expect(within(fang).getByRole('button', { name: 'Accept' })).toBeEnabled();
  expect(optionLabels(targetField('Magic fang'))).toEqual([
    '',
    'No target',
    'Unarmed strike',
    'Longsword · not equipped',
  ]);
  const weapon = row('Magic weapon');
  expect(targetField('Magic weapon')).toHaveValue('sword|');
  expect(
    within(weapon).queryByRole('button', { name: /Accept/ }),
  ).not.toBeInTheDocument();
  expect(within(weapon).queryByText(/Choose the/)).not.toBeInTheDocument();
});

test('on the phone the Target is a button opening a bottom sheet of touch-sized choices, saving and closing on a choice', async () => {
  breakpoint.wide = false;
  renderSheet(effectSheet([magicWeapon()]));
  const effect = row('Magic weapon');
  const trigger = within(effect).getByRole('button', { name: 'Target' });
  expect(trigger).toHaveTextContent('No target');
  expect(trigger).toHaveClass('ring-sky-400/80', 'h-11');
  expect(trigger).toHaveAccessibleDescription(
    'Choose the weapon it enhances; until then it adds nothing.',
  );
  fireEvent.click(trigger);
  const dialog = screen.getByRole('dialog', {
    name: 'Target for Magic weapon',
  });
  const choices = within(dialog).getByRole('radiogroup', { name: 'Target' });
  expect(
    within(choices)
      .getAllByRole('radio')
      .map((radio) => radio.parentElement?.textContent),
  ).toEqual(['No target', 'Longsword', 'Unarmed strike']);
  expect(
    within(choices).getByRole('radio', { name: 'No target' }),
  ).toBeChecked();
  for (const radio of within(choices).getAllByRole('radio'))
    expect(radio.parentElement).toHaveClass('min-h-11');
  fireEvent.click(within(choices).getByRole('radio', { name: 'Longsword' }));
  await waitFor(() => expect(calls).toHaveLength(1));
  expect(lastCall().args).toMatchObject({
    entryId: 'entry-20',
    onItem: { entry: 'sword' },
  });
  await waitFor(() =>
    expect(
      screen.queryByRole('dialog', { name: 'Target for Magic weapon' }),
    ).not.toBeInTheDocument(),
  );
});

test('maintenance disables the Target and Reset while the row still explains itself', () => {
  const message = 'Editing is paused for maintenance.';
  maintenance.mockReturnValue({ kind: 'maintenance', readOnly: true, message });
  renderSheet(effectSheet([magicWeapon({ casterLevel: 3 })]));
  const effect = row('Magic weapon');
  expect(targetField('Magic weapon')).toBeDisabled();
  expect(targetField('Magic weapon')).not.toHaveClass('ring-sky-400/80');
  expect(
    within(effect).queryByText(/Choose the weapon/),
  ).not.toBeInTheDocument();
  expect(
    within(effect).getByRole('button', { name: /Reset to 1/ }),
  ).toBeDisabled();
  expect(effect).toHaveTextContent(
    'Pre-filled 1: Cleric 1 casts 1st-level spells',
  );
});
