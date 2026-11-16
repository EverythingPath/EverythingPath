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
import { buildSheet, type Adjustment } from './character-sheet-test-fixture';
import type { CharacterSheetSnapshot } from './use-character-sheet';
import { characterSheetNames } from './character-sheet-api-test-fixture';
import type { FunctionReference } from 'convex/server';

// Personal adjustments (#263): added, edited, switched off and on and
// removed on the living sheet, by several players at once.

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
  usePaginatedQuery: () => ({
    results: [],
    status: 'Exhausted',
    loadMore: vi.fn(),
  }),
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

const page = () => <CharacterSheetBlocks blocks={['scores', 'adjustments']} />;
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
const region = () =>
  screen.getByRole('region', { name: 'Personal adjustments' });
const row = (name: string) => within(region()).getByRole('listitem', { name });
const editor = (kind: 'New' | 'Edit') =>
  within(region()).getByRole('form', { name: `${kind} personal adjustment` });
const field = (name: string) => within(region()).getByRole('textbox', { name });
const picker = (name: string) =>
  within(region()).getByRole('combobox', { name });
const button = (name: string | RegExp) =>
  within(region()).getByRole('button', { name });
const strengthTotal = () =>
  within(screen.getByRole('region', { name: 'Ability scores' })).getByRole(
    'button',
    { name: /^Strength \d+, breakdown$/ },
  );
const baseStrength = () =>
  within(screen.getByRole('region', { name: 'Ability scores' })).getByRole(
    'textbox',
    { name: 'Strength' },
  );
function lastCall() {
  const call = calls.at(-1);
  if (!call) throw new Error('Expected a write');
  return call;
}
const operationOf = (call: Call) => String(call.args.operationId);

const bullStrength: Adjustment = {
  id: 'adj-1',
  name: 'Bull strength',
  modifiers: [
    { target: 'ability.str', bonusType: 'enhancement', value: 4 },
    { target: 'save.will', bonusType: 'morale', value: 2 },
  ],
};
// Bull strength after its Strength Modifier is raised to +6.
const strongerBullStrength: Adjustment = {
  ...bullStrength,
  modifiers: [
    { target: 'ability.str', bonusType: 'enhancement', value: 6 },
    bullStrength.modifiers[1]!,
  ],
};

beforeEach(() => {
  calls = [];
  maintenance.mockReturnValue({ kind: 'ready', readOnly: false, message: '' });
  snapshot = undefined;
});

test('an adjustment with two Modifiers is added on the sheet and raises the calculated score but not the base score', async () => {
  const view = renderSheet(buildSheet());
  expect(within(region()).getByText('No personal adjustments.')).toBeVisible();
  fireEvent.click(button('Add personal adjustment'));
  expect(editor('New')).toBeVisible();
  fireEvent.change(field('Name'), { target: { value: ' Bull strength ' } });
  expect(picker('Modifier 1 statistic')).toHaveValue('ability.str');
  expect(
    within(picker('Modifier 1 statistic')).queryByRole('option', {
      name: 'Chosen ability',
    }),
  ).not.toBeInTheDocument();
  expect(
    within(picker('Modifier 1 statistic')).getByRole('option', {
      name: 'All saves',
    }),
  ).toBeInTheDocument();
  fireEvent.change(picker('Modifier 1 bonus type'), {
    target: { value: 'enhancement' },
  });
  fireEvent.change(field('Modifier 1 value'), { target: { value: '4' } });
  fireEvent.click(button('Add modifier'));
  fireEvent.change(picker('Modifier 2 statistic'), {
    target: { value: 'save.will' },
  });
  fireEvent.change(picker('Modifier 2 bonus type'), {
    target: { value: 'morale' },
  });
  fireEvent.change(field('Modifier 2 value'), { target: { value: '2' } });
  fireEvent.click(button('Save adjustment'));
  await waitFor(() => expect(calls).toHaveLength(1));
  expect(lastCall().name).toBe('createAdjustment');
  expect(lastCall().args).toMatchObject({
    name: 'Bull strength',
    modifiers: bullStrength.modifiers,
  });
  expect(button('Saving…')).toBeDisabled();
  await act(async () => {
    lastCall().resolve('adj-1');
  });
  view.show(
    buildSheet({
      adjustments: [bullStrength],
      lastOperationId: operationOf(lastCall()),
    }),
  );
  await waitFor(() =>
    expect(
      screen.queryByRole('form', { name: 'New personal adjustment' }),
    ).not.toBeInTheDocument(),
  );
  expect(within(row('Bull strength')).getByText('Active')).toBeVisible();
  expect(row('Bull strength')).toHaveTextContent('+4 enhancement to Strength');
  expect(row('Bull strength')).toHaveTextContent('+2 morale to Will save');
  expect(strengthTotal()).toHaveTextContent('14');
  expect(baseStrength()).toHaveValue('10');
  expect(
    within(region()).queryByText(/changed|another player/),
  ).not.toBeInTheDocument();
});

test("an adjustment's Modifier is edited in place and the calculated score follows the saved value", async () => {
  const view = renderSheet(buildSheet({ adjustments: [bullStrength] }));
  expect(strengthTotal()).toHaveTextContent('14');
  fireEvent.click(button('Edit Bull strength'));
  expect(field('Name')).toHaveValue('Bull strength');
  expect(field('Modifier 1 value')).toHaveValue('4');
  expect(picker('Modifier 2 statistic')).toHaveValue('save.will');
  fireEvent.change(field('Modifier 1 value'), { target: { value: '6' } });
  fireEvent.click(button('Save adjustment'));
  await waitFor(() => expect(calls).toHaveLength(1));
  expect(lastCall().name).toBe('editAdjustment');
  expect(lastCall().args).toMatchObject({
    entryId: 'adj-1',
    name: 'Bull strength',
    modifiers: [
      { target: 'ability.str', bonusType: 'enhancement', value: 6 },
      bullStrength.modifiers[1],
    ],
  });
  await act(async () => {
    lastCall().resolve(null);
  });
  view.show(
    buildSheet({
      adjustments: [strongerBullStrength],
      lastOperationId: operationOf(lastCall()),
    }),
  );
  expect(within(editor('Edit')).getByRole('status')).toHaveTextContent(
    'Saved.',
  );
  expect(strengthTotal()).toHaveTextContent('16');
});

test('an adjustment switched off keeps its definition and stays editable, returns when switched on, and leaves only with the subscription when removed', async () => {
  const edited = strongerBullStrength;
  const view = renderSheet(buildSheet({ adjustments: [edited] }));
  fireEvent.click(button('Edit Bull strength'));
  expect(strengthTotal()).toHaveTextContent('16');

  const toggle = screen.getByRole('switch', { name: 'Bull strength: active' });
  fireEvent.click(toggle);
  await waitFor(() => expect(calls).toHaveLength(1));
  expect(lastCall().args).toEqual(
    expect.objectContaining({ entryId: 'adj-1', active: false }),
  );
  expect(lastCall().args).not.toHaveProperty('name');
  expect(toggle).toBeDisabled();
  await act(async () => {
    lastCall().resolve(null);
  });
  view.show(
    buildSheet({
      adjustments: [{ ...edited, active: false }],
      lastOperationId: operationOf(lastCall()),
    }),
  );
  const inactive = screen.getByRole('switch', {
    name: 'Bull strength: inactive',
  });
  expect(inactive).toHaveAttribute('aria-checked', 'false');
  expect(within(row('Bull strength')).getByText('Inactive')).toBeVisible();
  expect(row('Bull strength')).toHaveTextContent('+6 enhancement to Strength');
  expect(strengthTotal()).toHaveTextContent('10');
  expect(field('Modifier 1 value')).toHaveValue('6');
  expect(field('Modifier 1 value')).toBeEnabled();
  fireEvent.click(inactive);
  await waitFor(() => expect(calls).toHaveLength(2));
  expect(lastCall().args).toMatchObject({ entryId: 'adj-1', active: true });
  await act(async () => {
    lastCall().resolve(null);
  });
  view.show(
    buildSheet({
      adjustments: [edited],
      lastOperationId: operationOf(lastCall()),
    }),
  );
  expect(strengthTotal()).toHaveTextContent('16');

  fireEvent.click(button('Remove Bull strength'));
  await waitFor(() => expect(calls).toHaveLength(3));
  expect(lastCall().name).toBe('removeAdjustment');
  expect(lastCall().args).toMatchObject({ entryId: 'adj-1' });
  await act(async () => {
    lastCall().resolve(null);
  });
  // The row leaves with the subscription, not with the reply.
  expect(row('Bull strength')).toBeVisible();
  view.show(
    buildSheet({ adjustments: [], lastOperationId: operationOf(lastCall()) }),
  );
  expect(within(region()).getByText('No personal adjustments.')).toBeVisible();
  expect(
    within(region()).getByText('This adjustment is no longer on the sheet.'),
  ).toBeVisible();
  expect(strengthTotal()).toHaveTextContent('10');
  fireEvent.click(button('Close editor'));
  expect(
    within(region()).queryByText(/no longer on the sheet/),
  ).not.toBeInTheDocument();
});

test('a blank value and a malformed value get distinct messages and write nothing; fractional ability adjustments require correction', async () => {
  renderSheet(buildSheet());
  fireEvent.click(button('Add personal adjustment'));
  fireEvent.click(button('Save adjustment'));
  expect(
    await screen.findByText('Adjustment name is required'),
  ).toHaveAttribute('role', 'alert');
  expect(screen.getByText('Modifier value is required')).toBeVisible();
  expect(field('Modifier 1 value')).toHaveAttribute('aria-invalid', 'true');
  expect(field('Modifier 1 value')).toHaveAccessibleDescription(
    /Modifier value is required/,
  );
  fireEvent.change(field('Name'), { target: { value: 'Table reward' } });
  fireEvent.change(field('Modifier 1 value'), { target: { value: 'many' } });
  fireEvent.click(button('Save adjustment'));
  expect(
    await screen.findByText('Modifier value must be a number'),
  ).toBeVisible();
  expect(calls).toEqual([]);
  fireEvent.change(field('Modifier 1 value'), { target: { value: '-2.5' } });
  fireEvent.click(button('Save adjustment'));
  expect(
    await screen.findByText('Ability score modifiers must be whole numbers'),
  ).toBeVisible();
  expect(calls).toEqual([]);
  fireEvent.change(field('Modifier 1 value'), { target: { value: '-2' } });
  fireEvent.click(button('Save adjustment'));
  await waitFor(() => expect(calls).toHaveLength(1));
  expect(lastCall().args).toMatchObject({
    name: 'Table reward',
    modifiers: [{ target: 'ability.str', bonusType: 'untyped', value: -2 }],
  });
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

test('an "Only when…" text becomes the adjustment\'s own Situation and a blank removes it', async () => {
  renderSheet(buildSheet());
  fireEvent.click(button('Add personal adjustment'));
  fireEvent.change(field('Name'), { target: { value: 'Rage' } });
  fireEvent.change(field('Modifier 1 value'), { target: { value: '2' } });
  fireEvent.change(field('Modifier 1 only when'), {
    target: { value: 'raging' },
  });
  expect(field('Modifier 1 only when')).toHaveValue('raging');
  fireEvent.click(button('Save adjustment'));
  await waitFor(() => expect(calls).toHaveLength(1));
  expect(lastCall().args).toMatchObject({
    modifiers: [
      {
        target: 'ability.str',
        bonusType: 'untyped',
        value: 2,
        condition: { situation: { local: 'raging' } },
      },
    ],
  });
  await act(async () => {
    lastCall().reject(new ConvexError('Not now'));
  });
  await screen.findByRole('alert');
  fireEvent.change(field('Modifier 1 only when'), { target: { value: '' } });
  fireEvent.click(button('Save adjustment'));
  await waitFor(() => expect(calls).toHaveLength(2));
  const [modifier] = lastCall().args.modifiers as Record<string, unknown>[];
  expect(modifier?.condition).toBeUndefined();
});

test("another player's edit updates the list and a clean editor; a dirty editor keeps its rows, input and errors with a notice; a removed entry's draft saves as new", async () => {
  const view = renderSheet(buildSheet({ adjustments: [bullStrength] }));
  fireEvent.click(button('Edit Bull strength'));
  const renamed: Adjustment = {
    ...bullStrength,
    name: 'Greater bull strength',
  };
  view.show(
    buildSheet({ adjustments: [renamed], lastOperationId: 'other-player' }),
  );
  expect(row('Greater bull strength')).toBeVisible();
  expect(field('Name')).toHaveValue('Greater bull strength');
  expect(
    within(region()).getByText('Personal adjustments changed.'),
  ).toBeVisible();
  expect(
    within(editor('Edit')).getByText('Updated by another player.'),
  ).toBeVisible();
  fireEvent.click(button('Dismiss personal adjustments update'));
  fireEvent.click(button('Dismiss adjustment update'));
  expect(
    within(region()).queryByText(/changed|another player/),
  ).not.toBeInTheDocument();

  fireEvent.click(button('Remove modifier 1'));
  fireEvent.change(field('Modifier 1 value'), { target: { value: 'bad' } });
  fireEvent.click(button('Save adjustment'));
  expect(
    await screen.findByText('Modifier value must be a number'),
  ).toBeVisible();
  expect(calls).toEqual([]);
  const theirs: Adjustment = {
    ...renamed,
    modifiers: [
      { target: 'ability.str', bonusType: 'enhancement', value: 6 },
      { target: 'save.will', bonusType: 'morale', value: 3 },
    ],
  };
  view.show(
    buildSheet({ adjustments: [theirs], lastOperationId: 'other-player' }),
  );
  expect(within(editor('Edit')).getAllByRole('listitem')).toHaveLength(1);
  expect(field('Modifier 1 value')).toHaveValue('bad');
  expect(picker('Modifier 1 statistic')).toHaveValue('save.will');
  expect(screen.getByText('Modifier value must be a number')).toBeVisible();
  expect(
    within(editor('Edit')).getByText(
      'This adjustment changed while you were editing. Your edits are kept.',
    ),
  ).toBeVisible();
  expect(row('Greater bull strength')).toHaveTextContent(
    '+6 enhancement to Strength',
  );

  view.show(buildSheet({ adjustments: [], lastOperationId: 'other-player' }));
  expect(field('Modifier 1 value')).toHaveValue('bad');
  expect(
    within(region()).getByText(
      'This adjustment is no longer on the sheet. Save adds it as a new adjustment.',
    ),
  ).toBeVisible();
  fireEvent.change(field('Modifier 1 value'), { target: { value: '3' } });
  fireEvent.click(button('Save adjustment'));
  await waitFor(() => expect(calls).toHaveLength(1));
  expect(lastCall().name).toBe('createAdjustment');
  expect(lastCall().args).toMatchObject({
    name: 'Greater bull strength',
    modifiers: [{ target: 'save.will', bonusType: 'morale', value: 3 }],
  });
});

test('a refused toggle and a refused removal report in place, keep the row as it was and allow a retry', async () => {
  renderSheet(buildSheet({ adjustments: [bullStrength] }));
  const toggle = screen.getByRole('switch', { name: 'Bull strength: active' });
  fireEvent.click(toggle);
  await waitFor(() => expect(calls).toHaveLength(1));
  expect(button('Remove Bull strength')).toBeDisabled();
  await act(async () => {
    lastCall().reject(new ConvexError('Editing is paused'));
  });
  expect(await within(region()).findByRole('alert')).toHaveTextContent(
    "Personal adjustment wasn't saved: Editing is paused. Try again.",
  );
  expect(toggle).toHaveAttribute('aria-checked', 'true');
  expect(toggle).toBeEnabled();
  fireEvent.click(button('Remove Bull strength'));
  await waitFor(() => expect(calls).toHaveLength(2));
  await act(async () => {
    lastCall().reject(new ConvexError('Not now'));
  });
  expect(await within(region()).findByRole('alert')).toHaveTextContent(
    "Personal adjustment wasn't saved: Not now. Try again.",
  );
  expect(row('Bull strength')).toBeVisible();
  expect(button('Remove Bull strength')).toBeEnabled();
});

test('a repeated save while pending sends one request; a refused save keeps the draft beside its error and is retried from there', async () => {
  renderSheet(buildSheet({ adjustments: [bullStrength] }));
  fireEvent.click(button('Edit Bull strength'));
  fireEvent.change(field('Modifier 1 value'), { target: { value: '5' } });
  fireEvent.click(button('Save adjustment'));
  fireEvent.click(button('Save adjustment'));
  await waitFor(() => expect(calls).toHaveLength(1));
  fireEvent.click(button('Saving…'));
  await act(async () => {
    lastCall().reject(new ConvexError('Refused'));
  });
  expect(await within(editor('Edit')).findByRole('alert')).toHaveTextContent(
    "Changes weren't saved: Refused. Your edits are kept. Save to try again.",
  );
  expect(calls).toHaveLength(1);
  expect(field('Modifier 1 value')).toHaveValue('5');
  fireEvent.click(button('Save adjustment'));
  await waitFor(() => expect(calls).toHaveLength(2));
  expect(lastCall().args).toMatchObject({ entryId: 'adj-1' });
});

test('maintenance disables adding, switching, removing and the editor fields, with the reason beside them', () => {
  const message = 'Editing is paused for maintenance.';
  const view = renderSheet(buildSheet({ adjustments: [bullStrength] }));
  fireEvent.click(button('Edit Bull strength'));
  fireEvent.change(field('Modifier 1 value'), { target: { value: '7' } });
  maintenance.mockReturnValue({ kind: 'maintenance', readOnly: true, message });
  view.show(buildSheet({ adjustments: [bullStrength] }));
  expect(button('Add personal adjustment')).toBeDisabled();
  expect(
    screen.getByRole('switch', { name: 'Bull strength: active' }),
  ).toBeDisabled();
  expect(button('Remove Bull strength')).toBeDisabled();
  expect(button('Save adjustment')).toBeDisabled();
  expect(button('Add modifier')).toBeDisabled();
  expect(field('Modifier 1 value')).toBeDisabled();
  expect(field('Modifier 1 value')).toHaveValue('7');
  expect(picker('Modifier 1 statistic')).toBeDisabled();
  expect(within(region()).getAllByText(message).length).toBeGreaterThan(0);
  fireEvent.submit(editor('Edit'));
  expect(calls).toEqual([]);
});
