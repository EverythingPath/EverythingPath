import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { ConvexError } from 'convex/values';
import { beforeEach, expect, test, vi } from 'vitest';
import type { MigrationMaintenance } from '~/components/use-initial-migration-maintenance';
import { buildCastingSheet } from './casting-features-test-fixture';
import { CharacterSheetBlocks } from './character-sheet-blocks-test-fixture';
import {
  emptyOwnerCandidates,
  findCalculatedWarning,
} from './character-sheet-test-fixture';
import type { CharacterSheetSnapshot } from './use-character-sheet';
import { characterSheetNames } from './character-sheet-api-test-fixture';
import type { FunctionReference } from 'convex/server';

// Casting advances on Class Levels (#415): a Prestige Class Level chooses the
// class each "+1 level of existing spellcasting class" goes to, pre-filled
// when one class qualifies, outlined while open, and saved as chosen.

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

const page = () => <CharacterSheetBlocks blocks={['levels']} />;
function renderLevels(initial: CharacterSheetSnapshot) {
  snapshot = initial;
  const view = render(page());
  return {
    show(next: CharacterSheetSnapshot) {
      snapshot = next;
      view.rerender(page());
    },
  };
}
const repeat = (identity: string, count: number) =>
  Array.from({ length: count }, () => identity);
const row = (level: number) =>
  screen.getByRole('listitem', { name: `Level ${level}` });
const advance = (level: number, label: string) =>
  within(row(level)).getByRole('combobox', { name: label });
const pick = (select: HTMLElement, value: string) =>
  fireEvent.change(select, { target: { value } });
const assignments = () =>
  calls.filter((call) => call.name === 'assignCastingAdvance');
const help =
  "Each advance adds a level to that class's spellcasting: caster level, spells per day and spells known.";

test('a Mystic Theurge level offers an arcane and a divine advance, each pre-filled with the one class that qualifies; base-class rows have none', () => {
  renderLevels(
    buildCastingSheet({
      levels: [
        ...repeat('wizard', 3),
        ...repeat('cleric', 3),
        'mystic-theurge',
      ],
    }),
  );
  expect(advance(7, 'Arcane advance')).toHaveValue('wizard');
  expect(advance(7, 'Divine advance')).toHaveValue('cleric');
  expect(advance(7, 'Arcane advance')).not.toHaveClass('ring-sky-400/80');
  expect(advance(7, 'Arcane advance')).toHaveAccessibleDescription(help);
  expect(within(row(7)).getByText(help)).toBeVisible();
  expect(
    within(advance(7, 'Arcane advance')).getByRole('option', {
      name: 'Not assigned',
    }),
  ).toBeInTheDocument();
  for (const level of [1, 4])
    expect(
      within(row(level)).queryByRole('combobox', { name: /advance/ }),
    ).not.toBeInTheDocument();
  expect(screen.queryByText(/doesn't qualify/)).not.toBeInTheDocument();
});

test('an arcane advance two classes could take stays empty and outlined with its prompt as description; choosing saves that advance alone, a refusal stays beside it, and Not assigned clears the other', async () => {
  renderLevels(
    buildCastingSheet({
      levels: [
        ...repeat('wizard', 3),
        ...repeat('sorcerer', 3),
        ...repeat('cleric', 3),
        'mystic-theurge',
      ],
    }),
  );
  const prompt =
    'Choose the arcane spellcasting class this Mystic Theurge level advances.';
  const arcane = advance(10, 'Arcane advance');
  // The select double holds the empty choice as its own item.
  expect(arcane).toHaveValue('none');
  expect(arcane).toHaveClass('ring-sky-400/80');
  expect(arcane).toHaveAccessibleDescription(`${prompt} ${help}`);
  expect(within(row(10)).getByText(prompt)).toHaveClass('text-sky-300');
  expect(
    within(arcane).getByRole('option', { name: 'Choose a class' }),
  ).toBeInTheDocument();
  expect(
    within(arcane)
      .getAllByRole('option')
      .map((option) => option.textContent),
  ).toEqual(['', 'Choose a class', 'Wizard', 'Sorcerer']);
  expect(advance(10, 'Divine advance')).toHaveValue('cleric');
  // The prompt is never a decision; the row's prerequisite warnings are.
  expect(
    within(row(10)).queryByRole('button', { name: 'Accept' }),
  ).not.toBeInTheDocument();
  expect(
    within(row(10)).queryByRole('button', { name: 'Reopen' }),
  ).not.toBeInTheDocument();

  pick(arcane, 'sorcerer');
  expect(assignments()).toHaveLength(1);
  expect(assignments()[0]?.args).toMatchObject({
    entryId: 'mystic-theurge-1',
    index: 0,
    classEntryId: 'sorcerer',
  });
  expect(advance(10, 'Arcane advance')).toBeDisabled();
  expect(advance(10, 'Divine advance')).toBeEnabled();
  expect(within(row(10)).getByText('Saving…')).toBeVisible();

  await act(async () =>
    assignments()[0]?.reject(new ConvexError('Character is read only')),
  );
  const alerts = within(row(10)).getAllByRole('alert');
  expect(alerts).toHaveLength(1);
  expect(alerts[0]).toHaveTextContent(
    "Casting advance wasn't saved: Character is read only. Try again.",
  );
  expect(advance(10, 'Arcane advance')).toBeEnabled();

  pick(advance(10, 'Divine advance'), 'none');
  expect(assignments()).toHaveLength(2);
  expect(assignments()[1]?.args).toMatchObject({
    entryId: 'mystic-theurge-1',
    index: 1,
    classEntryId: null,
  });
  expect(advance(10, 'Divine advance')).toBeDisabled();
  expect(advance(10, 'Arcane advance')).toBeEnabled();
  await act(async () => assignments()[1]?.resolve(null));
  expect(
    await within(row(10)).findByText('Casting advance saved.'),
  ).toBeVisible();
});

test('a recorded class taken after the Prestige Class stays selectable, marked as not qualifying, with its rules warning accepted in place', async () => {
  const levels = [
    ...repeat('wizard', 3),
    ...repeat('cleric', 3),
    'mystic-theurge',
    'sorcerer',
    ['mystic-theurge', [{ classEntryId: 'sorcerer' }]] as [
      string,
      { classEntryId: string }[],
    ],
  ];
  const view = renderLevels(buildCastingSheet({ levels }));
  const arcane = advance(9, 'Arcane advance');
  expect(arcane).toHaveValue('sorcerer');
  expect(arcane).not.toHaveClass('ring-sky-400/80');
  expect(
    within(arcane)
      .getAllByRole('option')
      .map((option) => option.textContent),
  ).toEqual(['', 'Not assigned', 'Wizard', "Sorcerer — doesn't qualify"]);
  const message =
    'Sorcerer was not taken before Mystic Theurge, so its advance does not qualify.';
  expect(within(row(9)).getByText(message).parentElement).toHaveClass(
    'text-amber-300',
  );
  expect(within(row(7)).queryByText(message)).not.toBeInTheDocument();

  fireEvent.click(within(row(9)).getByRole('button', { name: 'Accept' }));
  const accepted = calls.find((call) => call.name === 'accept');
  expect(accepted?.args).toMatchObject({
    check: 'castingAdvanceTarget',
    subject: 'mystic-theurge-2:castingAdvances:0',
  });
  await act(async () => accepted?.resolve(null));
  const warning = findCalculatedWarning(
    buildCastingSheet({ levels }),
    'castingAdvanceTarget',
  );
  view.show(buildCastingSheet({ levels, accepted: [warning] }));
  expect(within(row(9)).getByText('Accepted')).toBeVisible();
  expect(within(row(9)).getByRole('button', { name: 'Reopen' })).toBeVisible();
  expect(advance(9, 'Arcane advance')).toHaveValue('sorcerer');
});
