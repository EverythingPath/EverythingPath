import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import type { ComponentProps } from 'react';
import type * as NavigationGuard from '~/components/campaign-shell/navigation-guard';
import { beforeEach, expect, test, vi } from 'vitest';
import type { MigrationMaintenance } from '~/components/use-initial-migration-maintenance';
import { CharacterSheetBlocks } from './character-sheet-blocks-test-fixture';
import {
  buildSheet,
  emptyOwnerCandidates,
  type Adjustment,
} from './character-sheet-test-fixture';
import type { CharacterSheetSnapshot } from './use-character-sheet';
import { characterSheetNames } from './character-sheet-api-test-fixture';
import type { FunctionReference } from 'convex/server';

// Formula Modifiers (#298): a value typed once as a number or a formula, an
// unsupported formula kept with its warning under the Modifier it is about,
// accepted there and reopened by an edit.

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
const modifierRow = (ordinal: number) =>
  screen.getByRole('listitem', { name: `Modifier ${ordinal}` });
const button = (name: string | RegExp) =>
  within(region()).getByRole('button', { name });
const field = (name: string) => within(region()).getByRole('textbox', { name });
const formulaToggle = () => button('Modifier 1 as formula');
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

const unsupported =
  'This Modifier contributes nothing. @foo is not a supported variable.';
const odd: Adjustment = {
  id: 'adj-1',
  name: 'Odd',
  modifiers: [
    {
      target: 'ability.str',
      bonusType: 'untyped',
      value: { formula: '@foo + 1' },
    },
  ],
};
const warningOf = (sheet: CharacterSheetSnapshot) => {
  const warning = sheet.calculated.warnings.find(
    (item) => item.check === 'unsupportedFormula',
  );
  if (!warning) throw new Error('Expected an unsupported-formula warning');
  return warning;
};

beforeEach(() => {
  calls = [];
  maintenance.mockReturnValue({ kind: 'ready', readOnly: false, message: '' });
  snapshot = undefined;
});

// Arcane strike: a Strength Modifier whose value is a formula of the level.
const scaling: Adjustment = {
  id: 'adj-2',
  name: 'Arcane strike',
  modifiers: [
    {
      target: 'ability.str',
      bonusType: 'untyped',
      value: { formula: '@level * 2' },
    },
  ],
};

test('a value is typed once as a number or a formula: an empty formula is refused in place, and a formula saves as text and counts through the resolver', async () => {
  const view = renderSheet(buildSheet());
  fireEvent.click(button('Add personal adjustment'));
  fireEvent.change(field('Name'), { target: { value: 'Arcane strike' } });
  expect(formulaToggle()).toHaveAttribute('aria-pressed', 'false');
  expect(field('Modifier 1 value')).toHaveAttribute('inputmode', 'decimal');
  fireEvent.click(formulaToggle());
  expect(formulaToggle()).toHaveAttribute('aria-pressed', 'true');
  expect(field('Modifier 1 value')).toHaveAttribute('inputmode', 'text');
  fireEvent.click(button('Save adjustment'));
  expect(await screen.findByText('Formula is required')).toHaveAttribute(
    'role',
    'alert',
  );
  expect(calls).toEqual([]);
  fireEvent.change(field('Modifier 1 value'), {
    target: { value: '@level * 2' },
  });
  fireEvent.click(button('Save adjustment'));
  await waitFor(() => expect(calls).toHaveLength(1));
  expect(lastCall().name).toBe('createAdjustment');
  expect(lastCall().args).toMatchObject({
    name: 'Arcane strike',
    modifiers: [
      {
        target: 'ability.str',
        bonusType: 'untyped',
        value: { formula: '@level * 2' },
      },
    ],
  });
  await act(async () => {
    lastCall().resolve('adj-2');
  });
  view.show(
    buildSheet({
      adjustments: [scaling],
      lastOperationId: operationOf(lastCall()),
    }),
  );
  await waitFor(() =>
    expect(
      screen.queryByRole('form', { name: 'New personal adjustment' }),
    ).toBeNull(),
  );
  expect(row('Arcane strike')).toHaveTextContent('@level * 2 to Strength');
  expect(strength(12)).toBeVisible();
  expect(screen.queryByText(/contributes nothing/)).not.toBeInTheDocument();
});

test('a stored formula opens in formula mode, and the toggle back saves a number', async () => {
  renderSheet(buildSheet({ adjustments: [scaling] }));
  fireEvent.click(button('Edit Arcane strike'));
  expect(field('Modifier 1 value')).toHaveValue('@level * 2');
  expect(formulaToggle()).toHaveAttribute('aria-pressed', 'true');
  fireEvent.click(formulaToggle());
  fireEvent.change(field('Modifier 1 value'), { target: { value: '3' } });
  fireEvent.click(button('Save adjustment'));
  await waitFor(() => expect(calls).toHaveLength(1));
  expect(lastCall().name).toBe('editAdjustment');
  expect(lastCall().args).toMatchObject({
    entryId: 'adj-2',
    modifiers: [{ target: 'ability.str', bonusType: 'untyped', value: 3 }],
  });
});

test('an unsupported formula is kept with its warning under the row, moves under its Modifier while editing, is accepted without changing the number, and an edited expression reopens it while switching the entry off removes it', async () => {
  const initial = buildSheet({ adjustments: [odd] });
  const view = renderSheet(initial);
  expect(within(row('Odd')).getByText(unsupported)).toBeVisible();
  expect(row('Odd')).toHaveTextContent('@foo + 1 to Strength');
  expect(strength(10)).toBeVisible();

  fireEvent.click(within(row('Odd')).getByRole('button', { name: 'Accept' }));
  await waitFor(() => expect(calls).toHaveLength(1));
  expect(lastCall().name).toBe('accept');
  const warning = warningOf(initial);
  expect(lastCall().args).toMatchObject({
    check: 'unsupportedFormula',
    subject: 'adj-1:0',
    fingerprint: warning.fingerprint,
  });
  await act(async () => {
    lastCall().resolve(null);
  });
  const accepted = buildSheet({
    adjustments: [odd],
    accepted: [warning],
    lastOperationId: operationOf(lastCall()),
  });
  view.show(accepted);
  expect(within(row('Odd')).getByText('Accepted')).toBeVisible();
  expect(
    within(row('Odd')).getByRole('button', { name: 'Reopen' }),
  ).toBeVisible();
  expect(strength(10)).toBeVisible();

  fireEvent.click(button('Edit Odd'));
  expect(within(row('Odd')).queryByText('Accepted')).not.toBeInTheDocument();
  expect(within(modifierRow(1)).getByText('Accepted')).toBeVisible();
  expect(
    within(modifierRow(1)).getByRole('button', { name: 'Reopen' }),
  ).toHaveAccessibleDescription(unsupported);
  expect(field('Modifier 1 value')).toHaveValue('@foo + 1');
  expect(formulaToggle()).toHaveAttribute('aria-pressed', 'true');

  const edited: Adjustment = {
    ...odd,
    modifiers: [
      {
        target: 'ability.str',
        bonusType: 'untyped',
        value: { formula: '@bar + 1' },
      },
    ],
  };
  view.show(
    buildSheet({
      adjustments: [edited],
      accepted: [warning],
      lastOperationId: 'other-player',
    }),
  );
  expect(
    within(modifierRow(1)).getByText(
      'This Modifier contributes nothing. @bar is not a supported variable.',
    ),
  ).toBeVisible();
  expect(
    within(modifierRow(1)).getByRole('button', { name: 'Accept' }),
  ).toBeVisible();
  expect(screen.queryByText('Accepted')).not.toBeInTheDocument();

  view.show(
    buildSheet({
      adjustments: [{ ...edited, active: false }],
      lastOperationId: 'other-player',
    }),
  );
  expect(screen.queryByText(/contributes nothing/)).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Accept' })).toBeNull();
  expect(field('Modifier 1 value')).toHaveValue('@bar + 1');
});
