import { calculateFixtureSheet as calculateCharacterSheet } from './character-sheet-test-fixture';
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
import { beforeEach, expect, test, vi } from 'vitest';
import type { Id } from '@convex/_generated/dataModel';
import type { MigrationMaintenance } from '~/components/use-initial-migration-maintenance';
import {
  abilityKeys,
  abilityTargets,
  defaultAbilityScores,
  defaultCreationSettings,
  type AbilityScores,
  type CreationSettings,
  type SheetWarning,
} from '~/lib/character-sheet';
import { CharacterSheetBlocks } from './character-sheet-blocks-test-fixture';
import type { CharacterSheetSnapshot } from './use-character-sheet';
import { characterSheetNames } from './character-sheet-api-test-fixture';
import type { FunctionReference } from 'convex/server';

// Creation settings and inline warnings (#262): how the Character was made,
// and the sheet's advisory warnings beside what they are about, accepted
// without a reason by anyone who can edit.

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
    loadMore: () => undefined,
  }),
  useMutation: (mutation: FunctionReference<'mutation'>) => {
    const name = nameOf(mutation);
    return (args: Record<string, unknown>) =>
      new Promise((resolve, reject) => {
        calls.push({ name, args, resolve, reject });
      });
  },
}));
vi.mock('~/components/campaign-shell/navigation-guard', () => ({
  GuardedLink: ({
    href,
    children,
    ...props
  }: ComponentProps<'a'> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
  useNavigationGuard: () => ({
    navigate: vi.fn(),
    requestDeparture: vi.fn(),
    hasPendingWork: () => false,
  }),
}));

const characterId = 'character-1' as Id<'character'>;
const baseEntryId = 'base-entry' as Id<'characterSheetEntry'>;
type Level = { id: string; hp: number | null };
type Entry = CharacterSheetSnapshot['entries'][number];
type Accepted = Pick<SheetWarning, 'check' | 'subject' | 'fingerprint'>;

const fourteens = Object.fromEntries(
  abilityKeys.map((ability) => [ability, 14]),
) as AbilityScores;

function sheet({
  scores = defaultAbilityScores,
  levels = [{ id: 'level-1', hp: null }],
  settings = defaultCreationSettings,
  accepted = [],
  lastOperationId = 'seed',
}: {
  scores?: AbilityScores;
  levels?: Level[];
  settings?: Partial<CreationSettings>;
  accepted?: Accepted[];
  lastOperationId?: string;
} = {}): CharacterSheetSnapshot {
  const catalogEntry: CharacterSheetSnapshot['baseScoresEntry'] = {
    _id: 'base-catalogEntry' as Id<'catalogEntry'>,
    _creationTime: 1,
    scope: 'character',
    characterId,
    name: 'Base scores',
    ruleIdentity: 'base',
    stacksWithItself: false,
    detail: { kind: 'base' },
    sources: [],
    modifiers: abilityKeys.map((ability) => ({
      target: abilityTargets[ability],
      bonusType: 'base' as const,
      value: scores[ability],
    })),
  };
  const entries: Entry[] = [
    {
      _id: baseEntryId,
      _creationTime: 1,
      kind: 'base',
      active: true,
      catalogEntryId: catalogEntry._id,
      state: { kind: 'base', ...defaultCreationSettings, ...settings },
    } as Entry,
    ...levels.map(
      (level, index) =>
        ({
          _id: level.id as Id<'characterSheetEntry'>,
          _creationTime: 2 + index,
          kind: 'classLevel',
          active: true,
          state: {
            kind: 'classLevel',
            classEntryId: null,
            position: index + 1,
            hpGained: level.hp,
          },
        }) as Entry,
    ),
  ];
  return {
    familiarRelationshipId: null,
    companionCalculationInputs: null,
    campaign: {
      campaignId: 'campaign-1' as Id<'campaign'>,
      campaignName: 'Campaign',
      ownershipAvailable: true,
      organizationId: 'org',
    },
    owner: null,
    character: {
      _id: characterId,
      _creationTime: 1,
      campaignId: 'campaign-1' as Id<'campaign'>,
      name: 'Kesh',
      description: '',
      ownerId: 'owner',
      kind: 'pc',
      isActive: true,
      sheetMode: 'full',
      level: 1,
      ...defaultAbilityScores,
    },
    entries,
    catalogEntries: [catalogEntry],
    baseScoresEntry: catalogEntry,
    calculated: calculateCharacterSheet({
      characterKind: 'pc',
      entries,
      catalogEntries: [catalogEntry],
    }),
    permanentCalculated: calculateCharacterSheet(
      {
        characterKind: 'pc',
        entries,
        catalogEntries: [catalogEntry],
      },
      { permanentOnly: true },
    ),
    acceptedWarnings: accepted.map((warning, index) => ({
      _id: `accepted-${index}` as Id<'acceptedWarning'>,
      characterId,
      _creationTime: 10 + index,
      acceptedBy: 'other-player',
      acceptedAt: 10 + index,
      ...warning,
    })),
    revision: 1,
    lastOperationId,
    updatedBy: 'owner',
  };
}

/** The calculated warning for one check, to accept it as the sheet states it. */
function calculatedWarning(snapshot: CharacterSheetSnapshot, check: string) {
  const warning = snapshot.calculated.warnings.find(
    (candidate) => candidate.check === check,
  );
  if (!warning) throw new Error(`Expected a ${check} warning`);
  return warning;
}

const page = () => (
  <CharacterSheetBlocks blocks={['scores', 'levels', 'settings', 'summary']} />
);
function renderSheet(initial: CharacterSheetSnapshot) {
  snapshot = initial;
  const view = render(page());
  return {
    ...view,
    show(next: CharacterSheetSnapshot) {
      snapshot = next;
      view.rerender(page());
    },
  };
}
function row(name: string) {
  return screen.getByRole('listitem', { name });
}
function scoresRegion() {
  return screen.getByRole('region', { name: 'Ability scores' });
}
function levelsRegion() {
  return screen.getByRole('region', { name: 'Class Levels' });
}
function settingsRegion() {
  return screen.getByRole('region', { name: 'Creation settings' });
}
function setting(name: string) {
  return within(settingsRegion()).getByRole('textbox', { name });
}
function method(name: string) {
  return within(settingsRegion()).getByRole('radio', { name });
}
function campaignTrait() {
  return within(settingsRegion()).getByRole('checkbox', {
    name: 'Campaign trait required',
  });
}
function saveSettings() {
  fireEvent.click(
    screen.getByRole('button', { name: /Save creation settings|Saving…/ }),
  );
}
function hpSummary() {
  return screen.getByText('HP', { selector: 'dt' }).nextElementSibling;
}
function classPicker(level: number) {
  return within(row(`Level ${level}`)).getByRole('combobox', {
    name: `Class at level ${level}`,
  });
}
const noReasonAsked = () => {
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(
    screen.queryByRole('textbox', { name: /reason|why/i }),
  ).not.toBeInTheDocument();
};
function lastCall() {
  const call = calls.at(-1);
  if (!call) throw new Error('Expected a write');
  return call;
}
const operationOf = (call: Call) => String(call.args.operationId);

beforeEach(() => {
  calls = [];
  maintenance.mockReturnValue({ kind: 'ready', readOnly: false, message: '' });
  snapshot = undefined;
  Element.prototype.scrollIntoView = vi.fn();
});

test('a new sheet shows the creation defaults and its point counter; the choices it still needs are blue, unresolved HP is explained, and nothing offers Accept', () => {
  renderSheet(sheet());
  expect(method('Point buy')).toBeChecked();
  expect(method('Rolled')).not.toBeChecked();
  expect(setting('Point-buy budget')).toHaveValue('15');
  expect(setting('Trait count')).toHaveValue('2');
  expect(campaignTrait()).not.toBeChecked();
  expect(within(scoresRegion()).getByText('0 / 15 points')).toBeVisible();
  // Incomplete choices and the unresolved result are not decisions.
  expect(within(row('Level 1')).getByText('Choose a class.')).toHaveClass(
    'text-sky-300',
  );
  expect(
    within(row('Level 1')).getByText('Enter hit points gained.'),
  ).toHaveClass('text-sky-300');
  expect(classPicker(1)).toHaveClass('ring-sky-400/80');
  expect(hpSummary()).toHaveTextContent('not complete');
  expect(
    screen.getByText('Hit points need the HP gained at every Class Level.'),
  ).toHaveClass('text-muted-foreground');
  expect(
    screen.queryByRole('button', { name: /Accept|Reopen/ }),
  ).not.toBeInTheDocument();
  // Scores, budget and traits are never outlined as missing choices.
  for (const input of [
    ...within(scoresRegion()).getAllByRole('textbox'),
    setting('Point-buy budget'),
    setting('Trait count'),
  ]) {
    expect(input).not.toHaveClass('ring-sky-400/80');
  }
  expect(calls).toEqual([]);
});

test('Rolled hides and retains the budget; Point buy brings it back', async () => {
  const view = renderSheet(sheet());
  fireEvent.click(method('Rolled'));
  expect(method('Rolled')).toBeChecked();
  expect(
    within(settingsRegion()).queryByRole('textbox', {
      name: 'Point-buy budget',
    }),
  ).not.toBeInTheDocument();
  saveSettings();
  await waitFor(() => expect(calls).toHaveLength(1));
  expect(lastCall().name).toBe('settings');
  expect(lastCall().args.settings).toEqual({
    abilityMethod: { kind: 'rolled', budget: 15 },
  });
  view.show(
    sheet({
      settings: { abilityMethod: { kind: 'rolled', budget: 15 } },
      lastOperationId: operationOf(lastCall()),
    }),
  );
  await act(async () => {
    lastCall().resolve(null);
  });
  expect(
    within(settingsRegion()).getByText('Creation settings saved.'),
  ).toBeVisible();
  expect(within(scoresRegion()).queryByText(/points/)).not.toBeInTheDocument();
  fireEvent.click(method('Point buy'));
  expect(setting('Point-buy budget')).toHaveValue('15');
});

test('an empty budget is told from a malformed trait count, in place, and neither is saved', async () => {
  renderSheet(sheet());
  fireEvent.change(setting('Point-buy budget'), { target: { value: '' } });
  fireEvent.change(setting('Trait count'), { target: { value: 'two' } });
  saveSettings();
  const alerts = await within(settingsRegion()).findAllByRole('alert');
  expect(alerts.map((alert) => alert.textContent)).toEqual([
    'Point-buy budget is required',
    'Trait count must be a number',
  ]);
  expect(setting('Point-buy budget')).toHaveAttribute('aria-invalid', 'true');
  expect(setting('Trait count')).toHaveValue('two');
  expect(
    screen.getByRole('form', { name: 'Creation settings' }),
  ).toHaveAttribute('novalidate');
  expect(calls).toEqual([]);
});

test('negative and fractional budgets and trait counts keep their drafts beside styled field errors and are not saved', async () => {
  renderSheet(sheet());
  for (const [budget, traitCount] of [
    ['-1', '1.5'],
    ['1.5', '-1'],
  ]) {
    fireEvent.change(setting('Point-buy budget'), {
      target: { value: budget },
    });
    fireEvent.change(setting('Trait count'), {
      target: { value: traitCount },
    });
    await act(async () => saveSettings());
    const alerts = await within(settingsRegion()).findAllByRole('alert');
    expect(alerts.map((alert) => alert.textContent)).toEqual([
      'Point-buy budget must be a whole number of 0 or more',
      'Trait count must be a whole number of 0 or more',
    ]);
    for (const alert of alerts) {
      expect(alert).toBeVisible();
      expect(alert).toHaveClass('text-destructive', 'border-destructive/60');
    }
    expect(setting('Point-buy budget')).toHaveAccessibleDescription(
      'Point-buy budget must be a whole number of 0 or more',
    );
    expect(setting('Trait count')).toHaveAccessibleDescription(
      'Trait count must be a whole number of 0 or more',
    );
    expect(setting('Point-buy budget')).toHaveValue(budget);
    expect(setting('Trait count')).toHaveValue(traitCount);
    expect(calls).toEqual([]);
  }
});

test('unusual settings still save: a 40-point budget, no traits and a required campaign trait', async () => {
  const view = renderSheet(sheet());
  fireEvent.change(setting('Point-buy budget'), { target: { value: '40' } });
  fireEvent.change(setting('Trait count'), { target: { value: '0' } });
  fireEvent.click(campaignTrait());
  saveSettings();
  await waitFor(() => expect(calls).toHaveLength(1));
  expect(lastCall().args.settings).toEqual({
    abilityMethod: { kind: 'pointBuy', budget: 40 },
    traitCount: 0,
    campaignTraitRequired: true,
  });
  const saved: CreationSettings = {
    abilityMethod: { kind: 'pointBuy', budget: 40 },
    traitCount: 0,
    campaignTraitRequired: true,
  };
  view.show(
    sheet({ settings: saved, lastOperationId: operationOf(lastCall()) }),
  );
  await act(async () => {
    lastCall().resolve(null);
  });
  expect(
    within(settingsRegion()).getByText('Creation settings saved.'),
  ).toBeVisible();
  expect(within(scoresRegion()).getByText('0 / 40 points')).toBeVisible();
  expect(within(settingsRegion()).queryByRole('alert')).not.toBeInTheDocument();
});

test("a refused settings save keeps the draft beside its own error; another player's change refreshes untouched fields and is acknowledged there", async () => {
  const view = renderSheet(sheet());
  fireEvent.change(setting('Point-buy budget'), { target: { value: '20' } });
  saveSettings();
  await waitFor(() => expect(calls).toHaveLength(1));
  await act(async () => {
    lastCall().reject(new ConvexError('Editing is paused'));
  });
  expect(await within(settingsRegion()).findByRole('alert')).toHaveTextContent(
    "Changes weren't saved: Editing is paused. Your edits are kept. Save to try again.",
  );
  expect(setting('Point-buy budget')).toHaveValue('20');
  expect(screen.queryByText(/Warnings updated/)).not.toBeInTheDocument();
  view.show(sheet({ settings: { traitCount: 3 }, lastOperationId: 'other' }));
  expect(setting('Trait count')).toHaveValue('3');
  expect(setting('Point-buy budget')).toHaveValue('20');
  const notice = within(settingsRegion()).getByText(
    'Updated by another player. Your edits are kept.',
  );
  expect(notice).toBeVisible();
  fireEvent.click(
    screen.getByRole('button', { name: 'Dismiss creation settings update' }),
  );
  expect(notice).not.toBeInTheDocument();
});

test('scores over budget warn beside the counter with Accept; accepting asks no reason, collapses to Accepted with Reopen, and Reopen undoes it', async () => {
  const over = sheet({ scores: fourteens });
  const view = renderSheet(over);
  const message = 'Base scores cost 30 points, above the 15-point budget.';
  expect(within(scoresRegion()).getByText('30 / 15 points')).toHaveClass(
    'text-amber-300',
  );
  const accept = within(scoresRegion()).getByRole('button', {
    name: 'Accept',
    description: message,
  });
  fireEvent.click(accept);
  await waitFor(() => expect(calls).toHaveLength(1));
  const warning = calculatedWarning(over, 'pointBuy');
  expect(lastCall().name).toBe('accept');
  expect(lastCall().args).toMatchObject({
    check: 'pointBuy',
    subject: baseEntryId,
    fingerprint: warning.fingerprint,
  });
  noReasonAsked();
  expect(accept).toBeDisabled();
  view.show(
    sheet({
      scores: fourteens,
      accepted: [warning],
      lastOperationId: operationOf(lastCall()),
    }),
  );
  await act(async () => {
    lastCall().resolve(null);
  });
  expect(within(scoresRegion()).getByText('Accepted')).toHaveClass(
    'text-muted-foreground',
  );
  expect(within(scoresRegion()).getByText(message)).toHaveClass('sr-only');
  expect(within(scoresRegion()).getByText('30 / 15 points')).toHaveClass(
    'text-muted-foreground',
  );
  expect(within(scoresRegion()).getByText('Warning accepted.')).toHaveAttribute(
    'role',
    'status',
  );
  // Own acceptance is not another player's.
  expect(screen.queryByText(/Warnings updated/)).not.toBeInTheDocument();
  noReasonAsked();
  fireEvent.click(
    within(scoresRegion()).getByRole('button', {
      name: 'Reopen',
      description: message,
    }),
  );
  await waitFor(() => expect(calls).toHaveLength(2));
  expect(lastCall().name).toBe('reopen');
  expect(lastCall().args).toMatchObject({
    check: 'pointBuy',
    subject: baseEntryId,
  });
  expect(lastCall().args).not.toHaveProperty('fingerprint');
  view.show(
    sheet({ scores: fourteens, lastOperationId: operationOf(lastCall()) }),
  );
  await act(async () => {
    lastCall().resolve(null);
  });
  expect(
    within(scoresRegion()).getByRole('button', { name: 'Accept' }),
  ).toBeEnabled();
  expect(
    within(scoresRegion()).queryByText('Accepted'),
  ).not.toBeInTheDocument();
});

test('a refused acceptance is reported beside the warning, which stays open to try again', async () => {
  renderSheet(sheet({ scores: fourteens }));
  fireEvent.click(
    within(scoresRegion()).getByRole('button', { name: 'Accept' }),
  );
  await waitFor(() => expect(calls).toHaveLength(1));
  await act(async () => {
    lastCall().reject(new ConvexError('Editing is paused'));
  });
  expect(await within(scoresRegion()).findByRole('alert')).toHaveTextContent(
    "Warning wasn't saved: Editing is paused. Try again.",
  );
  const accept = within(scoresRegion()).getByRole('button', { name: 'Accept' });
  expect(accept).toBeEnabled();
  fireEvent.click(accept);
  await waitFor(() => expect(calls).toHaveLength(2));
});

test('changing the scores reopens an accepted point-buy warning while an unrelated edit leaves it accepted', () => {
  const over = sheet({ scores: fourteens });
  const warning = calculatedWarning(over, 'pointBuy');
  const view = renderSheet(
    sheet({ scores: fourteens, accepted: [warning], lastOperationId: 'seed' }),
  );
  expect(within(scoresRegion()).getByText('Accepted')).toBeVisible();
  view.show(
    sheet({
      scores: fourteens,
      levels: [{ id: 'level-1', hp: 7 }],
      accepted: [warning],
    }),
  );
  expect(within(scoresRegion()).getByText('Accepted')).toBeVisible();
  view.show(
    sheet({
      scores: { ...fourteens, strength: 15 },
      levels: [{ id: 'level-1', hp: 7 }],
      accepted: [warning],
    }),
  );
  expect(
    within(scoresRegion()).queryByText('Accepted'),
  ).not.toBeInTheDocument();
  expect(
    within(scoresRegion()).getByRole('button', {
      name: 'Accept',
      description: 'Base scores cost 32 points, above the 15-point budget.',
    }),
  ).toBeEnabled();
});

test('whole scores outside 7 to 18 leave the cost unresolved, which is said at the counter and warned with Accept', () => {
  renderSheet(sheet({ scores: { ...defaultAbilityScores, strength: 20 } }));
  expect(
    within(scoresRegion()).getByText('Point-buy cost unresolved.'),
  ).toBeVisible();
  expect(
    within(scoresRegion()).getByRole('button', {
      name: 'Accept',
      description: 'Point buy uses whole base scores from 7 to 18.',
    }),
  ).toBeEnabled();
});

test("another player's acceptance is announced once for the sheet and dismissed there", () => {
  const over = sheet({ scores: fourteens });
  const view = renderSheet(over);
  view.show(
    sheet({
      scores: fourteens,
      accepted: [calculatedWarning(over, 'pointBuy')],
      lastOperationId: 'other-device',
    }),
  );
  const notice = screen.getByText('Warnings updated by another player.');
  expect(notice).toBeVisible();
  expect(screen.getAllByText(/updated by another player/i)).toHaveLength(1);
  fireEvent.click(
    screen.getByRole('button', { name: 'Dismiss warnings update' }),
  );
  expect(notice).not.toBeInTheDocument();
});

test('hit points below 1 warn in their row with Accept; accepting changes no number, fills no missing choice and leaves HP unresolved', async () => {
  const initial = sheet({
    levels: [
      { id: 'a', hp: 0 },
      { id: 'b', hp: null },
    ],
  });
  const view = renderSheet(initial);
  const first = within(row('Level 1'));
  const second = within(row('Level 2'));
  const message = 'Hit points gained are below 1.';
  expect(first.getByText(message).parentElement).toHaveClass('text-amber-300');
  expect(second.getByText('Enter hit points gained.')).toBeVisible();
  expect(
    second.queryByRole('button', { name: 'Accept' }),
  ).not.toBeInTheDocument();
  fireEvent.click(
    first.getByRole('button', { name: 'Accept', description: message }),
  );
  await waitFor(() => expect(calls).toHaveLength(1));
  const warning = calculatedWarning(initial, 'hpGainedBelowMinimum');
  expect(lastCall().args).toMatchObject({
    check: 'hpGainedBelowMinimum',
    subject: 'a',
    fingerprint: warning.fingerprint,
  });
  view.show(
    sheet({
      levels: [
        { id: 'a', hp: 0 },
        { id: 'b', hp: null },
      ],
      accepted: [warning],
      lastOperationId: operationOf(lastCall()),
    }),
  );
  await act(async () => {
    lastCall().resolve(null);
  });
  expect(first.getByText('Accepted')).toBeVisible();
  expect(first.getByRole('button', { name: 'Reopen' })).toBeEnabled();
  expect(
    first.getByRole('textbox', { name: /^Hit points gained/ }),
  ).toHaveValue('0');
  expect(hpSummary()).toHaveTextContent('not complete');
  expect(
    screen.getByText('Hit points need the HP gained at every Class Level.'),
  ).toBeVisible();
  for (const level of [1, 2]) {
    expect(classPicker(level)).toHaveClass('ring-sky-400/80');
    expect(
      within(row(`Level ${level}`)).getByText('Choose a class.'),
    ).toBeVisible();
  }
  expect(second.getByText('Enter hit points gained.')).toBeVisible();
  expect(
    screen.queryByRole('button', { name: /Accept|Reopen/ }),
  ).toHaveTextContent('Reopen');
});

test('a PC without Class Levels shows the rule once beside Level up, with Accept and no second advisory', () => {
  renderSheet(sheet({ levels: [] }));
  const levels = within(levelsRegion());
  expect(
    levels.getByText('A PC has no Class Levels.').parentElement,
  ).toHaveClass('text-amber-300');
  expect(
    levels.getByRole('button', {
      name: 'Accept',
      description: 'A PC has no Class Levels.',
    }),
  ).toBeEnabled();
  expect(screen.queryByText(/This PC has no/)).not.toBeInTheDocument();
  expect(levels.queryByRole('listitem')).not.toBeInTheDocument();
  expect(levels.getByRole('button', { name: 'Level up' })).toBeEnabled();
});

test('maintenance disables the creation settings and every warning action with a nearby reason, and writes nothing', async () => {
  const message = 'Editing is paused for maintenance.';
  maintenance.mockReturnValue({ kind: 'maintenance', readOnly: true, message });
  renderSheet(sheet({ scores: fourteens, levels: [{ id: 'a', hp: 0 }] }));
  for (const control of [
    method('Point buy'),
    method('Rolled'),
    setting('Point-buy budget'),
    setting('Trait count'),
    campaignTrait(),
    screen.getByRole('button', { name: 'Save creation settings' }),
  ]) {
    expect(control).toBeDisabled();
  }
  expect(within(settingsRegion()).getByText(message)).toBeVisible();
  const accepts = screen.getAllByRole('button', { name: 'Accept' });
  expect(accepts).toHaveLength(2);
  for (const accept of accepts) {
    expect(accept).toBeDisabled();
    expect(accept).toHaveAccessibleDescription(
      new RegExp(`${message.replace('.', '\\.')}$`),
    );
    fireEvent.click(accept);
  }
  expect(within(levelsRegion()).getAllByText(message)).toHaveLength(1);
  await act(async () => {
    fireEvent.submit(screen.getByRole('form', { name: 'Creation settings' }));
  });
  expect(calls).toEqual([]);
});
