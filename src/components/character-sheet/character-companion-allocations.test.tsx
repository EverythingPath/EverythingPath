import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import type { FunctionReference } from 'convex/server';
import { ConvexError } from 'convex/values';
import type { ComponentProps } from 'react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import type * as NavigationGuard from '~/components/campaign-shell/navigation-guard';
import type { CompanionAllocationPoolRow } from './character-companion-allocations-view-model';
import { CharacterCompanions } from './character-companions';
import { characterSheetNames } from './character-sheet-api-test-fixture';
import { buildSheet } from './character-sheet-test-fixture';
import {
  useCharacterCompanions,
  type CompanionRelationship,
} from './use-character-companions';
import type { CharacterSheetSnapshot } from './use-character-sheet';

// The associated Character's divided budgets (#410): each companion's share
// of a Beast Master budget edited in place, over-budget shares kept with a
// warning, and a Boon Companion limit read without an editor.

const server = vi.hoisted(() => ({
  relationships: [] as unknown[] | undefined,
  pools: [] as unknown[] | undefined,
  write: vi.fn(),
  maintenance: { kind: 'ready', readOnly: false, message: '' },
}));
const nameOf = characterSheetNames({
  setSourceAllocation: api.companionRelationships.setSourceAllocation,
  setGroupPurchases: api.companionRelationships.setGroupPurchases,
});
vi.mock('convex/react', () => ({
  useQuery: (reference: FunctionReference<'query'>, args: unknown) => {
    if (args === 'skip') return undefined;
    const name = nameOf(reference);
    // Not a Synthesist: no Combined Form (#421).
    if (name === 'combinedForm') return null;
    if (name === 'companions') return server.relationships;
    if (name === 'companionRelationships:listAllocationPools')
      return server.pools;
    if (name === 'listCampaignCharacters') return [];
    if (name === 'listLinkedInputs') return [];
    throw new Error(`Unexpected query: ${name}`);
  },
  useMutation: (reference: FunctionReference<'mutation'>) => (args: unknown) =>
    server.write(nameOf(reference), args),
}));
vi.mock('~/components/use-initial-migration-maintenance', () => ({
  useInitialMigrationMaintenance: () => server.maintenance,
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

// Saria the Beast Master's two wolves, as her own sheet lists them.
const beastMasterSource = {
  key: 'beast-master',
  label: 'Beast Master',
  enabled: true,
  available: true,
  ruleKind: 'beastMasterCompanion',
} as const;
const fang = {
  relationshipId: 'rel-fang' as Id<'companionRelationship'>,
  role: 'companion',
  kind: 'animalCompanion',
  status: 'active',
  interruption: null,
  endpoint: { characterId: 'wolf' as Id<'character'>, name: 'Fang' },
  sources: [{ ...beastMasterSource, allocatedLevels: 2 }],
  linkedInputs: [],
  lastOperationId: 'seed',
} satisfies CompanionRelationship;
const claw = {
  ...fang,
  relationshipId: 'rel-claw' as Id<'companionRelationship'>,
  endpoint: { characterId: 'cat' as Id<'character'>, name: 'Claw' },
  sources: [beastMasterSource],
} satisfies CompanionRelationship;

type Member = Extract<
  CompanionAllocationPoolRow,
  { kind: 'allocation' }
>['members'][number];
const member = (
  relationshipId: string,
  levels: number | null,
  more: Partial<Member> = {},
): Member => ({
  relationshipId: relationshipId as Id<'companionRelationship'>,
  sourceKey: 'beast-master',
  levels,
  counting: true,
  companion: { characterId: 'wolf' as Id<'character'>, name: 'Fang' },
  lastOperationId: 'seed',
  ...more,
});
const clawCompanion = { characterId: 'cat' as Id<'character'>, name: 'Claw' };
const fangShare = member('rel-fang', 2);
const clawShare = member('rel-claw', null, { companion: clawCompanion });
const beastMaster = {
  kind: 'allocation',
  ruleKind: 'beastMasterCompanion',
  label: 'Beast Master',
  classRuleIdentity: 'ranger',
  classLevels: 7,
  budget: 4,
  allocated: 2,
  remaining: 2,
  overBudget: false,
  restriction:
    'Beast Master divides its effective druid level among its animal companions and may choose any animal companion a druid can.',
  sources: [
    {
      book: 'Pathfinder RPG Advanced Player’s Guide',
      pages: '124',
      url: 'https://legacy.aonprd.com/advancedPlayersGuide/coreClasses/ranger.html#beast-master',
    },
  ],
  members: [fangShare, clawShare],
} satisfies CompanionAllocationPoolRow;
const overBudget = {
  ...beastMaster,
  allocated: 6,
  remaining: -2,
  overBudget: true,
  members: [
    member('rel-fang', 4),
    member('rel-claw', 2, { companion: clawCompanion }),
  ],
} satisfies CompanionAllocationPoolRow;
const boonCompanion = {
  kind: 'increase',
  ruleKind: 'boonCompanion',
  label: 'Boon Companion',
  budget: 1,
  allocated: 2,
  overBudget: true,
  restriction:
    'Boon Companion adds four effective levels to one companion that another source supports, to at most the associated Character’s level.',
  sources: [
    {
      book: 'Pathfinder Roleplaying Game: Animal Archive',
      pages: '8',
      url: 'https://aonprd.com/FeatDisplay.aspx?ItemName=Boon%20Companion',
    },
  ],
  members: [
    member('rel-fang', null, { sourceKey: 'boon' }),
    member('rel-claw', null, { companion: clawCompanion, sourceKey: 'boon' }),
  ].map(({ levels: _levels, ...rest }) => rest),
} satisfies CompanionAllocationPoolRow;

beforeEach(() => {
  server.relationships = [fang, claw];
  server.pools = [beastMaster];
  server.maintenance = { kind: 'ready', readOnly: false, message: '' };
  server.write.mockReset().mockResolvedValue(null);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

const warningControls = {
  accept: vi.fn(),
  reopen: vi.fn(),
  statusFor: () => ({ kind: 'idle' as const }),
  hasRemoteChange: false,
  dismissRemoteChange: vi.fn(),
};
function Host({ snapshot }: { snapshot: CharacterSheetSnapshot }) {
  const controller = useCharacterCompanions(
    { characterId: snapshot.character._id },
    snapshot,
  );
  return (
    <main>
      <CharacterCompanions
        controller={controller}
        warningController={warningControls}
        characterId={snapshot.character._id}
      />
    </main>
  );
}
function renderSheet() {
  const snapshot = buildSheet();
  const view = render(<Host snapshot={snapshot} />);
  return { rerender: () => view.rerender(<Host snapshot={snapshot} />) };
}
const budget = (name = 'Beast Master') => screen.getByRole('region', { name });
const table = (name = 'Beast Master') =>
  within(budget(name)).getByRole('table', { name: `${name} companions` });
const row = (name: string | RegExp) =>
  within(table()).getByRole('row', { name });
const button = (name: string | RegExp) => screen.getByRole('button', { name });
const field = () =>
  screen.getByRole('textbox', { name: "Claw's Beast Master share" });
const editor = () =>
  screen.queryByRole('form', { name: "Edit Claw's Beast Master share" });
const lastCall = () => server.write.mock.calls.at(-1);
const saveCall = (relationshipId: string, levels: number | null) => [
  'setSourceAllocation',
  {
    relationshipId,
    sourceKey: 'beast-master',
    levels,
    operationId: expect.any(String),
  },
];

test('a Beast Master budget shows where it comes from, its totals, every share and the rule; an unallocated share opens prefilled with the remainder and saves the typed whole number', async () => {
  renderSheet();
  expect(within(budget()).getByText('Ranger 7')).toBeVisible();
  expect(within(budget()).getByText('4 effective levels')).toBeVisible();
  expect(within(budget()).getByText('2 allocated')).toBeVisible();
  expect(within(budget()).getByText('2 unallocated')).toBeVisible();
  expect(within(budget()).queryByRole('img')).toBeNull();
  expect(
    within(budget()).getByRole('list', { name: 'Rules' }),
  ).toHaveTextContent('Pathfinder RPG Advanced Player’s Guide, p. 124');
  expect(
    within(budget()).getByText(/divides its effective druid level/),
  ).toBeVisible();
  expect(
    within(row(/Fang/)).getByRole('link', { name: 'Fang' }),
  ).toHaveAttribute('href', '/characters/wolf');
  expect(row(/Fang/)).toHaveTextContent('2 levels');
  expect(row(/Claw/)).toHaveTextContent('Not allocated');
  expect(
    screen.queryByRole('button', { name: "Clear Claw's Beast Master share" }),
  ).toBeNull();

  fireEvent.click(button("Edit Claw's Beast Master share"));
  expect(editor()).toHaveAttribute('novalidate');
  expect(field()).toHaveFocus();
  expect(field()).toHaveValue('2');
  expect(field()).toHaveAttribute('inputmode', 'numeric');
  fireEvent.change(field(), { target: { value: '3' } });
  fireEvent.click(button("Save Claw's Beast Master share"));
  await waitFor(() => expect(server.write).toHaveBeenCalledTimes(1));
  expect(lastCall()).toEqual(saveCall('rel-claw', 3));
  await waitFor(() => expect(editor()).toBeNull());
  expect(button("Edit Claw's Beast Master share")).toHaveFocus();
  expect(within(row(/Claw/)).getByRole('status')).toHaveTextContent('Saved');
});

test('empty and malformed shares stop the save with their own messages in the field; Escape and Cancel close without writing and return focus', async () => {
  renderSheet();
  fireEvent.click(button("Edit Claw's Beast Master share"));
  fireEvent.change(field(), { target: { value: '' } });
  fireEvent.click(button("Save Claw's Beast Master share"));
  await waitFor(() =>
    expect(field()).toHaveAccessibleDescription(
      'Enter the effective levels to allocate.',
    ),
  );
  expect(field()).toHaveAttribute('aria-invalid', 'true');
  for (const typed of ['1.5', 'four', '21']) {
    fireEvent.change(field(), { target: { value: typed } });
    fireEvent.click(button("Save Claw's Beast Master share"));
    await waitFor(() =>
      expect(field()).toHaveAccessibleDescription(
        'Enter a whole number from 0 to 20.',
      ),
    );
  }
  expect(server.write).not.toHaveBeenCalled();
  expect(within(row(/Claw/)).getByRole('alert')).toBeVisible();
  expect(within(row(/Claw/)).getByRole('rowheader')).toHaveTextContent('Claw');

  fireEvent.keyDown(field(), { key: 'Escape' });
  expect(editor()).toBeNull();
  expect(button("Edit Claw's Beast Master share")).toHaveFocus();
  fireEvent.click(button("Edit Claw's Beast Master share"));
  fireEvent.click(button("Cancel editing Claw's Beast Master share"));
  expect(editor()).toBeNull();
  expect(button("Edit Claw's Beast Master share")).toHaveFocus();
  expect(server.write).not.toHaveBeenCalled();
});

test('shares above the budget stay listed and editable beside an amber warning that goes away once the budget covers them again', () => {
  server.pools = [overBudget];
  const view = renderSheet();
  const warning = within(budget()).getByText(
    'Allocations total 6 effective levels, above the Beast Master budget of 4. Every recorded allocation is kept; change one yourself if needed.',
  );
  expect(warning).toBeVisible();
  expect(warning.parentElement).toHaveClass('text-amber-300');
  expect(within(budget()).getByText('6 allocated')).toHaveClass(
    'text-amber-300',
  );
  expect(within(budget()).getByText('2 over budget')).toBeVisible();
  expect(row(/Fang/)).toHaveTextContent('4 levels');
  expect(row(/Claw/)).toHaveTextContent('2 levels');
  expect(button("Edit Fang's Beast Master share")).toBeEnabled();
  expect(button("Edit Claw's Beast Master share")).toBeEnabled();
  expect(button("Clear Claw's Beast Master share")).toBeEnabled();

  server.pools = [
    { ...overBudget, budget: 7, remaining: 1, overBudget: false },
  ];
  view.rerender();
  expect(
    within(budget()).queryByText(/above the Beast Master budget/),
  ).toBeNull();
  expect(within(budget()).getByText('7 effective levels')).toBeVisible();
  expect(within(budget()).getByText('6 allocated')).not.toHaveClass(
    'text-amber-300',
  );
  expect(server.write).not.toHaveBeenCalled();
});

test('an unresolved budget says so without a number and keeps every share editable', () => {
  server.pools = [
    {
      ...beastMaster,
      classLevels: null,
      budget: null,
      remaining: null,
    },
  ];
  renderSheet();
  expect(within(budget()).getByText('Ranger level unavailable')).toBeVisible();
  expect(within(budget()).getByText('Unresolved')).toBeVisible();
  expect(within(budget()).getByText('2 allocated')).toBeVisible();
  expect(within(budget()).queryByText(/unallocated|over budget/)).toBeNull();
  expect(row(/Fang/)).toHaveTextContent('2 levels');
  expect(button("Edit Fang's Beast Master share")).toBeEnabled();
});

test('Clear removes a recorded share; a share kept while not counting says so and stays editable', async () => {
  server.pools = [
    {
      ...beastMaster,
      members: [
        fangShare,
        member('rel-claw', 1, { companion: clawCompanion, counting: false }),
      ],
    },
  ];
  renderSheet();
  fireEvent.click(button("Clear Fang's Beast Master share"));
  await waitFor(() => expect(server.write).toHaveBeenCalledTimes(1));
  expect(lastCall()).toEqual(saveCall('rel-fang', null));
  await waitFor(() =>
    expect(within(row(/Fang/)).getByRole('status')).toHaveTextContent('Saved'),
  );
  const resting = row(/Claw/);
  expect(resting).toHaveTextContent('1 level');
  expect(
    within(resting).getByText(
      'Not counting while its support or relationship is inactive; its allocation is kept.',
    ),
  ).toBeVisible();
  expect(button("Edit Claw's Beast Master share")).toBeEnabled();
  expect(button("Clear Claw's Beast Master share")).toBeEnabled();
});

test('a refused save keeps the draft open with its reason beside the field', async () => {
  renderSheet();
  fireEvent.click(button("Edit Claw's Beast Master share"));
  fireEvent.change(field(), { target: { value: '3' } });
  server.write.mockRejectedValueOnce(new ConvexError('Not allowed'));
  fireEvent.click(button("Save Claw's Beast Master share"));
  await waitFor(() =>
    expect(within(row(/Claw/)).getByRole('alert')).toHaveTextContent(
      "Companion allocation wasn't saved: Not allowed. Try again.",
    ),
  );
  expect(editor()).toBeVisible();
  expect(field()).toHaveValue('3');
  expect(server.write).toHaveBeenCalledTimes(1);
});

test("another player's share is announced once and dismissed while the open draft keeps what was typed", () => {
  const view = renderSheet();
  fireEvent.click(button("Edit Claw's Beast Master share"));
  fireEvent.change(field(), { target: { value: '3' } });
  server.pools = [
    {
      ...beastMaster,
      allocated: 1,
      remaining: 3,
      members: [
        member('rel-fang', 1, { lastOperationId: 'other-player' }),
        clawShare,
      ],
    },
  ];
  view.rerender();
  const notice =
    'Companion allocations updated by another player. Your edits are kept.';
  expect(screen.getAllByText(notice)).toHaveLength(1);
  expect(row(/Fang/)).toHaveTextContent('1 level');
  expect(field()).toHaveValue('3');
  fireEvent.click(button('Dismiss companion allocations update'));
  expect(screen.queryByText(notice)).toBeNull();
  expect(field()).toHaveValue('3');
  expect(server.write).not.toHaveBeenCalled();
});

test('maintenance disables Edit and Clear with the one reason while the budget and shares stay readable', () => {
  const message = 'Editing is paused for maintenance.';
  server.maintenance = { kind: 'maintenance', readOnly: true, message };
  renderSheet();
  for (const name of [
    "Edit Fang's Beast Master share",
    "Clear Fang's Beast Master share",
    "Edit Claw's Beast Master share",
  ]) {
    expect(button(name)).toBeDisabled();
    expect(button(name)).toHaveAccessibleDescription(message);
  }
  expect(screen.getAllByText(message)).toHaveLength(1);
  expect(within(budget()).getByText('Ranger 7')).toBeVisible();
  expect(row(/Fang/)).toHaveTextContent('2 levels');
  expect(screen.queryByRole('form')).toBeNull();
});

test('an inaccessible companion reads only as unavailable, with no link, but its share belongs to this budget and stays editable', () => {
  server.relationships = [fang, { ...claw, endpoint: null }];
  server.pools = [
    {
      ...beastMaster,
      members: [fangShare, member('rel-claw', 2, { companion: null })],
    },
  ];
  renderSheet();
  const hidden = row(/Character unavailable/);
  expect(within(hidden).queryByRole('link')).toBeNull();
  expect(hidden).toHaveTextContent('2 levels');
  expect(
    within(hidden).getByRole('button', {
      name: "Edit Character unavailable's Beast Master share",
    }),
  ).toBeEnabled();
  expect(document.body.textContent).not.toContain('Claw');
  expect(document.body.innerHTML).not.toMatch(/rel-claw|"cat"/);
});

test('Boon Companion reads as one companion per selection with its warning and offers no editor; no budget means no block', () => {
  server.pools = [beastMaster, boonCompanion];
  const view = renderSheet();
  const boon = budget('Boon Companion');
  expect(within(boon).getByText('1 selection')).toBeVisible();
  expect(within(boon).getByText('One companion each')).toBeVisible();
  expect(within(boon).getByText('Supports 2 companions')).toHaveClass(
    'text-amber-300',
  );
  expect(
    within(boon).getByText(
      'Boon Companion applies to one companion per selection but supports 2 on 1 selection. Each keeps the benefit until you remove a source.',
    ),
  ).toBeVisible();
  expect(within(boon).queryByRole('button')).toBeNull();
  expect(
    within(boon).queryByRole('columnheader', { name: 'Share' }),
  ).toBeNull();
  expect(
    within(boon).getByRole('table', { name: 'Boon Companion companions' }),
  ).toHaveTextContent('Fang');
  expect(within(boon).getByRole('list', { name: 'Rules' })).toHaveTextContent(
    'Pathfinder Roleplaying Game: Animal Archive, p. 8',
  );

  server.pools = [];
  view.rerender();
  expect(screen.queryByRole('region', { name: 'Beast Master' })).toBeNull();
  expect(screen.queryByRole('region', { name: 'Boon Companion' })).toBeNull();
  expect(screen.getByRole('region', { name: 'Companions' })).toBeVisible();
});

// Phone below 768px, tablet above.
function stubViewport(isWide: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query.includes('prefers-reduced-motion') || isWide,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
}

test.each([
  { isWide: false, label: 'phone' },
  { isWide: true, label: 'tablet' },
])(
  'on the $label each share control is named once and touch-sized, and the rows stack as cards below 768px',
  ({ isWide }) => {
    stubViewport(isWide);
    renderSheet();
    for (const name of [
      "Edit Fang's Beast Master share",
      "Clear Fang's Beast Master share",
      "Edit Claw's Beast Master share",
    ]) {
      expect(screen.getAllByRole('button', { name })).toHaveLength(1);
      expect(button(name)).toHaveClass('min-h-11', 'md:min-h-9');
    }
    expect(table()).toHaveClass('max-md:block');
    expect(row(/Fang/)).toHaveClass('max-md:block', 'max-md:border');
    fireEvent.click(button("Edit Claw's Beast Master share"));
    expect(field()).toHaveClass('h-11', 'md:h-8');
    expect(button("Save Claw's Beast Master share")).toHaveClass('min-h-11');
  },
);

// Mira the Broodmaster's brood of two Small eidolons at summoner level 2
// (#419, UM p. 78): the published example, one eidolon with the feat.
const broodSource = {
  key: 'brood',
  label: 'Broodmaster',
  enabled: true,
  available: true,
  ruleKind: 'broodmasterEidolon',
} as const;
const brute = {
  ...fang,
  relationshipId: 'rel-brute' as Id<'companionRelationship'>,
  kind: 'eidolon',
  endpoint: { characterId: 'brute' as Id<'character'>, name: 'Brute' },
  sources: [broodSource],
} satisfies CompanionRelationship;
const skitter = {
  ...brute,
  relationshipId: 'rel-skitter' as Id<'companionRelationship'>,
  endpoint: { characterId: 'skitter' as Id<'character'>, name: 'Skitter' },
} satisfies CompanionRelationship;
type BroodMember = Extract<
  CompanionAllocationPoolRow,
  { kind: 'component' }
>['members'][number];
type Components = NonNullable<BroodMember['components']>;
const bruteShare = {
  hitDice: 1,
  skillRanks: 4,
  feats: 1,
  armorBonus: 1,
  strengthBonus: 1,
  dexterityBonus: 0,
  evolutionPoints: 2,
  maxAttacks: 2,
} satisfies Components;
const eidolon = (
  relationshipId: string,
  name: string,
  components: Components | null,
  more: Partial<BroodMember> = {},
): BroodMember => ({
  relationshipId: relationshipId as Id<'companionRelationship'>,
  sourceKey: 'brood',
  components,
  counting: true,
  companion: { characterId: name.toLowerCase() as Id<'character'>, name },
  lastOperationId: 'seed',
  ...more,
});
const broodmaster = {
  kind: 'component',
  ruleKind: 'broodmasterEidolon',
  label: 'Broodmaster',
  classRuleIdentity: 'summoner',
  classLevels: 2,
  budget: {
    hitDice: 2,
    skillRanks: 8,
    feats: 1,
    armorBonus: 2,
    strengthBonus: 1,
    dexterityBonus: 1,
    evolutionPoints: 3,
    maxAttacks: 3,
  },
  allocated: bruteShare,
  remaining: {
    hitDice: 1,
    skillRanks: 4,
    feats: 0,
    armorBonus: 1,
    strengthBonus: 0,
    dexterityBonus: 1,
    evolutionPoints: 1,
    maxAttacks: 1,
  },
  overBudget: false,
  overBudgetComponents: [],
  groupPurchases: [],
  capacity: { allowed: 2, used: 2 },
  restriction:
    'Broodmaster eidolons share the summoner level’s base attack bonus and saves; Hit Dice (at least 1 each), skill ranks, feats, armor bonus, Strength and Dexterity bonuses, evolution points and maximum natural attacks are divided among the brood. Each eidolon buys its own evolutions.',
  sources: [
    {
      book: 'Pathfinder RPG Ultimate Magic',
      pages: '78',
      url: 'https://legacy.aonprd.com/ultimateMagic/classArchetypes/summoner.html#broodmaster',
    },
    {
      book: 'Pathfinder RPG Advanced Player’s Guide',
      pages: '58–63',
      url: 'https://legacy.aonprd.com/advancedPlayersGuide/baseClasses/summoner.html#eidolons',
    },
  ],
  members: [
    eidolon('rel-brute', 'Brute', bruteShare),
    eidolon('rel-skitter', 'Skitter', null),
  ],
} satisfies CompanionAllocationPoolRow;
const largeBought = {
  key: 'large',
  label: 'Large evolution',
  cost: 4,
  minimumLevel: 8,
  issues: ['Requires summoner level 8.'],
} as const;

function renderBrood(pool: CompanionAllocationPoolRow = broodmaster) {
  server.relationships = [brute, skitter];
  server.pools = [pool];
  return renderSheet();
}
const brood = () => budget('Broodmaster');
const components = () =>
  within(brood()).getByRole('table', { name: 'Broodmaster components' });
const componentRow = (name: RegExp) =>
  within(components()).getByRole('row', { name });
const cells = (element: HTMLElement) =>
  within(element)
    .getAllByRole('cell')
    .map((cell) => cell.textContent);
const eidolonRow = (name: string | RegExp) =>
  within(table('Broodmaster')).getByRole('row', { name });
const checkbox = (name: string) => screen.getByRole('checkbox', { name });
const componentEditor = (name: string) =>
  screen.queryByRole('form', { name: `Edit ${name}'s Broodmaster share` });
const componentField = (name: string) => screen.getByRole('textbox', { name });
const componentsCall = (relationshipId: string, value: Components | null) => [
  'setSourceAllocation',
  {
    relationshipId,
    sourceKey: 'brood',
    components: value,
    operationId: expect.any(String),
  },
];

test('a Broodmaster budget shows its summoner level, Hit Dice and places, each component against the budget, the brood’s purchases and every eidolon’s shares; an unallocated eidolon opens prefilled with what is left and saves all eight together', async () => {
  renderBrood();
  expect(within(brood()).getByText('Summoner 2')).toBeVisible();
  expect(within(brood()).getByText('2 Hit Dice to divide')).toBeVisible();
  expect(within(brood()).getByText('1 allocated')).toBeVisible();
  expect(within(brood()).getByText('1 unallocated')).toBeVisible();
  expect(within(brood()).getByText('2 of 2 Small-eidolon places')).toHaveClass(
    'text-muted-foreground',
  );
  expect(within(brood()).queryByRole('img')).toBeNull();
  expect(within(brood()).getByText(/share the summoner level’s/)).toBeVisible();
  expect(
    within(brood()).getByRole('list', { name: 'Rules' }),
  ).toHaveTextContent(
    'Pathfinder RPG Ultimate Magic, p. 78Pathfinder RPG Advanced Player’s Guide, p. 58–63',
  );
  expect(
    within(components())
      .getAllByRole('rowheader')
      .map((cell) => cell.textContent),
  ).toEqual([
    'Hit Dice',
    'skill ranks',
    'feats',
    'armor bonus',
    'Strength bonus',
    'Dexterity bonus',
    'evolution points',
    'maximum natural attacks',
  ]);
  expect(cells(componentRow(/^evolution points/))).toEqual([
    'Budget3',
    'Allocated2',
    'Remaining1',
  ]);
  expect(componentRow(/^feats/)).not.toHaveClass('text-amber-300');

  const purchases = within(brood()).getByRole('list', {
    name: 'Group purchases',
  });
  expect(checkbox('Buy the large evolution for the brood')).not.toBeChecked();
  expect(checkbox('Buy the huge evolution for the brood')).not.toBeChecked();
  expect(within(purchases).getByText('4 points')).toBeVisible();
  expect(within(purchases).getByText('Summoner level 8')).toBeVisible();
  expect(within(purchases).getByText('6 points')).toBeVisible();
  expect(within(purchases).getByText('Summoner level 13')).toBeVisible();
  expect(within(purchases).queryByText(/Requires/)).toBeNull();

  expect(
    within(eidolonRow(/Brute/)).getByRole('link', { name: 'Brute' }),
  ).toHaveAttribute('href', '/characters/brute');
  expect(eidolonRow(/Brute/)).toHaveTextContent(
    'Hit Dice 1, skill ranks 4, feats 1, armor bonus 1, Strength bonus 1, Dexterity bonus 0, evolution points 2, maximum natural attacks 2',
  );
  expect(within(eidolonRow(/Brute/)).queryByText(/^Allocate/)).toBeNull();
  expect(eidolonRow(/Skitter/)).toHaveTextContent('Not allocated');
  expect(within(eidolonRow(/Skitter/)).getByText('Not allocated')).toHaveClass(
    'ring-sky-400/80',
  );
  expect(
    within(eidolonRow(/Skitter/)).getByText(
      'Allocate Hit Dice, skill ranks, feats, armor bonus, Strength bonus, Dexterity bonus, evolution points, maximum natural attacks.',
    ),
  ).toHaveClass('text-sky-300');
  expect(
    screen.queryByRole('button', { name: "Clear Skitter's Broodmaster share" }),
  ).toBeNull();

  fireEvent.click(button("Edit Skitter's Broodmaster share"));
  expect(componentEditor('Skitter')).toHaveAttribute('novalidate');
  expect(componentField('Hit Dice')).toHaveFocus();
  expect(componentField('Hit Dice')).toHaveValue('1');
  expect(componentField('Hit Dice')).toHaveAttribute('inputmode', 'numeric');
  expect(componentField('skill ranks')).toHaveValue('4');
  expect(componentField('feats')).toHaveValue('');
  expect(componentField('Strength bonus')).toHaveValue('');
  expect(componentField('evolution points')).toHaveValue('1');
  fireEvent.change(componentField('feats'), { target: { value: '0' } });
  fireEvent.change(componentField('Strength bonus'), {
    target: { value: '0' },
  });
  fireEvent.click(button("Save Skitter's Broodmaster share"));
  await waitFor(() => expect(server.write).toHaveBeenCalledTimes(1));
  expect(lastCall()).toEqual(
    componentsCall('rel-skitter', {
      hitDice: 1,
      skillRanks: 4,
      feats: 0,
      armorBonus: 1,
      strengthBonus: 0,
      dexterityBonus: 1,
      evolutionPoints: 1,
      maxAttacks: 1,
    }),
  );
  await waitFor(() => expect(componentEditor('Skitter')).toBeNull());
  expect(button("Edit Skitter's Broodmaster share")).toHaveFocus();
  expect(within(eidolonRow(/Skitter/)).getByRole('status')).toHaveTextContent(
    'Saved',
  );
});

test('an empty or malformed component stops the save with its own message in its field while the others stay valid; Escape and Cancel close without writing and return focus', async () => {
  renderBrood();
  fireEvent.click(button("Edit Brute's Broodmaster share"));
  fireEvent.change(componentField('skill ranks'), { target: { value: '' } });
  fireEvent.change(componentField('maximum natural attacks'), {
    target: { value: '100' },
  });
  fireEvent.change(componentField('armor bonus'), { target: { value: '1.5' } });
  fireEvent.click(button("Save Brute's Broodmaster share"));
  await waitFor(() =>
    expect(componentField('skill ranks')).toHaveAccessibleDescription(
      'Enter the skill ranks to allocate.',
    ),
  );
  expect(componentField('skill ranks')).toHaveAttribute('aria-invalid', 'true');
  expect(componentField('maximum natural attacks')).toHaveAccessibleDescription(
    'Enter a whole number from 0 to 99.',
  );
  expect(componentField('armor bonus')).toHaveAccessibleDescription(
    'Enter a whole number from 0 to 99.',
  );
  expect(componentField('Hit Dice')).not.toHaveAttribute(
    'aria-invalid',
    'true',
  );
  expect(within(eidolonRow(/Brute/)).getAllByRole('alert')).toHaveLength(3);
  expect(within(eidolonRow(/Brute/)).getByRole('rowheader')).toHaveTextContent(
    'Brute',
  );
  expect(server.write).not.toHaveBeenCalled();

  fireEvent.keyDown(componentField('Hit Dice'), { key: 'Escape' });
  expect(componentEditor('Brute')).toBeNull();
  expect(button("Edit Brute's Broodmaster share")).toHaveFocus();
  fireEvent.click(button("Edit Brute's Broodmaster share"));
  expect(componentField('Hit Dice')).toHaveValue('1');
  fireEvent.click(button("Cancel editing Brute's Broodmaster share"));
  expect(componentEditor('Brute')).toBeNull();
  expect(button("Edit Brute's Broodmaster share")).toHaveFocus();
  expect(server.write).not.toHaveBeenCalled();
});

test('buying a group purchase records it once for the whole brood; one bought early is kept with its issue in amber and more places, and unticking removes it', async () => {
  const view = renderBrood();
  fireEvent.click(checkbox('Buy the large evolution for the brood'));
  await waitFor(() => expect(server.write).toHaveBeenCalledTimes(1));
  expect(lastCall()).toEqual([
    'setGroupPurchases',
    {
      characterId: 'character-1',
      ruleKind: 'broodmasterEidolon',
      purchases: ['large'],
      operationId: expect.any(String),
    },
  ]);
  server.pools = [
    {
      ...broodmaster,
      budget: { ...broodmaster.budget, evolutionPoints: -1 },
      remaining: { ...broodmaster.remaining, evolutionPoints: -3 },
      overBudget: true,
      overBudgetComponents: ['evolutionPoints'],
      groupPurchases: [largeBought],
      capacity: { allowed: 4, used: 2 },
    },
  ];
  view.rerender();
  expect(checkbox('Buy the large evolution for the brood')).toBeChecked();
  const issue = within(brood()).getByText('Requires summoner level 8.');
  expect(issue.parentElement).toHaveClass('text-amber-300');
  expect(within(brood()).getByText('2 of 4 Small-eidolon places')).toHaveClass(
    'text-muted-foreground',
  );
  expect(cells(componentRow(/^evolution points/))).toEqual([
    'Budget-1',
    'Allocated2',
    'Remaining-3',
  ]);
  expect(componentRow(/^evolution points/)).toHaveClass('text-amber-300');
  expect(
    within(brood()).getByText(
      'Allocations exceed the Broodmaster budget for evolution points. Every recorded allocation is kept; change one yourself if needed.',
    ),
  ).toBeVisible();

  fireEvent.click(checkbox('Buy the large evolution for the brood'));
  await waitFor(() => expect(server.write).toHaveBeenCalledTimes(2));
  expect(lastCall()).toEqual([
    'setGroupPurchases',
    expect.objectContaining({ purchases: [] }),
  ]);
});

test('shares above the budget and a brood over its places stay listed and editable beside amber advisories; Clear removes an eidolon’s shares', async () => {
  const skitterShare = { ...bruteShare, hitDice: 2, evolutionPoints: 3 };
  renderBrood({
    ...broodmaster,
    allocated: {
      hitDice: 3,
      skillRanks: 8,
      feats: 2,
      armorBonus: 2,
      strengthBonus: 2,
      dexterityBonus: 0,
      evolutionPoints: 5,
      maxAttacks: 4,
    },
    remaining: {
      hitDice: -1,
      skillRanks: 0,
      feats: -1,
      armorBonus: 0,
      strengthBonus: -1,
      dexterityBonus: 1,
      evolutionPoints: -2,
      maxAttacks: -1,
    },
    overBudget: true,
    overBudgetComponents: [
      'hitDice',
      'feats',
      'strengthBonus',
      'evolutionPoints',
      'maxAttacks',
    ],
    capacity: { allowed: 2, used: 3 },
    members: [
      eidolon('rel-brute', 'Brute', bruteShare),
      eidolon('rel-skitter', 'Skitter', skitterShare),
    ],
  });
  const warning = within(brood()).getByText(
    'Allocations exceed the Broodmaster budget for Hit Dice, feats, Strength bonus, evolution points, maximum natural attacks. Every recorded allocation is kept; change one yourself if needed. The brood fills 3 of its 2 Small-eidolon places; two eidolons of one size count as one of the next size up.',
  );
  expect(warning.parentElement).toHaveClass('text-amber-300');
  expect(within(brood()).getByText('3 allocated')).toHaveClass(
    'text-amber-300',
  );
  expect(within(brood()).getByText('1 over budget')).toBeVisible();
  expect(within(brood()).getByText('3 of 2 Small-eidolon places')).toHaveClass(
    'text-amber-300',
  );
  expect(componentRow(/^Hit Dice/)).toHaveClass('text-amber-300');
  expect(cells(componentRow(/^Hit Dice/))).toEqual([
    'Budget2',
    'Allocated3',
    'Remaining-1',
  ]);
  expect(componentRow(/^skill ranks/)).not.toHaveClass('text-amber-300');
  expect(eidolonRow(/Brute/)).toHaveTextContent('Hit Dice 1, skill ranks 4');
  expect(eidolonRow(/Skitter/)).toHaveTextContent('Hit Dice 2, skill ranks 4');
  expect(button("Edit Brute's Broodmaster share")).toBeEnabled();
  expect(button("Edit Skitter's Broodmaster share")).toBeEnabled();

  fireEvent.click(button("Clear Skitter's Broodmaster share"));
  await waitFor(() => expect(server.write).toHaveBeenCalledTimes(1));
  expect(lastCall()).toEqual(componentsCall('rel-skitter', null));
  await waitFor(() =>
    expect(within(eidolonRow(/Skitter/)).getByRole('status')).toHaveTextContent(
      'Saved',
    ),
  );
});

test('a refused component save keeps all eight drafted shares open with the reason beside them', async () => {
  renderBrood();
  fireEvent.click(button("Edit Skitter's Broodmaster share"));
  fireEvent.change(componentField('Hit Dice'), { target: { value: '2' } });
  fireEvent.change(componentField('feats'), { target: { value: '0' } });
  fireEvent.change(componentField('Strength bonus'), {
    target: { value: '0' },
  });
  server.write.mockRejectedValueOnce(new ConvexError('Not allowed'));
  fireEvent.click(button("Save Skitter's Broodmaster share"));
  await waitFor(() =>
    expect(within(eidolonRow(/Skitter/)).getByRole('alert')).toHaveTextContent(
      "Companion allocation wasn't saved: Not allowed. Try again.",
    ),
  );
  expect(componentEditor('Skitter')).toBeVisible();
  expect(componentField('Hit Dice')).toHaveValue('2');
  expect(componentField('maximum natural attacks')).toHaveValue('1');
  expect(server.write).toHaveBeenCalledTimes(1);
});

test('an unresolved brood budget keeps every share editable; a share kept while not counting says so without a prompt; an inaccessible eidolon reads only as unavailable, with no link, and stays editable', () => {
  server.relationships = [brute, { ...skitter, endpoint: null }];
  server.pools = [
    {
      ...broodmaster,
      classLevels: null,
      budget: null,
      remaining: null,
      capacity: { allowed: 2, used: null },
      members: [
        eidolon('rel-brute', 'Brute', bruteShare, { counting: false }),
        eidolon('rel-skitter', 'Skitter', bruteShare, { companion: null }),
      ],
    },
  ];
  renderSheet();
  expect(within(brood()).getByText('Summoner level unavailable')).toBeVisible();
  expect(within(brood()).getByText('1 allocated')).toBeVisible();
  expect(within(brood()).queryByText(/unallocated|over budget/)).toBeNull();
  expect(within(brood()).getByText('2 Small-eidolon places')).toBeVisible();
  expect(cells(componentRow(/^Hit Dice/))).toEqual([
    'BudgetUnresolved',
    'Allocated1',
    'RemainingUnresolved',
  ]);
  const resting = eidolonRow(/Brute/);
  expect(resting).toHaveTextContent('Hit Dice 1, skill ranks 4');
  expect(
    within(resting).getByText(
      'Not counting while its support or relationship is inactive; its allocation is kept.',
    ),
  ).toBeVisible();
  expect(within(resting).queryByText(/^Allocate/)).toBeNull();
  expect(button("Edit Brute's Broodmaster share")).toBeEnabled();
  expect(button("Clear Brute's Broodmaster share")).toBeEnabled();

  const hidden = eidolonRow(/Character unavailable/);
  expect(within(hidden).queryByRole('link')).toBeNull();
  expect(hidden).toHaveTextContent('Hit Dice 1, skill ranks 4');
  expect(
    within(hidden).getByRole('button', {
      name: "Edit Character unavailable's Broodmaster share",
    }),
  ).toBeEnabled();
  expect(document.body.textContent).not.toContain('Skitter');
  expect(document.body.innerHTML).not.toMatch(/rel-skitter|"skitter"/);
});

test.each([
  { isWide: false, label: 'phone' },
  { isWide: true, label: 'tablet' },
])(
  'on the $label each brood control is named once and touch-sized, and the component and eidolon tables stack as cards below 768px',
  ({ isWide }) => {
    stubViewport(isWide);
    renderBrood();
    for (const name of [
      "Edit Brute's Broodmaster share",
      "Clear Brute's Broodmaster share",
      "Edit Skitter's Broodmaster share",
    ]) {
      expect(screen.getAllByRole('button', { name })).toHaveLength(1);
      expect(button(name)).toHaveClass('min-h-11', 'md:min-h-9');
    }
    expect(
      screen.getAllByRole('checkbox', {
        name: 'Buy the large evolution for the brood',
      }),
    ).toHaveLength(1);
    expect(
      checkbox('Buy the large evolution for the brood').closest('label'),
    ).toHaveClass('min-h-11', 'md:min-h-9');
    expect(components()).toHaveClass('max-md:block');
    expect(componentRow(/^Hit Dice/)).toHaveClass(
      'max-md:flex',
      'max-md:border',
    );
    expect(table('Broodmaster')).toHaveClass('max-md:block');
    expect(eidolonRow(/Brute/)).toHaveClass('max-md:block', 'max-md:border');
    fireEvent.click(button("Edit Skitter's Broodmaster share"));
    expect(componentField('Hit Dice')).toHaveClass('h-11', 'md:h-8');
    expect(button("Save Skitter's Broodmaster share")).toHaveClass('min-h-11');
  },
);
