import { familiarBaseCreatureKeySchema } from '~/lib/catalog/representative-familiars';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import type { Id } from '@convex/_generated/dataModel';
import { ConvexError } from 'convex/values';
import type { ComponentProps } from 'react';
import { beforeEach, expect, test, vi } from 'vitest';
import type * as NavigationGuard from '~/components/campaign-shell/navigation-guard';
import type { MigrationMaintenance } from '~/components/use-initial-migration-maintenance';
import type {
  CompanionLinkedInput,
  CompanionLinkedInputResolution,
} from '~/lib/character-sheet-linked-inputs';
import { CharacterSheetBlocks } from './character-sheet-blocks-test-fixture';
import type { CompanionRelationship } from './character-companions-view-model';
import {
  buildSheet,
  calculateFixtureSheetProjections,
  emptyOwnerCandidates,
  representativeWeapon,
} from './character-sheet-test-fixture';
import type { CharacterSheetSnapshot } from './use-character-sheet';
import { characterSheetNames } from './character-sheet-api-test-fixture';
import type { FunctionReference } from 'convex/server';

// A familiar's own sheet (#326): its associated Character, its base creature
// as cards, the familiar rule values beside the ordinary sheet numbers, and
// Unresolved wherever a value the familiar borrows is missing.

type Call = {
  name: string;
  args: Record<string, unknown>;
  resolve: (value: unknown) => void;
  reject: (error: unknown) => void;
};
let calls: Call[] = [];
let snapshot: CharacterSheetSnapshot | null | undefined;
let relationships: CompanionRelationship[] | undefined;
const maintenance = vi.fn<() => MigrationMaintenance>();

vi.mock('~/components/use-initial-migration-maintenance', () => ({
  useInitialMigrationMaintenance: () => maintenance(),
}));
const nameOf = characterSheetNames();
vi.mock('convex/react', () => ({
  useQuery: (query: FunctionReference<'query'>, args: unknown) => {
    const name = nameOf(query);
    if (args === 'skip') return undefined;
    if (name === 'read') return snapshot;
    if (name === 'companions') return relationships;
    return undefined;
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
  async (importOriginal) => ({
    ...(await importOriginal<typeof NavigationGuard>()),
    GuardedLink: ({
      href,
      children,
      ...props
    }: ComponentProps<'a'> & { href: string }) => (
      <a href={href} {...props}>
        {children}
      </a>
    ),
  }),
);
vi.mock(
  '~/components/ui/select',
  () => import('../weekly-draft-workspace/native-select-test-double'),
);

const ready: MigrationMaintenance = {
  kind: 'ready',
  readOnly: false,
  message: '',
};
beforeEach(() => {
  calls = [];
  relationships = [association()];
  maintenance.mockReturnValue(ready);
});

function association(
  overrides: Partial<CompanionRelationship> = {},
): CompanionRelationship {
  return {
    relationshipId: 'bond' as Id<'companionRelationship'>,
    role: 'associated',
    kind: 'familiar',
    status: 'active',
    interruption: null,
    endpoint: { characterId: 'master' as Id<'character'>, name: 'Ama' },
    sources: [
      {
        key: 'witch',
        label: 'Witch’s Familiar',
        enabled: true,
        available: true,
      },
    ],
    linkedInputs: [],
    lastOperationId: 'seed',
    ...overrides,
  };
}

const linked = (
  input: CompanionLinkedInput,
  value: number,
): CompanionLinkedInputResolution => ({
  input,
  value,
  status: 'available',
  resolution: 'calculated',
  candidates: [],
  contributions: [],
  fallback: null,
  interpretation: null,
  fallbackState: 'none',
  prerequisiteStatus: 'resolved',
});

// The master's values: level 7 with five familiar-granting Class Levels,
// maximum HP 49 now (a temporary Constitution boost) and 41 permanently.
function masterInputs(maximumHp: number) {
  return [
    linked({ kind: 'characterLevel' }, 7),
    linked({ kind: 'familiarProgressionLevels' }, 5),
    linked({ kind: 'maximumHp' }, maximumHp),
    linked({ kind: 'baseAttackBonus' }, 3),
    linked({ kind: 'baseSave', save: 'fort' }, 2),
    linked({ kind: 'baseSave', save: 'ref' }, 2),
    linked({ kind: 'baseSave', save: 'will' }, 5),
  ];
}

// A familiar's sheet read, calculated by the public resolver from its own
// base creature and the master's values for each projection.
function familiarSheet({
  baseCreatureKey = 'cat',
  current = masterInputs(49),
  permanent = masterInputs(41),
  lastOperationId = 'seed',
  ...extras
}: {
  baseCreatureKey?: string | null;
  current?: CompanionLinkedInputResolution[];
  permanent?: CompanionLinkedInputResolution[];
  lastOperationId?: string;
} & Pick<
  Parameters<typeof buildSheet>[0] & object,
  'sheetEntries' | 'attackRoutines' | 'adjustments'
> = {}): CharacterSheetSnapshot {
  const sheet = buildSheet({
    name: 'Smudge',
    levels: [],
    lastOperationId,
    ...extras,
  });
  const parsedCreatureKey =
    familiarBaseCreatureKeySchema.safeParse(baseCreatureKey);
  const calculationCreatureKey = parsedCreatureKey.success
    ? parsedCreatureKey.data
    : null;
  const { current: calculated, permanent: permanentCalculated } =
    calculateFixtureSheetProjections(
      {
        entries: sheet.entries,
        catalogEntries: sheet.catalogEntries,
        characterKind: 'npc',
        ...(calculationCreatureKey
          ? { familiarBaseCreatureKey: calculationCreatureKey }
          : {}),
      },
      {
        projectionInputs: {
          current: {
            familiar: {
              baseCreatureKey: calculationCreatureKey,
              linkedInputs: current,
            },
          },
          permanent: {
            familiar: {
              baseCreatureKey: calculationCreatureKey,
              linkedInputs: permanent,
            },
          },
        },
      },
    );
  return {
    ...sheet,
    familiarRelationshipId: 'bond' as Id<'companionRelationship'>,
    character: {
      ...sheet.character,
      kind: 'npc',
      ...(baseCreatureKey ? { familiarBaseCreatureKey: baseCreatureKey } : {}),
    },
    calculated,
    permanentCalculated,
  } as CharacterSheetSnapshot;
}

type Block = ComponentProps<typeof CharacterSheetBlocks>['blocks'][number];
function renderSheet(
  sheet: CharacterSheetSnapshot | null | undefined = familiarSheet(),
  blocks: Block[] = ['summary', 'familiar'],
) {
  snapshot = sheet;
  const view = render(<CharacterSheetBlocks blocks={blocks} />);
  return {
    show: (next: CharacterSheetSnapshot | null | undefined) => {
      snapshot = next;
      view.rerender(<CharacterSheetBlocks blocks={blocks} />);
    },
  };
}
const familiar = () => within(screen.getByRole('region', { name: 'Familiar' }));
const statistic = (name: string) =>
  within(familiar().getByRole('group', { name }));
const card = (name: string) =>
  familiar().getByRole('button', { name: `${name} base creature` });
const lastCall = () => calls.at(-1);

test('the summary keeps Actual and Effective Hit Dice and progression level apart, and labels current and permanent half-master hit points', () => {
  renderSheet();
  expect(statistic('Actual Hit Dice').getByText('1')).toBeVisible();
  expect(statistic('Effective Hit Dice').getByText('7')).toBeVisible();
  expect(statistic('Familiar progression level').getByText('5')).toBeVisible();
  const hp = statistic('Hit points from master');
  expect(hp.getByText('Current')).toBeVisible();
  expect(hp.getByText('24')).toBeVisible();
  expect(hp.getByText('Permanent')).toBeVisible();
  expect(hp.getByText('20')).toBeVisible();
  expect(
    familiar().getByRole('group', { name: 'Hit points from master' }),
  ).toHaveAccessibleDescription(
    'Half the master’s maximum hit points, rounded down. Temporary hit points are excluded.',
  );
  expect(statistic('Actual Hit Dice').queryByText('Permanent')).toBeNull();
  // The militia count stays the actual Hit Dice.
  const summary = screen.getByText('Hit Dice', {
    selector: 'dt',
  }).parentElement!;
  expect(within(summary).getByText('1')).toBeVisible();
  expect(
    within(
      familiar().getByRole('list', { name: 'Special abilities' }),
    ).getByText('Speak with master'),
  ).toBeVisible();
  expect(familiar().getByRole('link', { name: 'Ama' })).toHaveAttribute(
    'href',
    '/characters/master',
  );
  expect(
    familiar().getByText('Representative base creatures: Cat, Raven and Toad.'),
  ).toBeVisible();
});

test('a creature card saves its own key once, shows Saving then Saved, keeps a refusal beside the cards and retries from the same card; Clear saves null', async () => {
  renderSheet(familiarSheet({ baseCreatureKey: null }));
  expect(familiar().getByText('Choose a base creature')).toBeVisible();
  expect(
    familiar().getByText(
      'Choose a base creature to calculate its familiar statistics.',
    ),
  ).toBeVisible();
  expect(
    familiar().queryByRole('button', { name: 'Clear base creature' }),
  ).toBeNull();
  for (const name of ['Cat', 'Raven', 'Toad']) {
    expect(card(name).tagName).toBe('BUTTON');
    expect(card(name)).toHaveAttribute('type', 'button');
    expect(card(name)).toHaveAttribute('aria-pressed', 'false');
  }

  fireEvent.click(card('Raven'));
  expect(calls).toHaveLength(1);
  expect(lastCall()).toMatchObject({
    name: 'selectFamiliarBaseCreature',
    args: { relationshipId: 'bond', baseCreatureKey: 'raven' },
  });
  expect(familiar().getByText('Saving…')).toBeVisible();
  expect(card('Raven')).toBeDisabled();
  fireEvent.click(card('Toad'));
  expect(calls).toHaveLength(1);
  // The read stays authoritative until the save lands.
  expect(card('Raven')).toHaveAttribute('aria-pressed', 'false');
  await act(async () => lastCall()!.resolve(null));
  expect(familiar().getByText('Saved')).toBeVisible();

  fireEvent.click(card('Toad'));
  await act(async () => lastCall()!.reject(new ConvexError('Not allowed')));
  expect(familiar().getByRole('alert')).toHaveTextContent(/Not allowed/);
  expect(card('Toad')).toBeEnabled();
  fireEvent.click(card('Toad'));
  expect(calls).toHaveLength(3);
  expect(lastCall()!.args).toMatchObject({ baseCreatureKey: 'toad' });
});

test('a saved creature is the one pressed card and can be cleared; an unknown saved key reads unavailable without becoming Cat', async () => {
  const view = renderSheet(familiarSheet({ baseCreatureKey: 'toad' }));
  expect(card('Toad')).toHaveAttribute('aria-pressed', 'true');
  expect(card('Cat')).toHaveAttribute('aria-pressed', 'false');
  expect(card('Raven')).toHaveAttribute('aria-pressed', 'false');
  fireEvent.click(
    familiar().getByRole('button', { name: 'Clear base creature' }),
  );
  expect(calls).toHaveLength(1);
  expect(lastCall()!.args).toMatchObject({ baseCreatureKey: null });
  await act(async () => lastCall()!.resolve(null));

  view.show(familiarSheet({ baseCreatureKey: 'owl' }));
  expect(familiar().getByText('Base creature unavailable')).toBeVisible();
  for (const name of ['Cat', 'Raven', 'Toad'])
    expect(card(name)).toHaveAttribute('aria-pressed', 'false');
  expect(
    familiar().getByRole('button', { name: 'Clear base creature' }),
  ).toBeEnabled();
});

test('missing creature and master values read Unresolved in the summary and the ordinary numbers, with the known breakdown marked partial; a valid zero stays a value', () => {
  const view = renderSheet(
    familiarSheet({
      current: [linked({ kind: 'baseAttackBonus' }, 0)],
      permanent: [linked({ kind: 'baseAttackBonus' }, 0)],
    }),
    ['summary', 'familiar', 'defenses', 'offense'],
  );
  expect(
    statistic('Hit points from master').getByText('Unresolved'),
  ).toBeVisible();
  expect(statistic('Effective Hit Dice').getByText('Unresolved')).toBeVisible();
  expect(
    statistic('Class-derived base attack bonus').getByText('0'),
  ).toBeVisible();
  expect(
    familiar().getByText(
      'Some familiar statistics need values from the associated Character.',
    ),
  ).toBeVisible();
  expect(
    familiar().queryByRole('list', { name: 'Special abilities' }),
  ).toBeNull();
  const hp = screen.getByRole('button', { name: 'HP Unresolved, breakdown' });
  expect(hp).toHaveTextContent('Unresolved');
  expect(
    screen.getByRole('button', {
      name: 'Fortitude save Unresolved, breakdown',
    }),
  ).toBeVisible();
  expect(
    screen.getByRole('button', { name: 'Armor Class Unresolved, breakdown' }),
  ).toBeVisible();
  expect(
    screen.getByRole('button', { name: 'Base attack bonus +0, breakdown' }),
  ).toBeVisible();
  expect(
    screen.getByRole('button', { name: /^Initiative [+-]\d+, breakdown$/ }),
  ).toBeVisible();
  fireEvent.click(hp);
  const breakdown = within(screen.getByRole('group', { name: 'HP breakdown' }));
  expect(breakdown.getByText('Known contributions (partial)')).toBeVisible();
  expect(
    breakdown.getByText(
      'Some familiar statistics need values from the associated Character.',
    ),
  ).toBeVisible();

  // Without a base creature its Hit Dice and size are unknown too.
  view.show(familiarSheet({ baseCreatureKey: null }));
  const summary = screen.getByText('Hit Dice', {
    selector: 'dt',
  }).parentElement!;
  expect(within(summary).getByText('Unresolved')).toBeVisible();
  expect(statistic('Actual Hit Dice').getByText('Unresolved')).toBeVisible();
  expect(
    screen.getByRole('button', { name: 'Touch AC Unresolved, breakdown' }),
  ).toBeVisible();
});

test('an unresolved familiar save has no Situation totals while resolved Initiative keeps its alternatives', () => {
  renderSheet(
    familiarSheet({
      current: [linked({ kind: 'baseAttackBonus' }, 0)],
      permanent: [linked({ kind: 'baseAttackBonus' }, 0)],
      adjustments: [
        {
          id: 'vigilance',
          name: 'Spell vigilance',
          modifiers: [
            {
              target: 'save.fort',
              bonusType: 'insight',
              value: 2,
              condition: { situation: 'spells' },
            },
            {
              target: 'init',
              bonusType: 'insight',
              value: 2,
              condition: { situation: 'spells' },
            },
          ],
        },
      ],
    }),
    ['situations', 'familiar', 'defenses', 'offense'],
  );
  const save = screen.getByRole('button', {
    name: 'Fortitude save Unresolved, breakdown',
  });
  expect(save).toBeVisible();
  expect(
    screen.queryByRole('button', { name: /^Fortitude save, / }),
  ).toBeNull();
  expect(
    screen.getByRole('button', {
      name: 'Initiative, vs. spells +2, breakdown',
    }),
  ).toBeVisible();

  fireEvent.click(screen.getByRole('button', { name: 'vs. spells' }));
  expect(
    screen.queryByRole('button', { name: /^Fortitude save, / }),
  ).toBeNull();
  expect(
    screen.getByRole('button', {
      name: 'Initiative, selected: vs. spells +2, breakdown',
    }),
  ).toBeVisible();
  fireEvent.click(save);
  const breakdown = within(
    screen.getByRole('group', { name: 'Fortitude save breakdown' }),
  );
  expect(breakdown.getByText('Known contributions (partial)')).toBeVisible();
  expect(breakdown.getByText('Selected Situations')).toBeVisible();
  expect(breakdown.getByText('Only when…')).toBeVisible();
  expect(breakdown.queryByText(/becomes/)).toBeNull();
});

test('skill totals without the master’s ranks and attack bonuses without its base attack read Unresolved; damage stays a number', () => {
  renderSheet(
    familiarSheet({
      sheetEntries: [representativeWeapon('longsword', 'sword')],
      attackRoutines: [{ id: 'claw', name: 'Claw', weaponEntryId: 'sword' }],
      current: [linked({ kind: 'characterLevel' }, 7)],
      permanent: [linked({ kind: 'characterLevel' }, 7)],
    }),
    ['skills', 'attacks'],
  );
  expect(
    screen.getByRole('button', { name: 'Perception Unresolved, breakdown' }),
  ).toBeVisible();
  expect(
    screen.getByRole('button', {
      name: 'Claw single attack: attack Unresolved, breakdown',
    }),
  ).toBeVisible();
  expect(
    screen.getByRole('button', {
      name: /^Claw single attack: damage 1d8/,
    }),
  ).not.toHaveAccessibleName(/Unresolved/);
});

test('interrupted and replaced history keeps the creature choice and its explanation; missing linked values stay Unresolved', () => {
  relationships = [association({ status: 'replaced' })];
  const view = renderSheet(
    familiarSheet({ baseCreatureKey: 'toad', current: [], permanent: [] }),
  );
  expect(familiar().getByText('Replaced')).toBeVisible();
  expect(
    familiar().getByText(
      'The former relationship and Character Sheet are retained.',
    ),
  ).toBeVisible();
  expect(card('Toad')).toHaveAttribute('aria-pressed', 'true');
  expect(card('Toad')).toBeEnabled();
  expect(
    statistic('Hit points from master').getByText('Unresolved'),
  ).toBeVisible();

  relationships = [association({ status: 'active' })];
  view.show(familiarSheet({ baseCreatureKey: 'toad' }));
  expect(familiar().getByText('Active')).toBeVisible();
  expect(card('Toad')).toHaveAttribute('aria-pressed', 'true');
  expect(statistic('Effective Hit Dice').getByText('7')).toBeVisible();
});

test('an inaccessible master discloses no name, link or source, and the familiar’s owner still chooses its creature; losing the sheet removes every control', () => {
  relationships = [
    association({ endpoint: null, status: undefined, sources: [] }),
  ];
  const view = renderSheet();
  expect(familiar().getByText('Character unavailable')).toBeVisible();
  expect(familiar().queryByRole('link')).toBeNull();
  const text = document.body.textContent ?? '';
  expect(text).not.toContain('Ama');
  expect(text).not.toContain('Witch’s Familiar');
  expect(document.body.innerHTML).not.toMatch(/characters\/master|bond/);
  fireEvent.click(card('Raven'));
  expect(lastCall()).toMatchObject({
    name: 'selectFamiliarBaseCreature',
    args: { baseCreatureKey: 'raven' },
  });

  view.show(null);
  expect(screen.queryByRole('region', { name: 'Familiar' })).toBeNull();
  expect(screen.queryByRole('button', { name: /base creature/ })).toBeNull();
});

test('loading shows no cards or numbers; maintenance disables edits with one stated reason; another player’s change is announced and dismissible', () => {
  relationships = undefined;
  const view = renderSheet();
  expect(familiar().getByRole('status')).toHaveTextContent('Loading familiar…');
  expect(familiar().queryAllByRole('button')).toHaveLength(0);
  expect(familiar().queryByRole('list')).toBeNull();

  relationships = [];
  view.show(familiarSheet());
  expect(screen.queryByRole('region', { name: 'Familiar' })).toBeNull();

  relationships = [association()];
  maintenance.mockReturnValue({
    kind: 'maintenance',
    readOnly: true,
    message: 'Character sheets are read-only during maintenance.',
  } as MigrationMaintenance);
  view.show(familiarSheet());
  for (const name of ['Cat', 'Raven', 'Toad']) {
    expect(card(name)).toBeDisabled();
    expect(card(name)).toHaveAccessibleDescription(
      'Character sheets are read-only during maintenance.',
    );
  }
  expect(
    familiar().getByRole('button', { name: 'Clear base creature' }),
  ).toBeDisabled();
  expect(
    familiar().getAllByText(
      'Character sheets are read-only during maintenance.',
    ),
  ).toHaveLength(1);

  maintenance.mockReturnValue(ready);
  view.show(
    familiarSheet({ baseCreatureKey: 'raven', lastOperationId: 'elsewhere' }),
  );
  expect(
    familiar().getByText('Familiar updated by another player.'),
  ).toBeVisible();
  fireEvent.click(
    familiar().getByRole('button', { name: 'Dismiss familiar update' }),
  );
  expect(
    familiar().queryByText('Familiar updated by another player.'),
  ).toBeNull();
  expect(card('Raven')).toHaveAttribute('aria-pressed', 'true');
});

test('cards, names and feedback stay inside their own containers at every width, with touch-sized controls', async () => {
  renderSheet();
  const group = familiar().getByRole('group', { name: 'Base creature' });
  expect(group).toHaveClass('grid', 'grid-cols-1', 'sm:grid-cols-3');
  for (const name of ['Cat', 'Raven', 'Toad']) {
    expect(card(name)).toHaveClass(
      'min-h-16',
      'w-full',
      'min-w-0',
      'whitespace-normal',
    );
  }
  expect(
    familiar().getByRole('button', { name: 'Clear base creature' }),
  ).toHaveClass('min-h-11', 'md:min-h-9');
  expect(
    familiar().getByRole('list', { name: 'Familiar statistics' }),
  ).toHaveClass('grid-cols-2', 'md:grid-cols-3', 'lg:grid-cols-5');
  fireEvent.click(card('Cat'));
  await act(async () => lastCall()!.reject(new ConvexError('Not allowed')));
  expect(familiar().getByRole('alert')).toHaveClass(
    'w-full',
    '[overflow-wrap:anywhere]',
  );
});
