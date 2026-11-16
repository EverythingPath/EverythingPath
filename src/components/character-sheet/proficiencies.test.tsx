import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import type { MigrationMaintenance } from '~/components/use-initial-migration-maintenance';
import { CharacterSheetBlocks } from './character-sheet-blocks-test-fixture';
import {
  buildSheet,
  emptyOwnerCandidates,
  type CatalogSheetEntry,
  type Level,
} from './character-sheet-test-fixture';
import type { CharacterSheetSnapshot } from './use-character-sheet';
import { characterSheetNames } from './character-sheet-api-test-fixture';
import type { FunctionReference } from 'convex/server';
import { api } from '@convex/_generated/api';

// Managing Proficiencies (#306): grants with their sources, manual additions
// and removals, and the weapon choices their sources ask for.

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
  editClassLevel: api.characterSheet.editClassLevel,
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

beforeEach(() => {
  calls = [];
  maintenance.mockReturnValue({ kind: 'ready', readOnly: false, message: '' });
});

const cleric: Level = { id: 'cleric-1', hp: 8, classId: 'cleric' };
const fighter: Level = { id: 'fighter-1', hp: 10, classId: 'fighter' };
const laterCleric: Level = { id: 'cleric-2', hp: 5, classId: 'cleric' };
const fullPlate: CatalogSheetEntry = {
  id: 'plate',
  name: 'Full plate',
  detail: {
    kind: 'item',
    consumable: false,
    armor: { slot: 'armor', category: 'heavy', bonus: 9, armorCheckPenalty: 6 },
  },
  modifiers: [],
};
const build = (input: Parameters<typeof buildSheet>[0] = {}) =>
  buildSheet({
    levels: [cleric, fighter, laterCleric],
    classProficiencies: {
      fighter: [{ category: 'heavy' }, { category: 'martial' }],
      cleric: [{ category: 'simple' }, { choice: true }],
    },
    ...input,
  });

const page = () => (
  <CharacterSheetBlocks blocks={['levels', 'equipment', 'proficiencies']} />
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
const region = () => screen.getByRole('region', { name: 'Proficiencies' });
const button = (name: string | RegExp) =>
  within(region()).getByRole('button', { name });
const choiceInput = () =>
  within(region()).getByRole('textbox', {
    name: 'Weapon proficiency choice for Cleric',
  });
const typeInto = (input: HTMLElement, value: string) =>
  fireEvent.change(input, { target: { value } });
function lastCall() {
  const call = calls.at(-1);
  if (!call) throw new Error('Expected a write');
  return call;
}
const rowOf = (text: string) => {
  const row = within(region()).getByText(text).closest('li');
  if (!row) throw new Error(`Missing row ${text}`);
  return within(row);
};

test('grants keep their sources; a class choice is offered once, on its first Class Level, saved, revised and cleared there without any warning', async () => {
  const view = renderSheet(build());
  expect(within(region()).getByText('Heavy armor · Fighter')).toBeVisible();
  expect(within(region()).getByText('Simple weapons · Cleric')).toBeVisible();
  expect(
    within(region()).getAllByRole('textbox', { name: /proficiency choice/ }),
  ).toHaveLength(1);
  const levels = screen.getByRole('region', { name: 'Class Levels' });
  expect(
    within(levels).queryByRole('textbox', { name: /proficiency/i }),
  ).not.toBeInTheDocument();
  expect(choiceInput()).toHaveAccessibleDescription(
    'Not chosen yet. Type a weapon, such as longsword.',
  );
  expect(screen.queryByRole('button', { name: 'Accept' })).toBeNull();

  typeInto(choiceInput(), ' warhammer ');
  fireEvent.keyDown(choiceInput(), { key: 'Enter' });
  await waitFor(() => expect(calls).toHaveLength(1));
  expect(lastCall()).toMatchObject({
    name: 'editClassLevel',
    args: { entryId: 'cleric-1', proficiencyChoice: 'warhammer' },
  });
  view.show(
    build({
      levels: [
        { ...cleric, proficiencyChoice: 'warhammer' },
        fighter,
        laterCleric,
      ],
      lastOperationId: String(lastCall().args.operationId),
    }),
  );
  await act(async () => lastCall().resolve(null));
  expect(within(region()).getByText('warhammer · Cleric')).toBeVisible();
  expect(within(region()).getByText('Saved')).toBeVisible();

  typeInto(choiceInput(), '');
  await within(region()).findByRole('button', {
    name: 'Save choice for Cleric',
  });
  fireEvent.blur(choiceInput());
  await waitFor(() => expect(calls).toHaveLength(2));
  expect(lastCall().args).toMatchObject({
    entryId: 'cleric-1',
    proficiencyChoice: null,
  });
});

test('a granted selection choice is saved through its grant without creating a stored entry', async () => {
  const base = buildSheet({
    levels: [fighter],
    hasClasses: true,
    classProficiencies: { cleric: [{ choice: true }] },
  });
  const definition = base.catalogEntries.find(
    (entry) => entry._id === 'cleric',
  );
  if (!definition) throw new Error('Missing definition');
  const grantKey = { source: 'fighter', classLevel: 1, entry: 'favored' };
  const granted: CharacterSheetSnapshot = {
    ...base,
    calculated: {
      ...base.calculated,
      resolvedEntries: [
        ...base.calculated.resolvedEntries,
        {
          entry: {
            _id: 'derived-feat',
            kind: 'feat',
            active: true,
            catalogEntryId: definition._id,
            grantKey,
            state: { kind: 'feat' },
          },
          origin: 'grant',
          recorded: false,
          dormant: false,
          counting: true,
        },
      ],
      proficiencies: {
        ...base.calculated.proficiencies,
        missingChoices: [
          { entryId: 'derived-feat', kind: 'entry', name: 'Cleric' },
        ],
        choices: [{ entryId: 'derived-feat', name: 'Cleric', choice: null }],
      },
    },
  };
  renderSheet(granted);
  typeInto(choiceInput(), 'longsword');
  fireEvent.blur(choiceInput());
  await waitFor(() => expect(calls).toHaveLength(1));
  expect(lastCall()).toMatchObject({
    name: 'editGrantState',
    args: { grantKey, state: { choice: 'longsword' } },
  });
});

test('manual additions and removals read apart from grants; a removal wins numerically, Restore and Clear change only the manual change, and removing a grant records a removal', async () => {
  renderSheet(
    build({
      sheetEntries: [fullPlate],
      manualProficiencies: {
        added: [
          { baseType: 'dwarven waraxe', asMartial: true },
          { group: 'Bows' },
        ],
        removed: [{ category: 'heavy' }],
      },
    }),
  );
  const grant = within(region()).getByText('Heavy armor · Fighter');
  expect(grant).toHaveClass('line-through');
  expect(rowOf('Heavy armor').getByText('Manual removal')).toBeVisible();
  expect(
    rowOf('dwarven waraxe (treat as martial)').getByText(
      'Counts only with Martial weapons.',
    ),
  ).toBeVisible();
  expect(rowOf('Bows weapon group').getByText('Manual addition')).toBeVisible();
  expect(
    screen.getByText('Not proficient: Full plate −6 to attacks'),
  ).toBeVisible();

  fireEvent.click(button('Restore proficiency Heavy armor'));
  expect(lastCall()).toMatchObject({
    name: 'setManualProficiency',
    args: { proficiency: { category: 'heavy' }, disposition: 'none' },
  });
  expect(rowOf('Heavy armor').getByText('Saving…')).toBeVisible();

  fireEvent.click(button('Clear manual change Bows weapon group'));
  expect(
    within(region()).getByText(
      'Clear the manual addition of Bows weapon group?',
    ),
  ).toBeVisible();
  fireEvent.click(button('Remove Bows weapon group'));
  expect(lastCall().args).toMatchObject({
    proficiency: { group: 'Bows' },
    disposition: 'none',
  });

  fireEvent.click(button('Remove proficiency Martial weapons'));
  fireEvent.click(button('Keep Martial weapons'));
  expect(button('Remove proficiency Martial weapons')).toHaveFocus();
  fireEvent.click(button('Remove proficiency Martial weapons'));
  fireEvent.click(button('Remove Martial weapons'));
  expect(lastCall().args).toMatchObject({
    proficiency: { category: 'martial' },
    disposition: 'removed',
  });
  expect(calls).toHaveLength(3);
});

test('the manual form adds a weapon by name with familiarity, refuses a blank name without a write, and Remove proficiency records a category removal', async () => {
  renderSheet(build());
  fireEvent.click(button('Add proficiency'));
  const form = within(region()).getByRole('form', { name: 'Add proficiency' });
  expect(form).toHaveAttribute('novalidate');
  const radio = (name: string) => within(form).getByRole('radio', { name });
  expect(radio('Category')).toBeChecked();
  expect(radio('Simple weapons')).toBeChecked();
  expect(within(form).queryByRole('textbox')).toBeNull();

  fireEvent.click(radio('Weapon name'));
  fireEvent.submit(form);
  expect(await within(form).findByRole('alert')).toHaveTextContent(
    'Weapon name is required',
  );
  expect(calls).toEqual([]);
  typeInto(
    within(form).getByRole('textbox', { name: 'Weapon name' }),
    'Dwarven waraxe',
  );
  fireEvent.click(
    within(form).getByRole('checkbox', { name: 'Treat as martial' }),
  );
  fireEvent.submit(form);
  await waitFor(() => expect(calls).toHaveLength(1));
  expect(lastCall()).toMatchObject({
    name: 'setManualProficiency',
    args: {
      proficiency: { baseType: 'Dwarven waraxe', asMartial: true },
      disposition: 'added',
    },
  });
  fireEvent.click(radio('Weapon group'));
  expect(
    within(form).queryByRole('checkbox', { name: 'Treat as martial' }),
  ).toBeNull();
  await act(async () => lastCall().resolve(null));
  expect(within(form).getByText('Saved')).toBeVisible();
  fireEvent.click(
    within(form).getByRole('button', { name: /^(Cancel|Close)/ }),
  );
  expect(button('Add proficiency')).toHaveFocus();

  fireEvent.click(button('Remove proficiency'));
  const removal = within(region()).getByRole('form', {
    name: 'Remove proficiency',
  });
  await waitFor(() =>
    expect(
      within(removal).getByRole('radio', { name: 'Remove' }),
    ).toBeChecked(),
  );
  fireEvent.click(
    within(removal).getByRole('radio', { name: 'Tower shields' }),
  );
  fireEvent.submit(removal);
  await waitFor(() => expect(calls).toHaveLength(2));
  expect(lastCall().args).toMatchObject({
    proficiency: { category: 'towerShield' },
    disposition: 'removed',
  });
});

test('without grants the block says so and stays usable', () => {
  renderSheet(buildSheet());
  expect(
    within(region()).getByText('No proficiencies recorded.'),
  ).toBeVisible();
  expect(button('Add proficiency')).toBeEnabled();
});

test('maintenance disables the block controls with the reason stated once', () => {
  const message = 'Editing is paused for maintenance.';
  maintenance.mockReturnValue({ kind: 'maintenance', readOnly: true, message });
  renderSheet(
    build({
      manualProficiencies: { added: [], removed: [{ category: 'heavy' }] },
    }),
  );
  for (const name of [
    'Add proficiency',
    'Remove proficiency',
    'Restore proficiency Heavy armor',
  ])
    expect(button(name)).toBeDisabled();
  expect(choiceInput()).toBeDisabled();
  expect(within(region()).getAllByText(message)).toHaveLength(1);
});
