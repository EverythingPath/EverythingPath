import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { ConvexError } from 'convex/values';
import type { FunctionReference } from 'convex/server';
import { beforeEach, expect, test, vi } from 'vitest';
import type { MigrationMaintenance } from '~/components/use-initial-migration-maintenance';
import { characterSheetNames } from './character-sheet-api-test-fixture';
import { CharacterSheetBlocks } from './character-sheet-blocks-test-fixture';
import { emptyOwnerCandidates } from './character-sheet-test-fixture';
import {
  buildCastingSheet,
  type CastingArchetype,
} from './casting-features-test-fixture';
import type { CharacterSheetSnapshot } from './use-character-sheet';

// Archetype casting conflicts (#422) in the Archetypes section: one row per
// property two published Archetypes change differently, chosen in place and
// saved per property, and the Spellcasting block waiting on the open
// choice. Every Archetype is a
// representative seed: Skirmisher (APG p. 128) against Dandy (UI p. 41) on
// a ranger, Eldritch Scion (ACG p. 104) with Mindblade (OA p. 121) on a
// magus, Seducer (LotFW p. 16) on a witch. Competing casting abilities have
// no published example, so their read-only line stays untested.

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
  snapshot = undefined;
  maintenance.mockReturnValue({ kind: 'ready', readOnly: false, message: '' });
});

const repeat = (identity: string, count: number) =>
  Array.from({ length: count }, () => identity);

const rangerSheet = (
  archetypes: CastingArchetype[],
  lastOperationId?: string,
) =>
  buildCastingSheet({
    levels: repeat('ranger', 8),
    scores: { wisdom: 12, charisma: 14 },
    archetypes,
    recorded: [
      { id: 'row-mage-armor', spell: 'mage-armor', castingClassId: 'ranger' },
    ],
    lastOperationId,
  });
const magusSheet = (archetypes: CastingArchetype[]) =>
  buildCastingSheet({
    levels: repeat('magus', 4),
    scores: { intelligence: 12, charisma: 16 },
    archetypes,
  });

function renderBlocks(initial: CharacterSheetSnapshot) {
  snapshot = initial;
  const ui = () => (
    <CharacterSheetBlocks blocks={['archetypes', 'spellcasting']} />
  );
  const view = render(ui());
  return {
    show(next: CharacterSheetSnapshot) {
      snapshot = next;
      view.rerender(ui());
    },
  };
}

const castingGroup = (className: string) =>
  within(
    within(screen.getByRole('group', { name: className })).getByRole('group', {
      name: 'Spellcasting',
    }),
  );
const choice = (label: string) =>
  screen.getByRole('radiogroup', { name: label });
const option = (label: string) => screen.getByRole('radio', { name: label });
const card = (name: string) => within(screen.getByRole('listitem', { name }));
const spellcastingBlock = () =>
  within(screen.getByRole('region', { name: 'Spellcasting' }));
const lastCall = () => {
  const call = calls.at(-1);
  if (!call) throw new Error('Expected a write');
  return call;
};

test('Skirmisher against Dandy leaves the ranger’s spellcasting to the player: an outlined row with no preselected option, the choice it asks for and no Accept, while the sheet line waits on it and keeps the recorded count', () => {
  renderBlocks(
    rangerSheet([{ key: 'ranger-skirmisher' }, { key: 'ranger-dandy' }]),
  );
  const group = castingGroup('Ranger');
  const presence = choice('Spellcasting for Ranger');
  expect(presence).toHaveClass('ring-2', 'ring-sky-400/80');
  expect(
    within(presence)
      .getAllByRole('radio')
      .map((radio) => radio.closest('label')?.textContent),
  ).toEqual(['Dandy: Keeps spellcasting', 'Skirmisher: Removes spellcasting']);
  for (const radio of within(presence).getAllByRole('radio'))
    expect(radio).not.toBeChecked();
  expect(option('Dandy: Keeps spellcasting').closest('label')).toHaveClass(
    'min-h-11',
    'md:min-h-9',
  );
  expect(presence).toHaveAccessibleDescription(
    'Choose which archetype’s spellcasting change applies to Ranger.',
  );
  expect(
    group.getByText(
      'Choose which archetype’s spellcasting change applies to Ranger.',
    ),
  ).toHaveClass('text-sky-300');
  expect(group.queryByRole('button', { name: /Accept/ })).toBeNull();
  // The conflict is chosen here, not warned about on each candidate's card;
  // the cards keep only their own feature conflict.
  for (const name of ['Skirmisher', 'Dandy']) {
    expect(
      card(name).queryByText(/spellcasting of Ranger differently/),
    ).toBeNull();
    expect(card(name).queryByText(/Choose which archetype/)).toBeNull();
  }
  expect(
    card('Skirmisher').getByRole('list', {
      name: 'Skirmisher spellcasting changes',
    }),
  ).toHaveTextContent('Removes spellcastingWaits for a choice');
  expect(
    card('Dandy').getByRole('list', { name: 'Dandy spellcasting changes' }),
  ).toHaveTextContent(
    'Casting ability: CharismaWaits for a choiceCasting table: Spontaneous low tableWaits for a choicePreparation: Spontaneous, spells knownWaits for a choiceSpell list: the Bard listWaits for a choice',
  );

  const block = spellcastingBlock();
  const line = within(
    block
      .getByRole('button', { name: 'View Ranger spellcasting' })
      .closest('li') as HTMLElement,
  );
  const waiting = line.getByRole('link', {
    name: 'Waiting for a spellcasting choice for Ranger, in Archetypes',
  });
  expect(waiting).toHaveAttribute('href', '#archetype-casting-ranger');
  expect(document.getElementById('archetype-casting-ranger')).toBe(
    presence.closest('[role=group]:not([role=radiogroup])'),
  );
  expect(line.getByText('Waiting for a choice')).toBeVisible();
  expect(line.queryByText('CL')).toBeNull();
  expect(line.queryByText('Per day')).toBeNull();
  expect(line.queryByText(/Not complete/)).toBeNull();
  expect(block.queryByText('Not under any Spellcasting')).toBeNull();
  expect(waiting).toHaveClass('min-h-11', 'md:min-h-9');
});

test('choosing an option saves that Archetype for that property at once, disables the row while saving, keeps a refusal beside it for retry, and a chosen row keeps its advisory warning with Accept', async () => {
  const view = renderBlocks(
    rangerSheet([{ key: 'ranger-skirmisher' }, { key: 'ranger-dandy' }]),
  );
  fireEvent.click(option('Dandy: Keeps spellcasting'));
  expect(calls.map((call) => [call.name, call.args])).toEqual([
    [
      'chooseArchetypeCasting',
      expect.objectContaining({
        entryId: 'ranger-dandy-row',
        property: 'presence',
      }),
    ],
  ]);
  expect(option('Dandy: Keeps spellcasting')).toBeDisabled();
  expect(option('Skirmisher: Removes spellcasting')).toBeDisabled();
  expect(castingGroup('Ranger').getByText('Saving…')).toHaveAttribute(
    'role',
    'status',
  );

  await act(async () =>
    lastCall().reject(new ConvexError('Character is read only')),
  );
  expect(castingGroup('Ranger').getByRole('alert')).toHaveTextContent(
    "Casting choice wasn't saved: Character is read only. Try again.",
  );
  expect(option('Dandy: Keeps spellcasting')).toBeEnabled();
  expect(option('Dandy: Keeps spellcasting')).not.toBeChecked();
  fireEvent.click(option('Dandy: Keeps spellcasting'));
  expect(calls).toHaveLength(2);
  view.show(
    rangerSheet(
      [
        { key: 'ranger-skirmisher' },
        { key: 'ranger-dandy', choices: ['presence'] },
      ],
      lastCall().args.operationId as string,
    ),
  );
  await act(async () => lastCall().resolve(null));
  expect(
    castingGroup('Ranger').getByText('Casting choice saved.'),
  ).toHaveAttribute('role', 'status');

  const presence = choice('Spellcasting for Ranger');
  expect(presence).not.toHaveClass('ring-sky-400/80');
  expect(option('Dandy: Keeps spellcasting')).toBeChecked();
  expect(
    castingGroup('Ranger').getByText(
      'Dandy and Skirmisher change the spellcasting of Ranger differently. All remain selected.',
    ),
  ).toBeVisible();
  expect(
    castingGroup('Ranger').queryByText(/Choose which archetype/),
  ).toBeNull();
  fireEvent.click(
    castingGroup('Ranger').getByRole('button', { name: 'Accept' }),
  );
  expect(lastCall()).toMatchObject({
    name: 'accept',
    args: {
      check: 'archetypeCastingConflict',
      subject: 'ranger:casting:presence',
    },
  });
  expect(
    calls.filter((call) => call.name === 'chooseArchetypeCasting'),
  ).toHaveLength(2);
  // Dandy's casting now applies: the sheet line reads its numbers.
  const line = within(
    spellcastingBlock()
      .getByRole('button', { name: 'View Ranger spellcasting' })
      .closest('li') as HTMLElement,
  );
  expect(line.getByText('Spells known')).toBeVisible();
  expect(line.getByText('CL')).toBeVisible();
  expect(
    line.queryByRole('link', { name: /Waiting for a spellcasting choice/ }),
  ).toBeNull();
  expect(
    card('Skirmisher').getByRole('list', {
      name: 'Skirmisher spellcasting changes',
    }),
  ).toHaveTextContent('Removes spellcastingNot applied');
  expect(
    card('Dandy').getByRole('list', { name: 'Dandy spellcasting changes' }),
  ).toHaveTextContent('Casting ability: CharismaCasting table');
  expect(card('Dandy').queryByText('Not applied')).toBeNull();
});

test('a removal that won keeps its row reachable so the player can switch back, while the sheet has no Spellcasting and the recorded Spell waits under no Spellcasting', () => {
  renderBlocks(
    rangerSheet([
      { key: 'ranger-skirmisher', choices: ['presence'] },
      { key: 'ranger-dandy' },
    ]),
  );
  expect(option('Skirmisher: Removes spellcasting')).toBeChecked();
  expect(option('Dandy: Keeps spellcasting')).toBeEnabled();
  expect(
    spellcastingBlock().getByText('Kesh has no Spellcasting.'),
  ).toBeVisible();
  expect(
    card('Dandy').getByRole('list', { name: 'Dandy spellcasting changes' }),
  ).toHaveTextContent('Casting ability: CharismaNot applied');
  fireEvent.click(option('Dandy: Keeps spellcasting'));
  expect(lastCall().args).toMatchObject({
    entryId: 'ranger-dandy-row',
    property: 'presence',
  });
});

test('Eldritch Scion with Mindblade asks nothing: Eldritch Scion’s Charisma and Mindblade’s psychic kind each apply alone, and both state the bard table they share', () => {
  renderBlocks(
    magusSheet([{ key: 'magus-eldritch-scion' }, { key: 'magus-mindblade' }]),
  );
  expect(screen.queryAllByRole('radiogroup')).toEqual([]);
  expect(screen.queryByText(/higher current modifier/)).toBeNull();
  expect(
    card('Eldritch Scion').getByRole('list', {
      name: 'Eldritch Scion spellcasting changes',
    }),
  ).toHaveTextContent(
    /^Casting ability: CharismaCasting table: Spontaneous medium tablePreparation: Spontaneous, spells known$/,
  );
  const mindblade = card('Mindblade').getByRole('list', {
    name: 'Mindblade spellcasting changes',
  });
  expect(mindblade).toHaveTextContent(
    /^Spell kind: PsychicCasting table: Spontaneous medium tablePreparation: Spontaneous, spells known$/,
  );
  expect(
    within(mindblade).getByText('Spell kind: Psychic').closest('li'),
  ).not.toHaveClass('text-muted-foreground');
});

test('Seducer alone changes the witch’s ability with nothing to choose: no Spellcasting rows, and the card states the applied change', () => {
  renderBlocks(
    buildCastingSheet({
      levels: repeat('witch', 3),
      archetypes: [{ key: 'witch-seducer' }],
    }),
  );
  expect(
    within(screen.getByRole('group', { name: 'Witch' })).queryByRole('group', {
      name: 'Spellcasting',
    }),
  ).toBeNull();
  expect(
    card('Seducer').getByRole('list', { name: 'Seducer spellcasting changes' }),
  ).toHaveTextContent(/^Casting ability: Charisma$/);
});

test('the choice rows stack their label over the options on the phone and sit beside them from the tablet, and a read-only sheet disables the options', () => {
  maintenance.mockReturnValue({
    kind: 'maintenance',
    readOnly: true,
    message: 'Read only for maintenance.',
  });
  renderBlocks(
    rangerSheet([{ key: 'ranger-skirmisher' }, { key: 'ranger-dandy' }]),
  );
  const row = choice('Spellcasting for Ranger').closest('li');
  expect(row).toHaveClass(
    'grid',
    'md:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]',
  );
  expect(choice('Spellcasting for Ranger')).toHaveClass(
    'flex-col',
    'sm:flex-row',
  );
  expect(option('Dandy: Keeps spellcasting')).toBeDisabled();
  fireEvent.click(option('Dandy: Keeps spellcasting'));
  expect(calls).toEqual([]);
});
