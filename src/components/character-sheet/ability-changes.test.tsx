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
import type { Id } from '@convex/_generated/dataModel';
import type * as NavigationGuard from '~/components/campaign-shell/navigation-guard';
import { beforeEach, expect, test, vi } from 'vitest';
import type { MigrationMaintenance } from '~/components/use-initial-migration-maintenance';
import { defaultAbilityScores } from '~/lib/character-sheet';
import { CharacterSheetBlocks } from './character-sheet-blocks-test-fixture';
import {
  buildSheet,
  emptyOwnerCandidates,
  type AbilityChange,
} from './character-sheet-test-fixture';
import type { CharacterSheetSnapshot } from './use-character-sheet';
import { characterSheetNames } from './character-sheet-api-test-fixture';
import type { FunctionReference } from 'convex/server';

// Ability damage and drain (#298): entered from cards, edited, switched off
// and removed on the living sheet; damage changes the modifier, drain the
// score, and the permanent values stand beside a differing current one.

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

const page = (scopeCharacterId?: Id<'character'>) => (
  <CharacterSheetBlocks
    blocks={['scores', 'abilityChanges']}
    scopeCharacterId={scopeCharacterId}
  />
);
function renderSheet(initial: CharacterSheetSnapshot) {
  snapshot = initial;
  const view = render(page());
  return {
    show(next: CharacterSheetSnapshot | null | undefined) {
      snapshot = next;
      view.rerender(page());
    },
    showCharacter(characterId: Id<'character'>) {
      snapshot = undefined;
      view.rerender(page(characterId));
    },
  };
}
const region = () =>
  screen.getByRole('region', { name: 'Ability damage and drain' });
const scores = () => screen.getByRole('region', { name: 'Ability scores' });
const row = (name: string) => within(region()).getByRole('listitem', { name });
const button = (name: string | RegExp) =>
  within(region()).getByRole('button', { name });
const radio = (name: string) => within(region()).getByRole('radio', { name });
const points = () => within(region()).getByRole('textbox', { name: 'Points' });
const statistic = (name: string) =>
  within(scores()).getByRole('button', { name: `${name}, breakdown` });
// The permanent line under a differing row reads "<ability> Permanent 14 +2".
const permanentOf = (ability: string) =>
  within(scores()).queryByText(
    (_, element) =>
      element?.tagName === 'P' &&
      (element.textContent ?? '').startsWith(`${ability} Permanent`),
  );
function lastCall() {
  const call = calls.at(-1);
  if (!call) throw new Error('Expected a write');
  return call;
}
const operationOf = (call: Call) => String(call.args.operationId);
const strong = { ...defaultAbilityScores, strength: 14 };
const strengthDamage: AbilityChange = {
  id: 'dmg-1',
  kind: 'abilityDamage',
  ability: 'strength',
  points: 3,
};

beforeEach(() => {
  calls = [];
  maintenance.mockReturnValue({ kind: 'ready', readOnly: false, message: '' });
  snapshot = undefined;
});

/** The open editor for a new entry. */
function openNewEditor() {
  fireEvent.click(button('Add ability damage or drain'));
  return screen.getByRole('form', { name: 'New ability damage or drain' });
}

/** Saves the open editor and waits for its one write. */
async function saveOpenEditor() {
  const expected = calls.length + 1;
  fireEvent.click(button('Save ability change'));
  await waitFor(() => expect(calls).toHaveLength(expected));
  return lastCall();
}

/** Settles the pending write as `entryId` and shows the sheet it produced. */
async function settleNewChange(
  view: ReturnType<typeof renderSheet>,
  entryId: string,
  abilityChanges: AbilityChange[],
) {
  await act(async () => {
    lastCall().resolve(entryId);
  });
  view.show(
    buildSheet({
      scores: strong,
      abilityChanges,
      lastOperationId: operationOf(lastCall()),
    }),
  );
}

test('a sheet without damage or drain says so, and the scores stand without a permanent line', () => {
  renderSheet(buildSheet({ scores: strong }));
  expect(
    within(region()).getByText('No ability damage or drain.'),
  ).toBeVisible();
  expect(statistic('Strength 14')).toBeVisible();
  expect(statistic('Strength modifier +2')).toBeVisible();
  expect(permanentOf('Strength')).toBeNull();
});

test('the new editor starts as Strength damage with both kinds described, and refuses missing and fractional points in place without writing', async () => {
  renderSheet(buildSheet({ scores: strong }));
  expect(openNewEditor()).toBeVisible();
  expect(radio('Ability damage')).toBeChecked();
  expect(radio('Ability damage')).toHaveAccessibleDescription(
    /Leaves the score alone; lowers the modifier by 1 per 2 points/,
  );
  expect(radio('Ability drain')).toHaveAccessibleDescription(
    /Lowers the score/,
  );
  expect(radio('Strength')).toBeChecked();
  fireEvent.click(button('Save ability change'));
  expect(await screen.findByText('Points are required')).toHaveAttribute(
    'role',
    'alert',
  );
  expect(points()).toHaveAccessibleDescription(/Points are required/);
  fireEvent.change(points(), { target: { value: '1.5' } });
  fireEvent.click(button('Save ability change'));
  expect(
    await screen.findByText('Points must be a whole number of 0 or more'),
  ).toBeVisible();
  expect(calls).toEqual([]);
});

test('damage entered from the cards with whole points leaves the score and lowers the modifier beside its permanent value, and the breakdown names its points', async () => {
  const view = renderSheet(buildSheet({ scores: strong }));
  openNewEditor();
  fireEvent.change(points(), { target: { value: '3' } });
  const call = await saveOpenEditor();
  expect(call.name).toBe('createAbilityChange');
  expect(call.args).toMatchObject({
    kind: 'abilityDamage',
    ability: 'strength',
    points: 3,
  });
  expect(button('Saving…')).toBeDisabled();
  await settleNewChange(view, 'dmg-1', [strengthDamage]);
  await waitFor(() =>
    expect(
      screen.queryByRole('form', { name: 'New ability damage or drain' }),
    ).not.toBeInTheDocument(),
  );
  const damage = row('Strength damage, 3 points');
  expect(damage).toHaveTextContent('3 points · modifier −1');
  expect(within(damage).getByText('Active')).toBeVisible();
  expect(statistic('Strength 14')).toBeVisible();
  expect(statistic('Strength modifier +1')).toBeVisible();
  expect(permanentOf('Strength')).toHaveTextContent('Strength Permanent 14 +2');
  expect(
    within(scores()).getByText(
      'Permanent values exclude short-duration spells, conditions, consumables and ability damage.',
    ),
  ).toBeVisible();
  fireEvent.click(statistic('Strength modifier +1'));
  const breakdown = screen.getByRole('group', {
    name: 'Strength modifier breakdown',
  });
  expect(breakdown).toHaveTextContent('Ability damage (3 points)');
  expect(breakdown).toHaveTextContent('-1');
  fireEvent.click(
    within(breakdown).getByRole('button', { name: 'Close breakdown' }),
  );
});

test('drain lowers the score and is permanent; its own echo is quiet', async () => {
  const view = renderSheet(
    buildSheet({ scores: strong, abilityChanges: [strengthDamage] }),
  );
  openNewEditor();
  fireEvent.click(radio('Ability drain'));
  fireEvent.click(radio('Dexterity'));
  fireEvent.change(points(), { target: { value: '2' } });
  const call = await saveOpenEditor();
  expect(call.args).toMatchObject({
    kind: 'abilityDrain',
    ability: 'dexterity',
    points: 2,
  });
  await settleNewChange(view, 'drain-1', [
    strengthDamage,
    { id: 'drain-1', kind: 'abilityDrain', ability: 'dexterity', points: 2 },
  ]);
  expect(row('Dexterity drain, 2 points')).toHaveTextContent(
    '2 points · score −2',
  );
  expect(statistic('Dexterity 8')).toBeVisible();
  expect(statistic('Dexterity modifier -1')).toBeVisible();
  expect(permanentOf('Dexterity')).toBeNull();
  expect(
    within(region()).queryByText(/changed|another player/),
  ).not.toBeInTheDocument();
});

test('an existing entry keeps its kind while ability and points change; switched off it stays editable with an off state and its modifier returns; it leaves with the subscription when removed', async () => {
  const view = renderSheet(
    buildSheet({ scores: strong, abilityChanges: [strengthDamage] }),
  );
  fireEvent.click(button('Edit Strength damage'));
  expect(
    screen.getByRole('form', { name: 'Edit ability damage' }),
  ).toBeVisible();
  expect(radio('Ability damage')).toBeChecked();
  expect(radio('Ability damage')).toBeDisabled();
  expect(radio('Ability drain')).toBeDisabled();
  expect(radio('Strength')).toBeChecked();
  expect(radio('Constitution')).toBeEnabled();
  expect(points()).toHaveValue('3');
  fireEvent.change(points(), { target: { value: '4' } });
  fireEvent.click(button('Save ability change'));
  await waitFor(() => expect(calls).toHaveLength(1));
  expect(lastCall().name).toBe('editAbilityChange');
  expect(lastCall().args).toMatchObject({
    entryId: 'dmg-1',
    ability: 'strength',
    points: 4,
  });
  expect(lastCall().args).not.toHaveProperty('kind');
  await act(async () => {
    lastCall().resolve(null);
  });
  const heavier = { ...strengthDamage, points: 4 };
  view.show(
    buildSheet({
      scores: strong,
      abilityChanges: [heavier],
      lastOperationId: operationOf(lastCall()),
    }),
  );
  expect(
    within(screen.getByRole('form', { name: 'Edit ability damage' })).getByRole(
      'status',
    ),
  ).toHaveTextContent('Saved.');
  expect(statistic('Strength modifier +0')).toBeVisible();
  expect(statistic('Strength 14')).toBeVisible();

  const toggle = screen.getByRole('switch', {
    name: 'Strength damage: active',
  });
  fireEvent.click(toggle);
  await waitFor(() => expect(calls).toHaveLength(2));
  expect(lastCall().args).toMatchObject({ entryId: 'dmg-1', active: false });
  expect(lastCall().args).not.toHaveProperty('points');
  expect(toggle).toBeDisabled();
  await act(async () => {
    lastCall().resolve(null);
  });
  view.show(
    buildSheet({
      scores: strong,
      abilityChanges: [{ ...heavier, active: false }],
      lastOperationId: operationOf(lastCall()),
    }),
  );
  const inactive = screen.getByRole('switch', {
    name: 'Strength damage: inactive',
  });
  expect(inactive).toHaveAttribute('aria-checked', 'false');
  expect(
    within(row('Strength damage, 4 points')).getByText('Inactive'),
  ).toBeVisible();
  expect(statistic('Strength modifier +2')).toBeVisible();
  expect(permanentOf('Strength')).toBeNull();
  expect(points()).toHaveValue('4');
  expect(points()).toBeEnabled();

  fireEvent.click(button('Remove Strength damage'));
  await waitFor(() => expect(calls).toHaveLength(3));
  expect(lastCall().name).toBe('removeAbilityChange');
  expect(lastCall().args).toMatchObject({ entryId: 'dmg-1' });
  await act(async () => {
    lastCall().resolve(null);
  });
  expect(row('Strength damage, 4 points')).toBeVisible();
  view.show(
    buildSheet({
      scores: strong,
      abilityChanges: [],
      lastOperationId: operationOf(lastCall()),
    }),
  );
  expect(
    within(region()).getByText('No ability damage or drain.'),
  ).toBeVisible();
  expect(
    within(region()).getByText('This entry is no longer on the sheet.'),
  ).toBeVisible();
  fireEvent.click(button('Close editor'));
  expect(
    within(region()).queryByText(/no longer on the sheet/),
  ).not.toBeInTheDocument();
});

test('a refused save keeps the draft beside its error for a retry; a refused toggle reports in place', async () => {
  const view = renderSheet(buildSheet({ abilityChanges: [strengthDamage] }));
  fireEvent.click(button('Add ability damage or drain'));
  fireEvent.click(radio('Wisdom'));
  fireEvent.change(points(), { target: { value: '2' } });
  fireEvent.click(button('Save ability change'));
  await waitFor(() => expect(calls).toHaveLength(1));
  await act(async () => {
    lastCall().reject(new ConvexError('Not now'));
  });
  const editor = screen.getByRole('form', {
    name: 'New ability damage or drain',
  });
  expect(within(editor).getByRole('alert')).toHaveTextContent(
    "Changes weren't saved: Not now. Your edits are kept. Save to try again.",
  );
  expect(points()).toHaveValue('2');
  expect(radio('Wisdom')).toBeChecked();
  expect(within(editor).queryByText('Saved.')).not.toBeInTheDocument();

  fireEvent.click(
    screen.getByRole('switch', { name: 'Strength damage: active' }),
  );
  await waitFor(() => expect(calls).toHaveLength(2));
  await act(async () => {
    lastCall().reject(new ConvexError('Not now'));
  });
  expect(within(region()).getAllByRole('alert').at(-1)).toHaveTextContent(
    "Ability change wasn't saved: Not now. Try again.",
  );
  expect(
    screen.getByRole('switch', { name: 'Strength damage: active' }),
  ).toBeEnabled();
  view.show(buildSheet({ abilityChanges: [strengthDamage] }));
  expect(points()).toHaveValue('2');
});

test("another player's change is announced on the block and in the editor and dismissed there; an own echo is quiet", async () => {
  const view = renderSheet(buildSheet({ abilityChanges: [strengthDamage] }));
  fireEvent.click(button('Edit Strength damage'));
  view.show(
    buildSheet({
      abilityChanges: [{ ...strengthDamage, points: 5 }],
      lastOperationId: 'other-player',
    }),
  );
  expect(row('Strength damage, 5 points')).toBeVisible();
  expect(points()).toHaveValue('5');
  expect(
    within(region()).getByText('Ability damage and drain changed.'),
  ).toBeVisible();
  const editor = screen.getByRole('form', { name: 'Edit ability damage' });
  expect(within(editor).getByText('Updated by another player.')).toBeVisible();
  fireEvent.click(button('Dismiss ability damage and drain update'));
  fireEvent.click(button('Dismiss ability change update'));
  expect(
    within(region()).queryByText(/changed|another player/),
  ).not.toBeInTheDocument();

  fireEvent.change(points(), { target: { value: '6' } });
  view.show(
    buildSheet({
      abilityChanges: [{ ...strengthDamage, points: 7 }],
      lastOperationId: 'other-player',
    }),
  );
  expect(points()).toHaveValue('6');
  expect(
    within(editor).getByText(
      'This entry changed while you were editing. Your edits are kept.',
    ),
  ).toBeVisible();
  fireEvent.click(button('Dismiss ability change update'));
  fireEvent.click(button('Dismiss ability damage and drain update'));
  fireEvent.click(button('Save ability change'));
  await waitFor(() => expect(calls).toHaveLength(1));
  await act(async () => {
    lastCall().resolve(null);
  });
  view.show(
    buildSheet({
      abilityChanges: [{ ...strengthDamage, points: 6 }],
      lastOperationId: operationOf(lastCall()),
    }),
  );
  expect(
    within(region()).queryByText(/changed|another player/),
  ).not.toBeInTheDocument();
  expect(within(editor).getByRole('status')).toHaveTextContent('Saved.');
});

test('maintenance disables editing and a pending replacement keeps the saved ability changes and maintenance controls', () => {
  const message = 'Editing is paused for maintenance.';
  maintenance.mockReturnValue({ kind: 'maintenance', readOnly: true, message });
  const view = renderSheet(buildSheet({ abilityChanges: [strengthDamage] }));
  expect(button('Add ability damage or drain')).toBeDisabled();
  expect(
    screen.getByRole('switch', { name: 'Strength damage: active' }),
  ).toBeDisabled();
  expect(button('Remove Strength damage')).toBeDisabled();
  expect(within(region()).getAllByText(message).length).toBeGreaterThan(0);
  fireEvent.click(button('Edit Strength damage'));
  expect(points()).toBeDisabled();
  expect(radio('Constitution')).toBeDisabled();
  expect(button('Save ability change')).toBeDisabled();
  fireEvent.submit(screen.getByRole('form', { name: 'Edit ability damage' }));
  expect(calls).toEqual([]);

  const savedRegion = region();
  view.show(undefined);
  expect(region()).toBe(savedRegion);
  expect(row('Strength damage, 3 points')).toBeVisible();
  expect(button('Add ability damage or drain')).toBeDisabled();
  expect(
    screen.getByRole('switch', { name: 'Strength damage: active' }),
  ).toBeDisabled();
  expect(button('Remove Strength damage')).toBeDisabled();
  expect(points()).toHaveValue('3');
  expect(points()).toBeDisabled();
  expect(button('Save ability change')).toBeDisabled();
  expect(within(region()).getAllByText(message).length).toBeGreaterThan(0);
  expect(calls).toEqual([]);
});

test('a different Character loading cannot display the previous Character ability changes', () => {
  const view = renderSheet(buildSheet({ abilityChanges: [strengthDamage] }));
  expect(row('Strength damage, 3 points')).toBeVisible();
  view.showCharacter('different-character' as Id<'character'>);
  expect(
    screen.queryByRole('region', { name: 'Ability damage and drain' }),
  ).toBeNull();
  expect(screen.getByRole('link', { name: 'Characters' })).toBeVisible();
});
